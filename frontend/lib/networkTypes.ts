export type NetworkDetailRecord = Record<string, unknown>;

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
