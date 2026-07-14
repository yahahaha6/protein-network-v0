import type { RelationKind } from "@/lib/networkTypes";

export type EvidenceRole =
  | "none"
  | "ddi"
  | "dmi"
  | "ddi_and_dmi"
  | "structural";

export type EdgePresentationInput = {
  relationKind: RelationKind;
  hasDDI?: boolean;
  hasDMI?: boolean;
  hasStructuralEvidence?: boolean;
  isSubunitOfOtherComplex?: boolean | null;
};

export type EdgeVisual = {
  color: string;
  width: number;
  lineStyle: "solid" | "dashed";
};

export type EdgeLegendItem = {
  key: string;
  label: string;
  description: string;
  visual: EdgeVisual;
};

export type RelationPresentation = EdgeLegendItem & {
  edgeClassName: string;
  lineStyle: "solid" | "dashed";
  selectedLineStyle: "solid" | "dashed";
  swatchClassName: string;
  legendSwatchClassName: string;
};

export type EdgePresentationState = {
  relationKind: RelationKind;
  evidenceRole: EvidenceRole;
  coComplexOnly: boolean;
  isSubunitOfOtherComplex: boolean;
  classes: string[];
  visual: EdgeVisual;
};

export type PresentationStyleRule = {
  selector: string;
  style: Record<string, string | number>;
};

const RELATION_PRESENTATIONS: Record<RelationKind, RelationPresentation> = {
  protein_physical_interaction: {
    key: "protein_physical_interaction",
    label: "Direct PPI",
    description: "Direct protein-protein interaction.",
    edgeClassName: "edge-relation-protein-physical-interaction",
    lineStyle: "solid",
    selectedLineStyle: "solid",
    swatchClassName: "",
    legendSwatchClassName: "",
    visual: { color: "#38bdf8", width: 2, lineStyle: "solid" },
  },
  complex_subunit_pair_supported: {
    key: "complex_subunit_pair_supported",
    label: "Confirmed intra-complex PPI",
    description: "A direct PPI is confirmed between two complex subunits.",
    edgeClassName: "edge-relation-complex-subunit-pair-supported",
    lineStyle: "solid",
    selectedLineStyle: "solid",
    swatchClassName: "",
    legendSwatchClassName: "",
    visual: { color: "#34d399", width: 2.2, lineStyle: "solid" },
  },
  complex_subunit_pair_co_membership_only: {
    key: "complex_subunit_pair_co_membership_only",
    label: "Co-complex only",
    description: "The pair shares complex membership without direct PPI evidence.",
    edgeClassName: "edge-relation-complex-subunit-pair-co-membership-only",
    lineStyle: "dashed",
    selectedLineStyle: "dashed",
    swatchClassName: "border-dashed",
    legendSwatchClassName: "border-dashed",
    visual: { color: "#fb923c", width: 2.2, lineStyle: "dashed" },
  },
  complex_external_partner: {
    key: "complex_external_partner",
    label: "Complex external partner",
    description: "External protein partner connected through complex subunits.",
    edgeClassName: "edge-relation-complex-external-partner",
    lineStyle: "solid",
    selectedLineStyle: "solid",
    swatchClassName: "",
    legendSwatchClassName: "",
    visual: { color: "#38bdf8", width: 2.2, lineStyle: "solid" },
  },
};

const EVIDENCE_PRESENTATIONS: Record<
  Exclude<EvidenceRole, "none">,
  EdgeLegendItem & { edgeClassName: string }
> = {
  ddi: {
    key: "ddi",
    label: "DDI",
    description: "Domain-domain interaction evidence.",
    edgeClassName: "edge-evidence-ddi",
    visual: { color: "#ec4899", width: 3, lineStyle: "solid" },
  },
  dmi: {
    key: "dmi",
    label: "DMI",
    description: "Domain-motif interaction evidence.",
    edgeClassName: "edge-evidence-dmi",
    visual: { color: "#8b5cf6", width: 3, lineStyle: "solid" },
  },
  ddi_and_dmi: {
    key: "ddi_and_dmi",
    label: "DDI + DMI",
    description: "Both DDI and DMI evidence are present.",
    edgeClassName: "edge-evidence-ddi-and-dmi",
    visual: { color: "#facc15", width: 4, lineStyle: "solid" },
  },
  structural: {
    key: "structural",
    label: "Structural / PDB",
    description: "Supporting structural evidence is present.",
    edgeClassName: "edge-evidence-structural",
    visual: { color: "#f59e0b", width: 5, lineStyle: "solid" },
  },
};

const CONTEXT_PRESENTATIONS = {
  coComplexOnly: {
    edgeClassName: "edge-context-co-complex-only",
    lineStyle: "dashed" as const,
  },
  otherComplex: {
    edgeClassName: "edge-context-other-complex",
    lineStyle: "dashed" as const,
    legend: {
      key: "other_complex",
      label: "Partner in other complexes",
      description: "The external partner also belongs to another complex.",
      visual: { color: "#38bdf8", width: 2.2, lineStyle: "dashed" as const },
    },
  },
};

export const NODE_SELECTED_STYLE = {
  "border-width": 5,
  "border-color": "#f8fafc",
};

export const EDGE_SELECTED_STYLE = {
  width: 6,
  opacity: 1,
  "line-outline-width": 1,
  "line-outline-color": "#f8fafc",
};

const NODE_PRESENTATIONS = {
  TF: {
    key: "TF",
    label: "TF",
    selector: 'node[proteinCategory = "TF"]',
    color: "#22c55e",
    borderColor: "#86efac",
  },
  EF: {
    key: "EF",
    label: "EF",
    selector: 'node[proteinCategory = "EF"]',
    color: "#38bdf8",
    borderColor: "#bae6fd",
  },
  TF_and_EF: {
    key: "TF_and_EF",
    label: "TF_and_EF",
    selector: 'node[proteinCategory = "TF_and_EF"]',
    color: "#f97316",
    borderColor: "#fed7aa",
  },
  Focus: {
    key: "Focus",
    label: "Focus protein",
    selector: 'node[isFocus = "true"]',
    color: "#facc15",
    borderColor: "#fde68a",
  },
  Complex: {
    key: "Complex",
    label: "Complex",
    selector: 'node[type = "complex"]',
    color: "#a855f7",
    borderColor: "#d8b4fe",
  },
} as const;

export function isRelationKind(value: unknown): value is RelationKind {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RELATION_PRESENTATIONS, value)
  );
}

export function getRelationPresentation(
  relationKind: RelationKind
): RelationPresentation {
  return RELATION_PRESENTATIONS[relationKind];
}

export function getNodePresentation(
  key: keyof typeof NODE_PRESENTATIONS
) {
  return NODE_PRESENTATIONS[key];
}

export function getNodeLegendItems() {
  return [
    NODE_PRESENTATIONS.TF,
    NODE_PRESENTATIONS.EF,
    NODE_PRESENTATIONS.TF_and_EF,
    NODE_PRESENTATIONS.Focus,
    NODE_PRESENTATIONS.Complex,
  ];
}

export function getNodePresentationStyleRules(): PresentationStyleRule[] {
  return getNodeLegendItems().map((item) => ({
    selector: item.selector,
    style: {
      "background-color": item.color,
      "border-color": item.borderColor,
      ...(item.key === "Focus" ? { width: 42, height: 42, "border-width": 4 } : {}),
      ...(item.key === "Complex" ? { width: 52, height: 52, "font-size": 11 } : {}),
    },
  }));
}

export function getEvidenceRole(edge: EdgePresentationInput): EvidenceRole {
  if (edge.hasStructuralEvidence === true) {
    return "structural";
  }

  if (edge.hasDDI === true && edge.hasDMI === true) {
    return "ddi_and_dmi";
  }

  if (edge.hasDDI === true) {
    return "ddi";
  }

  if (edge.hasDMI === true) {
    return "dmi";
  }

  return "none";
}

export function buildEdgePresentationState(
  edge: EdgePresentationInput
): EdgePresentationState {
  const relation = getRelationPresentation(edge.relationKind);
  const evidenceRole = getEvidenceRole(edge);
  const coComplexOnly =
    edge.relationKind === "complex_subunit_pair_co_membership_only";
  const isSubunitOfOtherComplex = edge.isSubunitOfOtherComplex === true;
  const evidence =
    evidenceRole === "none" ? null : EVIDENCE_PRESENTATIONS[evidenceRole];
  const classes = [relation.edgeClassName];

  if (evidence) {
    classes.push(evidence.edgeClassName);
  }

  if (coComplexOnly) {
    classes.push(CONTEXT_PRESENTATIONS.coComplexOnly.edgeClassName);
  }

  if (isSubunitOfOtherComplex) {
    classes.push(CONTEXT_PRESENTATIONS.otherComplex.edgeClassName);
  }

  return {
    relationKind: edge.relationKind,
    evidenceRole,
    coComplexOnly,
    isSubunitOfOtherComplex,
    classes,
    visual: {
      color: evidence?.visual.color ?? relation.visual.color,
      width: evidence?.visual.width ?? relation.visual.width,
      lineStyle:
        coComplexOnly || isSubunitOfOtherComplex
          ? "dashed"
          : relation.visual.lineStyle,
    },
  };
}

export const MANAGED_EDGE_PRESENTATION_CLASSES = [
  ...Object.values(RELATION_PRESENTATIONS).map((item) => item.edgeClassName),
  ...Object.values(EVIDENCE_PRESENTATIONS).map((item) => item.edgeClassName),
  CONTEXT_PRESENTATIONS.coComplexOnly.edgeClassName,
  CONTEXT_PRESENTATIONS.otherComplex.edgeClassName,
];

export function getEdgePresentationStyleRules(): PresentationStyleRule[] {
  const relationRules = Object.values(RELATION_PRESENTATIONS).map((item) => ({
    selector: `edge.${item.edgeClassName}`,
    style: {
      width: item.visual.width,
      "line-color": item.visual.color,
      "line-style": item.visual.lineStyle,
      opacity: 0.9,
    },
  }));
  const evidenceRules = Object.values(EVIDENCE_PRESENTATIONS).map((item) => ({
    selector: `edge.${item.edgeClassName}`,
    style: {
      width: item.visual.width,
      "line-color": item.visual.color,
      opacity: 1,
    },
  }));

  return [
    ...relationRules,
    ...evidenceRules,
    {
      selector: `edge.${CONTEXT_PRESENTATIONS.coComplexOnly.edgeClassName}`,
      style: { "line-style": CONTEXT_PRESENTATIONS.coComplexOnly.lineStyle },
    },
    {
      selector: `edge.${CONTEXT_PRESENTATIONS.otherComplex.edgeClassName}`,
      style: { "line-style": CONTEXT_PRESENTATIONS.otherComplex.lineStyle },
    },
  ];
}

export function getEdgeLegendSections(edges: EdgePresentationInput[]) {
  const relationship = new Map<string, EdgeLegendItem>();
  const evidenceAndContext = new Map<string, EdgeLegendItem>();

  for (const edge of edges) {
    const state = buildEdgePresentationState(edge);
    const relation = getRelationPresentation(state.relationKind);
    relationship.set(relation.key, relation);

    if (state.evidenceRole !== "none") {
      const evidence = EVIDENCE_PRESENTATIONS[state.evidenceRole];
      evidenceAndContext.set(evidence.key, evidence);
    }

    if (state.isSubunitOfOtherComplex) {
      const otherComplex = CONTEXT_PRESENTATIONS.otherComplex.legend;
      evidenceAndContext.set(otherComplex.key, otherComplex);
    }
  }

  return {
    relationship: Array.from(relationship.values()),
    evidenceAndContext: Array.from(evidenceAndContext.values()),
  };
}
