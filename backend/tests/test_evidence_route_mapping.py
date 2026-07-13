import sys
import types
import unittest
from types import SimpleNamespace


def _install_router_import_fakes():
    datastore_module = types.ModuleType("app.datastore")
    datastore_module.store = SimpleNamespace()
    sys.modules.setdefault("app.datastore", datastore_module)

    global_store_module = types.ModuleType("app.global_ppi_store")
    global_store_module.global_ppi_store = SimpleNamespace(loaded=False)
    global_store_module.normalize_protein_id = lambda value: str(value).strip()
    global_store_module.protein_key = lambda value: f"UniProt:{str(value).strip()}"
    sys.modules.setdefault("app.global_ppi_store", global_store_module)


_install_router_import_fakes()

from app.routers.complex import _make_complex_ext_edge, _make_complex_intra_edge
from app.routers.global_ppi import _make_global_ppi_edge
from app.routers.protein import _make_protein_neighbor_edge


class EvidenceRouteMappingTests(unittest.TestCase):
    def make_tsv_row(self, **overrides):
        row = {
            "sources": "",
            "methods": "",
            "publications": "",
            "supporting_structures": "",
            "n_ddi": "",
            "n_dmi": "",
            "gold_record_count": "",
            "ddi": "",
            "dmi": "",
        }
        row.update(overrides)
        return row

    def assert_missing_evidence(self, edge):
        summary = edge.evidenceSummary
        self.assertEqual(
            [
                summary.sourceCount,
                summary.methodCount,
                summary.publicationCount,
                summary.structureCount,
                summary.ddiRecordCount,
                summary.dmiRecordCount,
                summary.goldRecordCount,
            ],
            [None, None, None, None, None, None, None],
        )
        self.assertEqual(edge.evidenceSources, [])
        self.assertEqual(edge.methods, [])
        self.assertEqual(edge.publications, [])
        self.assertEqual(edge.supportingStructures, [])
        self.assertEqual(edge.ddi, [])
        self.assertEqual(edge.dmi, [])

    def assert_explicit_empty_evidence(self, edge):
        summary = edge.evidenceSummary
        self.assertEqual(
            [
                summary.sourceCount,
                summary.methodCount,
                summary.publicationCount,
                summary.structureCount,
                summary.ddiRecordCount,
                summary.dmiRecordCount,
                summary.goldRecordCount,
            ],
            [0, 0, 0, 0, 0, 0, 0],
        )
        self.assertFalse(edge.hasDDI)
        self.assertFalse(edge.hasDMI)

    def test_protein_neighbor_builder_preserves_blank_and_explicit_empty(self):
        blank = _make_protein_neighbor_edge(
            row=self.make_tsv_row(),
            source_id="SYNTHETIC:SOURCE",
            target_id="SYNTHETIC:TARGET",
        )
        explicit_empty = _make_protein_neighbor_edge(
            row=self.make_tsv_row(
                sources=[],
                methods=[],
                publications=[],
                supporting_structures=[],
                n_ddi=0,
                n_dmi=0,
                gold_record_count=0,
                ddi=[],
                dmi=[],
            ),
            source_id="SYNTHETIC:SOURCE",
            target_id="SYNTHETIC:TARGET",
        )

        self.assert_missing_evidence(blank)
        self.assert_explicit_empty_evidence(explicit_empty)

    def test_complex_intra_builder_preserves_blank_and_explicit_empty(self):
        blank = _make_complex_intra_edge(
            complex_id="SYNTHETIC:COMPLEX",
            row=self.make_tsv_row(),
            source_id="SYNTHETIC:SOURCE",
            target_id="SYNTHETIC:TARGET",
            is_confirmed_ppi=True,
        )
        explicit_empty = _make_complex_intra_edge(
            complex_id="SYNTHETIC:COMPLEX",
            row=self.make_tsv_row(
                sources=[],
                methods=[],
                publications=[],
                supporting_structures=[],
                n_ddi=0,
                n_dmi=0,
                gold_record_count=0,
                ddi=[],
                dmi=[],
            ),
            source_id="SYNTHETIC:SOURCE",
            target_id="SYNTHETIC:TARGET",
            is_confirmed_ppi=True,
        )

        self.assert_missing_evidence(blank)
        self.assert_explicit_empty_evidence(explicit_empty)

    def test_complex_ext_builder_preserves_blank_and_explicit_empty(self):
        blank = _make_complex_ext_edge(
            complex_id="SYNTHETIC:COMPLEX",
            row=self.make_tsv_row(),
            source_id="CORUM:SYNTHETIC",
            target_id="SYNTHETIC:TARGET",
        )
        explicit_empty = _make_complex_ext_edge(
            complex_id="SYNTHETIC:COMPLEX",
            row=self.make_tsv_row(
                sources=[],
                methods=[],
                publications=[],
                supporting_structures=[],
                n_ddi=0,
                n_dmi=0,
                gold_record_count=0,
                ddi=[],
                dmi=[],
            ),
            source_id="CORUM:SYNTHETIC",
            target_id="SYNTHETIC:TARGET",
        )

        self.assert_missing_evidence(blank)
        self.assert_explicit_empty_evidence(explicit_empty)

    def test_global_builder_preserves_list_presence_without_adapter_fallback(self):
        missing = _make_global_ppi_edge(
            {
                "source": "SYNTHETIC:SOURCE",
                "target": "SYNTHETIC:TARGET",
                "sources": "",
                "methods": "",
                "publications": "",
                "supporting_structures": "",
                "n_ddi": "",
                "n_dmi": "",
                "gold_record_count": "",
                "ddi": "",
                "dmi": "",
            }
        )
        explicit_empty = _make_global_ppi_edge(
            {
                "source": "SYNTHETIC:SOURCE",
                "target": "SYNTHETIC:TARGET",
                "sources": [],
                "methods": [],
                "publications": [],
                "supporting_structures": [],
                "n_ddi": 0,
                "n_dmi": 0,
                "gold_record_count": 0,
                "ddi": [],
                "dmi": [],
            }
        )

        self.assert_missing_evidence(missing)
        self.assert_explicit_empty_evidence(explicit_empty)

    def test_all_builders_normalize_valid_source_values(self):
        tsv_row = self.make_tsv_row(
            sources="SYNTHETIC_SOURCE_A;SYNTHETIC_SOURCE_B",
            methods="SYNTHETIC_METHOD_A",
            publications="999999991",
            supporting_structures="Z9Z9",
            n_ddi=1,
            n_dmi=1,
            gold_record_count=1,
            ddi="DDI:SYNTHETIC_A",
            dmi="DMI:SYNTHETIC_A",
        )
        builders = [
            lambda: _make_protein_neighbor_edge(
                row=tsv_row,
                source_id="SYNTHETIC:SOURCE",
                target_id="SYNTHETIC:TARGET",
            ),
            lambda: _make_complex_intra_edge(
                complex_id="SYNTHETIC:COMPLEX",
                row=tsv_row,
                source_id="SYNTHETIC:SOURCE",
                target_id="SYNTHETIC:TARGET",
                is_confirmed_ppi=True,
            ),
            lambda: _make_complex_ext_edge(
                complex_id="SYNTHETIC:COMPLEX",
                row=tsv_row,
                source_id="CORUM:SYNTHETIC",
                target_id="SYNTHETIC:TARGET",
            ),
            lambda: _make_global_ppi_edge(
                {
                    **tsv_row,
                    "source": "SYNTHETIC:SOURCE",
                    "target": "SYNTHETIC:TARGET",
                    "sources": ["SYNTHETIC_SOURCE_A", "SYNTHETIC_SOURCE_B"],
                    "methods": ["SYNTHETIC_METHOD_A"],
                    "publications": ["999999991"],
                    "supporting_structures": ["Z9Z9"],
                    "ddi": ["DDI:SYNTHETIC_A"],
                    "dmi": ["DMI:SYNTHETIC_A"],
                }
            ),
        ]

        for builder in builders:
            with self.subTest(builder=builder):
                edge = builder()
                self.assertEqual(edge.evidenceSummary.sourceCount, 2)
                self.assertEqual(edge.evidenceSummary.structureCount, 1)
                self.assertTrue(edge.hasDDI)
                self.assertTrue(edge.hasDMI)


if __name__ == "__main__":
    unittest.main()
