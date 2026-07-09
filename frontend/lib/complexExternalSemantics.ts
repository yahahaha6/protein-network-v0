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

type ValueLookup = {
  found: boolean;
  value: unknown;
};

const EMPTY_TEXT_VALUES = new Set([
  "",
  "nan",
  "none",
  "null",
  "undefined",
  "n/a",
  "na",
  "no data",
  "not available",
  "missing",
  "暂无数据",
  "无数据",
  "-",
  "—",
]);

function isRecord(value: unknown): value is NetworkDetailRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: NetworkDetailRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function rawOf(record: NetworkDetailRecord): NetworkDetailRecord | null {
  return isRecord(record.raw) ? record.raw : null;
}

function hasLegacySemanticValue(value: unknown): boolean {
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
    return !EMPTY_TEXT_VALUES.has(value.trim().toLowerCase());
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

function firstStandardValue(
  edge: NetworkDetailRecord,
  keys: string[]
): ValueLookup {
  for (const key of keys) {
    if (hasOwn(edge, key)) {
      return {
        found: true,
        value: edge[key],
      };
    }
  }

  return {
    found: false,
    value: undefined,
  };
}

function firstLegacyRawValue(
  edge: NetworkDetailRecord,
  keys: string[]
): unknown {
  const raw = rawOf(edge);

  if (!raw) {
    return undefined;
  }

  for (const key of keys) {
    if (!hasOwn(raw, key)) {
      continue;
    }

    const value = raw[key];

    if (hasLegacySemanticValue(value)) {
      return value;
    }
  }

  return undefined;
}

function firstStandardThenLegacyRawValue(
  edge: NetworkDetailRecord,
  standardKeys: string[],
  legacyRawKeys: string[]
): unknown {
  const standard = firstStandardValue(edge, standardKeys);

  if (standard.found) {
    return standard.value;
  }

  return firstLegacyRawValue(edge, legacyRawKeys);
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
    .filter(hasLegacySemanticValue)
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
  const standard = firstStandardValue(edge, ["isSubunitOfOtherComplex"]);

  if (standard.found) {
    return toBoolean(standard.value);
  }

  return toBoolean(
    firstLegacyRawValue(edge, [
      "isSubunitOfOtherComplex",
      "is_subunit_of_other_complex",
      "is_subunit_of_complex",
    ])
  );
}

export function getComplexExternalExplanationFields(
  edge: ComplexExternalEdgeRecord,
  options: { isSubunitOfOtherComplex?: boolean } = {}
): ComplexExternalExplanationFields {
  return {
    externalPartnerGene: firstStandardThenLegacyRawValue(
      edge,
      ["externalPartnerGene"],
      ["externalPartnerGene", "extGeneName", "targetGene", "target"]
    ),
    mediatingSubunitIds:
      standardMediatingSubunitFieldValues(edge, "id") ??
      firstStandardThenLegacyRawValue(
        edge,
        ["mediatingSubunitIds"],
        ["mediatingSubunitIds", "mediating_subunit_ids"]
      ),
    mediatingSubunitGenes:
      standardMediatingSubunitFieldValues(edge, "gene") ??
      firstStandardThenLegacyRawValue(
        edge,
        ["mediatingSubunitGenes"],
        ["mediatingSubunitGenes", "mediating_subunit_genes"]
      ),
    nMediatingSubunits:
      standardMediatingSubunitCount(edge) ??
      firstStandardThenLegacyRawValue(
        edge,
        ["nMediatingSubunits"],
        ["nMediatingSubunits", "n_mediating_subunits"]
      ),
    isSubunitOfOtherComplex:
      options.isSubunitOfOtherComplex ?? getComplexExternalOtherComplexFlag(edge),
    otherComplexIds: firstStandardThenLegacyRawValue(
      edge,
      ["otherComplexIds"],
      ["otherComplexIds", "other_complex_ids"]
    ),
  };
}
