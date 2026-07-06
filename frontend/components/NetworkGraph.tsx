"use client";

import cytoscape from "cytoscape";
import type { Core, EdgeSingular, ElementDefinition, LayoutOptions, NodeSingular } from "cytoscape";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import DetailFields from "./DetailFields";

type DetailRecord = Record<string, unknown>;

type NetworkElements = {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
};

type NetworkGraphProps = {
  elements: NetworkElements;
  focusNodeId?: string;
  layoutName?: "cose" | "concentric" | "circle";
  showEdgeLabels?: boolean;
  enableNodeNavigation?: boolean;
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

function getNodeHref(data: DetailRecord) {
  const rawId = String(data.id || "");
  const rawType = String(data.type || "").toLowerCase();

  if (rawType.includes("protein") || rawId.startsWith("UniProt:")) {
    const proteinId = rawId.replace("UniProt:", "");
    return `/protein/${proteinId}`;
  }

  if (rawType.includes("complex") || rawId.startsWith("CORUM:")) {
    const complexId = rawId.replace("CORUM:", "");
    return `/complex/${complexId}`;
  }

  return null;
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
        nodeId === focusNodeId ||
        nodeId === `UniProt:${focusNodeId}` ||
        nodeId === `CORUM:${focusNodeId}` ||
        nodeLabel === focusNodeId;

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
    ddi: firstDefined(edgeData, ["ddi", "domain_domain_interactions"]),
    dmi: firstDefined(edgeData, ["dmi", "domain_motif_interactions"]),
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
    "domain_domain_interactions",
    "dmi",
    "domain_motif_interactions",
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
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "N/A";
    }

    return value
      .map((item) =>
        typeof item === "object" && item !== null
          ? JSON.stringify(item)
          : String(item)
      )
      .join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
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
  graphName = "network",
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();

  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);

  const selectedNodeData =
    selectedElement?.kind === "node" ? selectedElement.data : null;

  const selectedEdgeData =
    selectedElement?.kind === "edge"
      ? buildEdgeDetailData(selectedElement.data)
      : null;

  const selectedNodeHref = selectedNodeData ? getNodeHref(selectedNodeData) : null;
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

    const focusedElements = addFocusToElements(elements, focusNodeId);

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
  }, [elements, focusNodeId, layoutName, showEdgeLabels]);

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
          </div>
        </div>

        <div
  ref={containerRef}
  className="h-[760px] w-full rounded-xl border border-slate-800 bg-slate-900"
/>
      </section>

      <aside className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl">
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
                  Open Detail Page
                </button>
              )}
            </div>

            <DetailFields title="Node Fields" data={selectedNodeData} />
          </div>
        )}

        {selectedElement?.kind === "edge" && selectedEdgeData && selectedEdgeSummary && (
  <div className="mt-4 space-y-4">
    <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
        Selected Edge Evidence
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
      </div>
    </div>

    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
        Evidence Summary
      </p>

      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-slate-500">Source databases</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.sources}
          </dd>
        </div>

        <div>
          <dt className="text-slate-500">Experimental methods</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.methods}
          </dd>
        </div>

        <div>
          <dt className="text-slate-500">Publications</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.publications}
          </dd>
        </div>

        <div>
          <dt className="text-slate-500">Supporting structures</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.structures}
          </dd>
        </div>

        <div>
          <dt className="text-slate-500">Gold record count</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.goldRecordCount}
          </dd>
        </div>

        <div>
          <dt className="text-slate-500">DDI</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.ddi}
          </dd>
        </div>

        <div>
          <dt className="text-slate-500">DMI</dt>
          <dd className="mt-1 break-words text-slate-200">
            {selectedEdgeSummary.dmi}
          </dd>
        </div>
      </dl>
    </div>

    <DetailFields title="Full Edge Fields" data={selectedEdgeData} />
  </div>
)}
      </aside>
    </div>
  );
}