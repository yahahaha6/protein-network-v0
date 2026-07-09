"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SearchMode = "protein" | "complex";

type SearchResult = Record<string, unknown>;

type NormalizedResult = {
  id: string;
  type: SearchMode | "unknown";
  title: string;
  subtitle: string;
  href: string | null;
  raw: SearchResult;
};

type SearchModeOption = {
  value: SearchMode;
  label: string;
  description: string;
  placeholder: string;
  examples: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const SEARCH_MODE_OPTIONS: SearchModeOption[] = [
  {
    value: "protein",
    label: "Protein",
    description: "Search UniProt IDs, gene symbols, or protein names.",
    placeholder: "Try Q15910, EZH2, TP53, or PHF1",
    examples: "Examples: Q15910, EZH2, TP53",
  },
  {
    value: "complex",
    label: "Complex",
    description: "Search CORUM IDs, complex names, or complex aliases.",
    placeholder: "Try 996, CORUM:996, PRC2/3, or PRC2",
    examples: "Examples: 996, CORUM:996, PRC2/3",
  },
];

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

function cleanProteinId(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^UniProt:/i, "")
    .toUpperCase();
}

function cleanComplexId(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^CORUM:/i, "");
}

function looksLikeProteinId(value: string) {
  return /^[A-Z0-9]{6,10}$/i.test(value);
}

function looksLikeComplexId(value: string) {
  return /^[0-9]+$/.test(value);
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

function normalizeResult(
  result: SearchResult,
  preferredMode: SearchMode
): NormalizedResult {
  const rawType = firstDefined(result, [
    "type",
    "record_type",
    "kind",
    "category",
  ]);

  let type = normalizeType(rawType);

  const rawUniprotId = firstDefined(result, [
    "uniprot_ac",
    "uniprot",
    "uniprot_id",
    "protein_id",
    "id",
  ]);

  const rawComplexId = firstDefined(result, [
    "complex_id",
    "corum_id",
    "complexId",
    "id",
  ]);

  const proteinId = cleanProteinId(rawUniprotId);
  const complexId = cleanComplexId(rawComplexId);

  if (type === "unknown") {
    if (preferredMode === "protein" && proteinId) {
      type = "protein";
    } else if (preferredMode === "complex" && complexId) {
      type = "complex";
    } else if (looksLikeProteinId(proteinId)) {
      type = "protein";
    } else if (looksLikeComplexId(complexId)) {
      type = "complex";
    }
  }

  const id =
    type === "complex"
      ? complexId
      : type === "protein"
        ? proteinId
        : String(rawUniprotId || rawComplexId || "").trim();

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
    ]) ||
      id ||
      "Unknown result"
  );

  const subtitleParts = [
    type.toUpperCase(),
    firstDefined(result, ["gene_symbol", "gene"]),
    type === "protein" ? proteinId : complexId,
    type === "complex"
      ? firstDefined(result, ["n_subunits", "subunit_count"])
      : undefined,
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

function guessHrefFromQuery(query: string, mode: SearchMode) {
  const trimmed = query.trim();

  if (mode === "complex") {
    const complexId = cleanComplexId(trimmed);

    return looksLikeComplexId(complexId) ? `/complex/${complexId}` : null;
  }

  const proteinId = cleanProteinId(trimmed);

  return looksLikeProteinId(proteinId) ? `/protein/${proteinId}` : null;
}

export default function SearchAutocomplete() {
  const router = useRouter();

  const [searchMode, setSearchMode] = useState<SearchMode>("protein");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  const activeMode =
    SEARCH_MODE_OPTIONS.find((option) => option.value === searchMode) ??
    SEARCH_MODE_OPTIONS[0];

  const guessedHref = useMemo(
    () => guessHrefFromQuery(trimmedQuery, searchMode),
    [searchMode, trimmedQuery]
  );

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/search?q=${encodeURIComponent(
            trimmedQuery
          )}&type=${searchMode}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Search request failed: ${response.status}`);
        }

        const payload = await response.json();
        const normalized = normalizeSearchPayload(payload)
          .map((item) => normalizeResult(item, searchMode))
          .filter((item) => item.href && item.type === searchMode);

        setResults(normalized);
        setHasSearched(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage(
            "Search failed. Please check whether the backend is running."
          );
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
  }, [canSearch, searchMode, trimmedQuery]);

  function handleSearchModeChange(nextMode: SearchMode) {
    if (nextMode === searchMode) {
      return;
    }

    setSearchMode(nextMode);
    setResults([]);
    setErrorMessage("");
    setHasSearched(false);
    setIsLoading(false);
  }

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

  function handleQueryChange(value: string) {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setErrorMessage("");
      setHasSearched(false);
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Search
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-100">
          {activeMode.label} lookup
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {activeMode.description}
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-2">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search target
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {SEARCH_MODE_OPTIONS.map((option) => {
            const isActive = option.value === searchMode;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleSearchModeChange(option.value)}
                className={
                  isActive
                    ? "rounded-lg border border-cyan-400 bg-cyan-500/20 px-4 py-3 text-left text-cyan-100"
                    : "rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-left text-slate-300 hover:border-slate-500 hover:bg-slate-900"
                }
              >
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {option.examples}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitSearch();
            }
          }}
          placeholder={activeMode.placeholder}
          className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-cyan-500/40 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4"
        />

        <button
          type="button"
          onClick={submitSearch}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Open {activeMode.label}
        </button>
      </div>

      <div className="mt-4">
        {!canSearch && (
          <p className="text-sm text-slate-500">
            Type at least 2 characters to search {searchMode} records.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-cyan-300">
            Searching {searchMode} candidates...
          </p>
        )}

        {errorMessage && (
          <p className="rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200">
            {errorMessage}
          </p>
        )}

        {hasSearched &&
          !isLoading &&
          canSearch &&
          results.length === 0 &&
          !errorMessage && (
            <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">
              No indexed {searchMode} result found for{" "}
              <span className="font-semibold">{trimmedQuery}</span>.
              {guessedHref ? (
                <span className="mt-2 block text-amber-200/80">
                  It looks like a possible direct {searchMode} ID. Press Open to
                  try opening the inferred detail page.
                </span>
              ) : (
                <span className="mt-2 block text-amber-200/80">
                  This may mean the {searchMode} is not present in the local demo
                  dataset, or the current search target is not the right one.
                </span>
              )}
            </div>
          )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {activeMode.label} suggestions
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
