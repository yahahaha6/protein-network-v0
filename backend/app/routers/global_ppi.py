from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.global_ppi_store import global_ppi_store, normalize_protein_id, protein_key


router = APIRouter()


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

    nodes = {
        protein_key(protein_id): global_ppi_store.to_node_element(
            protein_id,
            node_type="CenterProtein",
        )
    }

    edges = []

    for edge in neighbor_edges:
        source_id = normalize_protein_id(edge.get("source"))
        target_id = normalize_protein_id(edge.get("target"))

        other_id = target_id if source_id == protein_id else source_id

        nodes[protein_key(other_id)] = global_ppi_store.to_node_element(
            other_id,
            node_type="NeighborProtein",
        )

        edges.append(global_ppi_store.to_edge_element(edge))

    center_node = nodes[protein_key(protein_id)]["data"]
    total = len(global_ppi_store.neighbor_edges_by_id.get(protein_id, []))

    return {
        "center": {
            "id": protein_key(protein_id),
            "uniprotAc": protein_id,
            "label": center_node.get("label", protein_id),
            "type": "CenterProtein",
        },
        "nodes": list(nodes.values()),
        "edges": edges,
        "pagination": {
            "limit": limit,
            "offset": 0,
            "total": total,
            "returned": len(edges),
            "nextOffset": limit if limit < total else None,
        },
        "stats": {
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
        },
        "truncated": limit < total,
    }


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