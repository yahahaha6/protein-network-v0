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
function normalizeToken(value: string) {
  return value.trim().replace(/^["'([{]+|["')\]}.,;:]+$/g, "");
}

function isLikelyUniprotId(value: string) {
  return /^[OPQ][0-9][A-Z0-9]{3}[0-9]$/.test(value) || /^[A-NR-Z][0-9][A-Z][A-Z0-9]{2}[0-9]$/.test(value);
}

function isLikelyPmid(value: string) {
  return /^[1-9][0-9]{5,8}$/.test(value);
}

function isLikelyPdbId(value: string) {
  return /^[0-9][A-Za-z0-9]{3}$/.test(value);
}

function externalLinkForToken(token: string) {
  const cleaned = normalizeToken(token);

  if (!cleaned) {
    return null;
  }

  if (cleaned.toLowerCase().startsWith("pmid:")) {
    const pmid = cleaned.slice(5);
    return {
      label: cleaned,
      href: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      type: "PubMed",
    };
  }

  if (isLikelyUniprotId(cleaned)) {
    return {
      label: cleaned,
      href: `https://www.uniprot.org/uniprotkb/${cleaned}/entry`,
      type: "UniProt",
    };
  }

  if (isLikelyPdbId(cleaned)) {
    return {
      label: cleaned.toUpperCase(),
      href: `https://www.rcsb.org/structure/${cleaned.toUpperCase()}`,
      type: "RCSB PDB",
    };
  }

  if (isLikelyPmid(cleaned)) {
    return {
      label: cleaned,
      href: `https://pubmed.ncbi.nlm.nih.gov/${cleaned}/`,
      type: "PubMed",
    };
  }

  return null;
}

function renderExternalToken(token: string): ReactNode {
  const link = externalLinkForToken(token);

  if (!link) {
    return token;
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-100"
      title={`Open ${link.type}`}
    >
      {link.label}
    </a>
  );
}

function renderLinkedText(value: string): ReactNode {
  const parts = value.split(/(\s+|[,;|])/g);

  return (
    <>
      {parts.map((part, index) => {
        if (/^(\s+|[,;|])$/.test(part)) {
          return part;
        }

        return <span key={`${part}-${index}`}>{renderExternalToken(part)}</span>;
      })}
    </>
  );
}

function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-500">N/A</span>;
  }

    if (typeof value === "string") {
    return <span>{renderLinkedText(value)}</span>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
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