import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { getComplexIntraNetwork } from "@/lib/api";

type ComplexIntraPageProps = {
  params: Promise<{
    complexId: string;
  }>;
  searchParams: Promise<{
    confirmed_ppi?: string;
    co_complex_only?: string;
    has_ddi?: string;
    has_dmi?: string;
    has_pdb?: string;
  }>;
};

function parseOptionalBoolean(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

function filterButtonClass(active: boolean) {
  return active
    ? "rounded-full border border-cyan-400 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100"
    : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800";
}

export default async function ComplexIntraNetworkPage({
  params,
  searchParams,
}: ComplexIntraPageProps) {
  const { complexId } = await params;
  const resolvedSearchParams = await searchParams;

  const activeFilters = {
    confirmed_ppi: parseOptionalBoolean(resolvedSearchParams.confirmed_ppi),
    co_complex_only: parseOptionalBoolean(resolvedSearchParams.co_complex_only),
    has_ddi: parseOptionalBoolean(resolvedSearchParams.has_ddi),
    has_dmi: parseOptionalBoolean(resolvedSearchParams.has_dmi),
    has_pdb: parseOptionalBoolean(resolvedSearchParams.has_pdb),
  };

  function buildNetworkHref(overrides: Partial<typeof activeFilters> = {}) {
    const nextFilters = {
      ...activeFilters,
      ...overrides,
    };

    const query = new URLSearchParams();

    if (typeof nextFilters.confirmed_ppi === "boolean") {
      query.set("confirmed_ppi", String(nextFilters.confirmed_ppi));
    }

    if (typeof nextFilters.co_complex_only === "boolean") {
      query.set("co_complex_only", String(nextFilters.co_complex_only));
    }

    if (typeof nextFilters.has_ddi === "boolean") {
      query.set("has_ddi", String(nextFilters.has_ddi));
    }

    if (typeof nextFilters.has_dmi === "boolean") {
      query.set("has_dmi", String(nextFilters.has_dmi));
    }

    if (typeof nextFilters.has_pdb === "boolean") {
      query.set("has_pdb", String(nextFilters.has_pdb));
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";

    return `/complex/${complexId}/intra${suffix}`;
  }

  const activeFilterCount = Object.values(activeFilters).filter(
    (value) => value !== undefined
  ).length;

  let network: Awaited<ReturnType<typeof getComplexIntraNetwork>> | null = null;
  let loadError = false;

  try {
    network = await getComplexIntraNetwork(complexId, activeFilters);
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

  const centerLabel =
    network.center?.displayName ||
    network.center?.label ||
    network.center?.id ||
    `Complex ${complexId}`;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/complex/${complexId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to complex detail
          </Link>

          <Link href="/" className="text-sm text-slate-400 hover:text-slate-300">
            Home
          </Link>
        </div>

        <section className="mt-8 mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Complex Internal Network
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            {centerLabel} Internal PPI Network
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            This view shows internal subunit relationships for the selected
            complex. Confirmed edges have direct PPI evidence; co-complex-only
            edges mean both proteins are observed in the same complex but direct
            PPI evidence is not available in the current data.
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
              <p className="text-slate-500">Confirmed / co-complex-only</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {String(network.stats?.confirmedPpiEdgeCount ?? 0)} /{" "}
                {String(network.stats?.coComplexOnlyEdgeCount ?? 0)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Backend Filters
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  These filters are sent to the FastAPI backend. The frontend only
                  displays the filtered complex intra network returned by the API.
                </p>
              </div>

              {activeFilterCount > 0 && (
                <a
                  href={buildNetworkHref({
                    confirmed_ppi: undefined,
                    co_complex_only: undefined,
                    has_ddi: undefined,
                    has_dmi: undefined,
                    has_pdb: undefined,
                  })}
                  className="cursor-pointer rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Clear filters
                </a>
              )}
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Relationship type
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref({
                      confirmed_ppi: undefined,
                      co_complex_only: undefined,
                    })}
                    className={filterButtonClass(
                      activeFilters.confirmed_ppi === undefined &&
                        activeFilters.co_complex_only === undefined
                    )}
                  >
                    All relationships
                  </a>

                  <a
                    href={buildNetworkHref({
                      confirmed_ppi: true,
                      co_complex_only: undefined,
                    })}
                    className={filterButtonClass(
                      activeFilters.confirmed_ppi === true &&
                        activeFilters.co_complex_only === undefined
                    )}
                  >
                    Confirmed PPI only
                  </a>

                  <a
                    href={buildNetworkHref({
                      confirmed_ppi: undefined,
                      co_complex_only: true,
                    })}
                    className={filterButtonClass(
                      activeFilters.co_complex_only === true &&
                        activeFilters.confirmed_ppi === undefined
                    )}
                  >
                    Co-complex-only
                  </a>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  DDI
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref({ has_ddi: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_ddi === undefined
                    )}
                  >
                    Any
                  </a>

                  <a
                    href={buildNetworkHref({ has_ddi: true })}
                    className={filterButtonClass(activeFilters.has_ddi === true)}
                  >
                    DDI only
                  </a>

                  <a
                    href={buildNetworkHref({ has_ddi: false })}
                    className={filterButtonClass(activeFilters.has_ddi === false)}
                  >
                    No DDI
                  </a>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  DMI
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref({ has_dmi: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_dmi === undefined
                    )}
                  >
                    Any
                  </a>

                  <a
                    href={buildNetworkHref({ has_dmi: true })}
                    className={filterButtonClass(activeFilters.has_dmi === true)}
                  >
                    DMI only
                  </a>

                  <a
                    href={buildNetworkHref({ has_dmi: false })}
                    className={filterButtonClass(activeFilters.has_dmi === false)}
                  >
                    No DMI
                  </a>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Structural evidence
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref({ has_pdb: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_pdb === undefined
                    )}
                  >
                    Any
                  </a>

                  <a
                    href={buildNetworkHref({ has_pdb: true })}
                    className={filterButtonClass(activeFilters.has_pdb === true)}
                  >
                    PDB only
                  </a>

                  <a
                    href={buildNetworkHref({ has_pdb: false })}
                    className={filterButtonClass(activeFilters.has_pdb === false)}
                  >
                    No PDB
                  </a>
                </div>
              </div>
            </div>
          </div>

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
