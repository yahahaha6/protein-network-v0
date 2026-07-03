"use client";

import cytoscape from "cytoscape";
import type { Core, ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";

type NetworkElements = {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
};

type NetworkGraphProps = {
  elements: NetworkElements;
};

const networkStyle = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: 46,
      height: 46,
      "background-color": "#06b6d4",
      color: "#e2e8f0",
      "font-size": 10,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 6,
      "text-outline-width": 2,
      "text-outline-color": "#020617",
    },
  },
  {
    selector: 'node[type = "complex"]',
    style: {
      width: 70,
      height: 70,
      "background-color": "#a855f7",
      "font-size": 12,
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#64748b",
      "curve-style": "bezier",
      "target-arrow-shape": "none",
      label: "data(type)",
      "font-size": 8,
      color: "#94a3b8",
      "text-rotation": "autorotate",
      "text-margin-y": -8,
    },
  },
  {
    selector: 'edge[type = "confirmed"]',
    style: {
      width: 3,
      "line-color": "#22c55e",
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

export default function NetworkGraph({ elements }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements as cytoscape.ElementsDefinition,
      style: networkStyle,
      layout: {
        name: "cose",
        fit: true,
        padding: 50,
        animate: false,
      },
    });

    cyRef.current = cy;

    cy.on("tap", "node", (event) => {
      const node = event.target;
      console.log("Clicked node:", node.data());
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="h-[650px] w-full" />
    </div>
  );
}