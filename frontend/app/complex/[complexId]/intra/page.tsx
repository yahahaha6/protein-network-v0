import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { getComplexIntraNetwork } from "@/lib/api";

type ComplexIntraPageProps = {
  params: Promise<{
    complexId: string;
  }>;
};

export default async function ComplexIntraNetworkPage({
  params,
}: ComplexIntraPageProps) {
  const { complexId } = await params;

  let network: Awaited<ReturnType<typeof getComplexIntraNetwork>> | null = null;
  let loadError = false;

  try {
    network = await getComplexIntraNetwork(complexId);
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
              Could not load internal network for complex {complexId}.
            </p>
          </div>
        </div>
      </main>
    );
  }

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
            Complex Internal Network
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Complex {complexId} Internal PPI Network
          </h1>

          <p className="mt-3 text-slate-400">
            Nodes: {network.nodes.length} · Edges: {network.edges.length}
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-green-700 px-3 py-1 text-green-300">
              green = confirmed intra-pair PPI
            </span>

            <span className="rounded-full border border-orange-700 px-3 py-1 text-orange-300">
              orange dashed = co-complex-only
            </span>

            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              edge labels hidden for readability
            </span>
          </div>
        </section>

        <NetworkGraph
          elements={network}
          layoutName="circle"
          showEdgeLabels={false}
          enableNodeNavigation={true}
          graphName={`complex_${complexId}_internal_network`}
        />
      </div>
    </main>
  );
}