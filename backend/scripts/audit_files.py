from pathlib import Path
import pandas as pd


DATA_DIR = Path("../data")

FILES = [
    "ppi_unit_graph/ppi_nodes.tsv",
    "ppi_unit_graph/ppi_edges.tsv",

    "complex_intra_ppi_graph/complex_nodes.tsv",
    "complex_intra_ppi_graph/protein_nodes.tsv",
    "complex_intra_ppi_graph/intra_edges.tsv",

    "complex_ext_ppi_graph/complex_nodes.tsv",
    "complex_ext_ppi_graph/ext_protein_nodes.tsv",
    "complex_ext_ppi_graph/ext_edges.tsv",
]


def main():
    for rel_path in FILES:
        path = DATA_DIR / rel_path

        print("\n" + "=" * 80)
        print(rel_path)

        if not path.exists():
            print("MISSING:", path)
            continue

        df = pd.read_csv(path, sep="\t", dtype=str).fillna("")

        print("rows:", len(df))
        print("columns:")
        for col in df.columns:
            print("  -", col)

        print("\nfirst row:")
        if len(df) > 0:
            print(df.head(1).to_dict(orient="records")[0])
        else:
            print("EMPTY FILE")


if __name__ == "__main__":
    main()