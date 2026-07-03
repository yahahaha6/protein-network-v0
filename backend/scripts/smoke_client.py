import sys
import httpx


BASE_URL = "http://localhost:8000"


def check_response(response, name):
    """
    检查接口是否返回 200。
    如果不是 200，直接停止测试。
    """
    if response.status_code != 200:
        print(f"[FAIL] {name}")
        print("status:", response.status_code)
        print(response.text)
        sys.exit(1)

    print(f"[OK] {name}")
    return response.json()


def validate_graph(graph, name):
    """
    检查图谱结构是否正确：
    每条边的 source 和 target 都必须存在于 nodes 里。
    """
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node_ids = set()

    for node in nodes:
        node_id = node.get("data", {}).get("id")
        if node_id:
            node_ids.add(node_id)

    for edge in edges:
        data = edge.get("data", {})
        source = data.get("source")
        target = data.get("target")

        if source not in node_ids:
            print(f"[FAIL] {name}")
            print("edge source not found in nodes:", source)
            sys.exit(1)

        if target not in node_ids:
            print(f"[FAIL] {name}")
            print("edge target not found in nodes:", target)
            sys.exit(1)

    print(f"[OK] {name}: graph structure valid")


def main():
    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        # 1. health
        health = check_response(
            client.get("/api/health"),
            "health",
        )

        loaded = health.get("loaded", {})
        print("loaded:", loaded)

        assert loaded.get("ppi_nodes", 0) > 0
        assert loaded.get("ppi_edges", 0) > 0
        assert loaded.get("intra_edges", 0) > 0
        assert loaded.get("ext_edges", 0) > 0

        # 2. search protein TP53
        search_tp53 = check_response(
            client.get("/api/search", params={"q": "TP53", "type": "protein"}),
            "search TP53",
        )

        if search_tp53.get("count", 0) <= 0:
            print("[FAIL] search TP53 returned no results")
            sys.exit(1)

        # 3. search protein EZH2
        search_ezh2 = check_response(
            client.get("/api/search", params={"q": "EZH2", "type": "protein"}),
            "search EZH2",
        )

        if search_ezh2.get("count", 0) <= 0:
            print("[FAIL] search EZH2 returned no results")
            sys.exit(1)

        # 4. search complex 996
        search_complex = check_response(
            client.get("/api/search", params={"q": "996", "type": "complex"}),
            "search complex 996",
        )

        if search_complex.get("count", 0) <= 0:
            print("[FAIL] search complex 996 returned no results")
            sys.exit(1)

        # 5. complex detail
        complex_detail = check_response(
            client.get("/api/complex/996"),
            "complex detail 996",
        )

        if complex_detail.get("id") != "996":
            print("[FAIL] complex detail id is not 996")
            sys.exit(1)

        # 6. complex intra graph
        complex_intra = check_response(
            client.get("/api/complex/996/intra"),
            "complex intra 996",
        )

        validate_graph(complex_intra, "complex intra 996")
        print("intra stats:", complex_intra.get("stats"))

        intra_stats = complex_intra.get("stats", {})
        if intra_stats.get("nodeCount", 0) <= 0:
            print("[FAIL] complex intra has no nodes")
            sys.exit(1)

        if intra_stats.get("edgeCount", 0) <= 0:
            print("[FAIL] complex intra has no edges")
            sys.exit(1)

        # 7. complex ext graph
        complex_ext = check_response(
            client.get("/api/complex/996/ext", params={"limit": 20, "offset": 0}),
            "complex ext 996",
        )

        validate_graph(complex_ext, "complex ext 996")
        print("ext pagination:", complex_ext.get("pagination"))

        ext_stats = complex_ext.get("stats", {})
        if ext_stats.get("nodeCount", 0) <= 0:
            print("[FAIL] complex ext has no nodes")
            sys.exit(1)

        # 8. protein detail EZH2
        protein_detail = check_response(
            client.get("/api/protein/Q15910"),
            "protein detail Q15910 EZH2",
        )

        if protein_detail.get("id") != "Q15910":
            print("[FAIL] protein detail id is not Q15910")
            sys.exit(1)

        # 9. protein neighbors EZH2
        protein_neighbors = check_response(
            client.get("/api/protein/Q15910/neighbors", params={"limit": 20}),
            "protein neighbors Q15910 EZH2",
        )

        validate_graph(protein_neighbors, "protein neighbors Q15910")
        print("protein neighbor stats:", protein_neighbors.get("stats"))

        neighbor_stats = protein_neighbors.get("stats", {})
        if neighbor_stats.get("nodeCount", 0) <= 0:
            print("[FAIL] protein neighbors has no nodes")
            sys.exit(1)

    print("\nSmoke test passed. Backend V0 is working.")


if __name__ == "__main__":
    main()