"use client";

import cytoscape from "cytoscape";
import type { Core, EdgeSingular, ElementDefinition, LayoutOptions, NodeSingular } from "cytoscape";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import DetailFields from "./DetailFields";
import ExpressionProfileCard from "./ExpressionProfileCard";
import NetworkAttributeTable from "./NetworkAttributeTable";
import {
  getEdgeSemanticModel,
  getNetworkSemanticProfile,
} from "@/lib/networkSemantics";
import {
  formatCompactDetailValue,
  toDetailListPreview,
} from "@/lib/detailPresentation";
import {
  getEdgeLegendItems,
  getEdgePresentationClasses,
  MANAGED_EDGE_PRESENTATION_CLASSES,
} from "@/lib/networkPresentation";

type DetailRecord = Record<string, unknown>;

type NetworkElements = {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
};

type StandardVizNode = {
  id: string;
  label: string;
  type?: string;
  displayName?: string | null;
  proteinCategory?: string;
  badges?: string[];
  hpaProfile?: unknown;
  externalLinks?: unknown[];
  complexIds?: string[];
  complexNames?: string[];
  raw?: DetailRecord;
};

type StandardVizEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string | null;
  evidenceSources?: string[];
  hpaDatasets?: string[];
  methods?: string[];
  publications?: string[];
  supportingStructures?: string[];
  ddi?: string[];
  dmi?: string[];
  hasDDI?: boolean;
  hasDMI?: boolean;
  hasStructuralEvidence?: boolean;
  isConfirmedPpi?: boolean;
  isCoComplexOnly?: boolean;
  evidenceLevel?: string;
  evidenceSummary?: unknown;
  externalLinks?: unknown[];
  raw?: DetailRecord;
};

type LegacyNetworkNode = {
  data?: DetailRecord;
  id?: string;
  label?: string;
  type?: string;
  [key: string]: unknown;
};

type LegacyNetworkEdge = {
  data?: DetailRecord;
  id?: string;
  source?: string;
  target?: string;
  type?: string;
  [key: string]: unknown;
};

type StandardNetworkResponse = {
  graphType?: string;
  center?: StandardVizNode | LegacyNetworkNode | null;
  nodes: Array<StandardVizNode | LegacyNetworkNode | ElementDefinition>;
  edges: Array<StandardVizEdge | LegacyNetworkEdge | ElementDefinition>;
  stats?: unknown;
  legend?: unknown;
  pagination?: unknown;
  filters?: unknown;
  warnings?: string[];
  total?: number;
  total_edges?: number;
  truncated?: boolean;
};

type NetworkGraphInput = NetworkElements | StandardNetworkResponse;

type NetworkGraphProps = {
  elements: NetworkGraphInput;
  focusNodeId?: string;
  layoutName?: "cose" | "concentric" | "circle";
  showEdgeLabels?: boolean;
  enableNodeNavigation?: boolean;
  nodeNavigationMode?: "default" | "global-ppi";
  graphName?: string;
};

type SelectedElement =
  | {
      kind: "node";
      data: DetailRecord;
    }
  | {
      kind: "edge";
      data: DetailRecord;
    }
  | null;

function getNodeHref(
  data: DetailRecord,
  mode: NetworkGraphProps["nodeNavigationMode"] = "default"
) {
  const rawId = String(data.id || "");
  const rawType = String(data.type || "").toLowerCase();

  if (rawType.includes("protein") || rawId.startsWith("UniProt:")) {
    const proteinId = rawId.replace("UniProt:", "");

    if (mode === "global-ppi") {
      return `/global-ppi/protein/${proteinId}/network`;
    }

    return `/protein/${proteinId}`;
  }

  if (rawType.includes("complex") || rawId.startsWith("CORUM:")) {
    const complexId = rawId.replace("CORUM:", "");
    return `/complex/${complexId}`;
  }

  return null;
}

function stripKnownIdPrefix(value: string) {
  return value.replace(/^UniProt:/, "").replace(/^CORUM:/, "");
}

function idsMatch(left: string, right?: string) {
  if (!right) {
    return false;
  }

  return (
    left === right ||
    stripKnownIdPrefix(left) === stripKnownIdPrefix(right)
  );
}

function isCytoscapeElementInput(
  elements: NetworkGraphInput
): elements is NetworkElements {
  return (
    Array.isArray(elements.nodes) &&
    Array.isArray(elements.edges) &&
    elements.nodes.every(
      (node) =>
        typeof node === "object" &&
        node !== null &&
        "data" in node &&
        !("graphType" in node)
    )
  );
}

function getElementData(item: StandardVizNode | StandardVizEdge | LegacyNetworkNode | LegacyNetworkEdge | ElementDefinition) {
  if (
    typeof item === "object" &&
    item !== null &&
    "data" in item &&
    item.data &&
    typeof item.data === "object"
  ) {
    return item.data as DetailRecord;
  }

  return item as DetailRecord;
}

function standardNodeTypeForCytoscape(node: StandardVizNode) {
  const badges = node.badges ?? [];

  if (badges.includes("CENTER")) {
    return "CenterProtein";
  }

  if (node.type === "complex") {
    return "Complex";
  }

  if (node.type === "protein") {
    return "Protein";
  }

  return node.type || "Unknown";
}

function toNetworkElements(elements: NetworkGraphInput): NetworkElements {
  if (isCytoscapeElementInput(elements)) {
    return elements;
  }

  return {
    nodes: elements.nodes.map((node) => {
      const data = getElementData(node);
      const normalizedNode = data as unknown as StandardVizNode;
      const nodeType = standardNodeTypeForCytoscape(normalizedNode);

      return {
        data: {
          ...data,
          id: String(normalizedNode.id || data.id || ""),
          label: String(normalizedNode.label || data.label || normalizedNode.id || data.id || ""),
          type: nodeType,
          nodeType: normalizedNode.type || data.nodeType,
          displayName: normalizedNode.displayName || data.displayName,
          category:
            normalizedNode.proteinCategory ||
            String(data.proteinCategory || data.category || "Unknown"),
          proteinCategory:
            normalizedNode.proteinCategory ||
            String(data.proteinCategory || data.category || "Unknown"),
          badges: normalizedNode.badges ?? data.badges ?? [],
          hpaProfile: normalizedNode.hpaProfile ?? data.hpaProfile,
          externalLinks: normalizedNode.externalLinks ?? data.externalLinks ?? [],
          complexIds: normalizedNode.complexIds ?? data.complexIds ?? [],
          complexNames: normalizedNode.complexNames ?? data.complexNames ?? [],
          raw: normalizedNode.raw ?? data.raw ?? {},
        },
      };
    }),
    edges: elements.edges.map((edge) => {
      const data = getElementData(edge);
      const normalizedEdge = data as unknown as StandardVizEdge;

      return {
        data: {
          ...data,
          id: String(normalizedEdge.id || data.id || `${data.source || ""}-${data.target || ""}`),
          source: String(normalizedEdge.source || data.source || ""),
          target: String(normalizedEdge.target || data.target || ""),
          type: normalizedEdge.type || String(data.type || "ppi"),
          relationshipType:
            normalizedEdge.type ||
            String(data.relationshipType || data.type || "ppi"),
          label:
            normalizedEdge.label ||
            String(data.label || data.relationshipType || data.type || "ppi"),
          evidenceSources:
            normalizedEdge.evidenceSources ??
            (data.evidenceSources as string[] | undefined) ??
            (data.sources as string[] | undefined) ??
            [],
          sources:
            normalizedEdge.evidenceSources ??
            (data.evidenceSources as string[] | undefined) ??
            (data.sources as string[] | undefined) ??
            [],
          hpaDatasets:
            normalizedEdge.hpaDatasets ??
            (data.hpaDatasets as string[] | undefined) ??
            (data.hpa_datasets as string[] | undefined) ??
            [],
          hpa_datasets:
            normalizedEdge.hpaDatasets ??
            (data.hpaDatasets as string[] | undefined) ??
            (data.hpa_datasets as string[] | undefined) ??
            [],
          methods: normalizedEdge.methods ?? (data.methods as string[] | undefined) ?? [],
          publications:
            normalizedEdge.publications ??
            (data.publications as string[] | undefined) ??
            [],
          supportingStructures:
            normalizedEdge.supportingStructures ??
            (data.supportingStructures as string[] | undefined) ??
            (data.supporting_structures as string[] | undefined) ??
            [],
          supporting_structures:
            normalizedEdge.supportingStructures ??
            (data.supportingStructures as string[] | undefined) ??
            (data.supporting_structures as string[] | undefined) ??
            [],
          ddi: normalizedEdge.ddi ?? (data.ddi as string[] | undefined) ?? [],
          dmi: normalizedEdge.dmi ?? (data.dmi as string[] | undefined) ?? [],
          hasDDI: Boolean(normalizedEdge.hasDDI ?? data.hasDDI),
          hasDMI: Boolean(normalizedEdge.hasDMI ?? data.hasDMI),
          hasStructuralEvidence: Boolean(
            normalizedEdge.hasStructuralEvidence ?? data.hasStructuralEvidence
          ),
          isConfirmedPpi: Boolean(
            normalizedEdge.isConfirmedPpi ?? data.isConfirmedPpi
          ),
          isCoComplexOnly: Boolean(
            normalizedEdge.isCoComplexOnly ?? data.isCoComplexOnly
          ),
          evidenceLevel:
            normalizedEdge.evidenceLevel || String(data.evidenceLevel || "unknown"),
          evidenceSummary: normalizedEdge.evidenceSummary ?? data.evidenceSummary,
          externalLinks:
            normalizedEdge.externalLinks ??
            (data.externalLinks as unknown[] | undefined) ??
            [],
          raw: normalizedEdge.raw ?? data.raw ?? {},
        },
      };
    }),
  };
}

function addFocusToElements(
  elements: NetworkElements,
  focusNodeId?: string
): NetworkElements {
  if (!focusNodeId) {
    return elements;
  }

  return {
    nodes: elements.nodes.map((node) => {
      const nodeData = { ...(node.data ?? {}) } as DetailRecord;
      const nodeId = String(nodeData.id || "");
      const nodeLabel = String(nodeData.label || "");

      const isFocus =
        idsMatch(nodeId, focusNodeId) ||
        idsMatch(nodeLabel, focusNodeId);

      if (isFocus) {
        nodeData.isFocus = "true";
      } else {
        delete nodeData.isFocus;
      }

      return {
        ...node,
        data: nodeData,
      };
    }),
    edges: elements.edges,
  };
}

function makeSafeFileName(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function firstDefined(data: DetailRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function buildEdgeDetailData(edgeData: DetailRecord): DetailRecord {
  const preferredData: DetailRecord = {
    source: firstDefined(edgeData, [
      "source_protein",
      "sourceProtein",
      "source_name",
      "sourceName",
      "source",
    ]),
    target: firstDefined(edgeData, [
      "target_protein",
      "targetProtein",
      "target_name",
      "targetName",
      "target",
    ]),
    type: firstDefined(edgeData, [
      "relationship_type",
      "relationshipType",
      "edge_type",
      "edgeType",
      "type",
    ]),
    sources: firstDefined(edgeData, ["sources", "source_database", "sourceDatabase"]),
    methods: firstDefined(edgeData, ["methods", "method"]),
    publications: firstDefined(edgeData, ["publications", "publication", "pubmed_ids", "pubmedIds"]),
    supporting_structures: firstDefined(edgeData, [
      "supporting_structures",
      "supportingStructures",
      "structures",
    ]),
    gold_record_count: firstDefined(edgeData, [
      "gold_record_count",
      "goldRecordCount",
      "record_count",
      "recordCount",
    ]),
        ddi: firstDefined(edgeData, [
      "ddi",
      "DDI",
      "domain_domain_interactions",
      "domainDomainInteractions",
    ]),
    dmi: firstDefined(edgeData, [
      "dmi",
      "DMI",
      "domain_motif_interactions",
      "domainMotifInteractions",
    ]),
  };

  const consumedKeys = new Set([
    "source",
    "source_protein",
    "sourceProtein",
    "source_name",
    "sourceName",
    "target",
    "target_protein",
    "targetProtein",
    "target_name",
    "targetName",
    "type",
    "relationship_type",
    "relationshipType",
    "edge_type",
    "edgeType",
    "sources",
    "source_database",
    "sourceDatabase",
    "methods",
    "method",
    "publications",
    "publication",
    "pubmed_ids",
    "pubmedIds",
    "supporting_structures",
    "supportingStructures",
    "structures",
    "gold_record_count",
    "goldRecordCount",
    "record_count",
    "recordCount",
        "ddi",
    "DDI",
    "domain_domain_interactions",
    "domainDomainInteractions",
    "dmi",
    "DMI",
    "domain_motif_interactions",
    "domainMotifInteractions",
  ]);

  const extraData: DetailRecord = {};

  for (const [key, value] of Object.entries(edgeData)) {
    if (!consumedKeys.has(key)) {
      extraData[key] = value;
    }
  }

  return {
    ...preferredData,
    ...extraData,
  };
}


function toExternalLinks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item as Record<string, unknown>)
    .filter((item) => item && typeof item.url === "string");
}

function renderValueList(value: unknown, emptyLabel = "None") {
  const preview = toDetailListPreview(value, { maxItems: 12 });

  if (preview.items.length === 0) {
    return <span className="text-slate-500">{emptyLabel}</span>;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {preview.items.map((item, index) => (
          <li key={`${item}-${index}`} className="break-words text-slate-200">
            {item}
          </li>
        ))}
      </ul>

      {preview.hiddenCount > 0 && (
        <p className="text-xs font-medium text-slate-500">
          + {preview.hiddenCount} more
        </p>
      )}
    </div>
  );
}

function renderExternalLinks(value: unknown) {
  const links = toExternalLinks(value);

  if (links.length === 0) {
    return <span className="text-slate-500">No external links</span>;
  }

  return (
    <ul className="space-y-1">
      {links.map((link, index) => (
        <li key={`${String(link.url)}-${index}`}>
          <a
            href={String(link.url)}
            target="_blank"
            rel="noreferrer"
            className="break-words text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
          >
            {String(link.label || link.url)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function renderStatusBadge(
  active: boolean,
  activeLabel: string,
  inactiveLabel: string,
  key?: string
) {
  return (
    <span
      key={key}
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
          : "border-slate-700 bg-slate-950/50 text-slate-400"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function evidenceLevelLabel(value: unknown) {
  const text = String(value || "unknown").replace(/_/g, " ");

  return text.charAt(0).toUpperCase() + text.slice(1);
}


function cleanNodeId(value: unknown) {
  return String(value || "").replace("UniProt:", "").replace("CORUM:", "");
}

function getEndpointDisplay(edgeData: DetailRecord, side: "source" | "target") {
  const label =
    side === "source"
      ? firstDefined(edgeData, [
          "source_node_label",
          "sourceLabel",
          "source_label",
          "source_name",
          "sourceName",
          "source_protein",
          "sourceProtein",
        ])
      : firstDefined(edgeData, [
          "target_node_label",
          "targetLabel",
          "target_label",
          "target_name",
          "targetName",
          "target_protein",
          "targetProtein",
        ]);

  const id =
    side === "source"
      ? firstDefined(edgeData, [
          "source_node_id",
          "source",
          "source_id",
          "sourceId",
          "source_uniprot",
          "sourceUniProt",
        ])
      : firstDefined(edgeData, [
          "target_node_id",
          "target",
          "target_id",
          "targetId",
          "target_uniprot",
          "targetUniProt",
        ]);

  const cleanedLabel = String(label || "").trim();
  const cleanedId = cleanNodeId(id).trim();

  if (cleanedLabel && cleanedId && cleanedLabel !== cleanedId) {
    return `${cleanedLabel} / ${cleanedId}`;
  }

  if (cleanedLabel) {
    return cleanedLabel;
  }

  if (cleanedId) {
    return cleanedId;
  }

  return side === "source" ? "Unknown source" : "Unknown target";
}

function getEdgeTitle(edgeData: DetailRecord) {
  const source = getEndpointDisplay(edgeData, "source");
  const target = getEndpointDisplay(edgeData, "target");

  const type = String(
    firstDefined(edgeData, ["relationship_type", "relationshipType", "type"]) ||
      ""
  );

  if (type) {
    return `${source} → ${target} (${type})`;
  }

  return `${source} → ${target}`;
}
function formatSummaryValue(value: unknown) {
  return formatCompactDetailValue(value);
}
const DEFAULT_EVIDENCE_SOURCE_FILTERS = [
  "BioGRID",
  "HPA",
  "IntAct",
  "PDB",
  "CORUM",
];

const EVIDENCE_SOURCE_KEYS = [
  "evidenceSources",
  "evidence_sources",
  "sources",
  "source",
  "source_database",
  "source_databases",
  "sourceDatabase",
  "sourceDatabases",
  "databases",
  "database",
];

function normalizeEvidenceSourceLabel(value: string) {
  const cleaned = value
    .trim()
    .replace(/^["'\[]+|["'\]]+$/g, "")
    .trim();

  const lower = cleaned.toLowerCase();

  if (lower.includes("biogrid")) {
    return "BioGRID";
  }

  if (lower.includes("human protein atlas") || lower === "hpa") {
    return "HPA";
  }

  if (lower.includes("intact")) {
    return "IntAct";
  }

  if (lower.includes("rcsb") || lower === "pdb" || lower.includes("pdb")) {
    return "PDB";
  }

  if (lower.includes("corum")) {
    return "CORUM";
  }

  return cleaned;
}

function splitEvidenceSourceValue(value: unknown): string[] {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => splitEvidenceSourceValue(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      splitEvidenceSourceValue(item)
    );
  }

  const raw = String(value).trim();

  if (!raw) {
    return [];
  }

  if (
    (raw.startsWith("[") && raw.endsWith("]")) ||
    (raw.startsWith("{") && raw.endsWith("}"))
  ) {
    try {
      return splitEvidenceSourceValue(JSON.parse(raw));
    } catch {
      // Fall through to text splitting.
    }
  }

  return raw
    .split(/[,;|]/)
    .map((item) => normalizeEvidenceSourceLabel(item))
    .filter(Boolean);
}

function extractEvidenceSources(data: DetailRecord) {
  const sources = EVIDENCE_SOURCE_KEYS.flatMap((key) =>
    splitEvidenceSourceValue(data[key])
  );

  return Array.from(new Set(sources));
}

function getNodeElementId(node: ElementDefinition) {
  return String((node.data as DetailRecord | undefined)?.id || "");
}

function getEdgeEndpointIds(edge: ElementDefinition) {
  const data = (edge.data || {}) as DetailRecord;

  return {
    source: String(data.source || ""),
    target: String(data.target || ""),
  };
}

function nodeMatchesFocus(node: ElementDefinition, focusNodeId?: string) {
  if (!focusNodeId) {
    return false;
  }

  const data = (node.data || {}) as DetailRecord;
  const id = String(data.id || "");
  const label = String(data.label || "");

  return idsMatch(id, focusNodeId) || idsMatch(label, focusNodeId);
}
function applyEdgeEvidenceClasses(cy: Core, graphType?: string) {
  const semanticProfile = getNetworkSemanticProfile(graphType);
  const managedClasses = MANAGED_EDGE_PRESENTATION_CLASSES.join(" ");

  cy.edges().forEach((edge) => {
    const edgeData = edge.data() as DetailRecord;
    const semanticModel = getEdgeSemanticModel(edgeData, semanticProfile);
    const presentationClasses = getEdgePresentationClasses(semanticModel);

    edge.removeClass(managedClasses);

    if (presentationClasses.length > 0) {
      edge.addClass(presentationClasses.join(" "));
    }
  });
}

const networkStyle = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: 28,
      height: 28,
      "background-color": "#06b6d4",
      "border-width": 2,
      "border-color": "#67e8f9",
      color: "#e2e8f0",
      "font-size": 8,
      "font-weight": 600,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 5,
      "text-outline-width": 2,
      "text-outline-color": "#020617",
      "overlay-opacity": 0,
    },
  },
    {
    selector:
      'node[protein_category = "TF"], node[proteinCategory = "TF"], node[category = "TF"], node[protein_category = "tf"], node[proteinCategory = "tf"], node[category = "tf"]',
    style: {
      "background-color": "#22c55e",
      "border-color": "#86efac",
    },
  },
  {
    selector:
      'node[protein_category = "EF"], node[proteinCategory = "EF"], node[category = "EF"], node[protein_category = "ef"], node[proteinCategory = "ef"], node[category = "ef"]',
    style: {
      "background-color": "#38bdf8",
      "border-color": "#bae6fd",
    },
  },
  {
    selector:
      'node[protein_category = "TF_and_EF"], node[proteinCategory = "TF_and_EF"], node[category = "TF_and_EF"], node[protein_category = "TF_AND_EF"], node[proteinCategory = "TF_AND_EF"], node[category = "TF_AND_EF"], node[protein_category = "tf_and_ef"], node[proteinCategory = "tf_and_ef"], node[category = "tf_and_ef"], node[protein_category = "TF/EF"], node[proteinCategory = "TF/EF"], node[category = "TF/EF"]',
    style: {
      "background-color": "#f97316",
      "border-color": "#fed7aa",
    },
  },
  {
    selector: 'node[isFocus = "true"]',
    style: {
      width: 42,
      height: 42,
      "background-color": "#facc15",
      "border-width": 4,
      "border-color": "#fde68a",
      color: "#f8fafc",
      "font-size": 12,
      "font-weight": 800,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 5,
      "border-color": "#f8fafc",
      "background-color": "#0ea5e9",
    },
  },
  {
    selector: 'node[type = "complex"]',
    style: {
      width: 52,
      height: 52,
      "background-color": "#a855f7",
      "border-color": "#d8b4fe",
      "font-size": 11,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#64748b",
      opacity: 0.75,
      "curve-style": "bezier",
      "target-arrow-shape": "none",
      "overlay-padding": 8,
      "overlay-opacity": 0,
    },
  },
  {
    selector: "edge:selected",
    style: {
      width: 4,
      "line-color": "#f8fafc",
      opacity: 1,
    },
  },
  {
    selector: "edge.show-label",
    style: {
      label: "data(type)",
      "font-size": 7,
      color: "#94a3b8",
      "text-rotation": "autorotate",
      "text-margin-y": -6,
      "text-outline-width": 2,
      "text-outline-color": "#020617",
    },
  },
  {
    selector: 'edge[type = "INTRA_PAIR_CONFIRMED"]',
    style: {
      width: 2.2,
      "line-color": "#22c55e",
      opacity: 0.9,
    },
  },
  {
    selector: 'edge[type = "intra_pair_confirmed"]',
    style: {
      width: 2.2,
      "line-color": "#22c55e",
      opacity: 0.9,
    },
  },
  {
    selector: 'edge[type = "DIRECT_PPI"]',
    style: {
      width: 2,
      "line-color": "#38bdf8",
      opacity: 0.85,
    },
  },
  {
    selector: 'edge[type = "direct_ppi"]',
    style: {
      width: 2,
      "line-color": "#38bdf8",
      opacity: 0.85,
    },
  },
  {
    selector: 'edge[type = "CO_COMPLEX_ONLY"]',
    style: {
      "line-style": "dashed",
      "line-color": "#f97316",
      opacity: 0.85,
    },
  },
  {
    selector: 'edge[type = "co-complex-only"]',
    style: {
      "line-style": "dashed",
      "line-color": "#f97316",
      opacity: 0.85,
    },
  },
    {
    selector: 'edge[type = "co_complex_only"]',
    style: {
      "line-style": "dashed",
      "line-color": "#f97316",
    },
  },
  {
    selector: "edge.has-ddi",
    style: {
      width: 3,
      "line-color": "#ec4899",
      opacity: 0.95,
    },
  },
  {
    selector: "edge.has-dmi",
    style: {
      width: 3,
      "line-color": "#8b5cf6",
      opacity: 0.95,
    },
  },
  {
    selector: "edge.has-ddi-dmi",
    style: {
      width: 4,
      "line-color": "#facc15",
      opacity: 1,
    },
  },
  {
    selector: "edge.edge-role-complex-ext-base",
    style: {
      width: 2.2,
      "line-color": "#38bdf8",
      "line-style": "solid",
      opacity: 0.9,
    },
  },
  {
    selector: "edge.edge-role-complex-ext-other-complex",
    style: {
      width: 3.2,
      "line-color": "#a855f7",
      "line-style": "dashed",
      opacity: 0.95,
    },
  },
  {
    selector: "edge.edge-role-complex-ext-structural",
    style: {
      width: 5,
      "line-color": "#f59e0b",
      "line-style": "solid",
      opacity: 1,
    },
  },
  {
    selector: "edge.edge-role-complex-ext-structural-other-complex",
    style: {
      width: 5,
      "line-color": "#f97316",
      "line-style": "dashed",
      opacity: 1,
    },
  },
  {
    selector: "edge:selected",
    style: {
      width: 5,
      "line-color": "#f8fafc",
      opacity: 1,
    },
  },  {
    selector: "edge.has-structural-evidence",
    style: {
      width: 5,
      "line-style": "solid",
    },
  },
  {
    selector: "edge.confirmed-ppi",
    style: {
      "line-style": "solid",
      opacity: 0.95,
    },
  },
  {
    selector: "edge.co-complex-only",
    style: {
      "line-style": "dashed",
      opacity: 0.65,
    },
  },
  {
    selector: "edge.evidence-co-complex-only",
    style: {
      "line-style": "dashed",
      opacity: 0.65,
    },
  },
  {
    selector: "edge.evidence-high",
    style: {
      width: 5,
    },
  },
  {
    selector: "edge.evidence-medium",
    style: {
      width: 3,
    },
  },
  {
    selector: "edge.evidence-low",
    style: {
      opacity: 0.8,
    },
  },
  {
    selector: "edge.evidence-unknown",
    style: {
      "line-style": "dotted",
      opacity: 0.55,
    },
  },

] as cytoscape.StylesheetJson;


function getLayoutOptions(layoutName: NetworkGraphProps["layoutName"]) {
  if (layoutName === "concentric") {
    return {
      name: "concentric",
      fit: true,
      padding: 120,
      animate: false,
      minNodeSpacing: 85,
      concentric: function (node: NodeSingular) {
        return node.data("isFocus") ? 10 : 1;
      },
      levelWidth: function () {
        return 1;
      },
    } as LayoutOptions;
  }

  if (layoutName === "circle") {
    return {
      name: "circle",
      fit: true,
      padding: 80,
      animate: false,
    } as LayoutOptions;
  }

  return {
    name: "cose",
    fit: true,
    padding: 80,
    animate: false,
    nodeRepulsion: 9000,
    idealEdgeLength: 120,
    edgeElasticity: 100,
  } as LayoutOptions;
}

export default function NetworkGraph({
  elements,
  focusNodeId,
  layoutName = "cose",
  showEdgeLabels = false,
  enableNodeNavigation = true,
  nodeNavigationMode = "default",
  graphName = "network",
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();

  const graphElements = useMemo(() => toNetworkElements(elements), [elements]);

    const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [activeEvidenceSources, setActiveEvidenceSources] = useState<string[]>(
    []
  );

  const evidenceSourceOptions = useMemo(() => {
    const discoveredSources = graphElements.edges.flatMap((edge) =>
      extractEvidenceSources((edge.data || {}) as DetailRecord)
    );

    return Array.from(
      new Set([...DEFAULT_EVIDENCE_SOURCE_FILTERS, ...discoveredSources])
    ).filter(Boolean);
  }, [graphElements.edges]);

  const filteredElements = useMemo(() => {
    if (activeEvidenceSources.length === 0) {
      return graphElements;
    }

    const activeSet = new Set(activeEvidenceSources);

    const filteredEdges = graphElements.edges.filter((edge) => {
      const edgeSources = extractEvidenceSources(
        (edge.data || {}) as DetailRecord
      );

      return edgeSources.some((source) => activeSet.has(source));
    });

    const visibleNodeIds = new Set<string>();

    filteredEdges.forEach((edge) => {
      const { source, target } = getEdgeEndpointIds(edge);
      visibleNodeIds.add(source);
      visibleNodeIds.add(target);
    });

    const filteredNodes = graphElements.nodes.filter((node) => {
      const nodeId = getNodeElementId(node);

      return visibleNodeIds.has(nodeId) || nodeMatchesFocus(node, focusNodeId);
    });

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [activeEvidenceSources, graphElements, focusNodeId]);

  function toggleEvidenceSource(source: string) {
    setActiveEvidenceSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source]
    );
  }

  const graphType =
    typeof (elements as { graphType?: unknown }).graphType === "string"
      ? String((elements as { graphType?: unknown }).graphType)
      : undefined;

  const semanticProfile = getNetworkSemanticProfile(graphType);
  const edgeLegendItems = getEdgeLegendItems(semanticProfile);

  const selectedNodeData =
    selectedElement?.kind === "node" ? selectedElement.data : null;

  const selectedEdgeOriginalData =
    selectedElement?.kind === "edge" ? selectedElement.data : null;

  const selectedEdgeData = selectedEdgeOriginalData
    ? buildEdgeDetailData(selectedEdgeOriginalData)
    : null;

  const selectedEdgeSemanticModel = selectedEdgeOriginalData
    ? getEdgeSemanticModel(selectedEdgeOriginalData, semanticProfile)
    : null;

  const selectedNodeHref = selectedNodeData
  ? getNodeHref(selectedNodeData, nodeNavigationMode)
  : null;
  const selectedEdgeSummary =
  selectedElement?.kind === "edge" && selectedEdgeData
    ? {
        source: getEndpointDisplay(selectedElement.data, "source"),
        target: getEndpointDisplay(selectedElement.data, "target"),
        type: formatSummaryValue(selectedEdgeData.type),
        sources: formatSummaryValue(selectedEdgeData.sources),
        methods: formatSummaryValue(selectedEdgeData.methods),
        publications: formatSummaryValue(selectedEdgeData.publications),
        structures: formatSummaryValue(selectedEdgeData.supporting_structures),
        goldRecordCount: formatSummaryValue(selectedEdgeData.gold_record_count),
        ddi: formatSummaryValue(selectedEdgeData.ddi),
        dmi: formatSummaryValue(selectedEdgeData.dmi),
      }
    : null;
  function fitView() {
  cyRef.current?.fit(undefined, 120);
}

  function resetLayout() {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const layout = cy.layout(getLayoutOptions(layoutName));
    layout.run();

    if (showEdgeLabels) {
      cy.edges().addClass("show-label");
    }
  }

  function downloadPng() {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const pngData = cy.png({
      full: true,
      scale: 2,
      bg: "#020617",
    });

    const link = document.createElement("a");
    link.href = pngData;
    link.download = `${makeSafeFileName(graphName)}.png`;
    link.click();
  }

  function downloadRawJson() {
  const payload = {
    graphName,
    downloadedAt: new Date().toISOString(),
    focusNodeId: focusNodeId ?? null,
        activeEvidenceSources,
    nodeCount: filteredElements.nodes.length,
    edgeCount: filteredElements.edges.length,
    nodes: filteredElements.nodes,
    edges: filteredElements.edges,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${makeSafeFileName(graphName)}_raw.json`;
  link.click();

  URL.revokeObjectURL(url);
}

  function openSelectedNode() {
    if (selectedNodeHref) {
      router.push(selectedNodeHref);
    }
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setSelectedElement(null);

        const focusedElements = addFocusToElements(filteredElements, focusNodeId);

    const cy = cytoscape({
      container: containerRef.current,
      elements: focusedElements as cytoscape.ElementsDefinition,
      style: networkStyle,
      layout: getLayoutOptions(layoutName),
      boxSelectionEnabled: false,
      autounselectify: false,
    });

        cyRef.current = cy;


    if (showEdgeLabels) {
      cy.edges().addClass("show-label");
    }

    function setPointerCursor() {
      if (containerRef.current) {
        containerRef.current.style.cursor = "pointer";
      }
    }

    function setDefaultCursor() {
      if (containerRef.current) {
        containerRef.current.style.cursor = "default";
      }
    }

    cy.on("mouseover", "node", setPointerCursor);
    cy.on("mouseout", "node", setDefaultCursor);

    cy.on("mouseover", "edge", setPointerCursor);
    cy.on("mouseout", "edge", setDefaultCursor);

    cy.on("tap", "node", (event) => {
      const node = event.target as NodeSingular;
      setSelectedElement({
        kind: "node",
        data: { ...node.data() },
      });
    });

    cy.on("tap", "edge", (event) => {
  const edge = event.target as EdgeSingular;
  const sourceNode = edge.source();
  const targetNode = edge.target();

  setSelectedElement({
    kind: "edge",
    data: {
      ...edge.data(),
      source_node_id: sourceNode.data("id"),
      source_node_label: sourceNode.data("label"),
      target_node_id: targetNode.data("id"),
      target_node_label: targetNode.data("label"),
    },
  });
});

    cy.on("tap", (event) => {
      if (event.target === cy) {
        cy.elements().unselect();
        setSelectedElement(null);
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    }, [filteredElements, focusNodeId, layoutName, showEdgeLabels]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    applyEdgeEvidenceClasses(cy, graphType);
  }, [filteredElements, graphType]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Network Viewer
            </h2>
            <p className="text-sm text-slate-400">
              Drag nodes, scroll to zoom, click a node or edge to inspect it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
  <button
    type="button"
    onClick={fitView}
    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
  >
    Fit View
  </button>

  <button
    type="button"
    onClick={resetLayout}
    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
  >
    Reset Layout
  </button>

  <button
    type="button"
    onClick={downloadPng}
    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
  >
    Download PNG
  </button>

  <button
    type="button"
    onClick={downloadRawJson}
    className="rounded-lg border border-cyan-800 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-950/50"
  >
    Download Raw JSON
  </button>
</div>
        </div>
        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Evidence source filter
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Filter visible edges by evidence database. No selected filter
                means all edges are shown.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveEvidenceSources([])}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Show All
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {evidenceSourceOptions.map((source) => {
              const isActive = activeEvidenceSources.includes(source);

              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => toggleEvidenceSource(source)}
                  className={
                    isActive
                      ? "rounded-full border border-cyan-400 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                      : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  }
                >
                  {source}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Showing {filteredElements.nodes.length} nodes and{" "}
            {filteredElements.edges.length} edges.
          </p>
        </div>
                <div
                
  ref={containerRef}
  className="h-[760px] w-full rounded-xl border border-slate-800 bg-slate-900"
/>

        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            Node legend
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-green-200 bg-green-500" />
            TF
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-sky-200 bg-sky-400" />
            EF
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-orange-200 bg-orange-500" />
            TF_and_EF
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-yellow-200 bg-yellow-400" />
            Focus protein
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-purple-200 bg-purple-500" />
            Complex
          </span>
        </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            {semanticProfile.graphKind === "complex_ext"
              ? "Complex external edge legend"
              : "Edge legend"}
          </span>

          {edgeLegendItems.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-2">
              <span className={item.swatchClassName} />
              {item.label}
            </span>
          ))}
        </div>
                <NetworkAttributeTable
          nodes={filteredElements.nodes}
          edges={filteredElements.edges}
        />
      </section>

      <aside className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-100">
          {selectedElement?.kind === "edge" ? "Edge Detail" : "Node Detail"}
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Click a node to view node metadata. Click an edge to view relationship
          evidence.
        </p>

        {!selectedElement && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            No node or edge selected.
          </div>
        )}

        {selectedElement?.kind === "node" && selectedNodeData && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-cyan-900/70 bg-cyan-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Selected Node
              </p>

              <h3 className="mt-1 break-words text-base font-semibold text-slate-100">
                {String(
                  selectedNodeData.label ||
                    selectedNodeData.name ||
                    selectedNodeData.id ||
                    "Unknown"
                )}
              </h3>

              <p className="mt-1 break-words text-xs text-slate-400">
                {String(selectedNodeData.id || "N/A")}
              </p>

              {selectedNodeHref && enableNodeNavigation && (
               <button
  type="button"
  onClick={openSelectedNode}
  className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
>
  {nodeNavigationMode === "global-ppi"
    ? "Open Global Neighborhood"
    : "Open Detail Page"}
</button>
              )}
            </div>

            {typeof selectedNodeData.hpaProfile === "object" &&
            selectedNodeData.hpaProfile !== null ? (
              <ExpressionProfileCard
                data={selectedNodeData.hpaProfile as Record<string, unknown>}
                compact
              />
            ) : null}

            <DetailFields title="Node Fields" data={selectedNodeData} />
          </div>
        )}

        {selectedElement?.kind === "edge" && selectedEdgeData && selectedEdgeSummary && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Interaction Summary
              </p>

              <h3 className="mt-1 break-words text-base font-semibold text-slate-100">
                {getEdgeTitle(selectedElement.data)}
              </h3>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Source
                  </p>
                  <p className="mt-1 break-words font-medium text-slate-200">
                    {selectedEdgeSummary.source}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Target
                  </p>
                  <p className="mt-1 break-words font-medium text-slate-200">
                    {selectedEdgeSummary.target}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Relationship Type
                  </p>
                  <p className="mt-1 break-words font-medium text-slate-200">
                    {selectedEdgeSummary.type}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Evidence Level
                  </p>
                  <p className="mt-1 break-words font-medium text-slate-200">
                    {evidenceLevelLabel(selectedEdgeData.evidenceLevel)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  {selectedEdgeSemanticModel?.statusBadges.map((badge) =>
                    renderStatusBadge(
                      badge.active,
                      badge.activeLabel,
                      badge.inactiveLabel,
                      badge.key
                    )
                  )}
                </div>
              </div>
            </div>

            {selectedEdgeSemanticModel?.complexExternalExplanation && (
              <div className="rounded-xl border border-purple-900/70 bg-purple-950/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">
                  Complex External Explanation
                </p>

                <div className="mt-3 grid gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      External Partner Gene
                    </p>
                    <p className="mt-1 break-words font-medium text-slate-200">
                      {formatSummaryValue(
                        selectedEdgeSemanticModel.complexExternalExplanation
                          .externalPartnerGene
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Mediating Subunit Count
                    </p>
                    <p className="mt-1 break-words font-medium text-slate-200">
                      {formatSummaryValue(
                        selectedEdgeSemanticModel.complexExternalExplanation
                          .nMediatingSubunits
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Mediating Subunit IDs
                    </p>
                    <div className="mt-2">
                      {renderValueList(
                        selectedEdgeSemanticModel.complexExternalExplanation
                          .mediatingSubunitIds,
                        "No mediating subunit IDs"
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Mediating Subunit Genes
                    </p>
                    <div className="mt-2">
                      {renderValueList(
                        selectedEdgeSemanticModel.complexExternalExplanation
                          .mediatingSubunitGenes,
                        "No mediating subunit genes"
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="mb-2">
                      {renderStatusBadge(
                        selectedEdgeSemanticModel.complexExternalExplanation
                          .isSubunitOfOtherComplex,
                        "Partner is in other complexes",
                        "Partner not marked in other complexes"
                      )}
                    </div>

                    {renderValueList(
                      selectedEdgeSemanticModel.complexExternalExplanation
                        .otherComplexIds,
                      "No other complex IDs"
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-pink-900/70 bg-pink-950/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-pink-300">
                DDI / DMI Evidence
              </p>

              <div className="mt-3 grid gap-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2">
                    {renderStatusBadge(
                      Boolean(selectedEdgeData.hasDDI),
                      "DDI-supported",
                      "No DDI evidence"
                    )}
                  </div>
                  {renderValueList(selectedEdgeData.ddi, "No DDI records")}
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2">
                    {renderStatusBadge(
                      Boolean(selectedEdgeData.hasDMI),
                      "DMI-supported",
                      "No DMI evidence"
                    )}
                  </div>
                  {renderValueList(selectedEdgeData.dmi, "No DMI records")}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-sky-900/70 bg-sky-950/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                Structural Evidence
              </p>

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                <div className="mb-2">
                  {renderStatusBadge(
                    Boolean(selectedEdgeData.hasStructuralEvidence),
                    "Structural evidence available",
                    "No structural evidence"
                  )}
                </div>
                {renderValueList(
                  selectedEdgeData.supportingStructures ||
                    selectedEdgeData.supporting_structures,
                  "No supporting PDB structures"
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Source Databases
              </p>

              <div className="mt-3 text-sm">
                {renderValueList(
                  selectedEdgeData.evidenceSources || selectedEdgeData.sources,
                  "No source databases"
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Experimental Methods
              </p>

              <div className="mt-3 text-sm">
                {renderValueList(selectedEdgeData.methods, "No methods")}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Publications
              </p>

              <div className="mt-3 text-sm">
                {renderValueList(selectedEdgeData.publications, "No publications")}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                External Links
              </p>

              <div className="mt-3 text-sm">
                {renderExternalLinks(selectedEdgeData.externalLinks)}
              </div>
            </div>

            <DetailFields title="Full Edge Fields" data={selectedEdgeData} />
          </div>
        )}
      </aside>
    </div>
  );
}
