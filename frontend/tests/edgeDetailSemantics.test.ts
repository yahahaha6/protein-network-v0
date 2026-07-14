import { describe, expect, it } from "vitest";

import { buildEdgeDetailViewModel } from "../lib/edgeDetailViewModel";
import { getRelationPresentation } from "../lib/networkPresentation";

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
});
