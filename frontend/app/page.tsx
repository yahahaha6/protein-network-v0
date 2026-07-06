"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  getSearchResultHref,
  getSearchResultTitle,
  getSearchResultType,
  searchEntities,
  type SearchResult,
} from "@/lib/api";

type SearchType = "all" | "protein" | "complex";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
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
      const searchResults = await searchEntities(trimmedQuery, searchType);
      setResults(searchResults);
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
  Search for proteins such as EZH2 or TP53, complexes such as PRC2/3
  and CORUM:996, or open the Global PPI Explorer to inspect
  protein-centered interaction neighborhoods with edge evidence.
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

            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                id="search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try EZH2, TP53, PRC2, or 996"
                className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />

              <select
                value={searchType}
                onChange={(event) =>
                  setSearchType(event.target.value as SearchType)
                }
                className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 text-slate-100 outline-none transition focus:border-cyan-400"
              >
                <option value="all">All</option>
                <option value="protein">Protein</option>
                <option value="complex">Complex</option>
              </select>

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

            {!error && loading && (
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
    Searching {searchType} results for {query.trim()}...
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
                  Found {results.length} {searchType} result
                  {results.length > 1 ? "s" : ""}.
                </p>

                {results.map((result, index) => {
                  const title = getSearchResultTitle(result);
                  const type = getSearchResultType(result);
                  const href = getSearchResultHref(result);

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
                            ID:{" "}
                            {result.uniprot_ac ||
                              result.complex_id ||
                              result.id ||
                              result.key ||
                              "N/A"}
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

        <div className="mt-8 grid gap-3 text-sm text-slate-400 lg:grid-cols-4">
  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
    <p className="font-semibold text-slate-200">Protein examples</p>
    <p className="mt-2">EZH2, TP53</p>
  </div>

  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
    <p className="font-semibold text-slate-200">Complex examples</p>
    <p className="mt-2">996, PRC2, CORUM:996</p>
  </div>

  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
    <p className="font-semibold text-slate-200">Network pages</p>
    <p className="mt-2">Internal, external, neighbors</p>
  </div>

  <Link
    href="/global-ppi"
    className="rounded-xl border border-cyan-800 bg-cyan-950/30 p-4 transition hover:border-cyan-400 hover:bg-cyan-950/50"
  >
    <p className="font-semibold text-cyan-200">Global PPI Explorer</p>
    <p className="mt-2 text-slate-400">
      Explore global protein interaction neighborhoods.
    </p>
    <p className="mt-3 text-cyan-300">Open global PPI →</p>
  </Link>
</div>
      </section>
    </main>
  );
}