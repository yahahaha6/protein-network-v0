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
  showInteractionEvidence: boolean;
  showFeatureAnnotations: boolean;
  showCoMembershipExplanation: boolean;
  showExternalMediation: boolean;
  coMembership: { complexId?: unknown; complexName?: unknown } | null;
  externalMediation: ReturnType<typeof getComplexExternalExplanationFields> | null;
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

  return {
    relationKind,
    relationLabel: presentation.label,
    relationDescription: presentation.description,
    source: String(edge.source ?? "Unknown source"),
    target: String(edge.target ?? "Unknown target"),
    evidence: summaryOf(edge.evidenceSummary),
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
