import type {
  EdgeSemanticModel,
  EdgeVisualRole,
  NetworkSemanticProfile,
} from "@/lib/networkSemantics";

export type EdgeLegendItem = {
  key: string;
  label: string;
  swatchClassName: string;
};

export const MANAGED_EDGE_PRESENTATION_CLASSES = [
  "has-ddi",
  "has-dmi",
  "has-ddi-dmi",
  "has-structural-evidence",
  "confirmed-ppi",
  "co-complex-only",
  "evidence-high",
  "evidence-medium",
  "evidence-low",
  "evidence-unknown",
  "evidence-co-complex-only",
  "edge-role-protein-ppi-default",
  "edge-role-protein-ppi-ddi",
  "edge-role-protein-ppi-dmi",
  "edge-role-protein-ppi-ddi-dmi",
  "edge-role-protein-ppi-structural",
  "edge-role-complex-intra-confirmed",
  "edge-role-complex-intra-co-complex-only",
  "edge-role-complex-intra-structural",
  "edge-role-complex-ext-base",
  "edge-role-complex-ext-other-complex",
  "edge-role-complex-ext-structural",
  "edge-role-complex-ext-structural-other-complex",
];

const VISUAL_ROLE_CLASS: Record<EdgeVisualRole, string[]> = {
  protein_ppi_default: ["edge-role-protein-ppi-default"],
  protein_ppi_ddi: ["edge-role-protein-ppi-ddi", "has-ddi"],
  protein_ppi_dmi: ["edge-role-protein-ppi-dmi", "has-dmi"],
  protein_ppi_ddi_dmi: ["edge-role-protein-ppi-ddi-dmi", "has-ddi-dmi"],
  protein_ppi_structural: [
    "edge-role-protein-ppi-structural",
    "has-structural-evidence",
  ],
  complex_intra_confirmed: [
    "edge-role-complex-intra-confirmed",
    "confirmed-ppi",
  ],
  complex_intra_co_complex_only: [
    "edge-role-complex-intra-co-complex-only",
    "co-complex-only",
  ],
  complex_intra_structural: [
    "edge-role-complex-intra-structural",
    "has-structural-evidence",
  ],
  complex_ext_base: ["edge-role-complex-ext-base"],
  complex_ext_other_complex: ["edge-role-complex-ext-other-complex"],
  complex_ext_structural: ["edge-role-complex-ext-structural"],
  complex_ext_structural_other_complex: [
    "edge-role-complex-ext-structural-other-complex",
  ],
  unknown: [],
};

export function getEdgePresentationClasses(model: EdgeSemanticModel): string[] {
  return VISUAL_ROLE_CLASS[model.visualRole] ?? [];
}

export function getEdgeLegendItems(
  profile: NetworkSemanticProfile
): EdgeLegendItem[] {
  if (profile.graphKind === "complex_ext") {
    return [
      {
        key: "complex-ext-base",
        label: "External partner",
        swatchClassName: "h-1 w-8 rounded-full bg-sky-400",
      },
      {
        key: "complex-ext-other-complex",
        label: "Partner also in other complexes",
        swatchClassName: "h-1 w-8 border-t border-dashed border-purple-400",
      },
      {
        key: "complex-ext-structural",
        label: "Structural / PDB-supported external partner",
        swatchClassName: "h-1.5 w-8 rounded-full bg-amber-400",
      },
      {
        key: "complex-ext-structural-other-complex",
        label: "PDB-supported and in other complexes",
        swatchClassName: "h-1.5 w-8 border-t-2 border-dashed border-orange-400",
      },
    ];
  }

  if (profile.graphKind === "complex_intra") {
    return [
      {
        key: "complex-intra-confirmed",
        label: "Confirmed intra-complex PPI",
        swatchClassName: "h-1 w-8 rounded-full bg-sky-400",
      },
      {
        key: "complex-intra-co-complex-only",
        label: "Co-complex only",
        swatchClassName: "h-1 w-8 border-t border-dashed border-orange-400",
      },
      {
        key: "complex-intra-structural",
        label: "Structural / PDB evidence",
        swatchClassName: "h-1.5 w-8 rounded-full bg-slate-200",
      },
    ];
  }

  return [
    {
      key: "protein-ppi-default",
      label: "Protein PPI",
      swatchClassName: "h-1 w-8 rounded-full bg-sky-400",
    },
    {
      key: "protein-ppi-ddi",
      label: "DDI evidence",
      swatchClassName: "h-1 w-8 rounded-full bg-pink-500",
    },
    {
      key: "protein-ppi-dmi",
      label: "DMI evidence",
      swatchClassName: "h-1 w-8 rounded-full bg-violet-500",
    },
    {
      key: "protein-ppi-ddi-dmi",
      label: "DDI + DMI",
      swatchClassName: "h-1.5 w-8 rounded-full bg-yellow-400",
    },
    {
      key: "protein-ppi-structural",
      label: "Structural / PDB evidence",
      swatchClassName: "h-2 w-8 rounded-full bg-slate-200",
    },
  ];
}
