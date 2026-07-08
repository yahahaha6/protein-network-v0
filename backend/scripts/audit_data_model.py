from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


def print_section(title: str) -> None:
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)


def audit_tsv(path: Path) -> None:
    print_section(str(path.relative_to(ROOT)))

    if not path.exists():
        print("MISSING")
        return

    df = pd.read_csv(path, sep="\t", nrows=5)
    print(f"rows_sampled: {len(df)}")
    print(f"columns_count: {len(df.columns)}")
    print("columns:")
    for col in df.columns:
        print(f"  - {col}")

    print("\nsample:")
    print(df.head(3).to_string(index=False))


def summarize_json_value(value: Any) -> str:
    if isinstance(value, dict):
        return f"dict keys={list(value.keys())[:20]}"
    if isinstance(value, list):
        return f"list len={len(value)} first_type={type(value[0]).__name__ if value else 'empty'}"
    return repr(value)[:200]


def audit_json_graph(path: Path) -> None:
    print_section(str(path.relative_to(ROOT)))

    if not path.exists():
        print("MISSING")
        return

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"top_level_type: {type(data).__name__}")
    if isinstance(data, dict):
        print(f"top_level_keys: {list(data.keys())}")

    nodes = None
    edges = None

    if isinstance(data, dict):
        for node_key in ["nodes", "node", "elements"]:
            if node_key in data:
                nodes = data[node_key]
                break

        for edge_key in ["edges", "links", "edge"]:
            if edge_key in data:
                edges = data[edge_key]
                break

        if nodes is None and "graph" in data and isinstance(data["graph"], dict):
            nodes = data["graph"].get("nodes")
            edges = data["graph"].get("edges") or data["graph"].get("links")

    print("\nvalue summary:")
    if isinstance(data, dict):
        for key, value in data.items():
            print(f"  - {key}: {summarize_json_value(value)}")

    if isinstance(nodes, list):
        print(f"\nnodes_count: {len(nodes)}")
        if nodes:
            first = nodes[0]
            print(f"first_node_type: {type(first).__name__}")
            if isinstance(first, dict):
                print("node_fields:")
                for key in first.keys():
                    print(f"  - {key}")
                print("\nfirst_node:")
                print(json.dumps(first, ensure_ascii=False, indent=2)[:4000])

    if isinstance(edges, list):
        print(f"\nedges_count: {len(edges)}")
        if edges:
            first = edges[0]
            print(f"first_edge_type: {type(first).__name__}")
            if isinstance(first, dict):
                print("edge_fields:")
                for key in first.keys():
                    print(f"  - {key}")
                print("\nfirst_edge:")
                print(json.dumps(first, ensure_ascii=False, indent=2)[:4000])


def main() -> None:
    print(f"ROOT={ROOT}")
    print(f"DATA_DIR={DATA_DIR}")

    tsv_paths = [
        DATA_DIR / "ppi_unit_graph" / "ppi_nodes.tsv",
        DATA_DIR / "ppi_unit_graph" / "ppi_edges.tsv",
        DATA_DIR / "complex_intra_ppi_graph" / "protein_nodes.tsv",
        DATA_DIR / "complex_intra_ppi_graph" / "complex_nodes.tsv",
        DATA_DIR / "complex_intra_ppi_graph" / "intra_edges.tsv",
        DATA_DIR / "complex_ext_ppi_graph" / "complex_nodes.tsv",
        DATA_DIR / "complex_ext_ppi_graph" / "ext_protein_nodes.tsv",
        DATA_DIR / "complex_ext_ppi_graph" / "ext_edges.tsv",
    ]

    json_paths = [
        DATA_DIR / "global_ppi_graph" / "ppi_graph.json",
        DATA_DIR / "complex_intra_ppi_graph" / "complex_intra_ppi_graph.json",
        DATA_DIR / "complex_ext_ppi_graph" / "complex_ext_ppi_graph.json",
    ]

    for path in tsv_paths:
        audit_tsv(path)

    for path in json_paths:
        audit_json_graph(path)


if __name__ == "__main__":
    main()
