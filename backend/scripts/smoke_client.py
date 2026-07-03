import sys
import httpx


BASE_URL = "http://localhost:8000"


def check_response(response, name):
    if response.status_code != 200:
        print(f"[FAIL] {name}")
        print("status:", response.status_code)
        print(response.text)
        sys.exit(1)

    print(f"[OK] {name}")
    return response.json()


def validate_graph(graph, name):
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
            print(f"[FAIL] {name}: edge source not found in nodes")
            print("source:", source)
            sys.exit(1)

        if target not in node_ids:
            print(f"[FAIL] {name}: edge target not found in nodes")
            print("target:", target)
            sys.exit(1)

    print(f"[OK] {name}: graph structure valid")


def main():
    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        health = check_response(
            client.get("/api/health"),
            "health",
        )

        loaded = health.get("loaded", {})
        print("loaded:", loaded)

        search_tp53 = check_response(
            client.get("/api/search", params={"q": "TP53", "type": "protein"}),
            "search TP53",
        )
        assert search_tp53["count"] > 0

        search_ezh2 = check_response(
            client.get("/api/search", params={"q": "EZH2", "type": "protein"}),
            "search EZH2",
        )
        assert search_ezh2["count"] > 0

        search_complex = check_response(
            client.get("/api/search", params={"q": "996", "type": "complex"}),
            "search complex 996",
        )
        assert search_complex["count"] > 0

        complex_detail = check_response(
            client.get("/api/complex/996"),
            "complex detail 996",
        )
        assert complex_detail["id"] == "996"

        complex_intra = check_response(
            client.get("/api/complex/996/intra"),
            "complex intra 996",
        )
        assert "nodes" in complex_intra
        assert "edges" in complex_intra
        assert "stats" in complex_intra
        validate_graph(complex_intra, "complex intra 996")

        print("intra stats:", complex_intra["stats"])

        complex_ext = check_response(
            client.get("/api/complex/996/ext", params={"limit": 20, "offset": 0}),
            "complex ext 996",
        )
        assert "nodes" in complex_ext
        assert "edges" in complex_ext
        assert "pagination" in complex_ext
        validate_graph(complex_ext, "complex ext 996")

        print("ext pagination:", complex_ext["pagination"])

        protein_detail = check_response(
            client.get("/api/protein/Q15910"),
            "protein detail Q15910 EZH2",
        )
        assert protein_detail["id"] == "Q15910"

        protein_neighbors = check_response(
            client.get("/api/protein/Q15910/neighbors", params={"limit": 20}),
            "protein neighbors Q15910 EZH2",
        )
        assert "nodes" in protein_neighbors
        assert "edges" in protein_neighbors
        assert "stats" in protein_neighbors
        validate_graph(protein_neighbors, "protein neighbors Q15910")

        print("protein neighbor stats:", protein_neighbors["stats"])

    print("\nSmoke test passed. Backend V0 is working.")


if __name__ == "__main__":
    main()