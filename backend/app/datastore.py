"""
Data loading layer for Protein Network Explorer.

This module reads the private local TSV datasets from the configured data
directory and keeps them in memory as pandas DataFrames. The API routers use
this shared DataStore instance for read-only protein, complex, and PPI queries.

Important:
- Real biological datasets are loaded from the local data/ directory at runtime.
- The data/ directory is intentionally excluded from GitHub.
- This module should not modify or write back to the source data files.
"""

from pathlib import Path

import pandas as pd

from app.config import settings


class DataStore:
    def __init__(self):
        """
        Load all local graph tables once when the backend starts.

        Keeping these tables in memory is enough for the V1 demo because the
        backend is read-only and only needs fast lookup / filtering over local
        files.
        """
        self.data_dir = Path(settings.data_dir)

        self.ppi_nodes = self._read("ppi_unit_graph/ppi_nodes.tsv")
        self.ppi_edges = self._read("ppi_unit_graph/ppi_edges.tsv")

        self.intra_complex_nodes = self._read(
            "complex_intra_ppi_graph/complex_nodes.tsv"
        )
        self.intra_protein_nodes = self._read(
            "complex_intra_ppi_graph/protein_nodes.tsv"
        )
        self.intra_edges = self._read("complex_intra_ppi_graph/intra_edges.tsv")

        self.ext_complex_nodes = self._read(
            "complex_ext_ppi_graph/complex_nodes.tsv"
        )
        self.ext_protein_nodes = self._read(
            "complex_ext_ppi_graph/ext_protein_nodes.tsv"
        )
        self.ext_edges = self._read("complex_ext_ppi_graph/ext_edges.tsv")

        # These indexes make detail-page lookups fast and keep router code simple.
        self.ppi_protein_by_uniprot = self._index_by_first_existing(
            self.ppi_nodes,
            ["uniprot_ac", "uniprot_id", "id"],
        )

        self.intra_protein_by_uniprot = self._index_by_first_existing(
            self.intra_protein_nodes,
            ["uniprot_ac", "uniprot_id", "id"],
        )

        self.ext_protein_by_uniprot = self._index_by_first_existing(
            self.ext_protein_nodes,
            ["uniprot_ac", "uniprot_id", "id"],
        )

        self.complex_by_id = self._index_by_first_existing(
            self.ext_complex_nodes,
            ["id", "complex_id", "corum_id"],
        )

    def _read(self, rel_path: str) -> pd.DataFrame:
        """
        Read one TSV file relative to the configured data directory.

        All columns are loaded as strings to avoid losing biological identifiers
        such as UniProt IDs, CORUM IDs, Ensembl IDs, or PMID values.
        """
        path = self.data_dir / rel_path

        if not path.exists():
            raise FileNotFoundError(f"Missing data file: {path}")

        return pd.read_csv(path, sep="\t", dtype=str).fillna("")

    def _index_by_first_existing(
        self, df: pd.DataFrame, candidate_columns: list[str]
    ) -> dict:
        """
        Build a dictionary index from the first available identifier column.

        Different source tables may use slightly different column names for the
        same concept, for example uniprot_ac, uniprot_id, or id. This helper
        keeps the routers independent from small schema differences.
        """
        selected_col = None

        for col in candidate_columns:
            if col in df.columns:
                selected_col = col
                break

        if selected_col is None:
            return {}

        result = {}

        for _, row in df.iterrows():
            row_dict = row.to_dict()
            key = str(row_dict.get(selected_col, "")).strip()

            if key:
                result[key] = row_dict

        return result


store = DataStore()