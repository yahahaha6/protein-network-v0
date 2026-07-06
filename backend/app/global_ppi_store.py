from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.config import settings


def clean(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).strip()

    if text == "" or text.lower() in {"nan", "none", "null"}:
        return ""

    return text


def first_existing(row: dict[str, Any], candidates: list[str]) -> Any:
    for key in candidates:
        if key not in row:
            continue

        value = row.get(key)

        if value is None:
            continue

        if isinstance(value, str):
            if clean(value):
                return value
        else:
            return value

    return ""


def normalize_protein_id(value: Any) -> str:
    text = clean(value)

    if text.startswith("UniProt:"):
        text = text.replace("UniProt:", "", 1)

    return text.strip()


def protein_key(uniprot_ac: str) -> str:
    return f"UniProt:{normalize_protein_id(uniprot_ac)}"


def to_list(value: Any) -> list[Any]:
    """
    兼容几种情况：
    1. 原始 JSON 里就是 list
    2. 原始 JSON 里是 JSON 字符串
    3. 原始 JSON 里是 ; / | / , 分隔字符串
    4. 空值
    """
    if value is None:
        return []

    if isinstance(value, list):
        return [item for item in value if item not in [None, ""]]

    if isinstance(value, dict):
        return [value]

    text = clean(value)

    if not text:
        return []

    if text.startswith("[") or text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [item for item in parsed if item not in [None, ""]]
            if isinstance(parsed, dict):
                return [parsed]
        except json.JSONDecodeError:
            pass

    return [item.strip() for item in re.split(r"[;|,]", text) if item.strip()]


def to_int_or_raw(value: Any) -> Any:
    if value is None:
        return ""

    if isinstance(value, int):
        return value

    text = clean(value)

    if not text:
        return ""

    try:
        return int(text)
    except ValueError:
        return text


class GlobalPPIStore:
    def __init__(self):
        self.data_dir = Path(settings.data_dir)
        self.json_path = self.data_dir / "global_ppi_graph" / "ppi_graph.json"

        self.loaded = False
        self.metadata: dict[str, Any] = {}
        self.nodes_by_id: dict[str, dict[str, Any]] = {}
        self.edges: list[dict[str, Any]] = []
        self.edge_by_pair: dict[tuple[str, str], dict[str, Any]] = {}
        self.neighbor_edges_by_id: dict[str, list[dict[str, Any]]] = {}

        self._load()

    def _load(self) -> None:
        """
        注意：
        - 如果 ppi_graph.json 还没放进 data/global_ppi_graph/，不会让 V0 后端崩掉。
        - 放入文件后，需要重启 uvicorn。
        """
        if not self.json_path.exists():
            self.loaded = False
            self.metadata = {
                "name": "global_ppi_graph",
                "message": f"File not found: {self.json_path}",
            }
            return

        with self.json_path.open("r", encoding="utf-8") as f:
            raw = json.load(f)

        nodes, edges, metadata = self._extract_graph(raw)

        self.metadata = metadata
        self.nodes_by_id = {}
        self.edges = []
        self.edge_by_pair = {}
        self.neighbor_edges_by_id = {}

        for node in nodes:
            if not isinstance(node, dict):
                continue

            node_id = normalize_protein_id(
                first_existing(node, ["id", "uniprot_ac", "uniprotAc", "uniprot_id"])
            )

            if not node_id:
                continue

            normalized_node = dict(node)
            normalized_node["id"] = node_id

            self.nodes_by_id[node_id] = normalized_node

        for edge in edges:
            if not isinstance(edge, dict):
                continue

            source_id = normalize_protein_id(first_existing(edge, ["source", "protein1", "protein1_id"]))
            target_id = normalize_protein_id(first_existing(edge, ["target", "protein2", "protein2_id"]))

            if not source_id or not target_id:
                continue

            normalized_edge = dict(edge)
            normalized_edge["source"] = source_id
            normalized_edge["target"] = target_id

            self.edges.append(normalized_edge)

            pair_key = self._pair_key(source_id, target_id)
            self.edge_by_pair[pair_key] = normalized_edge

            self.neighbor_edges_by_id.setdefault(source_id, []).append(normalized_edge)
            self.neighbor_edges_by_id.setdefault(target_id, []).append(normalized_edge)

        self.loaded = True

    def _extract_graph(
        self,
        raw: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
        """
        兼容几种常见 JSON 图格式：
        1. {"nodes": [...], "edges": [...]}
        2. {"nodes": [...], "links": [...]}  # networkx node_link_data 常见
        3. {"elements": {"nodes": [{"data": ...}], "edges": [{"data": ...}]}}
        """
        metadata: dict[str, Any] = {}

        if isinstance(raw.get("graph"), dict):
            metadata.update(raw["graph"])

        for key in ["name", "graph_name", "notes", "description", "directed", "multigraph"]:
            if key in raw:
                metadata[key] = raw[key]

        if "elements" in raw and isinstance(raw["elements"], dict):
            raw_nodes = raw["elements"].get("nodes", [])
            raw_edges = raw["elements"].get("edges", [])

            nodes = [
                item.get("data", item)
                for item in raw_nodes
                if isinstance(item, dict)
            ]

            edges = [
                item.get("data", item)
                for item in raw_edges
                if isinstance(item, dict)
            ]

            return nodes, edges, metadata

        nodes = raw.get("nodes", [])
        edges = raw.get("edges", raw.get("links", []))

        normalized_nodes = [
            item.get("data", item)
            for item in nodes
            if isinstance(item, dict)
        ]

        normalized_edges = [
            item.get("data", item)
            for item in edges
            if isinstance(item, dict)
        ]

        return normalized_nodes, normalized_edges, metadata

    def _pair_key(self, source: str, target: str) -> tuple[str, str]:
        return tuple(sorted([normalize_protein_id(source), normalize_protein_id(target)]))

    def info(self) -> dict[str, Any]:
        return {
            "loaded": self.loaded,
            "dataFile": str(self.json_path),
            "name": first_existing(self.metadata, ["name", "graph_name"]) or "global_ppi_graph",
            "notes": first_existing(self.metadata, ["notes", "description"]),
            "nodeCount": len(self.nodes_by_id),
            "edgeCount": len(self.edges),
            "exampleProteinIds": list(self.nodes_by_id.keys())[:10],
            "metadata": self.metadata,
        }

    def get_node(self, uniprot_ac: str) -> dict[str, Any] | None:
        return self.nodes_by_id.get(normalize_protein_id(uniprot_ac))

    def get_neighbor_edges(self, uniprot_ac: str, limit: int) -> list[dict[str, Any]]:
        protein_id = normalize_protein_id(uniprot_ac)
        return self.neighbor_edges_by_id.get(protein_id, [])[:limit]

    def get_edge(self, source: str, target: str) -> dict[str, Any] | None:
        return self.edge_by_pair.get(self._pair_key(source, target))

    def to_node_element(self, uniprot_ac: str, node_type: str = "Protein") -> dict[str, Any]:
        protein_id = normalize_protein_id(uniprot_ac)
        row = self.nodes_by_id.get(protein_id, {})

        gene_name = first_existing(row, ["gene_name", "gene", "gene_symbol", "label"])
        protein_name = first_existing(row, ["protein_name", "name", "recommended_name"])

        return {
            "data": {
                "id": protein_key(protein_id),
                "label": gene_name or protein_id,
                "type": node_type,
                "uniprotAc": protein_id,
                "geneName": gene_name,
                "proteinName": protein_name,
                "category": first_existing(row, ["category", "protein_category"]),
                "sequenceLength": first_existing(row, ["sequence_length", "length"]),
                "domains": first_existing(row, ["domains"]),
                "motifs": first_existing(row, ["motifs"]),
                "sequence": first_existing(row, ["sequence"]),
            }
        }

    def to_edge_element(self, edge: dict[str, Any]) -> dict[str, Any]:
        source_id = normalize_protein_id(edge.get("source"))
        target_id = normalize_protein_id(edge.get("target"))

        relationship_type = first_existing(
            edge,
            ["relationship_type", "relationshipType", "edge_type", "type"],
        ) or "GLOBAL_PPI"

        return {
            "data": {
                "id": first_existing(edge, ["id"])
                or f"GLOBAL_PPI|{protein_key(source_id)}|{protein_key(target_id)}",
                "source": protein_key(source_id),
                "target": protein_key(target_id),
                "type": relationship_type,
                "relationshipType": relationship_type,
                "sourceProtein": source_id,
                "targetProtein": target_id,
                "sources": to_list(first_existing(edge, ["sources", "source_database", "source_dbs"])),
                "hpa_datasets": to_list(first_existing(edge, ["hpa_datasets", "hpaDatasets"])),
                "methods": to_list(first_existing(edge, ["methods", "method", "experimental_methods"])),
                "publications": to_list(first_existing(edge, ["publications", "publication", "pmids", "pubmed_ids"])),
                "supporting_structures": to_list(
                    first_existing(edge, ["supporting_structures", "supportingStructures", "structures", "pdb_ids"])
                ),
                "gold_record_count": to_int_or_raw(
                    first_existing(edge, ["gold_record_count", "goldRecordCount", "record_count"])
                ),
                "ddi": to_list(first_existing(edge, ["ddi", "DDI", "domain_domain_interactions"])),
                "dmi": to_list(first_existing(edge, ["dmi", "DMI", "domain_motif_interactions"])),
                "raw": edge,
            }
        }


global_ppi_store = GlobalPPIStore()