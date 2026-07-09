import { describe, expect, it } from "vitest";
import {
  getComplexExternalExplanationFields,
  getComplexExternalOtherComplexFlag,
} from "../lib/complexExternalSemantics";

function standardEdge() {
  return {
    externalPartnerId: "O14497",
    externalPartnerGene: "ARID1A",
    mediatingSubunits: [
      {
        id: "Q15910",
        gene: "EZH2",
        displayName: "EZH2 / Q15910",
        externalLinks: [],
      },
      {
        id: "Q09028",
        gene: "RBBP4",
        displayName: "RBBP4 / Q09028",
        externalLinks: [],
      },
    ],
    isSubunitOfOtherComplex: false,
    otherComplexIds: [],
    raw: {
      externalPartnerGene: "WRONG_RAW_GENE",
      extGeneName: "WRONG_RAW_EXT_GENE",
      mediatingSubunitIds: ["WRONG_RAW_ID"],
      mediatingSubunitGenes: ["WRONG_RAW_GENE"],
      nMediatingSubunits: 99,
      isSubunitOfOtherComplex: true,
      otherComplexIds: ["WRONG_RAW_COMPLEX"],
    },
  };
}

function legacyRawOnlyEdge() {
  return {
    raw: {
      externalPartnerGene: "ARID1A",
      extGeneName: "ARID1A",
      mediatingSubunitIds: ["Q15910"],
      mediatingSubunitGenes: ["EZH2"],
      nMediatingSubunits: 1,
      isSubunitOfOtherComplex: true,
      otherComplexIds: ["1237"],
    },
  };
}

describe("complex external frontend semantics", () => {
  it("prefers standard top-level fields over legacy raw fallback", () => {
    const explanation = getComplexExternalExplanationFields(standardEdge());

    expect(explanation.externalPartnerGene).toBe("ARID1A");
    expect(explanation.mediatingSubunitIds).toEqual(["Q15910", "Q09028"]);
    expect(explanation.mediatingSubunitGenes).toEqual(["EZH2", "RBBP4"]);
    expect(explanation.nMediatingSubunits).toBe(2);
    expect(explanation.isSubunitOfOtherComplex).toBe(false);
    expect(explanation.otherComplexIds).toEqual([]);

    expect(getComplexExternalOtherComplexFlag(standardEdge())).toBe(false);
  });

  it("uses legacy raw fallback only when standard fields are absent", () => {
    const explanation = getComplexExternalExplanationFields(legacyRawOnlyEdge());

    expect(explanation.externalPartnerGene).toBe("ARID1A");
    expect(explanation.mediatingSubunitIds).toEqual(["Q15910"]);
    expect(explanation.mediatingSubunitGenes).toEqual(["EZH2"]);
    expect(explanation.nMediatingSubunits).toBe(1);
    expect(explanation.isSubunitOfOtherComplex).toBe(true);
    expect(explanation.otherComplexIds).toEqual(["1237"]);

    expect(getComplexExternalOtherComplexFlag(legacyRawOnlyEdge())).toBe(true);
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
