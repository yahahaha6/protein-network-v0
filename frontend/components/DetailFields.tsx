import Link from "next/link";
import type { ReactNode } from "react";

import {
  formatCompactDetailValue,
  isEmptyDetailValue,
} from "@/lib/detailPresentation";

type DetailRecord = Record<string, unknown>;

type DetailFieldsProps = {
  title: string;
  data: DetailRecord;
};

const LIST_PREVIEW_LIMIT = 12;
const LONG_TEXT_LIMIT = 220;
const OBJECT_PREVIEW_LIMIT = 6;

function isRecord(value: unknown): value is DetailRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toUpperCase();
}

function isDelimitedListField(key: string, value: string): boolean {
  const normalizedKey = key.toLowerCase();

  if (!/[;,|]/.test(value)) {
    return false;
  }

  return (
    normalizedKey.includes("ids") ||
    normalizedKey.includes("idlist") ||
    normalizedKey.includes("complex") ||
    normalizedKey.includes("publication") ||
    normalizedKey.includes("pubmed") ||
    normalizedKey.includes("sources") ||
    normalizedKey.includes("methods")
  );
}

function splitDelimitedList(value: string): string[] {
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter((item) => !isEmptyDetailValue(item));
}

function toFieldListItems(key: string, value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    const meaningfulItems = value.filter((item) => !isEmptyDetailValue(item));
    return meaningfulItems.length > 0 ? meaningfulItems : null;
  }

  if (typeof value === "string" && isDelimitedListField(key, value)) {
    const items = splitDelimitedList(value);
    return items.length > 1 ? items : null;
  }

  return null;
}

function sortEntries(entries: [string, unknown][]) {
  const noisyKeys = new Set(["raw", "metadata", "debug"]);

  return [...entries].sort(([leftKey], [rightKey]) => {
    const leftNoisy = noisyKeys.has(leftKey);
    const rightNoisy = noisyKeys.has(rightKey);

    if (leftNoisy !== rightNoisy) {
      return leftNoisy ? 1 : -1;
    }

    return leftKey.localeCompare(rightKey);
  });
}

function getVisibleEntries(data: DetailRecord) {
  return sortEntries(
    Object.entries(data).filter(([, value]) => !isEmptyDetailValue(value))
  );
}

function renderLinkedListItem(key: string, value: unknown): ReactNode {
  const text = formatCompactDetailValue(value, {
    maxItems: 4,
    maxObjectFields: 4,
    maxTextLength: 120,
  });

  const normalizedKey = key.toLowerCase();
  const cleanText = text.replace(/^CORUM:/i, "").replace(/^UniProt:/i, "");

  if (normalizedKey.includes("complex") && /^[0-9]+$/.test(cleanText)) {
    return (
      <Link
        href={`/complex/${cleanText}`}
        className="text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
      >
        {cleanText}
      </Link>
    );
  }

  if (/^[A-Z0-9]{6,10}$/.test(cleanText)) {
    return (
      <Link
        href={`/protein/${cleanText}`}
        className="text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
      >
        {cleanText}
      </Link>
    );
  }

  return text;
}

function renderListField(key: string, items: unknown[]) {
  const meaningfulItems = items.filter((item) => !isEmptyDetailValue(item));
  const visibleItems = meaningfulItems.slice(0, LIST_PREVIEW_LIMIT);
  const hiddenItems = meaningfulItems.slice(LIST_PREVIEW_LIMIT);

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {visibleItems.map((item, index) => (
          <div
            key={`${key}-${index}-${String(item)}`}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
          >
            {renderLinkedListItem(key, item)}
          </div>
        ))}
      </div>

      {hiddenItems.length > 0 && (
        <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
            Show remaining {hiddenItems.length} of {meaningfulItems.length}
          </summary>

          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
            {hiddenItems.map((item, index) => (
              <div
                key={`${key}-hidden-${index}-${String(item)}`}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
              >
                {renderLinkedListItem(key, item)}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function renderObjectField(value: DetailRecord) {
  const entries = getVisibleEntries(value);
  const visibleEntries = entries.slice(0, OBJECT_PREVIEW_LIMIT);
  const hiddenCount = Math.max(entries.length - visibleEntries.length, 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {visibleEntries.map(([entryKey, entryValue]) => (
          <div
            key={entryKey}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {formatFieldLabel(entryKey)}
            </p>
            <p className="mt-1 break-words text-slate-200">
              {formatCompactDetailValue(entryValue, {
                maxItems: 6,
                maxObjectFields: 3,
                maxTextLength: 120,
              })}
            </p>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
            Show full object with {entries.length} fields
          </summary>

          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function renderTextField(value: string) {
  const trimmed = value.trim();

  if (trimmed.length <= LONG_TEXT_LIMIT) {
    return <p className="break-words text-sm text-slate-200">{trimmed}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="break-words text-sm text-slate-200">
        {trimmed.slice(0, LONG_TEXT_LIMIT).trimEnd()}…
      </p>

      <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
          Show full text
        </summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-200">
          {trimmed}
        </p>
      </details>
    </div>
  );
}

function renderFieldValue(key: string, value: unknown) {
  const listItems = toFieldListItems(key, value);

  if (listItems) {
    return renderListField(key, listItems);
  }

  if (typeof value === "string") {
    return renderTextField(value);
  }

  if (isRecord(value)) {
    return renderObjectField(value);
  }

  return (
    <p className="break-words text-sm text-slate-200">
      {formatCompactDetailValue(value)}
    </p>
  );
}

export default function DetailFields({ title, data }: DetailFieldsProps) {
  const entries = getVisibleEntries(data);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        {title}
      </p>

      <div className="mt-3 grid gap-3">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatFieldLabel(key)}
            </p>

            <div className="mt-2">{renderFieldValue(key, value)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
