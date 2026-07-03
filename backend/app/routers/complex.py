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


router = APIRouter()


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
def get_complex_intra(complex_id: str):
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

    nodes = {}
    edges = []

    confirmed_count = 0
    co_complex_only_count = 0

    for _, row in sub.iterrows():
        row = row.to_dict()

        source_uniprot = clean(row.get(source_col))
        target_uniprot = clean(row.get(target_col))

        if source_uniprot == "暂无数据" or target_uniprot == "暂无数据":
            continue

        source_row = (
            store.ppi_protein_by_uniprot.get(source_uniprot)
            or store.intra_protein_by_uniprot.get(source_uniprot)
            or store.ext_protein_by_uniprot.get(source_uniprot)
            or {}
        )

        target_row = (
            store.ppi_protein_by_uniprot.get(target_uniprot)
            or store.intra_protein_by_uniprot.get(target_uniprot)
            or store.ext_protein_by_uniprot.get(target_uniprot)
            or {}
        )

        source_id = protein_key(source_uniprot)
        target_id = protein_key(target_uniprot)

        nodes[source_id] = protein_node(
            source_uniprot,
            source_row,
            node_type="SubunitProtein",
        )

        nodes[target_id] = protein_node(
            target_uniprot,
            target_row,
            node_type="SubunitProtein",
        )

        evidence = bool_value(
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

        if evidence:
            confirmed_count += 1
            edge_type = "INTRA_PAIR_CONFIRMED"
            evidence_label = "已获直接 PPI 证据确认"
        else:
            co_complex_only_count += 1
            edge_type = "CO_COMPLEX_ONLY"
            evidence_label = "仅共存于同一复合物，暂无直接 PPI 证据"

        edges.append(
            edge(
                edge_id=f"{edge_type}|{complex_key(complex_id)}|{source_id}|{target_id}",
                source=source_id,
                target=target_id,
                edge_type=edge_type,
                extra={
                    "complexId": complex_id,
                    "evidenceInPpiGraph": evidence,
                    "evidenceLabel": evidence_label,
                    "sources": split_list(first_existing(row, ["sources", "source_dbs"])),
                    "methods": split_list(first_existing(row, ["methods", "experimental_methods"])),
                    "publications": split_list(first_existing(row, ["publications", "pmids", "pmid"])),
                    "supportingStructures": split_list(
                        first_existing(row, ["supporting_structures", "pdb_ids", "structures"])
                    ),
                    "sharedComplexCount": first_existing(
    row,
    ["shared_complex_count", "n_shared_complexes", "n_complexes_shared"],
),
                    "ddi": split_list(first_existing(row, ["ddi", "DDI", "ddi_annotations"])),
                    "dmi": split_list(first_existing(row, ["dmi", "DMI", "dmi_annotations"])),
                },
            )
        )

    return {
        "complex": {
            "id": complex_id,
            "key": complex_key(complex_id),
            "label": first_existing(complex_row, ["name", "complex_name"]),
        },
        "nodes": list(nodes.values()),
        "edges": edges,
        "stats": {
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "confirmedEdgeCount": confirmed_count,
            "coComplexOnlyEdgeCount": co_complex_only_count,
        },
    }


@router.get("/complex/{complex_id}/ext")
def get_complex_ext(
    complex_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
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
    total = len(all_edges)

    page = all_edges.iloc[offset: offset + limit]

    nodes = {
        complex_key(complex_id): complex_node(complex_id, complex_row)
    }

    edges = []

    for _, row in page.iterrows():
        row = row.to_dict()

        target_uniprot = clean(row.get(target_col))

        if target_uniprot == "暂无数据":
            continue

        protein_row = store.ext_protein_by_uniprot.get(target_uniprot, {})

        nodes[protein_key(target_uniprot)] = protein_node(
            target_uniprot,
            protein_row,
            node_type="ExternalProtein",
        )

        source_id = complex_key(complex_id)
        target_id = protein_key(target_uniprot)

        edges.append(
            edge(
                edge_id=f"EXT_PPI|{source_id}|{target_id}",
                source=source_id,
                target=target_id,
                edge_type="EXT_PPI_PARTNER",
                extra={
                    "complexName": first_existing(row, ["complex_name", "source_name"]),
                    "extGeneName": first_existing(row, ["ext_gene_name", "gene_symbol", "gene"]),
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
                    "isSubunitOfOtherComplex": bool_value(
                        first_existing(
                            row,
                            ["is_subunit_of_other_complex", "is_subunit_of_complex"],
                        )
                    ),
                    "otherComplexIds": split_list(
                        first_existing(row, ["other_complex_ids", "other_complexes"])
                    ),
                    "sources": split_list(first_existing(row, ["sources", "source_dbs"])),
                    "methods": split_list(first_existing(row, ["methods", "experimental_methods"])),
                    "publications": split_list(first_existing(row, ["publications", "pmids", "pmid"])),
                    "supportingStructures": split_list(
                        first_existing(row, ["supporting_structures", "pdb_ids", "structures"])
                    ),
                },
            )
        )

    return {
        "complex": {
            "id": complex_id,
            "key": complex_key(complex_id),
            "label": first_existing(complex_row, ["name", "complex_name"]),
        },
        "nodes": list(nodes.values()),
        "edges": edges,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": total,
            "returned": len(edges),
            "nextOffset": offset + limit if offset + limit < total else None,
        },
        "stats": {
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
        },
        "truncated": offset + limit < total,
    }


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