import Link from "next/link";
import DetailFields from "@/components/DetailFields";
import ExpressionProfileCard from "@/components/ExpressionProfileCard";
import { getProteinDetail, type DetailRecord } from "@/lib/api";
import { buildRelatedComplexNetworks } from "@/lib/proteinComplexNavigation";

type ProteinPageProps = {
  params: Promise<{
    proteinId: string;
  }>;
};

function getProteinTitle(protein: DetailRecord, proteinId: string) {
  const possibleTitle =
    protein.gene_name ||
    protein.gene ||
    protein.symbol ||
    protein.label ||
    protein.name ||
    protein.protein_name;

  return possibleTitle ? String(possibleTitle) : proteinId;
}

function asRecord(value: unknown): DetailRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as DetailRecord;
  }

  return null;
}

export default async function ProteinDetailPage({ params }: ProteinPageProps) {
  const { proteinId } = await params;

  let protein: DetailRecord | null = null;
  let loadError = false;

  try {
    protein = await getProteinDetail(proteinId);
  } catch (error) {
    console.error(error);
    loadError = true;
  }

  if (loadError || !protein) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Back to search
          </Link>

          <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/40 p-6">
            <h1 className="text-2xl font-bold">Protein not found</h1>

            <p className="mt-3 text-slate-300">
              Failed to load protein {proteinId}. Please make sure the backend
              is running and this UniProt accession exists.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const title = getProteinTitle(protein, proteinId);
  const hpaProfile = asRecord(protein.hpaProfile);
  const summary = asRecord(protein.summary) ?? {
    uniprotAc: proteinId,
    geneSymbol: title,
  };
  const related = buildRelatedComplexNetworks(protein);
  const visibleExternalComplexes = related.externalComplexes.slice(0, 12);
  const hiddenExternalCount = Math.max(
    related.externalCount - visibleExternalComplexes.length,
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Back to search
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Protein Detail
          </p>

          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>

          <p className="mt-3 text-slate-400">UniProt AC: {proteinId}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/protein/${proteinId}/network`}
              className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Neighbor Network
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-cyan-700 px-5 py-3 text-center font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-slate-800"
            >
              Search Again
            </Link>
          </div>
        </section>

        <ExpressionProfileCard data={hpaProfile} />

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-100">
            Related Complex Networks
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Open a specific complex network for this protein&apos;s canonical
            member or external associations.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold text-slate-200">
                Member complexes ({related.memberCount})
              </h3>
              {related.memberComplexes.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No member complexes reported.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {related.memberComplexes.map((complex) => (
                    <li
                      key={complex.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <p className="font-medium text-slate-100">{complex.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{complex.id}</p>
                      <Link
                        href={complex.internalHref!}
                        className="mt-3 inline-flex rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:bg-slate-800"
                      >
                        Internal Network
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-200">
                External associations ({related.externalCount})
              </h3>
              {visibleExternalComplexes.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No external complex associations reported.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {visibleExternalComplexes.map((complex) => (
                    <li
                      key={complex.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {complex.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{complex.id}</p>
                      </div>
                      <Link
                        href={complex.externalHref!}
                        className="rounded-lg border border-purple-700 px-3 py-2 text-sm font-semibold text-purple-300 hover:border-purple-400 hover:bg-slate-800"
                      >
                        External Network
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {hiddenExternalCount > 0 && (
                <p className="mt-3 text-xs font-medium text-slate-500">
                  Showing {visibleExternalComplexes.length} of {related.externalCount}
                  {related.externalTruncated ? " reported associations" : " associations"}.
                </p>
              )}
            </div>
          </div>
        </section>

        <DetailFields title="Protein detail fields" data={summary} />
      </div>
    </main>
  );
}
