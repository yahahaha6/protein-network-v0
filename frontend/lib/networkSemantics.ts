import {
  getComplexExternalExplanationFields,
  getComplexExternalOtherComplexFlag,
} from "@/lib/complexExternalSemantics";
import type { RelationKind } from "@/lib/networkTypes";

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
  | "protein_ppi"
  | "complex_intra_confirmed"
  | "complex_intra_co_complex_only"
  | "complex_external_partner"
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

export type ComplexExternalExplanation = ReturnType<
  typeof getComplexExternalExplanationFields
>;

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

  return false;
}

function asRelationKind(value: unknown): RelationKind | null {
  switch (value) {
    case "protein_physical_interaction":
    case "complex_subunit_pair_supported":
    case "complex_subunit_pair_co_membership_only":
    case "complex_external_partner":
      return value;
    default:
      return null;
  }
}

export function getNetworkSemanticProfile(
  graphType: unknown
): NetworkSemanticProfile {
  const normalized = normalizeToken(graphType);

  if (normalized === "complex_ext" || normalized === "complex_external") {
    return { graphType: typeof graphType === "string" ? graphType : undefined, graphKind: "complex_ext" };
  }

  if (normalized === "complex_intra") {
    return { graphType: typeof graphType === "string" ? graphType : undefined, graphKind: "complex_intra" };
  }

  if (normalized === "protein_neighborhood") {
    return { graphType: typeof graphType === "string" ? graphType : undefined, graphKind: "protein_neighborhood" };
  }

  if (normalized === "global_ppi_neighborhood") {
    return { graphType: typeof graphType === "string" ? graphType : undefined, graphKind: "global_ppi_neighborhood" };
  }

  return { graphType: typeof graphType === "string" ? graphType : undefined, graphKind: "unknown" };
}

export function getEdgeEvidenceFlags(edge: DetailRecord): EdgeEvidenceFlags {
  return {
    hasDDI: toBoolean(edge.hasDDI),
    hasDMI: toBoolean(edge.hasDMI),
    hasStructuralEvidence: toBoolean(edge.hasStructuralEvidence),
    isConfirmedPpi: toBoolean(edge.isConfirmedPpi),
    isCoComplexOnly: toBoolean(edge.isCoComplexOnly),
    isSubunitOfOtherComplex: getComplexExternalOtherComplexFlag(edge),
  };
}

export function getEdgeSemanticKind(
  edge: DetailRecord,
  _profile?: NetworkSemanticProfile
): EdgeSemanticKind {
  void _profile;

  switch (asRelationKind(edge.relationKind)) {
    case "protein_physical_interaction":
      return "protein_ppi";
    case "complex_subunit_pair_supported":
      return "complex_intra_confirmed_ppi";
    case "complex_subunit_pair_co_membership_only":
      return "complex_intra_co_complex_only";
    case "complex_external_partner":
      return "complex_external_partner";
    default:
      return "unknown";
  }
}

export function getEdgeVisualRole(
  edge: DetailRecord,
  profile?: NetworkSemanticProfile
): EdgeVisualRole {
  switch (getEdgeSemanticKind(edge, profile)) {
    case "protein_ppi":
      return "protein_ppi";
    case "complex_intra_confirmed_ppi":
      return "complex_intra_confirmed";
    case "complex_intra_co_complex_only":
      return "complex_intra_co_complex_only";
    case "complex_external_partner":
      return "complex_external_partner";
    default:
      return "unknown";
  }
}

export function getEdgeStatusBadges(
  edge: DetailRecord,
  profile?: NetworkSemanticProfile
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
      active: kind === "protein_ppi" || kind === "complex_intra_confirmed_ppi",
      activeLabel: "Confirmed direct PPI",
      inactiveLabel: "Not confirmed direct PPI",
    },
    {
      key: "co-complex-only",
      active: kind === "complex_intra_co_complex_only",
      activeLabel: "Co-complex only",
      inactiveLabel: "Not co-complex only",
    },
  ];
}

export function getComplexExternalExplanation(
  edge: DetailRecord,
  profile?: NetworkSemanticProfile
): ComplexExternalExplanation | null {
  if (getEdgeSemanticKind(edge, profile) !== "complex_external_partner") {
    return null;
  }

  return getComplexExternalExplanationFields(edge, {
    isSubunitOfOtherComplex: getEdgeEvidenceFlags(edge).isSubunitOfOtherComplex,
  });
}

export function getEdgeSemanticModel(
  edge: DetailRecord,
  profile?: NetworkSemanticProfile
): EdgeSemanticModel {
  return {
    kind: getEdgeSemanticKind(edge, profile),
    visualRole: getEdgeVisualRole(edge, profile),
    flags: getEdgeEvidenceFlags(edge),
    statusBadges: getEdgeStatusBadges(edge, profile),
    complexExternalExplanation: getComplexExternalExplanation(edge, profile),
  };
}
