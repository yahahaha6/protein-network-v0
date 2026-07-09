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
    source?: string;
    protein_category?: string;
    has_ddi?: string;
    has_dmi?: string;
    has_pdb?: string;
    is_subunit_of_other_complex?: string;
  }>;
};

const SOURCE_FILTER_OPTIONS = ["BioGRID", "HPA", "IntAct", "PDB"];
const PROTEIN_CATEGORY_OPTIONS = ["TF", "EF", "TF_and_EF", "Unknown"];

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

export default async function ComplexExternalNetworkPage({
  params,
  searchParams,
}: ComplexExtPageProps) {
  const { complexId } = await params;
  const resolvedSearchParams = await searchParams;

  const limit = parsePositiveInt(resolvedSearchParams.limit, 20);
  const offset = parsePositiveInt(resolvedSearchParams.offset, 0);

  const activeFilters = {
    source: resolvedSearchParams.source,
    protein_category: resolvedSearchParams.protein_category,
    has_ddi: parseOptionalBoolean(resolvedSearchParams.has_ddi),
    has_dmi: parseOptionalBoolean(resolvedSearchParams.has_dmi),
    has_pdb: parseOptionalBoolean(resolvedSearchParams.has_pdb),
    is_subunit_of_other_complex: parseOptionalBoolean(
      resolvedSearchParams.is_subunit_of_other_complex
    ),
  };

  function buildNetworkHref(
    nextLimit = limit,
    nextOffset = offset,
    overrides: Partial<typeof activeFilters> = {}
  ) {
    const nextFilters = {
      ...activeFilters,
      ...overrides,
    };

    const query = new URLSearchParams({
      limit: String(nextLimit),
      offset: String(nextOffset),
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

    if (typeof nextFilters.is_subunit_of_other_complex === "boolean") {
      query.set(
        "is_subunit_of_other_complex",
        String(nextFilters.is_subunit_of_other_complex)
      );
    }

    return `/complex/${complexId}/ext?${query.toString()}`;
  }

  const activeFilterCount = Object.values(activeFilters).filter(
    (value) => value !== undefined && value !== ""
  ).length;

  let network: Awaited<ReturnType<typeof getComplexExtNetwork>> | null = null;
  let loadError = false;

  try {
    network = await getComplexExtNetwork(complexId, limit, offset, activeFilters);
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
  const hasNext = network.pagination?.hasMore ?? false;
  const currentPage = Math.floor(offset / limit) + 1;
  const startItem = network.edges.length > 0 ? offset + 1 : 0;
  const endItem = offset + network.edges.length;

  const centerLabel =
    network.center?.displayName ||
    network.center?.label ||
    network.center?.id ||
    `Complex ${complexId}`;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
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
            {centerLabel} External PPI Network
          </h1>

          <div className="mt-3 space-y-2 text-slate-400">
            <p>
              Page {currentPage}: showing external interaction batch {startItem}
              -{endItem} of {totalEdges}.
            </p>

            <p>
              This view shows external protein partners connected to the complex
              through mediating subunits. Use filters to focus on evidence type,
              partner category, and whether the external partner is also a
              subunit of other complexes.
            </p>

            <p>
              Nodes: {network.nodes.length} · Edges: {network.edges.length}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-4">
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
              <p className="text-slate-500">Filtered total edges</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {totalEdges}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-slate-500">Current page DDI / DMI / PDB</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {String(network.stats?.ddiSupportedEdgeCount ?? 0)} /{" "}
                {String(network.stats?.dmiSupportedEdgeCount ?? 0)} /{" "}
                {String(network.stats?.structuralEvidenceEdgeCount ?? 0)}
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
                  These filters are sent to the FastAPI backend before
                  pagination. The displayed total is the filtered edge count.
                </p>
              </div>

              {activeFilterCount > 0 && (
                <Link
                  href={buildNetworkHref(limit, 0, {
                    source: undefined,
                    protein_category: undefined,
                    has_ddi: undefined,
                    has_dmi: undefined,
                    has_pdb: undefined,
                    is_subunit_of_other_complex: undefined,
                  })}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Clear filters
                </Link>
              )}
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Evidence source
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildNetworkHref(limit, 0, { source: undefined })}
                    className={filterButtonClass(!activeFilters.source)}
                  >
                    All sources
                  </Link>

                  {SOURCE_FILTER_OPTIONS.map((option) => (
                    <Link
                      key={option}
                      href={buildNetworkHref(limit, 0, { source: option })}
                      className={filterButtonClass(
                        activeFilters.source === option
                      )}
                    >
                      {option}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  External partner category
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildNetworkHref(limit, 0, {
                      protein_category: undefined,
                    })}
                    className={filterButtonClass(
                      !activeFilters.protein_category
                    )}
                  >
                    All categories
                  </Link>

                  {PROTEIN_CATEGORY_OPTIONS.map((option) => (
                    <Link
                      key={option}
                      href={buildNetworkHref(limit, 0, {
                        protein_category: option,
                      })}
                      className={filterButtonClass(
                        activeFilters.protein_category === option
                      )}
                    >
                      {option}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  DDI
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildNetworkHref(limit, 0, { has_ddi: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_ddi === undefined
                    )}
                  >
                    Any
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, { has_ddi: true })}
                    className={filterButtonClass(activeFilters.has_ddi === true)}
                  >
                    DDI only
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, { has_ddi: false })}
                    className={filterButtonClass(activeFilters.has_ddi === false)}
                  >
                    No DDI
                  </Link>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  DMI
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildNetworkHref(limit, 0, { has_dmi: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_dmi === undefined
                    )}
                  >
                    Any
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, { has_dmi: true })}
                    className={filterButtonClass(activeFilters.has_dmi === true)}
                  >
                    DMI only
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, { has_dmi: false })}
                    className={filterButtonClass(activeFilters.has_dmi === false)}
                  >
                    No DMI
                  </Link>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Structural evidence
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildNetworkHref(limit, 0, { has_pdb: undefined })}
                    className={filterButtonClass(
                      activeFilters.has_pdb === undefined
                    )}
                  >
                    Any
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, { has_pdb: true })}
                    className={filterButtonClass(activeFilters.has_pdb === true)}
                  >
                    PDB only
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, { has_pdb: false })}
                    className={filterButtonClass(activeFilters.has_pdb === false)}
                  >
                    No PDB
                  </Link>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  External partner in other complexes
                </p>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildNetworkHref(limit, 0, {
                      is_subunit_of_other_complex: undefined,
                    })}
                    className={filterButtonClass(
                      activeFilters.is_subunit_of_other_complex === undefined
                    )}
                  >
                    Any
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, {
                      is_subunit_of_other_complex: true,
                    })}
                    className={filterButtonClass(
                      activeFilters.is_subunit_of_other_complex === true
                    )}
                  >
                    Other complex subunit
                  </Link>

                  <Link
                    href={buildNetworkHref(limit, 0, {
                      is_subunit_of_other_complex: false,
                    })}
                    className={filterButtonClass(
                      activeFilters.is_subunit_of_other_complex === false
                    )}
                  >
                    Not in other complexes
                  </Link>
                </div>
              </div>
            </div>
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
                href={buildNetworkHref(limit, previousOffset)}
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
                href={buildNetworkHref(limit, nextOffset)}
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
              href={buildNetworkHref(50, 0)}
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
          focusNodeId={network.center?.id ?? `CORUM:${complexId}`}
          layoutName="concentric"
          showEdgeLabels={false}
          enableNodeNavigation={true}
          graphName={`complex_${complexId}_external_network_offset_${offset}`}
        />
      </div>
    </main>
  );
}
