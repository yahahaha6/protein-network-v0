"use client";

import cytoscape from "cytoscape";
import type {
  Core,
  EdgeSingular,
  ElementDefinition,
  LayoutOptions,
  NodeSingular,
} from "cytoscape";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import DetailFields from "./DetailFields";
import ExpressionProfileCard from "./ExpressionProfileCard";
import NetworkAttributeTable from "./NetworkAttributeTable";
import { buildEdgeDetailViewModel } from "@/lib/edgeDetailViewModel";
import {
  formatCompactDetailValue,
  toDetailListPreview,
} from "@/lib/detailPresentation";
import {
  getEdgeLegendItems,
  getRelationPresentation,
  MANAGED_EDGE_PRESENTATION_CLASSES,
} from "@/lib/networkPresentation";
import type {
  CanonicalNetworkEdge,
  RelationKind,
} from "@/lib/networkTypes";

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

type StandardVizEdge = Partial<CanonicalNetworkEdge> & {
  id: string;
  source: string;
  target: string;
  type?: string;
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
  | { kind: "node"; data: DetailRecord }
  | { kind: "edge"; data: DetailRecord }
  | null;

const RELATION_KINDS = new Set<RelationKind>([
  "protein_physical_interaction",
  "complex_subunit_pair_supported",
  "complex_subunit_pair_co_membership_only",
  "complex_external_partner",
]);

function isRelationKind(value: unknown): value is RelationKind {
  return typeof value === "string" && RELATION_KINDS.has(value as RelationKind);
}

function getNodeHref(
  data: DetailRecord,
  mode: NetworkGraphProps["nodeNavigationMode"] = "default"
) {
  const rawId = String(data.id || "");
  const rawType = String(data.type || "").toLowerCase();

  if (rawType.includes("protein") || rawId.startsWith("UniProt:")) {
    const proteinId = rawId.replace("UniProt:", "");

    return mode === "global-ppi"
      ? `/global-ppi/protein/${proteinId}/network`
      : `/protein/${proteinId}`;
  }

  if (rawType.includes("complex") || rawId.startsWith("CORUM:")) {
    return `/complex/${rawId.replace("CORUM:", "")}`;
  }

  return null;
}

function stripKnownIdPrefix(value: string) {
  return value.replace(/^UniProt:/, "").replace(/^CORUM:/, "");
}

function idsMatch(left: string, right?: string) {
  return Boolean(
    right &&
      (left === right || stripKnownIdPrefix(left) === stripKnownIdPrefix(right))
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

function getElementData(
  item:
    | StandardVizNode
    | StandardVizEdge
    | LegacyNetworkNode
    | LegacyNetworkEdge
    | ElementDefinition
) {
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
  if (node.badges?.includes("CENTER")) {
    return "CenterProtein";
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
      const normalizedNode = data as StandardVizNode;

      return {
        data: {
          ...data,
          id: String(normalizedNode.id ?? data.id ?? ""),
          label: String(
            normalizedNode.label ?? data.label ?? normalizedNode.id ?? data.id ?? ""
          ),
          type: standardNodeTypeForCytoscape(normalizedNode),
          nodeType: normalizedNode.type ?? data.nodeType,
          displayName: normalizedNode.displayName ?? data.displayName,
          proteinCategory: normalizedNode.proteinCategory ?? data.proteinCategory,
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
      const normalizedEdge = data as StandardVizEdge;

      return {
        data: {
          ...data,
          id: String(
            normalizedEdge.id ?? data.id ?? `${data.source ?? ""}-${data.target ?? ""}`
          ),
          source: String(normalizedEdge.source ?? data.source ?? ""),
          target: String(normalizedEdge.target ?? data.target ?? ""),
          type: normalizedEdge.type ?? data.type,
          relationKind: normalizedEdge.relationKind ?? data.relationKind,
          label: normalizedEdge.label ?? data.label,
          evidenceSources:
            normalizedEdge.evidenceSources ?? data.evidenceSources ?? [],
          methods: normalizedEdge.methods ?? data.methods ?? [],
          publications: normalizedEdge.publications ?? data.publications ?? [],
          supportingStructures:
            normalizedEdge.supportingStructures ?? data.supportingStructures ?? [],
          ddi: normalizedEdge.ddi ?? data.ddi ?? [],
          dmi: normalizedEdge.dmi ?? data.dmi ?? [],
          hasDDI: normalizedEdge.hasDDI ?? data.hasDDI ?? false,
          hasDMI: normalizedEdge.hasDMI ?? data.hasDMI ?? false,
          hasStructuralEvidence:
            normalizedEdge.hasStructuralEvidence ?? data.hasStructuralEvidence ?? false,
          isConfirmedPpi:
            normalizedEdge.isConfirmedPpi ?? data.isConfirmedPpi ?? false,
          isCoComplexOnly:
            normalizedEdge.isCoComplexOnly ?? data.isCoComplexOnly ?? false,
          evidenceSummary:
            normalizedEdge.evidenceSummary ?? data.evidenceSummary ?? undefined,
          externalLinks:
            normalizedEdge.externalLinks ?? data.externalLinks ?? [],
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
      const data = { ...(node.data ?? {}) } as DetailRecord;
      data.isFocus = idsMatch(String(data.id ?? ""), focusNodeId) ? "true" : "false";

      return { ...node, data };
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

function toExternalLinks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && typeof item.url === "string"
  );
}

function renderValueList(value: unknown, emptyLabel: string) {
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
            {String(link.label ?? link.url)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function DetailCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-200">
        {formatCompactDetailValue(value)}
      </p>
    </div>
  );
}

function applyRelationPresentationClasses(cy: Core) {
  const managedClasses = MANAGED_EDGE_PRESENTATION_CLASSES.join(" ");

  cy.edges().forEach((edge) => {
    const relationKind = edge.data("relationKind");
    edge.removeClass(managedClasses);

    if (isRelationKind(relationKind)) {
      edge.addClass(getRelationPresentation(relationKind).edgeClassName);
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
    selector: 'node[proteinCategory = "TF"]',
    style: { "background-color": "#22c55e", "border-color": "#86efac" },
  },
  {
    selector: 'node[proteinCategory = "EF"]',
    style: { "background-color": "#38bdf8", "border-color": "#bae6fd" },
  },
  {
    selector: 'node[proteinCategory = "TF_and_EF"]',
    style: { "background-color": "#f97316", "border-color": "#fed7aa" },
  },
  {
    selector: 'node[isFocus = "true"]',
    style: {
      width: 42,
      height: 42,
      "background-color": "#facc15",
      "border-width": 4,
      "border-color": "#fde68a",
      "font-size": 12,
      "font-weight": 800,
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
    selector: "node:selected",
    style: {
      "border-width": 5,
      "border-color": "#f8fafc",
      "background-color": "#0ea5e9",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#64748b",
      "line-style": "solid",
      opacity: 0.75,
      "curve-style": "bezier",
      "target-arrow-shape": "none",
      "overlay-padding": 8,
      "overlay-opacity": 0,
    },
  },
  {
    selector: "edge.edge-relation-protein-physical-interaction",
    style: { width: 2, "line-color": "#38bdf8", "line-style": "solid", opacity: 0.9 },
  },
  {
    selector: "edge.edge-relation-complex-subunit-pair-supported",
    style: { width: 2.2, "line-color": "#34d399", "line-style": "solid", opacity: 0.95 },
  },
  {
    selector: "edge.edge-relation-complex-subunit-pair-co-membership-only",
    style: { width: 2.2, "line-color": "#fb923c", "line-style": "dashed", opacity: 0.9 },
  },
  {
    selector: "edge.edge-relation-complex-external-partner",
    style: { width: 2.2, "line-color": "#a78bfa", "line-style": "solid", opacity: 0.9 },
  },
  {
    selector: "edge:selected",
    style: { width: 4, "line-color": "#f8fafc", opacity: 1 },
  },
  {
    selector: "edge.edge-relation-complex-subunit-pair-co-membership-only:selected",
    style: { "line-style": "dashed" },
  },
  {
    selector: "edge.show-label",
    style: {
      label: "data(label)",
      "font-size": 7,
      color: "#94a3b8",
      "text-rotation": "autorotate",
      "text-margin-y": -6,
      "text-outline-width": 2,
      "text-outline-color": "#020617",
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
      concentric: (node: NodeSingular) => (node.data("isFocus") ? 10 : 1),
      levelWidth: () => 1,
    } as LayoutOptions;
  }

  if (layoutName === "circle") {
    return { name: "circle", fit: true, padding: 80, animate: false } as LayoutOptions;
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

  const edgeLegendItems = useMemo(() => {
    const relationKinds = graphElements.edges
      .map((edge) => (edge.data as DetailRecord | undefined)?.relationKind)
      .filter(isRelationKind);

    return getEdgeLegendItems(relationKinds);
  }, [graphElements.edges]);

  const selectedNodeData =
    selectedElement?.kind === "node" ? selectedElement.data : null;
  const selectedEdgeData =
    selectedElement?.kind === "edge" ? selectedElement.data : null;
  const selectedNodeHref = selectedNodeData
    ? getNodeHref(selectedNodeData, nodeNavigationMode)
    : null;
  const selectedEdgeView = useMemo(() => {
    if (!selectedEdgeData || !isRelationKind(selectedEdgeData.relationKind)) {
      return null;
    }

    return buildEdgeDetailViewModel(selectedEdgeData);
  }, [selectedEdgeData]);

  function fitView() {
    cyRef.current?.fit(undefined, 120);
  }

  function resetLayout() {
    const cy = cyRef.current;

    if (cy) {
      cy.layout(getLayoutOptions(layoutName)).run();
      if (showEdgeLabels) {
        cy.edges().addClass("show-label");
      }
    }
  }

  function downloadPng() {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const link = document.createElement("a");
    link.href = cy.png({ full: true, scale: 2, bg: "#020617" });
    link.download = `${makeSafeFileName(graphName)}.png`;
    link.click();
  }

  function downloadNetworkJson() {
    const payload = {
      graphName,
      downloadedAt: new Date().toISOString(),
      focusNodeId: focusNodeId ?? null,
      exportKind: "canonical_network",
      canonicalNetwork: {
        nodeCount: graphElements.nodes.length,
        edgeCount: graphElements.edges.length,
        nodes: graphElements.nodes,
        edges: graphElements.edges,
      },
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${makeSafeFileName(graphName)}_network.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setSelectedElement(null);
    const cy = cytoscape({
      container: containerRef.current,
      elements: addFocusToElements(graphElements, focusNodeId) as cytoscape.ElementsDefinition,
      style: networkStyle,
      layout: getLayoutOptions(layoutName),
      boxSelectionEnabled: false,
      autounselectify: false,
    });
    cyRef.current = cy;
    applyRelationPresentationClasses(cy);

    if (showEdgeLabels) {
      cy.edges().addClass("show-label");
    }

    const setPointerCursor = () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = "pointer";
      }
    };
    const setDefaultCursor = () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = "default";
      }
    };

    cy.on("mouseover", "node, edge", setPointerCursor);
    cy.on("mouseout", "node, edge", setDefaultCursor);
    cy.on("tap", "node", (event) => {
      setSelectedElement({ kind: "node", data: { ...event.target.data() } });
    });
    cy.on("tap", "edge", (event) => {
      const edge = event.target as EdgeSingular;
      setSelectedElement({ kind: "edge", data: { ...edge.data() } });
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
  }, [graphElements, focusNodeId, layoutName, showEdgeLabels]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Network Viewer</h2>
            <p className="text-sm text-slate-400">
              Drag nodes, scroll to zoom, click a node or edge to inspect it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={fitView} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Fit View</button>
            <button type="button" onClick={resetLayout} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Reset Layout</button>
            <button type="button" onClick={downloadPng} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Download PNG</button>
            <button type="button" onClick={downloadNetworkJson} className="rounded-lg border border-cyan-800 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-950/50">Download Network JSON</button>
          </div>
        </div>

        <div ref={containerRef} className="h-[760px] w-full rounded-xl border border-slate-800 bg-slate-900" />

        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Node legend</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-green-200 bg-green-500" />TF</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-sky-200 bg-sky-400" />EF</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-orange-200 bg-orange-500" />TF_and_EF</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-yellow-200 bg-yellow-400" />Focus protein</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-purple-200 bg-purple-500" />Complex</span>
        </div>

        {edgeLegendItems.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Edge legend</span>
            {edgeLegendItems.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-2">
                <span className={item.swatchClassName} />
                {item.label}
              </span>
            ))}
          </div>
        )}

        <NetworkAttributeTable nodes={graphElements.nodes} edges={graphElements.edges} />
      </section>

      <aside className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-100">
          {selectedElement?.kind === "edge" ? "Edge Detail" : "Node Detail"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Click a node to view node metadata. Click an edge to view relationship evidence.
        </p>

        {!selectedElement && <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">No node or edge selected.</div>}

        {selectedNodeData && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-cyan-900/70 bg-cyan-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Selected Node</p>
              <h3 className="mt-1 break-words text-base font-semibold text-slate-100">{String(selectedNodeData.label ?? selectedNodeData.id ?? "Unknown")}</h3>
              <p className="mt-1 break-words text-xs text-slate-400">{String(selectedNodeData.id ?? "N/A")}</p>
              {selectedNodeHref && enableNodeNavigation && (
                <button type="button" onClick={() => router.push(selectedNodeHref)} className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  {nodeNavigationMode === "global-ppi" ? "Open Global Neighborhood" : "Open Detail Page"}
                </button>
              )}
            </div>
            {typeof selectedNodeData.hpaProfile === "object" && selectedNodeData.hpaProfile !== null && (
              <ExpressionProfileCard data={selectedNodeData.hpaProfile as DetailRecord} compact />
            )}
            <DetailFields title="Node Fields" data={selectedNodeData} />
          </div>
        )}

        {selectedEdgeData && !selectedEdgeView && (
          <div className="mt-4 rounded-xl border border-red-900/70 bg-red-950/20 p-4 text-sm text-red-200">
            This edge is missing a canonical relationKind and cannot be presented safely.
          </div>
        )}

        {selectedEdgeData && selectedEdgeView && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Relationship Summary</p>
              <h3 className="mt-1 break-words text-base font-semibold text-slate-100">{selectedEdgeView.source} → {selectedEdgeView.target}</h3>
              <p className="mt-1 text-sm text-slate-300">{selectedEdgeView.relationDescription}</p>
              <div className="mt-4 grid gap-3 text-sm">
                <DetailCard label="Relationship" value={selectedEdgeView.relationLabel} />
                <DetailCard label="Source" value={selectedEdgeView.source} />
                <DetailCard label="Target" value={selectedEdgeView.target} />
              </div>
            </div>

            {selectedEdgeView.showCoMembershipExplanation && (
              <div className="rounded-xl border border-orange-900/70 bg-orange-950/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Co-complex Membership</p>
                <p className="mt-2 text-sm text-slate-300">This pair shares complex membership but has no direct PPI evidence in the current source data.</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <DetailCard label="Complex ID" value={selectedEdgeView.coMembership?.complexId} />
                  <DetailCard label="Complex Name" value={selectedEdgeView.coMembership?.complexName} />
                </div>
              </div>
            )}

            {selectedEdgeView.showExternalMediation && selectedEdgeView.externalMediation && (
              <div className="rounded-xl border border-purple-900/70 bg-purple-950/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">Complex External Mediation</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <DetailCard label="External Partner Gene" value={selectedEdgeView.externalMediation.externalPartnerGene} />
                  <DetailCard label="Mediating Subunit Count" value={selectedEdgeView.externalMediation.nMediatingSubunits} />
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Mediating Subunit IDs</p><div className="mt-2">{renderValueList(selectedEdgeView.externalMediation.mediatingSubunitIds, "No mediating subunit IDs")}</div></div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Other Complex IDs</p><div className="mt-2">{renderValueList(selectedEdgeView.externalMediation.otherComplexIds, "No other complex IDs")}</div></div>
                </div>
              </div>
            )}

            {selectedEdgeView.showInteractionEvidence && (
              <div className="rounded-xl border border-cyan-900/70 bg-cyan-950/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Interaction Evidence</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <DetailCard label="Source count" value={selectedEdgeView.evidence.sourceCount} />
                  <DetailCard label="Method count" value={selectedEdgeView.evidence.methodCount} />
                  <DetailCard label="Publication count" value={selectedEdgeView.evidence.publicationCount} />
                  <DetailCard label="Structure count" value={selectedEdgeView.evidence.structureCount} />
                  <DetailCard label="Gold record count" value={selectedEdgeView.evidence.goldRecordCount} />
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Source Databases</p><div className="mt-2">{renderValueList(selectedEdgeData.evidenceSources, "No source databases")}</div></div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Experimental Methods</p><div className="mt-2">{renderValueList(selectedEdgeData.methods, "No methods")}</div></div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Publications</p><div className="mt-2">{renderValueList(selectedEdgeData.publications, "No publications")}</div></div>
                </div>
              </div>
            )}

            {selectedEdgeView.showFeatureAnnotations && (
              <div className="rounded-xl border border-pink-900/70 bg-pink-950/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-pink-300">Feature and Structural Annotations</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <DetailCard label="DDI record count" value={selectedEdgeView.evidence.ddiRecordCount} />
                  <DetailCard label="DMI record count" value={selectedEdgeView.evidence.dmiRecordCount} />
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">DDI Details</p><div className="mt-2">{renderValueList(selectedEdgeData.ddi, "No DDI records")}</div></div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">DMI Details</p><div className="mt-2">{renderValueList(selectedEdgeData.dmi, "No DMI records")}</div></div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Supporting PDB Structures</p><div className="mt-2">{renderValueList(selectedEdgeData.supportingStructures, "No supporting PDB structures")}</div></div>
                </div>
              </div>
            )}

            {selectedEdgeView.showInteractionEvidence && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">External Links</p>
                <div className="mt-3 text-sm">{renderExternalLinks(selectedEdgeData.externalLinks)}</div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
