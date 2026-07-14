import unittest

from app.normalizers.complex_ext import (
    complex_ext_edge_passes_filters,
    make_complex_ext_edge,
    make_complex_ext_legend,
    make_mediating_subunits,
    optional_complex_ext_text,
)
from app.schemas.visualization import NetworkResponse, NetworkStats, VizNode


class ComplexExtContractTests(unittest.TestCase):
    def make_target_node(self, protein_category: str = "TF") -> VizNode:
        return VizNode(
            id="O14497",
            label="ARID1A",
            type="protein",
            proteinCategory=protein_category,
        )

    def make_edge(self, **overrides):
        row = {
            "complex_name": "PRC2 complex",
            "ext_gene_name": "ARID1A",
            "mediating_subunit_ids": "Q15910;Q09028",
            "mediating_subunit_genes": "EZH2;RBBP4",
            "is_subunit_of_other_complex": "false",
            "other_complex_ids": "1237;1251",
            "sources": "BioGRID;IntAct",
            "methods": "Affinity Capture-MS",
            "publications": "123456;789012",
            "supporting_structures": "1ABC",
            "ddi": "PF001;PF002",
            "dmi": "MOTIF_A",
            "n_ddi": "1",
            "n_dmi": "1",
        }
        row.update(overrides)

        return make_complex_ext_edge(
            complex_id="996",
            source_id="CORUM:996",
            target_id="O14497",
            row=row,
        )

    def test_legend_uses_only_standard_network_legend_fields(self):
        legend = make_complex_ext_legend()
        serialized = legend.model_dump(mode="json")

        self.assertEqual(
            set(serialized.keys()),
            {"nodeCategories", "edgeEvidence", "badges"},
        )
        self.assertGreaterEqual(len(serialized["nodeCategories"]), 2)
        self.assertGreaterEqual(len(serialized["edgeEvidence"]), 1)
        self.assertGreaterEqual(len(serialized["badges"]), 1)

        invalid_legacy_keys = {"nodeTypes", "edgeTypes", "evidenceLevels"}
        self.assertTrue(invalid_legacy_keys.isdisjoint(serialized.keys()))

    def test_optional_text_filters_placeholder_values(self):
        self.assertIsNone(optional_complex_ext_text(None))
        self.assertIsNone(optional_complex_ext_text(""))
        self.assertIsNone(optional_complex_ext_text("   "))
        self.assertIsNone(optional_complex_ext_text("暂无数据"))
        self.assertIsNone(optional_complex_ext_text("无数据"))
        self.assertIsNone(optional_complex_ext_text("nan"))
        self.assertIsNone(optional_complex_ext_text("N/A"))
        self.assertIsNone(optional_complex_ext_text("-"))
        self.assertEqual(optional_complex_ext_text("EZH2"), "EZH2")
        self.assertEqual(optional_complex_ext_text("  EZH2  "), "EZH2")

    def test_mediating_subunits_skip_empty_ids_without_shifting_genes(self):
        subunits = make_mediating_subunits(
            ids=["Q15910", "", "暂无数据", "Q09028"],
            genes=["EZH2", "SHOULD_NOT_SHIFT", "ALSO_SHOULD_NOT_SHIFT", "RBBP4"],
        )

        self.assertEqual([subunit.id for subunit in subunits], ["Q15910", "Q09028"])
        self.assertEqual(subunits[0].gene, "EZH2")
        self.assertEqual(subunits[0].displayName, "EZH2 / Q15910")
        self.assertEqual(subunits[1].gene, "RBBP4")
        self.assertEqual(subunits[1].displayName, "RBBP4 / Q09028")

    def test_complex_ext_edge_preserves_mediating_id_gene_alignment(self):
        edge = self.make_edge(
            mediating_subunit_ids=["Q15910", "", "Q09028"],
            mediating_subunit_genes=["EZH2", "SHOULD_NOT_SHIFT", "RBBP4"],
        )

        self.assertEqual(
            [subunit.id for subunit in edge.mediatingSubunits],
            ["Q15910", "Q09028"],
        )
        self.assertEqual(
            [subunit.gene for subunit in edge.mediatingSubunits],
            ["EZH2", "RBBP4"],
        )
        self.assertNotIn(
            "SHOULD_NOT_SHIFT",
            [subunit.gene for subunit in edge.mediatingSubunits],
        )

    def test_complex_ext_edge_promotes_core_semantics_to_top_level(self):
        edge = self.make_edge()

        self.assertEqual(edge.type, "complex_external_ppi")
        self.assertEqual(edge.source, "CORUM:996")
        self.assertEqual(edge.target, "O14497")
        self.assertEqual(edge.externalPartnerId, "O14497")
        self.assertEqual(edge.externalPartnerGene, "ARID1A")
        self.assertEqual(edge.otherComplexIds, ["1237", "1251"])
        self.assertIs(edge.isSubunitOfOtherComplex, True)
        self.assertEqual(edge.relationKind, "complex_external_partner")

        self.assertEqual(
            [subunit.id for subunit in edge.mediatingSubunits],
            ["Q15910", "Q09028"],
        )
        self.assertEqual(edge.mediatingSubunits[0].gene, "EZH2")
        self.assertEqual(edge.mediatingSubunits[0].displayName, "EZH2 / Q15910")

        self.assertNotIn("externalPartnerId", edge.raw)
        self.assertNotIn("externalPartnerGene", edge.raw)
        self.assertNotIn("mediatingSubunitIds", edge.raw)
        self.assertNotIn("mediatingSubunitGenes", edge.raw)
        self.assertNotIn("relationshipKind", edge.raw)

    def test_other_complex_boolean_is_derived_from_explicit_true(self):
        edge = self.make_edge(
            is_subunit_of_other_complex="true",
            other_complex_ids="",
        )

        self.assertIs(edge.isSubunitOfOtherComplex, True)
        self.assertEqual(edge.otherComplexIds, [])

    def test_other_complex_boolean_is_derived_from_other_complex_ids(self):
        edge = self.make_edge(
            is_subunit_of_other_complex="false",
            other_complex_ids="1237;1251",
        )

        self.assertIs(edge.isSubunitOfOtherComplex, True)
        self.assertEqual(edge.otherComplexIds, ["1237", "1251"])

    def test_other_complex_boolean_can_be_false(self):
        edge = self.make_edge(
            is_subunit_of_other_complex="false",
            other_complex_ids="",
        )

        self.assertIs(edge.isSubunitOfOtherComplex, False)
        self.assertEqual(edge.otherComplexIds, [])

    def test_filter_uses_standard_top_level_other_complex_semantics(self):
        target_node = self.make_target_node("TF")
        edge = self.make_edge(
            is_subunit_of_other_complex="false",
            other_complex_ids="1237;1251",
        )

        self.assertTrue(
            complex_ext_edge_passes_filters(
                edge=edge,
                target_node=target_node,
                source="biogrid",
                protein_category="TF",
                has_ddi=True,
                has_dmi=True,
                has_pdb=None,
                is_subunit_of_other_complex=True,
            )
        )

        self.assertFalse(
            complex_ext_edge_passes_filters(
                edge=edge,
                target_node=target_node,
                source="biogrid",
                protein_category="TF",
                has_ddi=True,
                has_dmi=True,
                has_pdb=None,
                is_subunit_of_other_complex=False,
            )
        )

    def test_filter_can_match_false_other_complex_semantics(self):
        target_node = self.make_target_node("TF")
        edge = self.make_edge(
            is_subunit_of_other_complex="false",
            other_complex_ids="",
        )

        self.assertTrue(
            complex_ext_edge_passes_filters(
                edge=edge,
                target_node=target_node,
                source="biogrid",
                protein_category="TF",
                has_ddi=True,
                has_dmi=True,
                has_pdb=None,
                is_subunit_of_other_complex=False,
            )
        )

        self.assertFalse(
            complex_ext_edge_passes_filters(
                edge=edge,
                target_node=target_node,
                source="biogrid",
                protein_category="TF",
                has_ddi=True,
                has_dmi=True,
                has_pdb=None,
                is_subunit_of_other_complex=True,
            )
        )

    def test_filter_uses_standard_evidence_sources_path(self):
        target_node = self.make_target_node("TF")
        edge = self.make_edge()

        self.assertIn("BioGRID", edge.evidenceSources)

        self.assertTrue(
            complex_ext_edge_passes_filters(
                edge=edge,
                target_node=target_node,
                source="biogrid",
                protein_category=None,
                has_ddi=None,
                has_dmi=None,
                has_pdb=None,
                is_subunit_of_other_complex=None,
            )
        )

        self.assertFalse(
            complex_ext_edge_passes_filters(
                edge=edge,
                target_node=target_node,
                source="not-a-real-source",
                protein_category=None,
                has_ddi=None,
                has_dmi=None,
                has_pdb=None,
                is_subunit_of_other_complex=None,
            )
        )

    def test_network_response_serializes_complex_ext_contract(self):
        center = VizNode(
            id="CORUM:996",
            label="PRC2 complex",
            type="complex",
        )
        target_node = self.make_target_node("TF")
        edge = self.make_edge()
        response = NetworkResponse(
            graphType="complex_ext",
            center=center,
            nodes=[center, target_node],
            edges=[edge],
            stats=NetworkStats(nodeCount=2, edgeCount=1),
            legend=make_complex_ext_legend(),
            filters={"is_subunit_of_other_complex": True},
            warnings=["synthetic contract test"],
        )

        serialized = response.model_dump(mode="json")
        serialized_edge = serialized["edges"][0]
        serialized_legend = serialized["legend"]

        self.assertEqual(serialized["graphType"], "complex_ext")
        self.assertEqual(
            set(serialized_legend.keys()),
            {"nodeCategories", "edgeEvidence", "badges"},
        )
        self.assertEqual(serialized_edge["externalPartnerId"], "O14497")
        self.assertEqual(serialized_edge["externalPartnerGene"], "ARID1A")
        self.assertIs(serialized_edge["isSubunitOfOtherComplex"], True)
        self.assertEqual(serialized_edge["otherComplexIds"], ["1237", "1251"])
        self.assertEqual(serialized_edge["mediatingSubunits"][0]["id"], "Q15910")
        self.assertEqual(serialized_edge["relationKind"], "complex_external_partner")
        self.assertNotIn("relationshipKind", serialized_edge["raw"])

        invalid_legacy_keys = {"nodeTypes", "edgeTypes", "evidenceLevels"}
        self.assertTrue(invalid_legacy_keys.isdisjoint(serialized_legend.keys()))


if __name__ == "__main__":
    unittest.main()
