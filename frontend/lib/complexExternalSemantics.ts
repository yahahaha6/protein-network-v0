import type {
  ComplexExternalEdgeFields,
  NetworkDetailRecord,
} from "./networkTypes";

export type ComplexExternalExplanationFields = {
  externalPartnerGene: unknown;
  mediatingSubunitIds: unknown;
  mediatingSubunitGenes: unknown;
  nMediatingSubunits: unknown;
  isSubunitOfOtherComplex: boolean;
  otherComplexIds: unknown;
};

type ComplexExternalEdgeRecord = NetworkDetailRecord &
  Partial<ComplexExternalEdgeFields>;

function isRecord(value: unknown): value is NetworkDetailRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: NetworkDetailRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}
function hasCanonicalValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as NetworkDetailRecord).length > 0;
  }

  return true;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    return ["true", "1", "yes", "y"].includes(normalized);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

function standardMediatingSubunitRecords(edge: ComplexExternalEdgeRecord) {
  if (!hasOwn(edge, "mediatingSubunits")) {
    return {
      found: false,
      records: [] as NetworkDetailRecord[],
    };
  }

  const value = edge.mediatingSubunits;

  if (!Array.isArray(value)) {
    return {
      found: true,
      records: [] as NetworkDetailRecord[],
    };
  }

  return {
    found: true,
    records: value.filter(isRecord),
  };
}

function standardMediatingSubunitFieldValues(
  edge: ComplexExternalEdgeRecord,
  field: "id" | "gene" | "displayName"
): string[] | undefined {
  const { found, records } = standardMediatingSubunitRecords(edge);

  if (!found) {
    return undefined;
  }

  return records
    .map((subunit) => subunit[field])
    .filter(hasCanonicalValue)
    .map(String);
}

function standardMediatingSubunitCount(
  edge: ComplexExternalEdgeRecord
): number | undefined {
  const { found, records } = standardMediatingSubunitRecords(edge);

  if (!found) {
    return undefined;
  }

  return records.length;
}

export function getComplexExternalOtherComplexFlag(
  edge: ComplexExternalEdgeRecord
): boolean {
  return hasOwn(edge, "isSubunitOfOtherComplex")
    ? toBoolean(edge.isSubunitOfOtherComplex)
    : false;
}

export function getComplexExternalExplanationFields(
  edge: ComplexExternalEdgeRecord,
  options: { isSubunitOfOtherComplex?: boolean } = {}
): ComplexExternalExplanationFields {
  return {
    externalPartnerGene: edge.externalPartnerGene,
    mediatingSubunitIds: standardMediatingSubunitFieldValues(edge, "id"),
    mediatingSubunitGenes: standardMediatingSubunitFieldValues(edge, "gene"),
    nMediatingSubunits: standardMediatingSubunitCount(edge),
    isSubunitOfOtherComplex:
      options.isSubunitOfOtherComplex ?? getComplexExternalOtherComplexFlag(edge),
    otherComplexIds: edge.otherComplexIds,
  };
}
