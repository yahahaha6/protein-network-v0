import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { getProteinNeighbors, getTotalEdges } from "@/lib/api";

type ProteinNetworkPageProps = {
  params: Promise<{
    proteinId: string;
  }>;
};

export default async function ProteinNeighborNetworkPage({
  params,
}: ProteinNetworkPageProps) {
  const { proteinId } = await params;

  const limit = 20;

  try {
    const network = await getProteinNeighbors(proteinId, limit);

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/protein/${proteinId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to protein detail
          </Link>

          <section className="mt-8 mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
              Protein Neighbor Network
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              {proteinId} Direct PPI Neighbor Network
            </h1>

            <p className="mt-3 text-slate-400">
              Showing first {limit} direct PPI neighbors. Nodes:{" "}
              {network.nodes.length} · Edges: {network.edges.length}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Total edges reported by backend: {getTotalEdges(network)}
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-yellow-700 px-3 py-1 text-yellow-300">
                yellow = focus protein
              </span>

              <span className="rounded-full border border-cyan-700 px-3 py-1 text-cyan-300">
                cyan = protein
              </span>

              <span className="rounded-full border border-sky-700 px-3 py-1 text-sky-300">
                blue edge = direct PPI
              </span>
            </div>
          </section>

          <NetworkGraph
  elements={network}
  focusNodeId={proteinId}
  layoutName="concentric"
  showEdgeLabels={false}
  enableNodeNavigation={true}
  graphName={`protein_${proteinId}_neighbors`}
/>
        </div>
      </main>
    );
  } catch (error) {
    console.error(error);

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/protein/${proteinId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to protein detail
          </Link>

          <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/40 p-6">
            <h1 className="text-2xl font-bold">Failed to load network</h1>
            <p className="mt-3 text-slate-300">
              Could not load neighbor network for protein {proteinId}.
            </p>
          </div>
        </div>
      </main>
    );
  }
}