from typing import Any, Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.datastore import store
from app.transform import (
    clean,
    first_existing,
    pair_items,
    split_list,
    bool_value,
    complex_key,
    protein_key,
    complex_node,
    protein_node,
    edge,
)
from app.normalizers.evidence import extract_evidence_input, normalize_evidence
from app.normalizers.complex_ext import (
    complex_ext_edge_passes_filters as normalize_complex_ext_edge_passes_filters,
    make_complex_ext_edge as normalize_complex_ext_edge,
    make_complex_ext_legend as normalize_complex_ext_legend,
)
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
    """Build a normalizer-friendly protein row from mixed local TSV sources."""

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


def _complex_center_node(complex_id: str, row: dict[str, Any]) -> VizNode:
    complex_name = first_existing(row, ["name", "complex_name"])
    label = complex_name if complex_name != "暂无数据" else complex_id

    subunit_ids = split_list(
        first_existing(row, ["subunit_ids", "subunit_uniprot_ids", "subunits"])
    )

    return VizNode(
        id=complex_key(complex_id),
        label=label,
        type="complex",
        displayName=f"{label} / CORUM:{complex_id}",
        subunitCount=len(subunit_ids) if subunit_ids else None,
        raw=dict(row),
    )


def _complex_intra_legend() -> NetworkLegend:
    return NetworkLegend(
        nodeCategories=[
            LegendItem(
                key="protein",
                label="Subunit protein",
                description="Protein subunit participating in this complex intra network.",
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
                key="complex_subunit_pair_supported",
                label="Confirmed direct PPI",
                description="Two subunits share direct PPI evidence in the PPI graph.",
            ),
            LegendItem(
                key="complex_subunit_pair_co_membership_only",
                label="Co-complex only",
                description="Two proteins are observed in the same complex, but no direct PPI evidence is available in the current data.",
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


def _make_complex_intra_stats(nodes: list[VizNode], edges: list[VizEdge]) -> NetworkStats:
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


def _complex_intra_edge_passes_filters(
    *,
    edge: VizEdge,
    confirmed_ppi: Optional[bool],
    co_complex_only: Optional[bool],
    has_ddi: Optional[bool],
    has_dmi: Optional[bool],
    has_pdb: Optional[bool],
) -> bool:
    if not _matches_optional_bool(edge.isConfirmedPpi, confirmed_ppi):
        return False

    if not _matches_optional_bool(edge.isCoComplexOnly, co_complex_only):
        return False

    if not _matches_optional_bool(edge.hasDDI, has_ddi):
        return False

    if not _matches_optional_bool(edge.hasDMI, has_dmi):
        return False

    if not _matches_optional_bool(edge.hasStructuralEvidence, has_pdb):
        return False

    return True


def _make_complex_intra_edge(
    *,
    complex_id: str,
    row: dict[str, Any],
    source_id: str,
    target_id: str,
    is_confirmed_ppi: bool,
) -> VizEdge:
    edge_kind = "confirmed_ppi" if is_confirmed_ppi else "co_complex_only"
    label = "Confirmed PPI" if is_confirmed_ppi else "Co-complex only"

    evidence = normalize_evidence(
        extract_evidence_input(row),
        is_confirmed_ppi=is_confirmed_ppi,
        is_co_complex_only=not is_confirmed_ppi,
    )

    return VizEdge(
        id=f"COMPLEX_INTRA|{edge_kind}|{complex_id}|{source_id}|{target_id}",
        source=source_id,
        target=target_id,
        type="complex_intra_ppi",
        relationKind=(
            "complex_subunit_pair_supported"
            if is_confirmed_ppi
            else "complex_subunit_pair_co_membership_only"
        ),
        label=label,
        raw=dict(row),
        complexId=complex_id,
        **evidence,
    )



@router.get("/complex/{complex_id}")
def get_complex(complex_id: str):
    row = store.complex_by_id.get(complex_id)

    if row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有找到该复合物。",
                "complexId": complex_id,
            },
        )

    complex_name = first_existing(row, ["name", "complex_name"])
    organism = first_existing(row, ["organism", "species"])
    pmid = first_existing(row, ["pmid", "pubmed_id", "pubmed"])
    cell_line = first_existing(row, ["cell_line", "cell_lines"])
    purification_method = first_existing(row, ["purification_method", "method"])
    n_subunits = first_existing(row, ["n_subunits", "subunit_count"])
    n_ext_ppi_edges = first_existing(row, ["n_ext_ppi_edges", "ext_edge_count"])
    n_ext_partners = first_existing(row, ["n_ext_partners", "ext_partner_count"])

    return {
        "id": complex_id,
        "key": complex_key(complex_id),
        "type": "complex",
        "label": complex_name,
        "summary": {
            "complexId": complex_id,
            "name": complex_name,
            "organism": organism,
            "pmid": pmid,
            "cellLine": cell_line,
            "purificationMethod": purification_method,
            "nSubunits": n_subunits,
            "nExtPpiEdges": n_ext_ppi_edges,
            "nExtPartners": n_ext_partners,
            "commentComplex": first_existing(row, ["comment_complex", "complex_comment"]),
            "commentDisease": first_existing(row, ["comment_disease", "disease_comment"]),
        },
        "sections": [
            {
                "id": "subunits",
                "title": "亚基列表",
                "items": pair_items(
                    first_existing(row, ["subunit_ids", "subunit_uniprot_ids", "subunits"]),
                    first_existing(row, ["subunit_genes", "subunit_gene_symbols", "subunit_names"]),
                ),
            },
            {
                "id": "go",
                "title": "GO 注释",
                "items": pair_items(
                    first_existing(row, ["go_ids", "go_id"]),
                    first_existing(row, ["go_names", "go_name", "go_terms"]),
                ),
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


@router.get("/complex/{complex_id}/intra")
def get_complex_intra(
    complex_id: str,
    confirmed_ppi: Optional[bool] = None,
    co_complex_only: Optional[bool] = None,
    has_ddi: Optional[bool] = None,
    has_dmi: Optional[bool] = None,
    has_pdb: Optional[bool] = None,
):
    complex_row = store.complex_by_id.get(complex_id)

    if complex_row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有找到该复合物。",
                "complexId": complex_id,
            },
        )

    df = store.intra_edges

    complex_col = detect_intra_complex_col(df)
    source_col, target_col = detect_intra_pair_cols(df)

    if complex_col == "complex_ids":
        sub = df[
            df[complex_col]
            .astype(str)
            .apply(lambda value: complex_id in [x.strip() for x in value.split(";")])
        ]
    else:
        sub = df[df[complex_col].astype(str) == complex_id]

    center_node = _complex_center_node(complex_id, complex_row)

    nodes_by_id: dict[str, VizNode] = {}
    viz_edges: list[VizEdge] = []

    for _, raw_row in sub.iterrows():
        row = raw_row.to_dict()

        source_uniprot = clean(row.get(source_col))
        target_uniprot = clean(row.get(target_col))

        if source_uniprot == "暂无数据" or target_uniprot == "暂无数据":
            continue

        source_row = (
            store.ppi_protein_by_uniprot.get(source_uniprot)
            or store.intra_protein_by_uniprot.get(source_uniprot)
            or store.ext_protein_by_uniprot.get(source_uniprot)
            or _fallback_protein_raw(source_uniprot)
        )

        target_row = (
            store.ppi_protein_by_uniprot.get(target_uniprot)
            or store.intra_protein_by_uniprot.get(target_uniprot)
            or store.ext_protein_by_uniprot.get(target_uniprot)
            or _fallback_protein_raw(target_uniprot)
        )

        source_node = normalize_protein_node(
            _protein_raw_for_normalizer(source_uniprot, source_row),
            is_center=False,
        )
        target_node = normalize_protein_node(
            _protein_raw_for_normalizer(target_uniprot, target_row),
            is_center=False,
        )

        is_confirmed_ppi = bool_value(
            first_existing(
                row,
                [
                    "evidence_in_ppi_graph",
                    "has_direct_ppi",
                    "is_confirmed",
                    "confirmed",
                ],
            )
        )

        viz_edge = _make_complex_intra_edge(
            complex_id=complex_id,
            row=row,
            source_id=source_uniprot,
            target_id=target_uniprot,
            is_confirmed_ppi=is_confirmed_ppi,
        )

        if not _complex_intra_edge_passes_filters(
            edge=viz_edge,
            confirmed_ppi=confirmed_ppi,
            co_complex_only=co_complex_only,
            has_ddi=has_ddi,
            has_dmi=has_dmi,
            has_pdb=has_pdb,
        ):
            continue

        nodes_by_id[source_node.id] = source_node
        nodes_by_id[target_node.id] = target_node
        viz_edges.append(viz_edge)

    viz_nodes = list(nodes_by_id.values())

    response = NetworkResponse(
        graphType="complex_intra",
        center=center_node,
        nodes=viz_nodes,
        edges=viz_edges,
        stats=_make_complex_intra_stats(viz_nodes, viz_edges),
        legend=_complex_intra_legend(),
        pagination=None,
        filters={
            "confirmed_ppi": confirmed_ppi,
            "co_complex_only": co_complex_only,
            "has_ddi": has_ddi,
            "has_dmi": has_dmi,
            "has_pdb": has_pdb,
        },
        warnings=[
            "This endpoint now returns the standard NetworkResponse model. Complex intra edges distinguish confirmed direct PPI from co-complex-only relationships via isConfirmedPpi and isCoComplexOnly."
        ],
    )

    return response.model_dump(mode="json")


def _complex_ext_legend() -> NetworkLegend:
    return normalize_complex_ext_legend()

def _make_complex_ext_stats(nodes: list[VizNode], edges: list[VizEdge]) -> NetworkStats:
    return NetworkStats(
        nodeCount=len(nodes),
        edgeCount=len(edges),
        proteinNodeCount=sum(1 for node in nodes if node.type == "protein"),
        complexNodeCount=sum(1 for node in nodes if node.type == "complex"),
        tfCount=sum(1 for node in nodes if node.proteinCategory == "TF"),
        efCount=sum(1 for node in nodes if node.proteinCategory == "EF"),
        tfAndEfCount=sum(1 for node in nodes if node.proteinCategory == "TF_and_EF"),
        unknownCategoryCount=sum(1 for node in nodes if node.proteinCategory == "Unknown"),
        ddiSupportedEdgeCount=sum(1 for edge in edges if edge.hasDDI),
        dmiSupportedEdgeCount=sum(1 for edge in edges if edge.hasDMI),
        structuralEvidenceEdgeCount=sum(1 for edge in edges if edge.hasStructuralEvidence),
        confirmedPpiEdgeCount=sum(1 for edge in edges if edge.isConfirmedPpi),
        coComplexOnlyEdgeCount=sum(1 for edge in edges if edge.isCoComplexOnly),
    )


def _make_complex_ext_edge(
    *,
    complex_id: str,
    row: dict[str, Any],
    source_id: str,
    target_id: str,
) -> VizEdge:
    return normalize_complex_ext_edge(
        complex_id=complex_id,
        row=row,
        source_id=source_id,
        target_id=target_id,
    )

def _complex_ext_edge_passes_filters(
    *,
    edge: VizEdge,
    target_node: VizNode,
    source: Optional[str],
    protein_category: Optional[str],
    has_ddi: Optional[bool],
    has_dmi: Optional[bool],
    has_pdb: Optional[bool],
    is_subunit_of_other_complex: Optional[bool],
) -> bool:
    return normalize_complex_ext_edge_passes_filters(
        edge=edge,
        target_node=target_node,
        source=source,
        protein_category=protein_category,
        has_ddi=has_ddi,
        has_dmi=has_dmi,
        has_pdb=has_pdb,
        is_subunit_of_other_complex=is_subunit_of_other_complex,
    )

@router.get("/complex/{complex_id}/ext")
def get_complex_ext(
    complex_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    source: Optional[str] = None,
    protein_category: Optional[str] = None,
    has_ddi: Optional[bool] = None,
    has_dmi: Optional[bool] = None,
    has_pdb: Optional[bool] = None,
    is_subunit_of_other_complex: Optional[bool] = None,
):
    complex_row = store.complex_by_id.get(complex_id)

    if complex_row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有找到该复合物。",
                "complexId": complex_id,
            },
        )

    df = store.ext_edges

    source_col = detect_ext_source_col(df)
    target_col = detect_ext_target_col(df)

    all_edges = df[df[source_col].astype(str) == complex_id]

    center_node = _complex_center_node(complex_id, complex_row)
    nodes_by_id: dict[str, VizNode] = {center_node.id: center_node}
    viz_edges: list[VizEdge] = []
    matched_total = 0

    for _, raw_row in all_edges.iterrows():
        row = raw_row.to_dict()
        target_uniprot = clean(row.get(target_col))

        if target_uniprot == "暂无数据":
            continue

        protein_row = (
            store.ext_protein_by_uniprot.get(target_uniprot)
            or store.ppi_protein_by_uniprot.get(target_uniprot)
            or store.intra_protein_by_uniprot.get(target_uniprot)
            or _fallback_protein_raw(target_uniprot)
        )

        target_node = normalize_protein_node(
            _protein_raw_for_normalizer(target_uniprot, protein_row),
            is_center=False,
        )

        viz_edge = _make_complex_ext_edge(
            complex_id=complex_id,
            row=row,
            source_id=center_node.id,
            target_id=target_node.id,
        )

        if not _complex_ext_edge_passes_filters(
            edge=viz_edge,
            target_node=target_node,
            source=source,
            protein_category=protein_category,
            has_ddi=has_ddi,
            has_dmi=has_dmi,
            has_pdb=has_pdb,
            is_subunit_of_other_complex=is_subunit_of_other_complex,
        ):
            continue

        if matched_total >= offset and len(viz_edges) < limit:
            nodes_by_id[target_node.id] = target_node
            viz_edges.append(viz_edge)

        matched_total += 1

    viz_nodes = list(nodes_by_id.values())
    has_more = offset + len(viz_edges) < matched_total

    response = NetworkResponse(
        graphType="complex_ext",
        center=center_node,
        nodes=viz_nodes,
        edges=viz_edges,
        stats=_make_complex_ext_stats(viz_nodes, viz_edges),
        legend=_complex_ext_legend(),
        pagination=PaginationInfo(
            limit=limit,
            offset=offset,
            total=matched_total,
            hasMore=has_more,
        ),
        filters={
            "limit": limit,
            "offset": offset,
            "source": source,
            "protein_category": protein_category,
            "has_ddi": has_ddi,
            "has_dmi": has_dmi,
            "has_pdb": has_pdb,
            "is_subunit_of_other_complex": is_subunit_of_other_complex,
        },
        warnings=[
            "This endpoint returns the standard NetworkResponse model. Complex external edges represent external protein partners connected through mediating subunits; use edge.mediatingSubunits, edge.externalPartnerId, edge.externalPartnerGene, edge.isSubunitOfOtherComplex, and edge.otherComplexIds for the normalized explanation. edge.raw is retained only for source traceability."
        ],
    )

    return response.model_dump(mode="json")



def detect_intra_complex_col(df):
    candidates = [
        "complex_id",
        "complex_ids",
        "id",
        "source_complex_id",
        "corum_id",
    ]

    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(f"Cannot detect complex column in intra_edges.tsv. Columns: {list(df.columns)}")


def detect_intra_pair_cols(df):
    candidates = [
        ("protein1", "protein2"),
        ("protein1_id", "protein2_id"),
        ("subunit1_id", "subunit2_id"),
        ("source", "target"),
        ("uniprot_ac_1", "uniprot_ac_2"),
        ("a_uniprot_ac", "b_uniprot_ac"),
    ]

    for source_col, target_col in candidates:
        if source_col in df.columns and target_col in df.columns:
            return source_col, target_col

    raise ValueError(f"Cannot detect intra edge endpoint columns. Columns: {list(df.columns)}")


def detect_ext_source_col(df):
    candidates = [
        "source",
        "complex_id",
        "source_complex_id",
        "corum_id",
    ]

    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(f"Cannot detect source column in ext_edges.tsv. Columns: {list(df.columns)}")


def detect_ext_target_col(df):
    candidates = [
        "target",
        "ext_uniprot_ac",
        "ext_protein_id",
        "uniprot_ac",
        "target_uniprot_ac",
    ]

    for col in candidates:
        if col in df.columns:
            return col

    raise ValueError(f"Cannot detect target column in ext_edges.tsv. Columns: {list(df.columns)}")
