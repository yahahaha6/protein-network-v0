"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type SearchResult = {
  id?: string;
  label?: string;
  name?: string;
  type?: string;
  uniprot_ac?: string;
  complex_id?: string;
  description?: string;
};

type SearchApiResponse =
  | SearchResult[]
  | {
      query?: string;
      type?: string;
      count?: number;
      results?: SearchResult[];
      proteins?: SearchResult[];
      complexes?: SearchResult[];
    };

function normalizeSearchResults(data: SearchApiResponse): SearchResult[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  const merged: SearchResult[] = [];

  if (Array.isArray(data.proteins)) {
    merged.push(...data.proteins);
  }

  if (Array.isArray(data.complexes)) {
    merged.push(...data.complexes);
  }

  return merged;
}

function getResultTitle(result: SearchResult) {
  return result.label || result.name || result.id || "Unknown result";
}

function getResultType(result: SearchResult) {
  return result.type || "unknown";
}

function getResultHref(result: SearchResult) {
  const type = getResultType(result).toLowerCase();

  if (type.includes("protein")) {
    const proteinId = result.uniprot_ac || result.id;
    return proteinId ? `/protein/${proteinId}` : "#";
  }

  if (type.includes("complex")) {
    const rawComplexId = result.complex_id || result.id || "";
    const complexId = rawComplexId.replace("CORUM:", "");
    return complexId ? `/complex/${complexId}` : "#";
  }

  return "#";
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setError("Please enter a protein or complex keyword.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch(
        `http://localhost:8000/api/search?q=${encodeURIComponent(
          trimmedQuery
        )}&type=all`
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data: SearchApiResponse = await response.json();
      const normalizedResults = normalizeSearchResults(data);

      setResults(normalizedResults);
    } catch (err) {
      console.error(err);
      setError(
        "Search failed. Please make sure the FastAPI backend is running on http://localhost:8000."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
        <div className="mb-12">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Protein Network Explorer
          </p>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Explore proteins, complexes, and PPI networks
          </h1>

          <p className="max-w-2xl text-base leading-7 text-slate-300">
            Search for proteins such as EZH2 or TP53, or complexes such as
            PRC2/3 and CORUM:996. This V0 frontend connects to your FastAPI
            backend and will visualize network data with Cytoscape.js.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <form onSubmit={handleSearch}>
            <label
              htmlFor="search"
              className="mb-3 block text-sm font-medium text-slate-200"
            >
              Search protein or complex
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try EZH2, TP53, PRC2, or 996"
                className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />

              <button
                type="submit"
                disabled={loading}
                className="min-h-12 rounded-xl bg-cyan-500 px-6 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            {error && (
              <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {!error && !loading && results.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                Search results will appear here.
              </div>
            )}

            {!error && results.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Found {results.length} result{results.length > 1 ? "s" : ""}.
                </p>

                {results.map((result, index) => {
                  const title = getResultTitle(result);
                  const type = getResultType(result);
                  const href = getResultHref(result);

                  return (
                    <Link
                      key={`${title}-${index}`}
                      href={href}
                      className="block rounded-xl border border-slate-800 bg-slate-950 p-4 transition hover:border-cyan-500 hover:bg-slate-900"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="font-semibold text-slate-100">
                            {title}
                          </h2>

                          <p className="mt-1 text-sm text-slate-400">
                            ID: {result.uniprot_ac || result.complex_id || result.id || "N/A"}
                          </p>

                          {result.description && (
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {result.description}
                            </p>
                          )}
                        </div>

                        <span className="w-fit rounded-full border border-cyan-700 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-300">
                          {type}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}