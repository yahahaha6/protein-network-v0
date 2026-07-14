import { describe, expect, it } from "vitest";
import {
  getComplexExternalExplanationFields,
  getComplexExternalOtherComplexFlag,
} from "../lib/complexExternalSemantics";
import {
  legacyRawOnlyComplexExternalEdge,
  standardComplexExternalEdge,
} from "./networkSemanticFixtures";

describe("complex external frontend semantics", () => {
  it("prefers standard top-level fields over legacy raw fallback", () => {
    const explanation = getComplexExternalExplanationFields(
      standardComplexExternalEdge
    );

    expect(explanation.externalPartnerGene).toBe("GENE_EXTERNAL");
    expect(explanation.mediatingSubunitIds).toEqual([
      "SYNTHETIC:MEDIATOR_A",
      "SYNTHETIC:MEDIATOR_B",
    ]);
    expect(explanation.mediatingSubunitGenes).toEqual(["GENE_A", "GENE_B"]);
    expect(explanation.nMediatingSubunits).toBe(2);
    expect(explanation.isSubunitOfOtherComplex).toBe(false);
    expect(explanation.otherComplexIds).toEqual([]);

    expect(getComplexExternalOtherComplexFlag(standardComplexExternalEdge)).toBe(
      false
    );
  });

  it("does not use raw fallback when standard fields are absent", () => {
    const explanation = getComplexExternalExplanationFields(
      legacyRawOnlyComplexExternalEdge
    );

    expect(explanation.externalPartnerGene).toBeUndefined();
    expect(explanation.mediatingSubunitIds).toBeUndefined();
    expect(explanation.mediatingSubunitGenes).toBeUndefined();
    expect(explanation.nMediatingSubunits).toBeUndefined();
    expect(explanation.isSubunitOfOtherComplex).toBe(false);
    expect(explanation.otherComplexIds).toBeUndefined();

    expect(
      getComplexExternalOtherComplexFlag(legacyRawOnlyComplexExternalEdge)
    ).toBe(false);
  });

  it("derives count from standard mediatingSubunits, not raw count", () => {
    const explanation = getComplexExternalExplanationFields({
      mediatingSubunits: [],
      raw: {
        nMediatingSubunits: 99,
        mediatingSubunitIds: ["RAW"],
        mediatingSubunitGenes: ["RAW"],
      },
    });

    expect(explanation.mediatingSubunitIds).toEqual([]);
    expect(explanation.mediatingSubunitGenes).toEqual([]);
    expect(explanation.nMediatingSubunits).toBe(0);
  });

  it("allows explicit false standard boolean to override true raw value", () => {
    const edge = {
      isSubunitOfOtherComplex: false,
      otherComplexIds: [],
      raw: {
        isSubunitOfOtherComplex: true,
        otherComplexIds: ["WRONG_RAW_COMPLEX"],
      },
    };

    const explanation = getComplexExternalExplanationFields(edge);

    expect(explanation.isSubunitOfOtherComplex).toBe(false);
    expect(explanation.otherComplexIds).toEqual([]);
    expect(getComplexExternalOtherComplexFlag(edge)).toBe(false);
  });
});
