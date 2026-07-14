from typing import Any, Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.datastore import store
from app.transform import (
    clean,
    first_existing,
    split_list,
    protein_key,
    complex_key,
    protein_node,
    edge,
)
from app.normalizers.evidence import extract_evidence_input, normalize_evidence
from app.normalizers.protein import normalize_protein_node
from app.schemas.visualization import (
    LegendItem,
    NetworkLegend,
    NetworkResponse,
    NetworkStats,
    PaginationInfo,
    VizEdge,
    VizNode,
)


router = APIRouter()


def _protein_raw_for_normalizer(uniprot_ac: str, row: dict[str, Any]) -> dict[str, Any]:
    """
    Build a normalizer-friendly protein row while preserving the original raw row.

    The existing local TSV sources use slightly different field names:
    - gene_symbol / gene / ext_gene_name / gene_name
    - protein_category / category
    - protein_name / name / recommended_name

    normalize_protein_node expects stable aliases such as uniprot_id,
    gene_name, protein_name, and protein_category.
    """

    raw = dict(row)
    raw["uniprot_id"] = uniprot_ac
    raw["id"] = uniprot_ac
    raw["gene_name"] = first_existing(
        row,
        ["gene_name", "gene_symbol", "gene", "ext_gene_name"],
    )
    raw["protein_name"] = first_existing(
        row,
        ["protein_name", "name", "recommended_name"],
    )
    raw["protein_category"] = first_existing(
        row,
        ["protein_category", "category"],
    )
    return raw


def _fallback_protein_raw(uniprot_ac: str) -> dict[str, Any]:
    return {
        "id": uniprot_ac,
        "uniprot_id": uniprot_ac,
        "gene_name": uniprot_ac,
        "protein_name": "",
        "protein_category": "Unknown",
    }


def _protein_neighborhood_legend() -> NetworkLegend:
    return NetworkLegend(
        nodeCategories=[
            LegendItem(
                key="center",
                label="Center protein",
                description="The queried protein at the center of the neighborhood.",
            ),
            LegendItem(
                key="TF",
                label="TF",
                description="Transcription factor protein.",
            ),
            LegendItem(
                key="EF",
                label="EF",
                description="Epigenetic factor protein.",
            ),
            LegendItem(
                key="TF_and_EF",
                label="TF and EF",
                description="Protein annotated as both TF and EF.",
            ),
            LegendItem(
                key="Unknown",
                label="Unknown",
                description="Protein category is unavailable or unknown.",
            ),
        ],
        edgeEvidence=[
            LegendItem(
                key="protein_physical_interaction",
                label="Direct PPI",
                description="Direct protein-protein interaction.",
            ),
        ],
        badges=[
            LegendItem(
                key="DDI",
                label="DDI",
                description="Domain-domain interaction evidence exists.",
            ),
            LegendItem(
                key="DMI",
                label="DMI",
                description="Domain-motif interaction evidence exists.",
            ),
            LegendItem(
                key="PDB",
                label="PDB",
                description="Supporting structural evidence exists.",
            ),
        ],
    )


def _make_protein_network_stats(nodes: list[VizNode], edges: list[VizEdge]) -> NetworkStats:
    return NetworkStats(
        nodeCount=len(nodes),
        edgeCount=len(edges),
        proteinNodeCount=sum(1 for node in nodes if node.type == "protein"),
        complexNodeCount=sum(1 for node in nodes if node.type == "complex"),
        tfCount=sum(1 for node in nodes if node.proteinCategory == "TF"),
        efCount=sum(1 for node in nodes if node.proteinCategory == "EF"),
        tfAndEfCount=sum(1 for node in nodes if node.proteinCategory == "TF_and_EF"),
        unknownCategoryCount=sum(
            1 for node in nodes if node.proteinCategory == "Unknown"
        ),
        ddiSupportedEdgeCount=sum(1 for edge in edges if edge.hasDDI),
        dmiSupportedEdgeCount=sum(1 for edge in edges if edge.hasDMI),
        structuralEvidenceEdgeCount=sum(
            1 for edge in edges if edge.hasStructuralEvidence
        ),
        confirmedPpiEdgeCount=sum(1 for edge in edges if edge.isConfirmedPpi),
        coComplexOnlyEdgeCount=sum(1 for edge in edges if edge.isCoComplexOnly),
    )



def _matches_optional_bool(value: bool, expected: Optional[bool]) -> bool:
    if expected is None:
        return True

    return value is expected


def _normalize_filter_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    text = value.strip()

    if not text:
        return None

    return text.lower()


def _edge_matches_source(edge: VizEdge, source_filter: Optional[str]) -> bool:
    normalized = _normalize_filter_text(source_filter)

    if normalized is None:
        return True

    return any(normalized in source.lower() for source in edge.evidenceSources)


def _node_matches_category(node: VizNode, category_filter: Optional[str]) -> bool:
    normalized = _normalize_filter_text(category_filter)

    if normalized is None:
        return True

    return node.proteinCategory.lower() == normalized


def _protein_edge_passes_filters(
    *,
    edge: VizEdge,
    other_node: VizNode,
    source: Optional[str],
    protein_category: Optional[str],
    has_ddi: Optional[bool],
    has_dmi: Optional[bool],
    has_pdb: Optional[bool],
) -> bool:
    if not _edge_matches_source(edge, source):
        return False

    if not _node_matches_category(other_node, protein_category):
        return False

    if not _matches_optional_bool(edge.hasDDI, has_ddi):
        return False

    if not _matches_optional_bool(edge.hasDMI, has_dmi):
        return False

    if not _matches_optional_bool(edge.hasStructuralEvidence, has_pdb):
        return False

    return True


def _make_protein_neighbor_edge(
    *,
    row: dict[str, Any],
    source_id: str,
    target_id: str,
) -> VizEdge:
    evidence = normalize_evidence(
        extract_evidence_input(row),
        is_confirmed_ppi=True,
        is_co_complex_only=False,
    )

    return VizEdge(
        id=f"DIRECT_PPI|{source_id}|{target_id}",
        source=source_id,
        target=target_id,
        type="ppi",
        relationKind="protein_physical_interaction",
        label="PPI",
        raw=dict(row),
        **evidence,
    )


@router.get("/protein/{uniprot_ac}")
def get_protein(uniprot_ac: str):
    row = find_protein_row(uniprot_ac)

    if row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有找到该蛋白。",
                "uniprotAc": uniprot_ac,
            },
        )

    member_complexes = find_member_complexes(uniprot_ac)
    external_complexes = find_external_complexes(uniprot_ac)

    normalized_protein = normalize_protein_node(
        _protein_raw_for_normalizer(uniprot_ac, row)
    )

    gene_symbol = first_existing(row, ["gene_symbol", "gene", "ext_gene_name", "gene_name"])
    protein_name = first_existing(row, ["protein_name", "name", "recommended_name"])
    summary = {
        "uniprotAc": uniprot_ac,
        "geneSymbol": gene_symbol,
        "proteinName": protein_name,
        "proteinCategory": first_existing(row, ["protein_category", "category"]),
        "ensemblId": first_existing(row, ["ensembl_id", "ensembl"]),
        "hgncId": first_existing(row, ["hgnc_id", "hgnc"]),
        "sequenceLength": first_existing(row, ["sequence_length", "length"]),
    }

    return {
        "id": uniprot_ac,
        "key": protein_key(uniprot_ac),
        "type": "protein",
        "label": gene_symbol if gene_symbol != "暂无数据" else uniprot_ac,
        "summary": summary,
        "hpaProfile": normalized_protein.hpaProfile.model_dump()
        if normalized_protein.hpaProfile
        else None,
        "raw": normalized_protein.raw,
        "sections": [
            {
                "id": "member_complexes",
                "title": "作为亚基所属复合物",
                "count": len(member_complexes),
                "items": member_complexes,
            },
            {
                "id": "external_complexes",
                "title": "作为外部伙伴连接的复合物",
                "count": len(external_complexes),
                "items": external_complexes[:100],
                "truncated": len(external_complexes) > 100,
            },
            {
                "id": "hpa",
                "title": "HPA 表达画像",
                "items": hpa_items(row),
            },
            {
                "id": "raw",
                "title": "原始属性",
                "items": [
                    {
                        "label": key,
                        "value": clean(value),
                    }
                    for key, value in row.items()
                ],
            },
        ],
    }


@router.get("/protein/{uniprot_ac}/neighbors")
def get_protein_neighbors(
    uniprot_ac: str,
    limit: int = Query(default=100, ge=1, le=300),
    source: Optional[str] = None,
    protein_category: Optional[str] = None,
    has_ddi: Optional[bool] = None,
    has_dmi: Optional[bool] = None,
    has_pdb: Optional[bool] = None,
):
    center_row = find_protein_row(uniprot_ac)

    if center_row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有找到该蛋白。",
                "uniprotAc": uniprot_ac,
            },
        )

    if uniprot_ac not in store.ppi_protein_by_uniprot:
        return JSONResponse(
            status_code=404,
            content={
                "message": "该蛋白存在，但未被 ppi_unit_graph 收录，无法展示直接 PPI 网络。",
                "uniprotAc": uniprot_ac,
            },
        )

    df = store.ppi_edges
    source_col, target_col = detect_ppi_pair_cols(df)

    sub = df[
        (df[source_col].astype(str) == uniprot_ac)
        | (df[target_col].astype(str) == uniprot_ac)
    ]

    center_node = normalize_protein_node(
        _protein_raw_for_normalizer(uniprot_ac, center_row),
        is_center=True,
    )

    nodes_by_id: dict[str, VizNode] = {
        center_node.id: center_node,
    }
    viz_edges: list[VizEdge] = []
    matched_count = 0

    for _, raw_row in sub.iterrows():
        row = raw_row.to_dict()

        protein_a = clean(row.get(source_col))
        protein_b = clean(row.get(target_col))

        if protein_a == "暂无数据" or protein_b == "暂无数据":
            continue

        other = protein_b if protein_a == uniprot_ac else protein_a
        other_row = find_protein_row(other) or _fallback_protein_raw(other)

        other_node = normalize_protein_node(
            _protein_raw_for_normalizer(other, other_row),
            is_center=False,
        )

        viz_edge = _make_protein_neighbor_edge(
            row=row,
            source_id=protein_a,
            target_id=protein_b,
        )

        if not _protein_edge_passes_filters(
            edge=viz_edge,
            other_node=other_node,
            source=source,
            protein_category=protein_category,
            has_ddi=has_ddi,
            has_dmi=has_dmi,
            has_pdb=has_pdb,
        ):
            continue

        matched_count += 1

        if len(viz_edges) >= limit:
            continue

        nodes_by_id[other_node.id] = other_node
        viz_edges.append(viz_edge)

    viz_nodes = list(nodes_by_id.values())
    total = matched_count

    response = NetworkResponse(
        graphType="protein_neighborhood",
        center=center_node,
        nodes=viz_nodes,
        edges=viz_edges,
        stats=_make_protein_network_stats(viz_nodes, viz_edges),
        legend=_protein_neighborhood_legend(),
        pagination=PaginationInfo(
            limit=limit,
            offset=0,
            total=total,
            hasMore=len(viz_edges) < total,
        ),
        filters={
            "limit": limit,
            "source": source,
            "protein_category": protein_category,
            "has_ddi": has_ddi,
            "has_dmi": has_dmi,
            "has_pdb": has_pdb,
        },
        warnings=[
            "This endpoint now returns the standard NetworkResponse model. Frontend code should use normalized node and edge fields instead of raw Cytoscape element data."
        ],
    )

    return response.model_dump(mode="json")

def find_protein_row(uniprot_ac: str):
    return (
        store.ppi_protein_by_uniprot.get(uniprot_ac)
        or store.intra_protein_by_uniprot.get(uniprot_ac)
        or store.ext_protein_by_uniprot.get(uniprot_ac)
    )


def find_member_complexes(uniprot_ac: str):
    """
    查这个蛋白作为亚基属于哪些复合物。
    主要从 complex_nodes.tsv 里的 subunit_ids 字段找。
    """
    items = []
    seen = set()

    complex_tables = [
        store.ext_complex_nodes,
        store.intra_complex_nodes,
    ]

    for df in complex_tables:
        for _, row in df.iterrows():
            row = row.to_dict()

            complex_id = first_existing(row, ["id", "complex_id", "corum_id"])
            if complex_id == "暂无数据":
                continue

            if complex_id in seen:
                continue

            subunit_ids = split_list(
                first_existing(
                    row,
                    ["subunit_ids", "subunit_uniprot_ids", "subunits"],
                )
            )

            if uniprot_ac not in subunit_ids:
                continue

            seen.add(complex_id)

            items.append(
                {
                    "id": complex_id,
                    "key": complex_key(complex_id),
                    "label": first_existing(row, ["name", "complex_name"]),
                    "nSubunits": first_existing(row, ["n_subunits", "subunit_count"]),
                }
            )

    return items


def find_external_complexes(uniprot_ac: str):
    """
    查这个蛋白作为外部伙伴连接了哪些复合物。
    来自 complex_ext_ppi_graph/ext_edges.tsv。
    """
    df = store.ext_edges

    target_col = detect_ext_target_col(df)
    complex_col = detect_ext_complex_col(df)

    sub = df[df[target_col].astype(str) == uniprot_ac]

    items = []
    seen = set()

    for _, row in sub.iterrows():
        row = row.to_dict()

        complex_id = clean(row.get(complex_col))
        if complex_id == "暂无数据":
            continue

        if complex_id in seen:
            continue

        seen.add(complex_id)

        complex_name = first_existing(row, ["complex_name", "source_name"])

        items.append(
            {
                "id": complex_id,
                "key": complex_key(complex_id),
                "label": complex_name,
                "mediatingSubunitIds": split_list(
                    first_existing(row, ["mediating_subunit_ids", "mediating_ids"])
                ),
                "mediatingSubunitGenes": split_list(
                    first_existing(row, ["mediating_subunit_genes", "mediating_genes"])
                ),
                "nMediatingSubunits": first_existing(
                    row,
                    ["n_mediating_subunits", "mediating_subunit_count"],
                ),
                "isSubunitOfOtherComplex": first_existing(
                    row,
                    ["is_subunit_of_other_complex", "is_subunit_of_complex"],
                ),
                "otherComplexIds": split_list(
                    first_existing(row, ["other_complex_ids", "other_complexes"])
                ),
                "sources": split_list(first_existing(row, ["sources", "source_dbs"])),
                "publications": split_list(first_existing(row, ["publications", "pmids", "pmid"])),
            }
        )

    return items


def hpa_items(row: dict):
    """
    把 HPA 相关字段整理出来。
    如果某些字段在当前 TSV 不存在，就自动跳过。
    """
    fields = [
        ("sc_type_specificity", "单细胞 RNA · 细胞类型特异性"),
        ("sc_type_distribution", "单细胞 RNA · 细胞类型分布"),
        ("sc_type_specificity_score", "单细胞 RNA · 细胞类型特异性分数"),
        ("sc_type_specific_ncpm", "单细胞 RNA · 富集细胞类型表达量"),

        ("sc_group_specificity", "单细胞 RNA · 谱系分组特异性"),
        ("sc_group_distribution", "单细胞 RNA · 谱系分组分布"),
        ("sc_group_specificity_score", "单细胞 RNA · 谱系分组特异性分数"),
        ("sc_group_specific_ncpm", "单细胞 RNA · 谱系分组表达量"),

        ("protein_ct_specificity", "蛋白 IHC · 细胞类型特异性"),
        ("protein_ct_distribution", "蛋白 IHC · 细胞类型分布"),
        ("protein_ct_specificity_score", "蛋白 IHC · 特异性分数"),
        ("protein_ct_specific_intensity", "蛋白 IHC · 染色强度"),

        ("tissue_ct_enrichment", "组织-细胞类型联合富集"),
        ("sc_expression_cluster", "单细胞共表达聚类"),

        ("cancer_rna_specificity", "泛癌细胞系 RNA 特异性"),
        ("cancer_rna_distribution", "泛癌细胞系 RNA 分布"),
        ("cancer_rna_specificity_score", "泛癌细胞系 RNA 特异性分数"),
        ("cancer_rna_specific_ptpm", "泛癌细胞系 RNA 表达量"),
    ]

    result = []

    for field, label in fields:
        if field not in row:
            continue

        value = clean(row.get(field))

        if value == "暂无数据":
            continue

        result.append(
            {
                "field": field,
                "label": label,
                "value": value,
            }
        )

    return result


def detect_ppi_pair_cols(df):
    candidates = [
        ("protein1_id", "protein2_id"),
        ("protein1", "protein2"),
        ("source", "target"),
        ("uniprot_ac_1", "uniprot_ac_2"),
        ("a_uniprot_ac", "b_uniprot_ac"),
    ]

    for source_col, target_col in candidates:
        if source_col in df.columns and target_col in df.columns:
            return source_col, target_col

    raise ValueError(f"Cannot detect PPI edge endpoint columns. Columns: {list(df.columns)}")


def detect_ext_target_col(df):
    candidates = [
        "ext_protein_id",
        "target",
        "ext_uniprot_ac",
        "uniprot_ac",
        "target_uniprot_ac",
    ]

    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(f"Cannot detect target column in ext_edges.tsv. Columns: {list(df.columns)}")


def detect_ext_complex_col(df):
    candidates = [
        "complex_id",
        "source",
        "source_complex_id",
        "corum_id",
    ]

    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(f"Cannot detect complex column in ext_edges.tsv. Columns: {list(df.columns)}")