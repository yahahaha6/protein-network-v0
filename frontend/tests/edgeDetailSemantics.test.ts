import { describe, expect, it } from "vitest";

import { buildEdgeDetailViewModel } from "../lib/edgeDetailViewModel";
import {
  EDGE_SELECTED_STYLE,
  NODE_SELECTED_STYLE,
  buildEdgePresentationState,
  getEdgeLegendSections,
  getNodePresentation,
  getRelationPresentation,
} from "../lib/networkPresentation";
import {
  formatReportedCount,
  formatReportedCountDetails,
} from "../lib/edgeDetailViewModel";

const evidence = {
  evidenceSources: ["SYNTHETIC_SOURCE"],
  methods: ["SYNTHETIC_METHOD"],
  publications: ["999999991"],
  supportingStructures: ["Z9Z9"],
  ddi: ["DDI:SYNTHETIC"],
  dmi: ["DMI:SYNTHETIC"],
  hasDDI: true,
  hasDMI: true,
  hasStructuralEvidence: true,
  evidenceSummary: {
    sourceCount: 1,
    methodCount: 1,
    publicationCount: 1,
    structureCount: 1,
    ddiRecordCount: 1,
    dmiRecordCount: 1,
    goldRecordCount: 3,
  },
};

describe("relation-specific edge detail semantics", () => {
  it.each([
    [
      "protein_physical_interaction",
      { interaction: true, features: true, coMembership: false, external: false },
    ],
    [
      "complex_subunit_pair_supported",
      { interaction: true, features: true, coMembership: false, external: false },
    ],
    [
      "complex_subunit_pair_co_membership_only",
      { interaction: false, features: false, coMembership: true, external: false },
    ],
    [
      "complex_external_partner",
      { interaction: true, features: true, coMembership: false, external: true },
    ],
  ] as const)("routes %s through the canonical presenter", (relationKind, expected) => {
    const view = buildEdgeDetailViewModel({
      id: `SYNTHETIC|${relationKind}`,
      source: "SYNTHETIC:SOURCE",
      target: "SYNTHETIC:TARGET",
      relationKind,
      ...evidence,
      externalPartnerGene: "SYNTHETIC_GENE",
      mediatingSubunits: [{ id: "SYNTHETIC:MEDIATOR" }],
      otherComplexIds: ["SYNTHETIC:OTHER_COMPLEX"],
      raw: { goldRecordCount: 99, relationshipKind: "wrong" },
    });

    expect(view.showInteractionEvidence).toBe(expected.interaction);
    expect(view.showFeatureAnnotations).toBe(expected.features);
    expect(view.showCoMembershipExplanation).toBe(expected.coMembership);
    expect(view.showExternalMediation).toBe(expected.external);
    expect(view.evidence.goldRecordCount).toBe(3);
  });

  it("keeps the co-membership line dashed in canvas, selected state, and legend", () => {
    const presentation = getRelationPresentation(
      "complex_subunit_pair_co_membership_only"
    );

    expect(presentation.lineStyle).toBe("dashed");
    expect(presentation.selectedLineStyle).toBe("dashed");
    expect(presentation.legendSwatchClassName).toContain("border-dashed");
  });

  const syntheticPresentationEdges = [
    {
      relationKind: "protein_physical_interaction",
      hasDDI: true,
      hasDMI: false,
      hasStructuralEvidence: false,
      isSubunitOfOtherComplex: false,
    },
    {
      relationKind: "complex_subunit_pair_co_membership_only",
      hasDDI: false,
      hasDMI: false,
      hasStructuralEvidence: false,
      isSubunitOfOtherComplex: false,
    },
    {
      relationKind: "complex_external_partner",
      hasDDI: false,
      hasDMI: false,
      hasStructuralEvidence: false,
      isSubunitOfOtherComplex: true,
    },
    {
      relationKind: "complex_subunit_pair_supported",
      hasDDI: false,
      hasDMI: false,
      hasStructuralEvidence: true,
      isSubunitOfOtherComplex: false,
    },
  ] as const;

  it("composes relation, evidence, and context presentation classes", () => {
    const [ddi, coMembership, externalOtherComplex, structural] =
      syntheticPresentationEdges.map(buildEdgePresentationState);

    expect(ddi.evidenceRole).toBe("ddi");
    expect(ddi.classes).toContain("edge-evidence-ddi");
    expect(ddi.visual.color).toBe("#ec4899");

    expect(coMembership.visual.lineStyle).toBe("dashed");
    expect(coMembership.classes).toContain("edge-context-co-complex-only");

    expect(externalOtherComplex.visual.lineStyle).toBe("dashed");
    expect(externalOtherComplex.classes).toContain("edge-context-other-complex");

    expect(structural.evidenceRole).toBe("structural");
    expect(structural.visual.color).toBe("#f59e0b");
    expect(structural.visual.width).toBe(5);
  });

  it("builds relationship and evidence legends from the same active registry", () => {
    const legend = getEdgeLegendSections(syntheticPresentationEdges);

    expect(legend.relationship.map((item) => item.label)).toEqual([
      "Direct PPI",
      "Co-complex only",
      "Complex external partner",
      "Confirmed intra-complex PPI",
    ]);
    expect(legend.evidenceAndContext.map((item) => item.label)).toEqual([
      "DDI",
      "Partner in other complexes",
      "Structural / PDB",
    ]);
  });

  it("keeps semantic node and edge colors out of selected-state overrides", () => {
    expect(NODE_SELECTED_STYLE).not.toHaveProperty("background-color");
    expect(EDGE_SELECTED_STYLE).not.toHaveProperty("line-color");
    expect(EDGE_SELECTED_STYLE).not.toHaveProperty("line-style");
    expect(getNodePresentation("TF_and_EF").color).toBe("#f97316");
  });

  it.each([
    [null, "Not reported by source"],
    [0, "Source reported 0 records"],
    [3, "3 records reported"],
  ] as const)("formats reported count %s without collapsing its state", (count, expected) => {
    expect(formatReportedCount(count)).toBe(expected);
  });

  it("explains a positive count whose detail records are unavailable", () => {
    expect(formatReportedCountDetails(2, [])).toBe(
      "Count reported; details unavailable"
    );
  });
});
