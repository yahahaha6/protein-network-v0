import Link from "next/link";

type ProteinPageProps = {
  params: Promise<{
    proteinId: string;
  }>;
};

type ProteinDetail = Record<string, unknown>;

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function getProteinTitle(protein: ProteinDetail, proteinId: string) {
  const possibleTitle =
    protein.gene_name ||
    protein.gene ||
    protein.symbol ||
    protein.label ||
    protein.name ||
    protein.protein_name;

  return possibleTitle ? String(possibleTitle) : proteinId;
}

export default async function ProteinDetailPage({ params }: ProteinPageProps) {
  const { proteinId } = await params;

  const response = await fetch(
    `http://localhost:8000/api/protein/${proteinId}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
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

  const protein: ProteinDetail = await response.json();
  const title = getProteinTitle(protein, proteinId);

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

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-xl font-semibold">Raw detail fields</h2>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            {Object.entries(protein).map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-1 border-b border-slate-800 last:border-b-0 sm:grid-cols-3"
              >
                <div className="bg-slate-950 px-4 py-3 text-sm font-medium text-slate-300">
                  {key}
                </div>

                <div className="whitespace-pre-wrap break-words px-4 py-3 text-sm text-slate-100 sm:col-span-2">
                  {formatValue(value)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}