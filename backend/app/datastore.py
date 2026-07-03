from pathlib import Path
import pandas as pd

from app.config import settings


class DataStore:
    def __init__(self):
        self.data_dir = Path(settings.data_dir)

        self.ppi_nodes = self._read("ppi_unit_graph/ppi_nodes.tsv")
        self.ppi_edges = self._read("ppi_unit_graph/ppi_edges.tsv")

        self.intra_complex_nodes = self._read("complex_intra_ppi_graph/complex_nodes.tsv")
        self.intra_protein_nodes = self._read("complex_intra_ppi_graph/protein_nodes.tsv")
        self.intra_edges = self._read("complex_intra_ppi_graph/intra_edges.tsv")

        self.ext_complex_nodes = self._read("complex_ext_ppi_graph/complex_nodes.tsv")
        self.ext_protein_nodes = self._read("complex_ext_ppi_graph/ext_protein_nodes.tsv")
        self.ext_edges = self._read("complex_ext_ppi_graph/ext_edges.tsv")

        # 后面 /protein/{id} 和 /complex/{id} 会用这些索引
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
        path = self.data_dir / rel_path

        if not path.exists():
            raise FileNotFoundError(f"Missing data file: {path}")

        return pd.read_csv(path, sep="\t", dtype=str).fillna("")

    def _index_by_first_existing(self, df: pd.DataFrame, candidate_columns: list[str]) -> dict:
        """
        用多个候选字段名建索引。
        比如有的表可能叫 uniprot_ac，有的可能叫 id。
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