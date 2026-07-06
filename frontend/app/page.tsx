import Link from "next/link";

import SearchAutocomplete from "@/components/SearchAutocomplete";

export default function HomePage() {
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

        <SearchAutocomplete />

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