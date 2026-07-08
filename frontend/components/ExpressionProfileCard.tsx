type ExpressionProfileCardProps = {
  data: Record<string, unknown> | null | undefined;
  compact?: boolean;
};

type HpaField = {
  keys: string[];
  label: string;
  description: string;
};

const HPA_FIELDS: HpaField[] = [
  {
    keys: ["scTypeSpecificity", "sc_type_specificity"],
    label: "Single-cell type specificity",
    description: "HPA single-cell type specificity.",
  },
  {
    keys: ["scGroupSpecificity", "sc_group_specificity"],
    label: "Single-cell group specificity",
    description: "HPA single-cell group specificity.",
  },
  {
    keys: ["proteinCtSpecificity", "protein_ct_specificity"],
    label: "Protein cell-type specificity",
    description: "Protein-level cell-type specificity.",
  },
  {
    keys: ["tissueCtEnrichment", "tissue_ct_enrichment"],
    label: "Tissue cell-type enrichment",
    description: "Tissue-level cell-type enrichment.",
  },
  {
    keys: ["scExpressionCluster", "sc_expression_cluster"],
    label: "Single-cell expression cluster",
    description: "HPA single-cell expression cluster.",
  },
  {
    keys: ["cancerRnaSpecificity", "cancer_rna_specificity"],
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

function firstAvailableValue(
  data: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!data) {
    return undefined;
  }

  for (const key of keys) {
    const value = data[key];

    if (!isEmptyValue(value)) {
      return value;
    }
  }

  return undefined;
}

function renderValue(value: unknown) {
  if (isEmptyValue(value)) {
    return <span className="text-slate-500">N/A</span>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export default function ExpressionProfileCard({
  data,
  compact = false,
}: ExpressionProfileCardProps) {
  const hasAnyHpaField = HPA_FIELDS.some(
    (field) => !isEmptyValue(firstAvailableValue(data, field.keys))
  );

  return (
    <section
      className={
        compact
          ? "rounded-xl border border-fuchsia-900/70 bg-fuchsia-950/20 p-4"
          : "mt-6 rounded-2xl border border-fuchsia-900/70 bg-fuchsia-950/20 p-6 shadow-xl"
      }
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-300">
            HPA Expression Profile
          </p>
          <h2
            className={
              compact
                ? "mt-2 text-base font-bold text-slate-100"
                : "mt-2 text-2xl font-bold text-slate-100"
            }
          >
            Expression and specificity overview
          </h2>
        </div>

        <div className="w-fit rounded-full border border-fuchsia-700/70 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
          Human Protein Atlas
        </div>
      </div>

      {!hasAnyHpaField ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          No structured HPA expression profile fields were found for this protein.
        </div>
      ) : (
        <div className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}>
          {HPA_FIELDS.map((field) => {
            const value = firstAvailableValue(data, field.keys);

            return (
              <div
                key={field.keys[0]}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {field.label}
                </div>

                <div className="whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-100">
                  {renderValue(value)}
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {field.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
