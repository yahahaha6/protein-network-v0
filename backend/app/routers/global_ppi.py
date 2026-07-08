from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.global_ppi_store import global_ppi_store, normalize_protein_id, protein_key
from app.normalizers.evidence import normalize_evidence
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


def _fallback_protein_raw(protein_id: str) -> dict[str, Any]:
    return {
        "id": protein_id,
        "gene_name": protein_id,
        "protein_name": "",
        "category": "Unknown",
    }


def _make_global_ppi_edge(edge: dict[str, Any]) -> VizEdge:
    source_id = normalize_protein_id(edge.get("source"))
    target_id = normalize_protein_id(edge.get("target"))

    evidence = normalize_evidence(
        edge,
        is_confirmed_ppi=True,
        is_co_complex_only=False,
    )

    return VizEdge(
        id=edge.get("id") or f"GLOBAL_PPI|{source_id}|{target_id}",
        source=source_id,
        target=target_id,
        type="ppi",
        label="PPI",
        raw=edge,
        **evidence,
    )


def _make_network_stats(nodes: list[VizNode], edges: list[VizEdge]) -> NetworkStats:
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
        highEvidenceEdgeCount=sum(1 for edge in edges if edge.evidenceLevel == "high"),
        mediumEvidenceEdgeCount=sum(
            1 for edge in edges if edge.evidenceLevel == "medium"
        ),
        lowEvidenceEdgeCount=sum(1 for edge in edges if edge.evidenceLevel == "low"),
        unknownEvidenceEdgeCount=sum(
            1 for edge in edges if edge.evidenceLevel == "unknown"
        ),
    )


def _global_ppi_legend() -> NetworkLegend:
    return NetworkLegend(
        nodeCategories=[
            LegendItem(
                key="center",
                label="Center protein",
                description="The queried protein at the center of the neighborhood.",
                color="yellow",
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
                key="high",
                label="High evidence",
                description="Structural evidence, or DDI/DMI with publication support.",
                lineStyle="solid",
            ),
            LegendItem(
                key="medium",
                label="Medium evidence",
                description="Multiple sources, multiple publications, or multiple gold records.",
                lineStyle="solid",
            ),
            LegendItem(
                key="low",
                label="Low evidence",
                description="At least one source, method, or publication exists.",
                lineStyle="solid",
            ),
            LegendItem(
                key="unknown",
                label="Unknown evidence",
                description="No usable evidence fields are available.",
                lineStyle="dotted",
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


@router.get("/global-ppi/info")
def get_global_ppi_info():
    return global_ppi_store.info()


@router.get("/global-ppi/protein/{uniprot_ac}")
def get_global_ppi_protein(uniprot_ac: str):
    if not global_ppi_store.loaded:
        return JSONResponse(
            status_code=404,
            content={
                "message": "global PPI graph has not been loaded. Please place ppi_graph.json under data/global_ppi_graph/ and restart backend.",
                "info": global_ppi_store.info(),
            },
        )

    protein_id = normalize_protein_id(uniprot_ac)
    row = global_ppi_store.get_node(protein_id)

    if row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有在 global PPI graph 中找到该蛋白。",
                "uniprotAc": protein_id,
            },
        )

    node_element = global_ppi_store.to_node_element(protein_id)
    node_data = node_element["data"]

    neighbor_count = len(global_ppi_store.neighbor_edges_by_id.get(protein_id, []))

    return {
        "id": protein_id,
        "key": protein_key(protein_id),
        "type": "protein",
        "label": node_data.get("label", protein_id),
        "summary": {
            "uniprotAc": protein_id,
            "geneName": node_data.get("geneName", ""),
            "proteinName": node_data.get("proteinName", ""),
            "category": node_data.get("category", ""),
            "sequenceLength": node_data.get("sequenceLength", ""),
            "neighborCount": neighbor_count,
        },
        "sections": [
            {
                "id": "global_ppi",
                "title": "Global PPI Graph",
                "items": [
                    {
                        "label": "Graph name",
                        "value": global_ppi_store.info().get("name", "global_ppi_graph"),
                    },
                    {
                        "label": "Neighbor count",
                        "value": neighbor_count,
                    },
                ],
            },
            {
                "id": "raw",
                "title": "原始属性",
                "items": [
                    {
                        "label": key,
                        "value": value,
                    }
                    for key, value in row.items()
                ],
            },
        ],
    }


@router.get("/global-ppi/protein/{uniprot_ac}/neighbors")
def get_global_ppi_neighbors(
    uniprot_ac: str,
    limit: int = Query(default=20, ge=1, le=300),
):
    if not global_ppi_store.loaded:
        return JSONResponse(
            status_code=404,
            content={
                "message": "global PPI graph has not been loaded. Please place ppi_graph.json under data/global_ppi_graph/ and restart backend.",
                "info": global_ppi_store.info(),
            },
        )

    protein_id = normalize_protein_id(uniprot_ac)
    center_row = global_ppi_store.get_node(protein_id)

    if center_row is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有在 global PPI graph 中找到该蛋白。",
                "uniprotAc": protein_id,
            },
        )

    neighbor_edges = global_ppi_store.get_neighbor_edges(protein_id, limit)

    nodes_by_id: dict[str, VizNode] = {
        protein_id: normalize_protein_node(center_row, is_center=True)
    }

    viz_edges: list[VizEdge] = []

    for edge in neighbor_edges:
        source_id = normalize_protein_id(edge.get("source"))
        target_id = normalize_protein_id(edge.get("target"))

        other_id = target_id if source_id == protein_id else source_id
        other_row = global_ppi_store.get_node(other_id) or _fallback_protein_raw(other_id)

        nodes_by_id[other_id] = normalize_protein_node(other_row)
        viz_edges.append(_make_global_ppi_edge(edge))

    viz_nodes = list(nodes_by_id.values())
    total = len(global_ppi_store.neighbor_edges_by_id.get(protein_id, []))

    response = NetworkResponse(
        graphType="global_ppi_neighborhood",
        center=nodes_by_id[protein_id],
        nodes=viz_nodes,
        edges=viz_edges,
        stats=_make_network_stats(viz_nodes, viz_edges),
        legend=_global_ppi_legend(),
        pagination=PaginationInfo(
            limit=limit,
            offset=0,
            total=total,
            hasMore=limit < total,
        ),
        filters={
            "limit": limit,
        },
        warnings=[
            "This endpoint now returns the standard NetworkResponse model. Frontend code should use normalized node and edge fields instead of raw Cytoscape element data."
        ],
    )

    return response.model_dump(mode="json")


@router.get("/global-ppi/edge")
def get_global_ppi_edge(source: str, target: str):
    if not global_ppi_store.loaded:
        return JSONResponse(
            status_code=404,
            content={
                "message": "global PPI graph has not been loaded. Please place ppi_graph.json under data/global_ppi_graph/ and restart backend.",
                "info": global_ppi_store.info(),
            },
        )

    source_id = normalize_protein_id(source)
    target_id = normalize_protein_id(target)

    edge = global_ppi_store.get_edge(source_id, target_id)

    if edge is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "没有找到这两个蛋白之间的 global PPI edge。",
                "source": source_id,
                "target": target_id,
            },
        )

    return {
        "source": source_id,
        "target": target_id,
        "edge": global_ppi_store.to_edge_element(edge),
        "raw": edge,
    }
