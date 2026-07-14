import json
import unittest

from pydantic import ValidationError

from app.normalizers.evidence import normalize_evidence
from app.schemas.visualization import EvidenceSummary, VizEdge
from evidence_semantic_fixtures import A2_SOURCE_CASES


class EvidenceCountContractTests(unittest.TestCase):
    def normalize_case(self, name: str):
        return normalize_evidence(A2_SOURCE_CASES[name])

    def make_edge(self, **evidence):
        return VizEdge(
            id="SYNTHETIC|evidence-count-contract",
            source="SYNTHETIC:SOURCE",
            target="SYNTHETIC:TARGET",
            type="ppi",
            relationKind="protein_physical_interaction",
            **evidence,
        )

    def test_missing_reported_counts_normalize_to_null(self):
        summary = self.normalize_case("missing_counts")["evidenceSummary"]

        self.assertEqual(
            summary.model_dump(
                include={
                    "sourceCount",
                    "methodCount",
                    "publicationCount",
                    "structureCount",
                    "ddiRecordCount",
                    "dmiRecordCount",
                    "goldRecordCount",
                }
            ),
            {
                "sourceCount": None,
                "methodCount": None,
                "publicationCount": None,
                "structureCount": None,
                "ddiRecordCount": None,
                "dmiRecordCount": None,
                "goldRecordCount": None,
            },
        )

    def test_legacy_adapter_sentinel_normalizes_to_missing_evidence(self):
        normalized = self.normalize_case("legacy_adapter_missing")
        summary = normalized["evidenceSummary"]

        self.assertEqual(normalized["evidenceSources"], [])
        self.assertEqual(normalized["methods"], [])
        self.assertEqual(normalized["publications"], [])
        self.assertEqual(normalized["supportingStructures"], [])
        self.assertEqual(normalized["ddi"], [])
        self.assertEqual(normalized["dmi"], [])
        self.assertFalse(normalized["hasDDI"])
        self.assertFalse(normalized["hasDMI"])
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

    def test_trimmed_legacy_adapter_sentinel_normalizes_to_null_count(self):
        normalized = normalize_evidence({"n_ddi": "  暂无数据  "})

        self.assertIsNone(normalized["evidenceSummary"].ddiRecordCount)

    def test_unrecognized_dash_count_and_pdb_tokens_remain_rejected(self):
        with self.assertRaises(ValueError):
            normalize_evidence({"n_ddi": "-"})

        with self.assertRaises(ValueError):
            normalize_evidence({"supporting_structures": "—"})

    def test_explicit_zero_counts_remain_zero(self):
        normalized = self.normalize_case("explicit_zero_counts")
        summary = normalized["evidenceSummary"]

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
        self.assertFalse(normalized["hasDDI"])
        self.assertFalse(normalized["hasDMI"])

    def test_positive_reported_counts_preserve_source_value(self):
        summary = self.normalize_case("positive_reported_counts")["evidenceSummary"]

        self.assertEqual(summary.sourceCount, 2)
        self.assertEqual(summary.methodCount, 2)
        self.assertEqual(summary.publicationCount, 2)
        self.assertEqual(summary.structureCount, 1)
        self.assertEqual(summary.goldRecordCount, 4)

    def test_ddi_and_dmi_reported_counts_are_added_to_summary(self):
        summary = self.normalize_case("positive_reported_counts")["evidenceSummary"]

        self.assertEqual(summary.ddiRecordCount, 2)
        self.assertEqual(summary.dmiRecordCount, 3)

    def test_list_count_distinguishes_missing_from_explicit_empty(self):
        missing = self.normalize_case("missing_counts")["evidenceSummary"]
        explicit_empty = self.normalize_case("explicit_zero_counts")["evidenceSummary"]

        self.assertIsNone(missing.sourceCount)
        self.assertIsNone(missing.methodCount)
        self.assertIsNone(missing.publicationCount)
        self.assertIsNone(missing.structureCount)
        self.assertEqual(explicit_empty.sourceCount, 0)
        self.assertEqual(explicit_empty.methodCount, 0)
        self.assertEqual(explicit_empty.publicationCount, 0)
        self.assertEqual(explicit_empty.structureCount, 0)

    def test_nonempty_list_counts_unique_normalized_details(self):
        normalized = self.normalize_case("unique_list_details")
        summary = normalized["evidenceSummary"]

        self.assertEqual(
            normalized["evidenceSources"],
            ["SYNTHETIC_SOURCE_A", "SYNTHETIC_SOURCE_B"],
        )
        self.assertEqual(normalized["methods"], ["SYNTHETIC_METHOD_A"])
        self.assertEqual(normalized["publications"], ["999999991", "999999992"])
        self.assertEqual(normalized["supportingStructures"], ["Z9Z9"])
        self.assertEqual(
            [
                summary.sourceCount,
                summary.methodCount,
                summary.publicationCount,
                summary.structureCount,
            ],
            [2, 1, 2, 1],
        )

    def test_integer_strings_and_integral_floats_are_accepted(self):
        cases = [
            ({"gold_record_count": "0"}, 0),
            ({"gold_record_count": " 2 "}, 2),
            ({"gold_record_count": 3}, 3),
            ({"gold_record_count": 4.0}, 4),
        ]

        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(
                    normalize_evidence(raw)["evidenceSummary"].goldRecordCount,
                    expected,
                )

    def test_negative_invalid_noninteger_and_bool_counts_are_rejected(self):
        invalid_values = [-1, "-1", "not-a-number", 1.5, True, False, float("inf")]

        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_evidence({"gold_record_count": value})

    def test_schema_counts_reject_non_strict_or_negative_input(self):
        for value in [True, 1.0, -1, "2"]:
            with self.subTest(value=value):
                with self.assertRaises(ValidationError):
                    EvidenceSummary(goldRecordCount=value)

    def test_json_preserves_null_zero_and_positive_counts(self):
        missing = self.make_edge(**self.normalize_case("missing_counts"))
        zero = self.make_edge(**self.normalize_case("explicit_zero_counts"))
        positive = self.make_edge(**self.normalize_case("positive_reported_counts"))

        self.assertIsNone(
            json.loads(missing.model_dump_json())["evidenceSummary"]["goldRecordCount"]
        )
        self.assertEqual(
            json.loads(zero.model_dump_json())["evidenceSummary"]["goldRecordCount"],
            0,
        )
        self.assertEqual(
            json.loads(positive.model_dump_json())["evidenceSummary"]["goldRecordCount"],
            4,
        )

    def test_missing_ddi_count_with_details_keeps_null_and_sets_support_true(self):
        normalized = self.normalize_case("ddi_details_without_count")

        self.assertIsNone(normalized["evidenceSummary"].ddiRecordCount)
        self.assertTrue(normalized["hasDDI"])

    def test_count_only_positive_without_details_is_allowed(self):
        normalized = self.normalize_case("ddi_count_only")

        self.assertEqual(normalized["evidenceSummary"].ddiRecordCount, 2)
        self.assertEqual(normalized["ddi"], [])
        self.assertTrue(normalized["hasDDI"])

    def test_zero_count_with_nonempty_details_preserves_independent_signals(self):
        normalized = self.normalize_case("ddi_zero_count_with_details")

        self.assertEqual(normalized["evidenceSummary"].ddiRecordCount, 0)
        self.assertEqual(normalized["ddi"], ["DDI:SYNTHETIC_A"])
        self.assertTrue(normalized["hasDDI"])

    def test_support_without_count_or_details_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.make_edge(
                hasDDI=True,
                evidenceSummary=EvidenceSummary(ddiRecordCount=None),
            )

    def test_supported_true_with_zero_count_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.make_edge(
                hasDDI=True,
                evidenceSummary=EvidenceSummary(ddiRecordCount=0),
            )

    def test_positive_count_sets_transitional_support_true(self):
        normalized = self.normalize_case("ddi_count_only")

        self.assertTrue(normalized["hasDDI"])
        self.assertEqual(normalized["evidenceSummary"].ddiRecordCount, 2)

    def test_positive_count_with_false_support_is_rejected_by_parent_schema(self):
        with self.assertRaises(ValidationError):
            self.make_edge(
                hasDDI=False,
                evidenceSummary=EvidenceSummary(ddiRecordCount=1),
            )

    def test_reported_count_greater_than_detail_count_is_allowed(self):
        normalized = self.normalize_case("ddi_count_greater_than_details")

        self.assertEqual(normalized["evidenceSummary"].ddiRecordCount, 2)
        self.assertEqual(normalized["ddi"], ["DDI:SYNTHETIC_A"])
        self.assertTrue(normalized["hasDDI"])

    def test_reported_count_less_than_detail_count_preserves_independent_signals(self):
        normalized = self.normalize_case("ddi_count_less_than_details")

        self.assertEqual(normalized["evidenceSummary"].ddiRecordCount, 1)
        self.assertEqual(
            normalized["ddi"],
            ["DDI:SYNTHETIC_A", "DDI:SYNTHETIC_B"],
        )
        self.assertTrue(normalized["hasDDI"])

    def test_mixed_valid_and_invalid_publication_items_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_evidence(
                {"publications": ["999999991", "SYNTHETIC_INVALID_PMID"]}
            )

    def test_mixed_valid_and_invalid_structure_items_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_evidence(
                {"supporting_structures": ["Z9Z9", "SYNTHETIC_INVALID_PDB"]}
            )

    def test_support_fields_are_not_duplicated_inside_evidence_summary(self):
        normalized = self.normalize_case("ddi_count_only")
        summary_payload = normalized["evidenceSummary"].model_dump()

        self.assertTrue(normalized["hasDDI"])
        self.assertNotIn("hasDDI", summary_payload)
        self.assertNotIn("hasDMI", summary_payload)


if __name__ == "__main__":
    unittest.main()
