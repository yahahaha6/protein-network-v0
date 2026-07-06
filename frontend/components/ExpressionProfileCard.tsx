type ExpressionProfileCardProps = {
  data: Record<string, unknown>;
};

const HPA_FIELDS = [
  {
    key: "sc_type_specificity",
    label: "Single-cell type specificity",
    description: "HPA single-cell type specificity.",
  },
  {
    key: "sc_group_specificity",
    label: "Single-cell group specificity",
    description: "HPA single-cell group specificity.",
  },
  {
    key: "protein_ct_specificity",
    label: "Protein cell-type specificity",
    description: "Protein-level cell-type specificity.",
  },
  {
    key: "tissue_ct_enrichment",
    label: "Tissue cell-type enrichment",
    description: "Tissue-level cell-type enrichment.",
  },
  {
    key: "sc_expression_cluster",
    label: "Single-cell expression cluster",
    description: "HPA single-cell expression cluster.",
  },
  {
    key: "cancer_rna_specificity",
    label: "Cancer RNA specificity",
    description: "Cancer RNA specificity from HPA.",
  },
];

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "nan" ||
    value === "NaN" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function renderValue(value: unknown) {
  if (isEmptyValue(value)) {
    return <span className="text-slate-500">N/A</span>;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export default function ExpressionProfileCard({ data }: ExpressionProfileCardProps) {
  const hasAnyHpaField = HPA_FIELDS.some((field) => !isEmptyValue(data[field.key]));

  return (
    <section className="mt-6 rounded-2xl border border-fuchsia-900/70 bg-fuchsia-950/20 p-6 shadow-xl">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-fuchsia-300">
            HPA Expression Profile
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-100">
            Expression and specificity overview
          </h2>
        </div>

        <div className="rounded-full border border-fuchsia-700/70 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
          Human Protein Atlas
        </div>
      </div>

      {!hasAnyHpaField ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          No structured HPA expression profile fields were found for this protein.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {HPA_FIELDS.map((field) => (
            <div
              key={field.key}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {field.label}
              </div>

              <div className="whitespace-pre-wrap break-words text-base font-semibold leading-6 text-slate-100">
                {renderValue(data[field.key])}
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {field.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}