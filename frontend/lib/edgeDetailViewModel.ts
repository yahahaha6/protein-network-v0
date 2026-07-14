import {
  getComplexExternalExplanationFields,
  getComplexExternalOtherComplexFlag,
} from "@/lib/complexExternalSemantics";
import { getRelationPresentation } from "@/lib/networkPresentation";
import type {
  EvidenceSummary,
  RelationKind,
  NetworkDetailRecord,
} from "@/lib/networkTypes";

type EdgeDetailInput = NetworkDetailRecord & {
  relationKind?: RelationKind;
  source?: string;
  target?: string;
  evidenceSummary?: Partial<EvidenceSummary>;
};

export type EdgeDetailViewModel = {
  relationKind: RelationKind;
  relationLabel: string;
  relationDescription: string;
  source: string;
  target: string;
  evidence: EvidenceSummary;
  reportedCounts: ReportedCountViewModel[];
  showInteractionEvidence: boolean;
  showFeatureAnnotations: boolean;
  showCoMembershipExplanation: boolean;
  showExternalMediation: boolean;
  coMembership: { complexId?: unknown; complexName?: unknown } | null;
  externalMediation: ReturnType<typeof getComplexExternalExplanationFields> | null;
};

export type ReportedCountViewModel = {
  key: keyof EvidenceSummary;
  label: string;
  value: number | null;
  display: string;
  detailStatus: string | null;
};

const RELATION_KINDS = new Set<RelationKind>([
  "protein_physical_interaction",
  "complex_subunit_pair_supported",
  "complex_subunit_pair_co_membership_only",
  "complex_external_partner",
]);

function summaryOf(summary?: Partial<EvidenceSummary>): EvidenceSummary {
  return {
    sourceCount: summary?.sourceCount ?? null,
    methodCount: summary?.methodCount ?? null,
    publicationCount: summary?.publicationCount ?? null,
    structureCount: summary?.structureCount ?? null,
    ddiRecordCount: summary?.ddiRecordCount ?? null,
    dmiRecordCount: summary?.dmiRecordCount ?? null,
    goldRecordCount: summary?.goldRecordCount ?? null,
  };
}

export function formatReportedCount(count: number | null | undefined): string {
  if (count === null || count === undefined) {
    return "Not reported by source";
  }

  if (count === 0) {
    return "Source reported 0 records";
  }

  return `${count} records reported`;
}

export function formatReportedCountDetails(
  count: number | null | undefined,
  details?: unknown[]
): string | null {
  if (details === undefined) {
    return null;
  }

  if (count !== null && count !== undefined && count > 0 && details.length === 0) {
    return "Count reported; details unavailable";
  }

  if ((count === null || count === undefined) && details.length > 0) {
    return "Details available; count not reported";
  }

  return null;
}

function buildReportedCounts(
  evidence: EvidenceSummary,
  edge: EdgeDetailInput
): ReportedCountViewModel[] {
  const detailsOf = (value: unknown) =>
    Array.isArray(value) ? value : undefined;
  const definitions: Array<{
    key: keyof EvidenceSummary;
    label: string;
    details?: unknown[];
  }> = [
    {
      key: "sourceCount",
      label: "Source count",
      details: detailsOf(edge.evidenceSources),
    },
    {
      key: "methodCount",
      label: "Method count",
      details: detailsOf(edge.methods),
    },
    {
      key: "publicationCount",
      label: "Publication count",
      details: detailsOf(edge.publications),
    },
    {
      key: "structureCount",
      label: "Structure count",
      details: detailsOf(edge.supportingStructures),
    },
    {
      key: "ddiRecordCount",
      label: "DDI record count",
      details: detailsOf(edge.ddi),
    },
    {
      key: "dmiRecordCount",
      label: "DMI record count",
      details: detailsOf(edge.dmi),
    },
    { key: "goldRecordCount", label: "Gold record count" },
  ];

  return definitions.map(({ key, label, details }) => ({
    key,
    label,
    value: evidence[key],
    display: formatReportedCount(evidence[key]),
    detailStatus: formatReportedCountDetails(evidence[key], details),
  }));
}

export function buildEdgeDetailViewModel(
  edge: EdgeDetailInput
): EdgeDetailViewModel {
  if (!edge.relationKind || !RELATION_KINDS.has(edge.relationKind)) {
    throw new Error("Selected edge is missing a canonical relationKind");
  }

  const relationKind = edge.relationKind;
  const presentation = getRelationPresentation(relationKind);
  const isCoMembership =
    relationKind === "complex_subunit_pair_co_membership_only";
  const isExternal = relationKind === "complex_external_partner";
  const supportsInteractionEvidence = !isCoMembership;
  const evidence = summaryOf(edge.evidenceSummary);

  return {
    relationKind,
    relationLabel: presentation.label,
    relationDescription: presentation.description,
    source: String(edge.source ?? "Unknown source"),
    target: String(edge.target ?? "Unknown target"),
    evidence,
    reportedCounts: buildReportedCounts(evidence, edge),
    showInteractionEvidence: supportsInteractionEvidence,
    showFeatureAnnotations: supportsInteractionEvidence,
    showCoMembershipExplanation: isCoMembership,
    showExternalMediation: isExternal,
    coMembership: isCoMembership
      ? { complexId: edge.complexId, complexName: edge.complexName }
      : null,
    externalMediation: isExternal
      ? getComplexExternalExplanationFields(edge, {
          isSubunitOfOtherComplex: getComplexExternalOtherComplexFlag(edge),
        })
      : null,
  };
}
