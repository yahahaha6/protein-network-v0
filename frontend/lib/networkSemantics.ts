export type DetailRecord = Record<string, unknown>;

export type GraphSemanticKind =
  | "protein_neighborhood"
  | "global_ppi_neighborhood"
  | "complex_intra"
  | "complex_ext"
  | "unknown";

export type EdgeSemanticKind =
  | "protein_ppi"
  | "complex_intra_confirmed_ppi"
  | "complex_intra_co_complex_only"
  | "complex_external_partner"
  | "unknown";

export type EdgeVisualRole =
  | "protein_ppi_default"
  | "protein_ppi_ddi"
  | "protein_ppi_dmi"
  | "protein_ppi_ddi_dmi"
  | "protein_ppi_structural"
  | "complex_intra_confirmed"
  | "complex_intra_co_complex_only"
  | "complex_intra_structural"
  | "complex_ext_base"
  | "complex_ext_other_complex"
  | "complex_ext_structural"
  | "complex_ext_structural_other_complex"
  | "unknown";

export type NetworkSemanticProfile = {
  graphType?: string;
  graphKind: GraphSemanticKind;
};

export type EdgeEvidenceFlags = {
  hasDDI: boolean;
  hasDMI: boolean;
  hasStructuralEvidence: boolean;
  isConfirmedPpi: boolean;
  isCoComplexOnly: boolean;
  isSubunitOfOtherComplex: boolean;
};

export type StatusBadge = {
  key: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
};

export type ComplexExternalExplanation = {
  externalPartnerGene: unknown;
  mediatingSubunitIds: unknown;
  mediatingSubunitGenes: unknown;
  nMediatingSubunits: unknown;
  isSubunitOfOtherComplex: boolean;
  otherComplexIds: unknown;
};

export type EdgeSemanticModel = {
  kind: EdgeSemanticKind;
  visualRole: EdgeVisualRole;
  flags: EdgeEvidenceFlags;
  statusBadges: StatusBadge[];
  complexExternalExplanation: ComplexExternalExplanation | null;
};

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function rawOf(record: DetailRecord): DetailRecord {
  const raw = record.raw;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as DetailRecord;
  }

  return {};
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return false;
}

function hasSemanticValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as DetailRecord).length > 0;
  }

  return true;
}

export function firstSemanticValue(
  record: DetailRecord,
  keys: string[]
): unknown {
  const raw = rawOf(record);

  for (const key of keys) {
    const value = record[key];

    if (hasSemanticValue(value)) {
      return value;
    }
  }

  for (const key of keys) {
    const value = raw[key];

    if (hasSemanticValue(value)) {
      return value;
    }
  }

  return undefined;
}

export function getNetworkSemanticProfile(
  graphType: unknown
): NetworkSemanticProfile {
  const normalized = normalizeToken(graphType);

  if (normalized === "complex_ext" || normalized === "complex_external") {
    return {
      graphType: typeof graphType === "string" ? graphType : undefined,
      graphKind: "complex_ext",
    };
  }

  if (normalized === "complex_intra") {
    return {
      graphType: typeof graphType === "string" ? graphType : undefined,
      graphKind: "complex_intra",
    };
  }

  if (normalized === "protein_neighborhood") {
    return {
      graphType: typeof graphType === "string" ? graphType : undefined,
      graphKind: "protein_neighborhood",
    };
  }

  if (normalized === "global_ppi_neighborhood") {
    return {
      graphType: typeof graphType === "string" ? graphType : undefined,
      graphKind: "global_ppi_neighborhood",
    };
  }

  return {
    graphType: typeof graphType === "string" ? graphType : undefined,
    graphKind: "unknown",
  };
}

function getEdgeType(edge: DetailRecord): string {
  const raw = rawOf(edge);
  return normalizeToken(edge.type ?? raw.relationshipKind);
}

function getEvidenceLevel(edge: DetailRecord): string {
  return normalizeToken(edge.evidenceLevel);
}

export function getEdgeEvidenceFlags(edge: DetailRecord): EdgeEvidenceFlags {
  return {
    hasDDI: toBoolean(
      firstSemanticValue(edge, [
        "hasDDI",
        "hasDdi",
        "ddi",
        "DDI",
        "domain_domain_interactions",
        "domainDomainInteractions",
      ])
    ),
    hasDMI: toBoolean(
      firstSemanticValue(edge, [
        "hasDMI",
        "hasDmi",
        "dmi",
        "DMI",
        "domain_motif_interactions",
        "domainMotifInteractions",
      ])
    ),
    hasStructuralEvidence: toBoolean(
      firstSemanticValue(edge, [
        "hasStructuralEvidence",
        "supportingStructures",
        "supporting_structures",
        "pdb",
        "pdbIds",
        "pdb_ids",
      ])
    ),
    isConfirmedPpi: toBoolean(
      firstSemanticValue(edge, ["isConfirmedPpi", "is_confirmed_ppi"])
    ),
    isCoComplexOnly: toBoolean(
      firstSemanticValue(edge, ["isCoComplexOnly", "is_co_complex_only"])
    ),
    isSubunitOfOtherComplex: toBoolean(
      firstSemanticValue(edge, [
        "isSubunitOfOtherComplex",
        "is_subunit_of_other_complex",
      ])
    ),
  };
}

export function getEdgeSemanticKind(
  edge: DetailRecord,
  profile: NetworkSemanticProfile
): EdgeSemanticKind {
  const edgeType = getEdgeType(edge);
  const evidenceLevel = getEvidenceLevel(edge);
  const flags = getEdgeEvidenceFlags(edge);

  if (
    profile.graphKind === "complex_ext" ||
    edgeType === "complex_external_ppi" ||
    edgeType === "complex_external_partner" ||
    edgeType === "ext_ppi_partner"
  ) {
    return "complex_external_partner";
  }

  if (profile.graphKind === "complex_intra" || edgeType === "complex_intra_ppi") {
    if (flags.isCoComplexOnly || evidenceLevel === "co_complex_only") {
      return "complex_intra_co_complex_only";
    }

    if (flags.isConfirmedPpi) {
      return "complex_intra_confirmed_ppi";
    }

    return "unknown";
  }

  if (
    profile.graphKind === "protein_neighborhood" ||
    profile.graphKind === "global_ppi_neighborhood" ||
    edgeType === "ppi" ||
    edgeType === "direct_ppi" ||
    edgeType === "protein_ppi"
  ) {
    return "protein_ppi";
  }

  if (flags.isCoComplexOnly || evidenceLevel === "co_complex_only") {
    return "complex_intra_co_complex_only";
  }

  if (flags.isConfirmedPpi) {
    return "protein_ppi";
  }

  return "unknown";
}

export function getEdgeVisualRole(
  edge: DetailRecord,
  profile: NetworkSemanticProfile
): EdgeVisualRole {
  const kind = getEdgeSemanticKind(edge, profile);
  const flags = getEdgeEvidenceFlags(edge);

  if (kind === "complex_external_partner") {
    if (flags.hasStructuralEvidence && flags.isSubunitOfOtherComplex) {
      return "complex_ext_structural_other_complex";
    }

    if (flags.hasStructuralEvidence) {
      return "complex_ext_structural";
    }

    if (flags.isSubunitOfOtherComplex) {
      return "complex_ext_other_complex";
    }

    return "complex_ext_base";
  }

  if (kind === "complex_intra_co_complex_only") {
    return "complex_intra_co_complex_only";
  }

  if (kind === "complex_intra_confirmed_ppi") {
    if (flags.hasStructuralEvidence) {
      return "complex_intra_structural";
    }

    return "complex_intra_confirmed";
  }

  if (kind === "protein_ppi") {
    if (flags.hasStructuralEvidence) {
      return "protein_ppi_structural";
    }

    if (flags.hasDDI && flags.hasDMI) {
      return "protein_ppi_ddi_dmi";
    }

    if (flags.hasDDI) {
      return "protein_ppi_ddi";
    }

    if (flags.hasDMI) {
      return "protein_ppi_dmi";
    }

    return "protein_ppi_default";
  }

  return "unknown";
}

export function getEdgeStatusBadges(
  edge: DetailRecord,
  profile: NetworkSemanticProfile
): StatusBadge[] {
  const kind = getEdgeSemanticKind(edge, profile);
  const flags = getEdgeEvidenceFlags(edge);

  if (kind === "complex_external_partner") {
    return [
      {
        key: "external-partner-edge",
        active: true,
        activeLabel: "External partner edge",
        inactiveLabel: "Not external partner edge",
      },
      {
        key: "other-complex-subunit",
        active: flags.isSubunitOfOtherComplex,
        activeLabel: "Partner is in other complexes",
        inactiveLabel: "Partner not marked in other complexes",
      },
    ];
  }

  return [
    {
      key: "confirmed-direct-ppi",
      active: flags.isConfirmedPpi,
      activeLabel: "Confirmed direct PPI",
      inactiveLabel: "Not confirmed direct PPI",
    },
    {
      key: "co-complex-only",
      active: flags.isCoComplexOnly,
      activeLabel: "Co-complex only",
      inactiveLabel: "Not co-complex only",
    },
  ];
}

export function getComplexExternalExplanation(
  edge: DetailRecord,
  profile: NetworkSemanticProfile
): ComplexExternalExplanation | null {
  if (getEdgeSemanticKind(edge, profile) !== "complex_external_partner") {
    return null;
  }

  const flags = getEdgeEvidenceFlags(edge);

  return {
    externalPartnerGene: firstSemanticValue(edge, [
      "externalPartnerGene",
      "extGeneName",
      "targetGene",
      "target",
    ]),
    mediatingSubunitIds: firstSemanticValue(edge, [
      "mediatingSubunitIds",
      "mediating_subunit_ids",
    ]),
    mediatingSubunitGenes: firstSemanticValue(edge, [
      "mediatingSubunitGenes",
      "mediating_subunit_genes",
    ]),
    nMediatingSubunits: firstSemanticValue(edge, [
      "nMediatingSubunits",
      "n_mediating_subunits",
    ]),
    isSubunitOfOtherComplex: flags.isSubunitOfOtherComplex,
    otherComplexIds: firstSemanticValue(edge, [
      "otherComplexIds",
      "other_complex_ids",
    ]),
  };
}

export function getEdgeSemanticModel(
  edge: DetailRecord,
  profile: NetworkSemanticProfile
): EdgeSemanticModel {
  return {
    kind: getEdgeSemanticKind(edge, profile),
    visualRole: getEdgeVisualRole(edge, profile),
    flags: getEdgeEvidenceFlags(edge),
    statusBadges: getEdgeStatusBadges(edge, profile),
    complexExternalExplanation: getComplexExternalExplanation(edge, profile),
  };
}
