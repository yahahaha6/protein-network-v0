import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { getGlobalPpiProteinNeighbors, getTotalEdges } from "@/lib/api";

type GlobalPpiProteinNetworkPageProps = {
  params: Promise<{
    proteinId: string;
  }>;
  searchParams: Promise<{
    limit?: string;
  }>;
};

function parseLimit(value: string | undefined) {
  if (!value) {
    return 20;
  }

  if (value.toLowerCase() === "all") {
    return 200;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 20;
  }

  return parsed;
}

export default async function GlobalPpiProteinNetworkPage({
  params,
  searchParams,
}: GlobalPpiProteinNetworkPageProps) {
  const { proteinId } = await params;
  const resolvedSearchParams = await searchParams;

  const normalizedProteinId = proteinId.replace("UniProt:", "");
  const focusNodeId = `UniProt:${normalizedProteinId}`;
  const limit = parseLimit(resolvedSearchParams.limit);

  let network: Awaited<ReturnType<typeof getGlobalPpiProteinNeighbors>> | null =
    null;
  let loadError = false;

  try {
    network = await getGlobalPpiProteinNeighbors(normalizedProteinId, limit);
  } catch (error) {
    console.error(error);
    loadError = true;
  }

  if (loadError || !network) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/global-ppi"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to global PPI
          </Link>

          <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/40 p-6">
            <h1 className="text-2xl font-bold">Failed to load global network</h1>

            <p className="mt-3 text-slate-300">
              Could not load global PPI neighbor network for protein{" "}
              {normalizedProteinId}.
            </p>

            <p className="mt-3 text-sm text-slate-500">
              Please make sure the FastAPI backend is running and the global PPI
              graph is loaded from your local private data directory.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const centerLabel =
    network.center?.label || network.center?.uniprotAc || normalizedProteinId;

  const totalEdges = getTotalEdges(network);
  const isShowingAll =
  resolvedSearchParams.limit?.toLowerCase() === "all" ||
  network.edges.length >= totalEdges ||
  !network.truncated;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/global-ppi"
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to global PPI
          </Link>

          <Link href="/" className="text-sm text-slate-400 hover:text-slate-300">
            Home
          </Link>
        </div>

        <section className="mt-8 mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Global PPI Neighborhood
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            {centerLabel}-centered Global PPI Neighborhood
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            This is not the full global graph. It shows the local interaction
            neighborhood around {centerLabel}. Click an edge to inspect evidence
            such as source databases, methods, publications, structures, DDI, or
            DMI fields when available.
          </p>

          <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-slate-500">Displayed nodes</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {network.nodes.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-slate-500">Displayed edges</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {network.edges.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-slate-500">Total reported edges</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {totalEdges}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-yellow-700 px-3 py-1 text-yellow-300">
                yellow = focus protein
              </span>

              <span className="rounded-full border border-cyan-700 px-3 py-1 text-cyan-300">
                cyan = protein
              </span>

              <span className="rounded-full border border-sky-700 px-3 py-1 text-sky-300">
                edge = global PPI evidence
              </span>

              <span className="rounded-full border border-amber-700 px-3 py-1 text-amber-300">
                click edge = evidence detail
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/global-ppi/protein/${normalizedProteinId}/network?limit=20`}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  limit === 20
                    ? "border-cyan-400 bg-cyan-500 text-slate-950"
                    : "border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                }`}
              >
                Show 20
              </Link>

              <Link
                href={`/global-ppi/protein/${normalizedProteinId}/network?limit=50`}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  limit === 50
                    ? "border-cyan-400 bg-cyan-500 text-slate-950"
                    : "border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                }`}
              >
                Show 50
              </Link>

              <Link
                href={`/global-ppi/protein/${normalizedProteinId}/network?limit=all`}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  isShowingAll
                    ? "border-cyan-400 bg-cyan-500 text-slate-950"
                    : "border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                }`}
              >
                Show All
              </Link>
            </div>
          </div>

          {network.truncated && (
            <div className="mt-5 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-200">
              This view is truncated. Use Show 50 or Show All to display more
              neighbors.
            </div>
          )}
        </section>

        <NetworkGraph
          elements={network}
          focusNodeId={focusNodeId}
          layoutName="concentric"
          showEdgeLabels={false}
          enableNodeNavigation={false}
          graphName={`global_ppi_${normalizedProteinId}_neighbors_limit_${limit}`}
        />
      </div>
    </main>
  );
}