import type { ReactNode } from "react";

type DetailFieldsProps = {
  title: string;
  data: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-500">N/A</span>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500">N/A</span>;
    }

    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
          >
            {isPlainObject(item) ? (
              <div className="space-y-2">
                {Object.entries(item).map(([itemKey, itemValue]) => (
                  <div key={itemKey} className="grid gap-1 sm:grid-cols-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatKey(itemKey)}
                    </div>

                    <div className="whitespace-pre-wrap break-words text-sm text-slate-200 sm:col-span-3">
                      {renderValue(itemValue)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-sm text-slate-200">
                {renderValue(item)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([nestedKey, nestedValue]) => (
          <div
            key={nestedKey}
            className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatKey(nestedKey)}
            </div>

            <div className="whitespace-pre-wrap break-words text-sm text-slate-200">
              {renderValue(nestedValue)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

export default function DetailFields({ title, data }: DetailFieldsProps) {
  const entries = Object.entries(data);

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>

      <div className="space-y-4">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">
              {formatKey(key)}
            </div>

            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
              {renderValue(value)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}