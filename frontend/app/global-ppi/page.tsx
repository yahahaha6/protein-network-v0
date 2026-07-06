"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getGlobalPpiInfo,
  getGlobalPpiProteinDetail,
  type GlobalPpiInfo,
  type GlobalPpiProteinDetail,
} from "@/lib/api";

export default function GlobalPpiPage() {
  const router = useRouter();

  const [info, setInfo] = useState<GlobalPpiInfo | null>(null);
  const [proteinId, setProteinId] = useState("Q15910");
  const [proteinDetail, setProteinDetail] =
    useState<GlobalPpiProteinDetail | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [checkingProtein, setCheckingProtein] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInfo() {
      setLoadingInfo(true);
      setError("");

      try {
        const data = await getGlobalPpiInfo();
        setInfo(data);
      } catch (err) {
        console.error(err);
        setError(
          "Failed to load global PPI info. Please make sure the FastAPI backend is running on http://localhost:8000."
        );
      } finally {
        setLoadingInfo(false);
      }
    }

    loadInfo();
  }, []);

  async function handleOpenNetwork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedProteinId = proteinId.trim();

    if (!trimmedProteinId) {
      setError("Please enter a UniProt accession, such as Q15910.");
      setProteinDetail(null);
      return;
    }

    setCheckingProtein(true);
    setError("");
    setProteinDetail(null);

    try {
      const detail = await getGlobalPpiProteinDetail(trimmedProteinId);
      setProteinDetail(detail);

      router.push(`/global-ppi/protein/${encodeURIComponent(trimmedProteinId)}/network`);
    } catch (err) {
      console.error(err);
      setError(
        `Protein ${trimmedProteinId} was not found in the global PPI graph.`
      );
    } finally {
      setCheckingProtein(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
              Global PPI
            </p>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Explore the global protein interaction graph
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Search a UniProt protein ID and open its global PPI neighbor
              network. Edge evidence will be shown by clicking relationships in
              the graph.
            </p>
          </div>

          <Link
            href="/"
            className="w-fit rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Back Home
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
            <p className="text-sm text-slate-400">Graph loaded</p>
            <p className="mt-2 text-2xl font-bold text-slate-100">
              {loadingInfo ? "Loading..." : info?.loaded ? "Yes" : "No"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
            <p className="text-sm text-slate-400">Nodes</p>
            <p className="mt-2 text-2xl font-bold text-slate-100">
              {info?.nodeCount ?? "N/A"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
            <p className="text-sm text-slate-400">Edges</p>
            <p className="mt-2 text-2xl font-bold text-slate-100">
              {info?.edgeCount ?? "N/A"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-100">
              Open protein network
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Try Q15910 for EZH2. The next page will use the existing
              Cytoscape NetworkGraph component.
            </p>
          </div>

          <form onSubmit={handleOpenNetwork}>
            <label
              htmlFor="global-ppi-protein"
              className="mb-3 block text-sm font-medium text-slate-200"
            >
              UniProt accession
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="global-ppi-protein"
                type="text"
                value={proteinId}
                onChange={(event) => setProteinId(event.target.value)}
                placeholder="Q15910"
                className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              />

              <button
                type="submit"
                disabled={checkingProtein}
                className="min-h-12 rounded-xl bg-cyan-500 px-6 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingProtein ? "Checking..." : "Open Network"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {!error && proteinDetail && (
            <div className="mt-5 rounded-xl border border-cyan-900 bg-cyan-950/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Protein found
              </p>

              <h3 className="mt-1 text-lg font-semibold text-slate-100">
                {proteinDetail.label || proteinDetail.id || proteinId}
              </h3>

              <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">UniProt: </span>
                  {proteinDetail.summary?.uniprotAc || proteinDetail.id || proteinId}
                </div>

                <div>
                  <span className="text-slate-500">Neighbors: </span>
                  {proteinDetail.summary?.neighborCount ?? "N/A"}
                </div>

                <div>
                  <span className="text-slate-500">Gene: </span>
                  {proteinDetail.summary?.geneName || "N/A"}
                </div>

                <div>
                  <span className="text-slate-500">Category: </span>
                  {proteinDetail.summary?.category || "N/A"}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm leading-6 text-slate-400">
          <p className="font-semibold text-slate-200">
            Current graph
          </p>

          <p className="mt-2">
            {info?.name || "global_ppi_graph"}
          </p>

          {info?.notes && (
            <p className="mt-2">
              {info.notes}
            </p>
          )}

          {info?.exampleProteinIds && info.exampleProteinIds.length > 0 && (
            <p className="mt-2">
              Example IDs: {info.exampleProteinIds.slice(0, 8).join(", ")}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}