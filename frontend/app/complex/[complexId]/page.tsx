import Link from "next/link";
import DetailFields from "@/components/DetailFields";
import { getComplexDetail, type DetailRecord } from "@/lib/api";

type ComplexPageProps = {
  params: Promise<{
    complexId: string;
  }>;
};

function getTitle(complex: DetailRecord, complexId: string) {
  const possibleTitle =
    complex.name ||
    complex.label ||
    complex.complex_name ||
    complex.ComplexName ||
    complex.description;

  return possibleTitle ? String(possibleTitle) : `Complex ${complexId}`;
}

export default async function ComplexDetailPage({ params }: ComplexPageProps) {
  const { complexId } = await params;

  let complex: DetailRecord | null = null;
  let loadError = false;

  try {
    complex = await getComplexDetail(complexId);
  } catch (error) {
    console.error(error);
    loadError = true;
  }

  if (loadError || !complex) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Back to search
          </Link>

          <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/40 p-6">
            <h1 className="text-2xl font-bold">Complex not found</h1>

            <p className="mt-3 text-slate-300">
              Failed to load complex {complexId}. Please make sure the backend
              is running and this complex ID exists.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const title = getTitle(complex, complexId);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Back to search
        </Link>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            Complex Detail
          </p>

          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>

          <p className="mt-3 text-slate-400">Complex ID: {complexId}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/complex/${complexId}/intra`}
              className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Internal Network
            </Link>

            <Link
              href={`/complex/${complexId}/ext`}
              className="rounded-xl border border-cyan-700 px-5 py-3 text-center font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-slate-800"
            >
              External Network
            </Link>
          </div>
        </section>

        <DetailFields title="Complex detail fields" data={complex} />
      </div>
    </main>
  );
}