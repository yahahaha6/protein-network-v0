import Link from "next/link";
import NetworkGraph from "@/components/NetworkGraph";
import { ApiRequestError, getProteinNeighbors, getTotalEdges } from "@/lib/api";

type ProteinNetworkPageProps = {
  params: Promise<{
    proteinId: string;
  }>;
  searchParams: Promise<{
    limit?: string;
    source?: string;
    protein_category?: string;
    has_ddi?: string;
    has_dmi?: string;
    has_pdb?: string;
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

const SOURCE_FILTER_OPTIONS = ["BioGRID", "HPA", "IntAct", "PDB"];
const PROTEIN_CATEGORY_OPTIONS = ["TF", "EF", "TF_and_EF", "Unknown"];

export default async function ProteinNeighborNetworkPage({
  params,
  searchParams,
}: ProteinNetworkPageProps) {
  const { proteinId } = await params;
  const resolvedSearchParams = await searchParams;

  const normalizedProteinId = proteinId.replace("UniProt:", "");
  const limit = parseLimit(resolvedSearchParams.limit);

  const activeFilters = {
    source: resolvedSearchParams.source || undefined,
    protein_category: resolvedSearchParams.protein_category || undefined,
    has_ddi: parseOptionalBoolean(resolvedSearchParams.has_ddi),
    has_dmi: parseOptionalBoolean(resolvedSearchParams.has_dmi),
    has_pdb: parseOptionalBoolean(resolvedSearchParams.has_pdb),
  };

  function buildNetworkHref(
    nextLimit: number,
    overrides: Partial<typeof activeFilters> = {}
  ) {
    const nextFilters = {
      ...activeFilters,
      ...overrides,
    };

    const query = new URLSearchParams({
      limit: String(nextLimit),
    });

    if (nextFilters.source) {
      query.set("source", nextFilters.source);
    }

    if (nextFilters.protein_category) {
      query.set("protein_category", nextFilters.protein_category);
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

    return `/protein/${normalizedProteinId}/network?${query.toString()}`;
  }

  const activeFilterCount = Object.values(activeFilters).filter(
    (value) => value !== undefined
  ).length;

  let network: Awaited<ReturnType<typeof getProteinNeighbors>> | null = null;
  let loadError = false;
  let networkUnavailable = false;

  try {
    network = await getProteinNeighbors(
      normalizedProteinId,
      limit,
      activeFilters
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      networkUnavailable = true;
    } else {
      console.error(error);
      loadError = true;
    }
  }

  if (networkUnavailable || loadError || !network) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <Link
            href={`/protein/${normalizedProteinId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to protein detail
          </Link>

          <div
            className={`mt-8 rounded-2xl border p-6 ${
              networkUnavailable
                ? "border-amber-700 bg-amber-950/30"
                : "border-red-800 bg-red-950/40"
            }`}
          >
            <h1 className="text-2xl font-bold">
              {networkUnavailable
                ? "No high-confidence direct PPI evidence"
                : "Failed to load network"}
            </h1>
            <p className="mt-3 text-slate-300">
              {networkUnavailable
                ? `No high-confidence direct PPI network is available for protein ${normalizedProteinId} in the current dataset.`
                : `Could not load neighbor network for protein ${normalizedProteinId}.`}
            </p>
            {networkUnavailable ? (
              <p className="mt-2 text-sm text-slate-400">
                This protein may still appear in complex membership networks.
              </p>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const centerLabel =
    network.center?.displayName ||
    network.center?.label ||
    network.center?.id ||
    normalizedProteinId;

  const totalEdges = getTotalEdges(network);
  const hasMore = Boolean(network.pagination?.hasMore);

  const isShowingAll =
    resolvedSearchParams.limit?.toLowerCase() === "all" ||
    limit >= 200 ||
    network.edges.length >= totalEdges ||
    !hasMore;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/protein/${normalizedProteinId}`}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            ← Back to protein detail
          </Link>

          <Link href="/" className="text-sm text-slate-400 hover:text-slate-300">
            Home
          </Link>
        </div>

        <section className="mt-8 mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Protein Neighbor Network
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            {centerLabel}-centered Direct PPI Neighbor Network
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            This view shows direct PPI neighbors for {centerLabel}. Filters are
            sent to the FastAPI backend, and the frontend renders only the
            filtered subgraph returned by the API.
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

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Backend Filters
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  These controls update URL parameters and request a filtered
                  network from the backend.
                </p>
              </div>

              {activeFilterCount > 0 && (
                <a
                  href={buildNetworkHref(limit, {
                    source: undefined,
                    protein_category: undefined,
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
                  Evidence source
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref(limit, { source: undefined })}
                    className={filterButtonClass(!activeFilters.source)}
                  >
                    All sources
                  </a>

                  {SOURCE_FILTER_OPTIONS.map((sourceOption) => (
                    <a
                      key={sourceOption}
                      href={buildNetworkHref(limit, { source: sourceOption })}
                      className={filterButtonClass(
                        activeFilters.source === sourceOption
                      )}
                    >
                      {sourceOption}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Neighbor protein category
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref(limit, {
                      protein_category: undefined,
                    })}
                    className={filterButtonClass(!activeFilters.protein_category)}
                  >
                    All categories
                  </a>

                  {PROTEIN_CATEGORY_OPTIONS.map((categoryOption) => (
                    <a
                      key={categoryOption}
                      href={buildNetworkHref(limit, {
                        protein_category: categoryOption,
                      })}
                      className={filterButtonClass(
                        activeFilters.protein_category === categoryOption
                      )}
                    >
                      {categoryOption}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  DDI
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildNetworkHref(limit, { has_ddi: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_ddi === undefined
                    )}
                  >
                    Any
                  </a>

                  <a
                    href={buildNetworkHref(limit, { has_ddi: true })}
                    className={filterButtonClass(activeFilters.has_ddi === true)}
                  >
                    DDI only
                  </a>

                  <a
                    href={buildNetworkHref(limit, { has_ddi: false })}
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
                    href={buildNetworkHref(limit, { has_dmi: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_dmi === undefined
                    )}
                  >
                    Any
                  </a>

                  <a
                    href={buildNetworkHref(limit, { has_dmi: true })}
                    className={filterButtonClass(activeFilters.has_dmi === true)}
                  >
                    DMI only
                  </a>

                  <a
                    href={buildNetworkHref(limit, { has_dmi: false })}
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
                    href={buildNetworkHref(limit, { has_pdb: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_pdb === undefined
                    )}
                  >
                    Any
                  </a>

                  <a
                    href={buildNetworkHref(limit, { has_pdb: true })}
                    className={filterButtonClass(activeFilters.has_pdb === true)}
                  >
                    PDB only
                  </a>

                  <a
                    href={buildNetworkHref(limit, { has_pdb: false })}
                    className={filterButtonClass(activeFilters.has_pdb === false)}
                  >
                    No PDB
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <a
              href={buildNetworkHref(20)}
              className={filterButtonClass(limit === 20)}
            >
              20 neighbors
            </a>

            <a
              href={buildNetworkHref(50)}
              className={filterButtonClass(limit === 50)}
            >
              50 neighbors
            </a>

            <a
              href={buildNetworkHref(200)}
              className={filterButtonClass(isShowingAll)}
            >
              Show All
            </a>
          </div>
        </section>

        <NetworkGraph
          elements={network}
          focusNodeId={normalizedProteinId}
          layoutName="concentric"
          showEdgeLabels={false}
          enableNodeNavigation={true}
          graphName={`protein_${normalizedProteinId}_neighbors`}
        />
      </div>
    </main>
  );
}
