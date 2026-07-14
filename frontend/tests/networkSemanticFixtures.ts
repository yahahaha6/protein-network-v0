export const coMembershipEdge = {
  id: "SYNTHETIC|co-membership",
  source: "SYNTHETIC:PROTEIN_A",
  target: "SYNTHETIC:PROTEIN_B",
  type: "complex_intra_ppi",
  relationKind: "complex_subunit_pair_co_membership_only",
  isConfirmedPpi: false,
  isCoComplexOnly: true,
  sharedComplexIds: ["SYNTHETIC:COMPLEX_A"],
  sharedComplexNames: ["Synthetic shared complex"],
  raw: {
    isConfirmedPpi: true,
    isCoComplexOnly: false,
  },
};

export const standardComplexExternalEdge = {
  source: "SYNTHETIC:COMPLEX_A",
  target: "SYNTHETIC:EXTERNAL_PARTNER",
  relationKind: "complex_external_partner",
  externalPartnerId: "SYNTHETIC:EXTERNAL_PARTNER",
  externalPartnerGene: "GENE_EXTERNAL",
  mediatingSubunits: [
    {
      id: "SYNTHETIC:MEDIATOR_A",
      gene: "GENE_A",
      displayName: "GENE_A / SYNTHETIC:MEDIATOR_A",
      externalLinks: [],
    },
    {
      id: "SYNTHETIC:MEDIATOR_B",
      gene: "GENE_B",
      displayName: "GENE_B / SYNTHETIC:MEDIATOR_B",
      externalLinks: [],
    },
  ],
  isSubunitOfOtherComplex: false,
  otherComplexIds: [],
  raw: {
    externalPartnerGene: "GENE_WRONG",
    extGeneName: "GENE_WRONG_EXTERNAL",
    mediatingSubunitIds: ["SYNTHETIC:WRONG_MEDIATOR"],
    mediatingSubunitGenes: ["GENE_WRONG"],
    nMediatingSubunits: 99,
    isSubunitOfOtherComplex: true,
    otherComplexIds: ["WRONG_RAW_COMPLEX"],
  },
};

export const legacyRawOnlyComplexExternalEdge = {
  raw: {
    externalPartnerGene: "GENE_EXTERNAL",
    extGeneName: "GENE_EXTERNAL",
    mediatingSubunitIds: ["SYNTHETIC:MEDIATOR_A"],
    mediatingSubunitGenes: ["GENE_A"],
    nMediatingSubunits: 1,
    isSubunitOfOtherComplex: true,
    otherComplexIds: ["SYNTHETIC:OTHER_COMPLEX_A"],
  },
};
