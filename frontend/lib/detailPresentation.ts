export type DetailPreviewOptions = {
  maxItems?: number;
  maxObjectFields?: number;
  maxTextLength?: number;
};

export type DetailListPreview = {
  items: string[];
  hiddenCount: number;
};

const DEFAULT_MAX_ITEMS = 12;
const DEFAULT_MAX_OBJECT_FIELDS = 6;
const DEFAULT_MAX_TEXT_LENGTH = 180;

const EMPTY_DETAIL_TEXTS = new Set([
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
  "[]",
  "{}",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isEmptyDetailValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return EMPTY_DETAIL_TEXTS.has(value.trim().toLowerCase());
  }

  if (Array.isArray(value)) {
    return value.every((item) => isEmptyDetailValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isEmptyDetailValue(item));
  }

  return false;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}…`;
}

function stringifyPrimitive(value: unknown, maxTextLength: number): string {
  if (isEmptyDetailValue(value)) {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "N/A";
  }

  if (typeof value === "string") {
    return truncateText(value.trim(), maxTextLength);
  }

  return truncateText(String(value), maxTextLength);
}

function formatObjectPreview(
  value: Record<string, unknown>,
  maxObjectFields: number,
  maxTextLength: number
): string {
  const entries = Object.entries(value).filter(([, entryValue]) => {
    return !isEmptyDetailValue(entryValue);
  });

  if (entries.length === 0) {
    return "N/A";
  }

  const visibleEntries = entries.slice(0, maxObjectFields);
  const hiddenCount = Math.max(entries.length - visibleEntries.length, 0);

  const preview = visibleEntries
    .map(([key, entryValue]) => {
      if (Array.isArray(entryValue)) {
        const meaningfulItems = entryValue.filter(
          (item) => !isEmptyDetailValue(item)
        );
        return `${key}: ${meaningfulItems.length} items`;
      }

      if (isRecord(entryValue)) {
        const meaningfulFields = Object.values(entryValue).filter(
          (item) => !isEmptyDetailValue(item)
        );
        return `${key}: ${meaningfulFields.length} fields`;
      }

      return `${key}: ${stringifyPrimitive(entryValue, maxTextLength)}`;
    })
    .join("; ");

  if (hiddenCount > 0) {
    return `${preview}; + ${hiddenCount} more fields`;
  }

  return preview;
}

export function formatCompactDetailValue(
  value: unknown,
  options: DetailPreviewOptions = {}
): string {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const maxObjectFields = options.maxObjectFields ?? DEFAULT_MAX_OBJECT_FIELDS;
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

  if (isEmptyDetailValue(value)) {
    return "N/A";
  }

  if (Array.isArray(value)) {
    const meaningfulItems = value.filter((item) => !isEmptyDetailValue(item));
    const visibleItems = meaningfulItems.slice(0, maxItems).map((item) => {
      if (Array.isArray(item)) {
        const nestedItems = item.filter((nested) => !isEmptyDetailValue(nested));
        return `${nestedItems.length} items`;
      }

      if (isRecord(item)) {
        return formatObjectPreview(item, maxObjectFields, maxTextLength);
      }

      return stringifyPrimitive(item, maxTextLength);
    });

    const hiddenCount = Math.max(meaningfulItems.length - visibleItems.length, 0);
    const suffix = hiddenCount > 0 ? `, + ${hiddenCount} more` : "";

    return `${visibleItems.join(", ")}${suffix}`;
  }

  if (isRecord(value)) {
    return formatObjectPreview(value, maxObjectFields, maxTextLength);
  }

  return stringifyPrimitive(value, maxTextLength);
}

export function toDetailListPreview(
  value: unknown,
  options: DetailPreviewOptions = {}
): DetailListPreview {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const maxObjectFields = options.maxObjectFields ?? DEFAULT_MAX_OBJECT_FIELDS;
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

  if (isEmptyDetailValue(value)) {
    return {
      items: [],
      hiddenCount: 0,
    };
  }

  const sourceItems = Array.isArray(value) ? value : [value];
  const meaningfulItems = sourceItems.filter((item) => !isEmptyDetailValue(item));

  const visibleItems = meaningfulItems.slice(0, maxItems).map((item) => {
    if (Array.isArray(item)) {
      const nestedItems = item.filter((nested) => !isEmptyDetailValue(nested));
      return `${nestedItems.length} items`;
    }

    if (isRecord(item)) {
      return formatObjectPreview(item, maxObjectFields, maxTextLength);
    }

    return stringifyPrimitive(item, maxTextLength);
  });

  return {
    items: visibleItems,
    hiddenCount: Math.max(meaningfulItems.length - visibleItems.length, 0),
  };
}
