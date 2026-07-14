export type NetworkDetailRecord = Record<string, unknown>;

export type RelationKind =
  | "protein_physical_interaction"
  | "complex_subunit_pair_supported"
  | "complex_subunit_pair_co_membership_only"
  | "complex_external_partner";

export type EvidenceSummary = {
  sourceCount: number | null;
  methodCount: number | null;
  publicationCount: number | null;
  structureCount: number | null;
  ddiRecordCount: number | null;
  dmiRecordCount: number | null;
  goldRecordCount: number | null;
};

export type NetworkExternalLink = {
  label?: string;
  url?: string;
  type?: string;
  [key: string]: unknown;
};

export type MediatingSubunit = {
  id: string;
  gene?: string | null;
  displayName?: string | null;
  externalLinks?: NetworkExternalLink[];
};

export type ComplexExternalEdgeFields = {
  mediatingSubunits?: MediatingSubunit[];
  externalPartnerId?: string | null;
  externalPartnerGene?: string | null;
  isSubunitOfOtherComplex?: boolean | null;
  otherComplexIds?: string[];
};

export type CanonicalNetworkEdge = ComplexExternalEdgeFields & {
  id: string;
  source: string;
  target: string;
  relationKind: RelationKind;
  label?: string | null;
  evidenceSources: string[];
  methods: string[];
  publications: string[];
  supportingStructures: string[];
  ddi: string[];
  dmi: string[];
  hasDDI: boolean;
  hasDMI: boolean;
  hasStructuralEvidence: boolean;
  isConfirmedPpi: boolean;
  isCoComplexOnly: boolean;
  evidenceSummary: EvidenceSummary;
  externalLinks?: NetworkExternalLink[];
  complexId?: string | null;
  complexName?: string | null;
};
