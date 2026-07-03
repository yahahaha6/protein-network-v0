"use client";

import cytoscape from "cytoscape";
import type { Core, ElementDefinition, LayoutOptions } from "cytoscape";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

type SelectedNodeData = Record<string, unknown> | null;

function getNodeHref(data: Record<string, unknown>) {
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
      const nodeData = { ...(node.data ?? {}) } as Record<string, unknown>;
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
function formatNodeValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function makeSafeFileName(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
      padding: 80,
      animate: false,
      minNodeSpacing: 70,
      concentric: function (node: cytoscape.NodeSingular) {
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

  const [selectedNodeData, setSelectedNodeData] =
    useState<SelectedNodeData>(null);

  const selectedNodeHref = selectedNodeData
    ? getNodeHref(selectedNodeData)
    : null;

  function fitView() {
    cyRef.current?.fit(undefined, 80);
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

    setSelectedNodeData(null);

    const focusedElements = addFocusToElements(elements, focusNodeId);

    const cy = cytoscape({
      container: containerRef.current,
      elements: focusedElements as cytoscape.ElementsDefinition,
      style: networkStyle,
      layout: getLayoutOptions(layoutName),
    });

    cyRef.current = cy;

    if (showEdgeLabels) {
      cy.edges().addClass("show-label");
    }

    cy.on("mouseover", "node", () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = "pointer";
      }
    });

    cy.on("mouseout", "node", () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = "default";
      }
    });

    cy.on("tap", "node", (event) => {
      const node = event.target;
      setSelectedNodeData(node.data());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        setSelectedNodeData(null);
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [
    elements,
    focusNodeId,
    layoutName,
    showEdgeLabels,
    enableNodeNavigation,
    router,
  ]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-100">Network Viewer</p>
          <p className="mt-1 text-xs text-slate-500">
            Drag nodes, scroll to zoom, click a node to inspect it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fitView}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            Fit View
          </button>

          <button
            type="button"
            onClick={resetLayout}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            Reset Layout
          </button>

          <button
            type="button"
            onClick={downloadPng}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Download PNG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={containerRef} className="h-[720px] w-full" />

        <aside className="border-t border-slate-800 bg-slate-900/70 p-4 lg:border-l lg:border-t-0">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-100">Node Detail</p>
            <p className="mt-1 text-xs text-slate-500">
              Click a node in the graph to view its data.
            </p>
          </div>

          {!selectedNodeData && (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              No node selected.
            </div>
          )}

          {selectedNodeData && (
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-800 bg-cyan-950/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Selected Node
                </p>

                <h3 className="mt-2 break-words text-lg font-bold text-slate-100">
                  {String(
                    selectedNodeData.label ||
                      selectedNodeData.name ||
                      selectedNodeData.id ||
                      "Unknown"
                  )}
                </h3>

                <p className="mt-1 break-words text-sm text-slate-400">
                  {String(selectedNodeData.id || "N/A")}
                </p>

                {selectedNodeHref && enableNodeNavigation && (
                  <button
                    type="button"
                    onClick={openSelectedNode}
                    className="mt-4 w-full rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Open Detail Page
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {Object.entries(selectedNodeData).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {key}
                    </p>

                    <p className="mt-1 break-words text-sm leading-6 text-slate-200">
                      {formatNodeValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}