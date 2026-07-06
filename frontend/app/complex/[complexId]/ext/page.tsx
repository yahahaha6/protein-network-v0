import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { getComplexExtNetwork, getTotalEdges } from "@/lib/api";

type ComplexExtPageProps = {
  params: Promise<{
    complexId: string;
  }>;
  searchParams: Promise<{
    limit?: string;
    offset?: string;
  }>;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export default async function ComplexExternalNetworkPage({
  params,
  searchParams,
}: ComplexExtPageProps) {
  const { complexId } = await params;
  const resolvedSearchParams = await searchParams;

  const limit = parsePositiveInt(resolvedSearchParams.limit, 20);
  const offset = parsePositiveInt(resolvedSearchParams.offset, 0);

  let network: Awaited<ReturnType<typeof getComplexExtNetwork>> | null = null;
  let loadError = false;

  try {
    network = await getComplexExtNetwork(complexId, limit, offset);
  } catch (error) {
    console.error(error);
    loadError = true;
  }

  if (loadError || !network) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/complex/${complexId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to complex detail
          </Link>

          <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/40 p-6">
            <h1 className="text-2xl font-bold">Failed to load network</h1>

            <p className="mt-3 text-slate-300">
              Could not load external network for complex {complexId}.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const totalEdges = getTotalEdges(network);
  const previousOffset = Math.max(offset - limit, 0);
  const nextOffset = offset + limit;
  const hasPrevious = offset > 0;

  const hasReliableTotal =
    typeof network.total_edges === "number" || typeof network.total === "number";

  const hasNext = hasReliableTotal
    ? nextOffset < totalEdges
    : network.edges.length >= limit;

  const currentPage = Math.floor(offset / limit) + 1;
  const startItem = network.edges.length > 0 ? offset + 1 : 0;
  const endItem = offset + network.edges.length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/complex/${complexId}`}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to complex detail
        </Link>

        <section className="mt-8 mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Complex External Network
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Complex {complexId} External PPI Network
          </h1>

          <div className="mt-3 space-y-2 text-slate-400">
            <p>
              Page {currentPage}: showing external interaction batch {startItem}
              -{endItem}
              {hasReliableTotal ? ` of ${totalEdges}` : ""}.
            </p>

            <p>
              This page only displays one batch of external PPI edges connected
              to complex {complexId}. Use Next Page to view the next batch.
            </p>

            <p>
              Nodes: {network.nodes.length} · Edges: {network.edges.length}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-purple-700 px-3 py-1 text-purple-300">
              purple = complex
            </span>

            <span className="rounded-full border border-cyan-700 px-3 py-1 text-cyan-300">
              cyan = protein
            </span>

            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              Page {currentPage}
            </span>

            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              {limit} edges per batch
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {hasPrevious ? (
              <Link
                href={`/complex/${complexId}/ext?limit=${limit}&offset=${previousOffset}`}
                className="rounded-xl border border-cyan-700 px-5 py-3 text-center font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-slate-800"
              >
                ← Previous Batch
              </Link>
            ) : (
              <span className="rounded-xl border border-slate-800 px-5 py-3 text-center font-semibold text-slate-600">
                ← Previous Batch
              </span>
            )}

            {hasNext ? (
              <Link
                href={`/complex/${complexId}/ext?limit=${limit}&offset=${nextOffset}`}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Next Batch →
              </Link>
            ) : (
              <span className="rounded-xl border border-slate-800 px-5 py-3 text-center font-semibold text-slate-600">
                Next Batch →
              </span>
            )}

            <Link
              href={`/complex/${complexId}/ext?limit=50&offset=0`}
              className="rounded-xl border border-slate-700 px-5 py-3 text-center font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300"
            >
              Show 50
            </Link>

            <Link
              href={`/complex/${complexId}/ext?limit=20&offset=0`}
              className="rounded-xl border border-slate-700 px-5 py-3 text-center font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300"
            >
              Reset
            </Link>
          </div>
        </section>

        <NetworkGraph
          elements={network}
          focusNodeId={complexId}
          layoutName="concentric"
          showEdgeLabels={false}
          enableNodeNavigation={true}
          graphName={`complex_${complexId}_external_network_offset_${offset}`}
        />
      </div>
    </main>
  );
}