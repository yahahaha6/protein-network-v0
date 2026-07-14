import type { EdgeSemanticModel } from "@/lib/networkSemantics";
import type { RelationKind } from "@/lib/networkTypes";

export type EdgeLegendItem = {
  key: RelationKind;
  label: string;
  swatchClassName: string;
};

export type RelationPresentation = EdgeLegendItem & {
  description: string;
  edgeClassName: string;
  lineStyle: "solid" | "dashed";
  selectedLineStyle: "solid" | "dashed";
  legendSwatchClassName: string;
};

export const MANAGED_EDGE_PRESENTATION_CLASSES = [
  "edge-relation-protein-physical-interaction",
  "edge-relation-complex-subunit-pair-supported",
  "edge-relation-complex-subunit-pair-co-membership-only",
  "edge-relation-complex-external-partner",
];

const RELATION_PRESENTATIONS: Record<RelationKind, RelationPresentation> = {
  protein_physical_interaction: {
    key: "protein_physical_interaction",
    label: "Direct PPI",
    description: "Direct protein-protein interaction.",
    edgeClassName: "edge-relation-protein-physical-interaction",
    lineStyle: "solid",
    selectedLineStyle: "solid",
    swatchClassName: "h-1 w-8 rounded-full bg-sky-400",
    legendSwatchClassName: "h-1 w-8 rounded-full bg-sky-400",
  },
  complex_subunit_pair_supported: {
    key: "complex_subunit_pair_supported",
    label: "Confirmed intra-complex PPI",
    description: "A direct PPI is confirmed between two complex subunits.",
    edgeClassName: "edge-relation-complex-subunit-pair-supported",
    lineStyle: "solid",
    selectedLineStyle: "solid",
    swatchClassName: "h-1 w-8 rounded-full bg-emerald-400",
    legendSwatchClassName: "h-1 w-8 rounded-full bg-emerald-400",
  },
  complex_subunit_pair_co_membership_only: {
    key: "complex_subunit_pair_co_membership_only",
    label: "Co-complex only",
    description: "The pair shares complex membership without direct PPI evidence.",
    edgeClassName: "edge-relation-complex-subunit-pair-co-membership-only",
    lineStyle: "dashed",
    selectedLineStyle: "dashed",
    swatchClassName: "h-1 w-8 border-t border-dashed border-orange-400",
    legendSwatchClassName:
      "h-1 w-8 border-t border-dashed border-orange-400",
  },
  complex_external_partner: {
    key: "complex_external_partner",
    label: "Complex external partner",
    description: "External protein partner connected through complex subunits.",
    edgeClassName: "edge-relation-complex-external-partner",
    lineStyle: "solid",
    selectedLineStyle: "solid",
    swatchClassName: "h-1 w-8 rounded-full bg-violet-400",
    legendSwatchClassName: "h-1 w-8 rounded-full bg-violet-400",
  },
};

export function getRelationPresentation(
  relationKind: RelationKind
): RelationPresentation {
  return RELATION_PRESENTATIONS[relationKind];
}

function relationKindForModel(model: EdgeSemanticModel): RelationKind | null {
  switch (model.kind) {
    case "protein_ppi":
      return "protein_physical_interaction";
    case "complex_intra_confirmed_ppi":
      return "complex_subunit_pair_supported";
    case "complex_intra_co_complex_only":
      return "complex_subunit_pair_co_membership_only";
    case "complex_external_partner":
      return "complex_external_partner";
    default:
      return null;
  }
}

export function getEdgePresentationClasses(model: EdgeSemanticModel): string[] {
  const relationKind = relationKindForModel(model);

  return relationKind ? [getRelationPresentation(relationKind).edgeClassName] : [];
}

export function getEdgeLegendItems(
  relationKinds: RelationKind[]
): EdgeLegendItem[] {
  return Array.from(new Set(relationKinds)).map((relationKind) => {
    const presentation = getRelationPresentation(relationKind);

    return {
      key: presentation.key,
      label: presentation.label,
      swatchClassName: presentation.legendSwatchClassName,
    };
  });
}
