import { describe, expect, it } from "vitest";
import {
  getEdgeSemanticModel,
  getNetworkSemanticProfile,
} from "../lib/networkSemantics";
import {
  coMembershipEdge,
  legacyRawOnlyComplexExternalEdge,
  standardComplexExternalEdge,
} from "./networkSemanticFixtures";

describe("network semantic fixtures", () => {
  it("preserves standard co-membership semantics without creating a confirmed PPI", () => {
    const model = getEdgeSemanticModel(
      coMembershipEdge,
      getNetworkSemanticProfile("complex_intra")
    );

    expect(model.kind).toBe("complex_intra_co_complex_only");
    expect(model.visualRole).toBe("complex_intra_co_complex_only");
    expect(model.flags.isCoComplexOnly).toBe(true);
    expect(model.flags.isConfirmedPpi).toBe(false);
    expect(
      model.statusBadges.find((badge) => badge.key === "confirmed-direct-ppi")
        ?.active
    ).toBe(false);
  });

  it("consumes standard complex external partner fields through the network adapter", () => {
    const model = getEdgeSemanticModel(
      standardComplexExternalEdge,
      getNetworkSemanticProfile("complex_ext")
    );

    expect(model.kind).toBe("complex_external_partner");
    expect(model.complexExternalExplanation?.externalPartnerGene).toBe(
      "GENE_EXTERNAL"
    );
    expect(model.complexExternalExplanation?.mediatingSubunitIds).toEqual([
      "SYNTHETIC:MEDIATOR_A",
      "SYNTHETIC:MEDIATOR_B",
    ]);
    expect(model.complexExternalExplanation?.isSubunitOfOtherComplex).toBe(
      false
    );
    expect(model.complexExternalExplanation?.otherComplexIds).toEqual([]);
  });

  it("does not derive complex external semantics from graph or raw fallback", () => {
    const model = getEdgeSemanticModel(
      legacyRawOnlyComplexExternalEdge,
      getNetworkSemanticProfile("complex_ext")
    );

    expect(model.kind).toBe("unknown");
    expect(model.complexExternalExplanation).toBeNull();
  });

  it("uses canonical relationKind without graph or raw inference", () => {
    const model = getEdgeSemanticModel(
      {
        relationKind: "protein_physical_interaction",
        raw: { relationshipKind: "complex_external_ppi" },
      },
      getNetworkSemanticProfile("unknown")
    );

    expect(model.kind).toBe("protein_ppi");
  });
});
