import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../lib/api";
import { buildNodeDetailViewModel } from "../lib/nodeDetailViewModel";
import { buildRelatedComplexNetworks } from "../lib/proteinComplexNavigation";

describe("protein detail and node detail semantics", () => {
  it("keeps member-complex internal routes separate", () => {
    const related = buildRelatedComplexNetworks({
      sections: [
        {
          id: "member_complexes",
          count: 2,
          items: [
            { id: "SYNTHETIC:COMPLEX_A", label: "Synthetic complex A" },
            { id: "SYNTHETIC:COMPLEX_B", label: "Synthetic complex B" },
          ],
        },
      ],
    });

    expect(related.memberComplexes.map((item) => item.internalHref)).toEqual([
      "/complex/SYNTHETIC%3ACOMPLEX_A/intra",
      "/complex/SYNTHETIC%3ACOMPLEX_B/intra",
    ]);
  });

  it("keeps TF_and_EF canonical support and excludes protein fields from complex details", () => {
    const protein = buildNodeDetailViewModel({
      id: "SYNTHETIC:PROTEIN",
      label: "SYNTHETIC_GENE",
      type: "protein",
      proteinCategory: "TF_and_EF",
      hpaProfile: { scTypeSpecificity: "synthetic" },
      complexIds: ["SYNTHETIC:COMPLEX_A"],
    });
    const complex = buildNodeDetailViewModel({
      id: "SYNTHETIC:COMPLEX",
      label: "Synthetic complex",
      type: "complex",
      proteinCategory: "Unknown",
      subunitCount: 4,
    });

    expect(protein.kind).toBe("protein");
    expect(protein.fields.proteinCategory).toBe("TF_and_EF");
    expect(complex.kind).toBe("complex");
    expect(complex.fields).not.toHaveProperty("proteinCategory");
    expect(complex.fields.subunitCount).toBe(4);
  });

  it("preserves a not-found status so expected network absence is not treated as a crash", () => {
    const error = new ApiRequestError(404, "Not Found");

    expect(error.status).toBe(404);
    expect(error.message).toBe("Request failed: 404 Not Found");
  });
});
