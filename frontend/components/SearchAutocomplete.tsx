"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = Record<string, unknown>;

type NormalizedResult = {
  id: string;
  type: "protein" | "complex" | "unknown";
  title: string;
  subtitle: string;
  href: string | null;
  raw: SearchResult;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function firstDefined(data: SearchResult, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function normalizeType(value: unknown): NormalizedResult["type"] {
  const text = String(value || "").toLowerCase();

  if (text.includes("protein") || text.includes("uniprot")) {
    return "protein";
  }

  if (text.includes("complex") || text.includes("corum")) {
    return "complex";
  }

  return "unknown";
}

function normalizeSearchPayload(payload: unknown): SearchResult[] {
  if (Array.isArray(payload)) {
    return payload as SearchResult[];
  }

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;

    if (Array.isArray(obj.results)) {
      return obj.results as SearchResult[];
    }

    if (Array.isArray(obj.items)) {
      return obj.items as SearchResult[];
    }

    if (Array.isArray(obj.data)) {
      return obj.data as SearchResult[];
    }
  }

  return [];
}

function normalizeResult(result: SearchResult): NormalizedResult {
  const rawType = firstDefined(result, ["type", "record_type", "kind", "category"]);
  let type = normalizeType(rawType);

  const uniprotId = firstDefined(result, [
    "uniprot_ac",
    "uniprot",
    "uniprot_id",
    "protein_id",
    "id",
  ]);

  const complexId = firstDefined(result, [
    "complex_id",
    "corum_id",
    "complexId",
    "id",
  ]);

  if (type === "unknown") {
    if (uniprotId && /^[A-Z0-9]{6,10}$/.test(String(uniprotId))) {
      type = "protein";
    } else if (complexId && /^[0-9]+$/.test(String(complexId))) {
      type = "complex";
    }
  }

  const id =
    type === "complex"
      ? String(complexId || "")
      : String(uniprotId || complexId || "");

  const title = String(
    firstDefined(result, [
      "label",
      "name",
      "protein_name",
      "complex_name",
      "gene_symbol",
      "gene",
      "title",
      "id",
    ]) || id || "Unknown result"
  );

  const subtitleParts = [
    type.toUpperCase(),
    firstDefined(result, ["gene_symbol", "gene"]),
    type === "protein" ? uniprotId : complexId,
    type === "complex" ? firstDefined(result, ["n_subunits", "subunit_count"]) : undefined,
  ]
    .filter((item) => item !== undefined && item !== null && item !== "")
    .map(String);

  const href =
    type === "protein" && id
      ? `/protein/${id}`
      : type === "complex" && id
        ? `/complex/${id}`
        : null;

  return {
    id,
    type,
    title,
    subtitle: subtitleParts.join(" · "),
    href,
    raw: result,
  };
}

function guessHrefFromQuery(query: string) {
  const trimmed = query.trim();

  if (/^[0-9]+$/.test(trimmed)) {
    return `/complex/${trimmed}`;
  }

  if (/^[A-Z0-9]{6,10}$/i.test(trimmed)) {
    return `/protein/${trimmed.toUpperCase()}`;
  }

  return null;
}

export default function SearchAutocomplete() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const trimmedQuery = query.trim();

  const canSearch = trimmedQuery.length >= 2;

  const guessedHref = useMemo(
    () => guessHrefFromQuery(trimmedQuery),
    [trimmedQuery]
  );

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setErrorMessage("");
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(trimmedQuery)}&type=all`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Search request failed: ${response.status}`);
        }

        const payload = await response.json();
        const normalized = normalizeSearchPayload(payload)
          .map(normalizeResult)
          .filter((item) => item.href);

        setResults(normalized);
        setHasSearched(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage("Search failed. Please check whether the backend is running.");
          setResults([]);
          setHasSearched(true);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, trimmedQuery]);

  function openResult(result: NormalizedResult) {
    if (result.href) {
      router.push(result.href);
    }
  }

  function submitSearch() {
    if (results[0]?.href) {
      router.push(results[0].href);
      return;
    }

    if (guessedHref) {
      router.push(guessedHref);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Search
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-100">
          Protein and complex lookup
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Search by UniProt ID, gene symbol, protein name, complex name, or
          complex ID.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitSearch();
            }
          }}
          placeholder="Try Q15910, EZH2, PHF1, PRC2, or 996"
          className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-cyan-500/40 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4"
        />

        <button
          type="button"
          onClick={submitSearch}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Open
        </button>
      </div>

      <div className="mt-4">
        {!canSearch && (
          <p className="text-sm text-slate-500">
            Type at least 2 characters to show suggestions.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-cyan-300">Searching candidates...</p>
        )}

        {errorMessage && (
          <p className="rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200">
            {errorMessage}
          </p>
        )}

        {hasSearched && !isLoading && canSearch && results.length === 0 && !errorMessage && (
          <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">
            No indexed result found for{" "}
            <span className="font-semibold">{trimmedQuery}</span>.
            {guessedHref ? (
              <span className="mt-2 block text-amber-200/80">
                It looks like a possible direct ID. Press Open to try opening the
                inferred detail page.
              </span>
            ) : (
              <span className="mt-2 block text-amber-200/80">
                This may mean the protein or complex is not present in the local
                demo dataset.
              </span>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suggestions
            </p>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}-${result.title}`}
                  type="button"
                  onClick={() => openResult(result)}
                  className="block w-full border-b border-slate-800 bg-slate-900/70 px-4 py-3 text-left last:border-b-0 hover:bg-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        result.type === "protein"
                          ? "rounded-full border border-cyan-700 bg-cyan-950/50 px-2 py-0.5 text-xs font-semibold text-cyan-200"
                          : "rounded-full border border-purple-700 bg-purple-950/50 px-2 py-0.5 text-xs font-semibold text-purple-200"
                      }
                    >
                      {result.type}
                    </span>

                    <span className="font-semibold text-slate-100">
                      {result.title}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    {result.subtitle || result.id}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}