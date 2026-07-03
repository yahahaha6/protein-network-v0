"use client";

import cytoscape from "cytoscape";
import type { Core, ElementDefinition, LayoutOptions } from "cytoscape";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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
};

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
      const nodeId = String(node.data?.id || "");
      const nodeLabel = String(node.data?.label || "");

      const isFocus =
        nodeId === focusNodeId ||
        nodeId === `UniProt:${focusNodeId}` ||
        nodeId === `CORUM:${focusNodeId}` ||
        nodeLabel === focusNodeId;

      return {
        ...node,
        data: {
          ...node.data,
          isFocus,
        },
      };
    }),
    edges: elements.edges,
  };
}

const networkStyle = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: 34,
      height: 34,
      "background-color": "#06b6d4",
      "border-width": 2,
      "border-color": "#67e8f9",
      color: "#e2e8f0",
      "font-size": 9,
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
    selector: "node[isFocus]",
    style: {
      width: 48,
      height: 48,
      "background-color": "#facc15",
      "border-width": 4,
      "border-color": "#fde68a",
      color: "#f8fafc",
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
    selector: 'edge[type = "confirmed"]',
    style: {
      width: 2.5,
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
    selector: 'edge[type = "co-complex-only"]',
    style: {
      "line-style": "dashed",
      "line-color": "#f97316",
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
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

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
      if (!enableNodeNavigation) {
        return;
      }

      const node = event.target;
      const href = getNodeHref(node.data());

      if (href) {
        router.push(href);
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
      <div ref={containerRef} className="h-[720px] w-full" />
    </div>
  );
}