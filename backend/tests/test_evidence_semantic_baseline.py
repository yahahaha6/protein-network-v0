import json
import unittest

from app.normalizers.evidence import normalize_evidence
from app.schemas.visualization import VizEdge
from evidence_semantic_fixtures import (
    CURRENT_SOURCE_CASES,
    EVIDENCE_CONTRACT_CASES,
)


class EvidenceSemanticBaselineTests(unittest.TestCase):
    def normalize_case(self, name: str):
        return normalize_evidence(CURRENT_SOURCE_CASES[name])

    def test_explicit_zero_fixture_preserves_zero_input_boundary(self):
        source = CURRENT_SOURCE_CASES["explicit_zero"]

        self.assertIn("n_ddi", source)
        self.assertEqual(source["n_ddi"], 0)
        self.assertEqual(source["ddi"], [])

        normalized = self.normalize_case("explicit_zero")

        self.assertFalse(normalized["hasDDI"])
        self.assertEqual(normalized["ddi"], [])

    def test_unknown_fixture_omits_count_and_details_keys(self):
        source = CURRENT_SOURCE_CASES["unknown"]

        self.assertNotIn("n_ddi", source)
        self.assertNotIn("ddi", source)

        normalized = self.normalize_case("unknown")

        self.assertFalse(normalized["hasDDI"])
        self.assertEqual(normalized["ddi"], [])

    def test_count_only_evidence_does_not_fabricate_details(self):
        source = CURRENT_SOURCE_CASES["count_only"]

        self.assertEqual(source["n_ddi"], 2)
        self.assertNotIn("ddi", source)

        normalized = self.normalize_case("count_only")

        self.assertTrue(normalized["hasDDI"])
        self.assertEqual(normalized["ddi"], [])

    def test_positive_dmi_details_are_preserved(self):
        source = CURRENT_SOURCE_CASES["positive_dmi_with_details"]

        self.assertEqual(source["n_dmi"], 3)
        self.assertEqual(source["dmi"], ["DMI:0001", "DMI:0002"])

        normalized = self.normalize_case("positive_dmi_with_details")

        self.assertTrue(normalized["hasDMI"])
        self.assertEqual(normalized["dmi"], ["DMI:0001", "DMI:0002"])

    def test_gold_count_is_serialized_inside_evidence_summary(self):
        normalized = self.normalize_case("gold_count")
        edge = VizEdge(
            id="SYNTHETIC|gold-count",
            source="SYNTHETIC:SOURCE",
            target="SYNTHETIC:TARGET",
            type="ppi",
            **normalized,
        )

        serialized = json.loads(edge.model_dump_json())

        self.assertEqual(serialized["evidenceSummary"]["goldRecordCount"], 4)

    def test_zero_count_with_details_is_an_allowed_normalizer_contract(self):
        case = EVIDENCE_CONTRACT_CASES["zero_count_with_details"]

        normalized = normalize_evidence(case["input"])
        expected = case["expected_output"]

        self.assertEqual(
            normalized["evidenceSummary"].ddiRecordCount,
            expected["ddiRecordCount"],
        )
        self.assertEqual(normalized["ddi"], expected["ddi"])
        self.assertIs(normalized["hasDDI"], expected["hasDDI"])

    def test_malformed_contract_cases_raise_from_normalizer(self):
        for name, case in EVIDENCE_CONTRACT_CASES.items():
            if "expected_exception" not in case:
                continue

            with self.subTest(case=name):
                with self.assertRaises(case["expected_exception"]):
                    normalize_evidence(case["input"])


if __name__ == "__main__":
    unittest.main()
