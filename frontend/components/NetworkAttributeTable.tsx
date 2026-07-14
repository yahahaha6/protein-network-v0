"use client";

import type { ElementDefinition } from "cytoscape";
import { useMemo, useState } from "react";

type TableMode = "nodes" | "edges";
type DetailRecord = Record<string, unknown>;

type NetworkAttributeTableProps = {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (Array.isArray(value)) {
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

function getData(element: ElementDefinition): DetailRecord {
  return (element.data || {}) as DetailRecord;
}

function collectColumns(rows: DetailRecord[]) {
  const excludedColumns = new Set(["raw"]);
  const preferredColumns = [
    "id",
    "label",
    "type",
    "protein_category",
    "gene_symbol",
    "protein_name",
    "source",
    "target",
    "sources",
    "methods",
    "publications",
    "supporting_structures",
    "ddi",
    "dmi",
  ];

  const allKeys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  ).filter((key) => !excludedColumns.has(key));

  const preferred = preferredColumns.filter((key) => allKeys.includes(key));
  const rest = allKeys.filter((key) => !preferredColumns.includes(key)).sort();

  return [...preferred, ...rest].slice(0, 12);
}

export default function NetworkAttributeTable({
  nodes,
  edges,
}: NetworkAttributeTableProps) {
  const [mode, setMode] = useState<TableMode>("nodes");
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRow, setSelectedRow] = useState<DetailRecord | null>(null);

  const rawRows = useMemo(() => {
    return (mode === "nodes" ? nodes : edges).map(getData);
  }, [mode, nodes, edges]);

  const columns = useMemo(() => collectColumns(rawRows), [rawRows]);

  const filteredRows = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();

    const matchedRows = keyword
      ? rawRows.filter((row) =>
          Object.values(row).some((value) =>
            formatValue(value).toLowerCase().includes(keyword)
          )
        )
      : rawRows;

    return [...matchedRows].sort((a, b) => {
      const aValue = formatValue(a[sortKey]);
      const bValue = formatValue(b[sortKey]);
      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return sortDirection === "asc" ? result : -result;
    });
  }, [filterText, rawRows, sortDirection, sortKey]);

  function toggleSort(column: string) {
    if (sortKey === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(column);
    setSortDirection("asc");
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Attribute table
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            Nodes and edges
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Filter and sort the currently visible subgraph.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("nodes");
              setSelectedRow(null);
            }}
            className={
              mode === "nodes"
                ? "rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
                : "rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            }
          >
            Nodes ({nodes.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("edges");
              setSelectedRow(null);
            }}
            className={
              mode === "edges"
                ? "rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
                : "rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            }
          >
            Edges ({edges.length})
          </button>
        </div>
      </div>

      <input
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
        placeholder="Filter by ID, name, source, method, PMID, DDI, DMI..."
        className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
      />

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900 text-slate-300">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="border-b border-slate-800 px-3 py-2 font-semibold"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="flex items-center gap-1 hover:text-cyan-300"
                    >
                      {column}
                      {sortKey === column && (
                        <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row, index) => (
                <tr
                  key={`${mode}-${formatValue(row.id)}-${index}`}
                  onClick={() => setSelectedRow(row)}
                  className="cursor-pointer border-b border-slate-900 bg-slate-950/60 hover:bg-slate-900"
                >
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="max-w-[260px] truncate px-3 py-2 text-slate-300"
                      title={formatValue(row[column])}
                    >
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No matching rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Showing {filteredRows.length} of {rawRows.length} {mode}.
      </p>

      {selectedRow && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Selected row
          </p>

          <div className="grid gap-2 text-xs md:grid-cols-2">
            {Object.entries(selectedRow)
              .filter(([key]) => key !== "raw")
              .map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-2"
              >
                <p className="font-semibold uppercase tracking-wide text-slate-500">
                  {key}
                </p>
                <p className="mt-1 break-words text-slate-200">
                  {formatValue(value)}
                </p>
              </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
