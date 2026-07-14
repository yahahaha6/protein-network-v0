type NodeDetailRecord = Record<string, unknown>;

export type NodeDetailViewModel = {
  kind: "protein" | "complex";
  title: string;
  fields: NodeDetailRecord;
  hpaProfile: NodeDetailRecord | null;
};

function isRecord(value: unknown): value is NodeDetailRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function withoutEmptyValues(record: NodeDetailRecord): NodeDetailRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined || value === "") {
        return false;
      }

      return !Array.isArray(value) || value.length > 0;
    })
  );
}

function isComplexNode(node: NodeDetailRecord): boolean {
  const type = String(node.nodeType ?? node.type ?? "").toLowerCase();
  const id = String(node.id ?? "");

  return type.includes("complex") || id.startsWith("CORUM:");
}

export function buildNodeDetailViewModel(
  node: NodeDetailRecord
): NodeDetailViewModel {
  const id = String(node.id ?? "Unknown");
  const title = String(node.label ?? node.displayName ?? id);

  if (isComplexNode(node)) {
    return {
      kind: "complex",
      title,
      fields: withoutEmptyValues({
        complexId: id,
        name: node.label,
        displayName: node.displayName,
        subunitCount: node.subunitCount,
        externalLinks: node.externalLinks,
      }),
      hpaProfile: null,
    };
  }

  return {
    kind: "protein",
    title,
    fields: withoutEmptyValues({
      uniprotId: id,
      gene: node.label,
      displayName: node.displayName,
      proteinCategory: node.proteinCategory,
      complexIds: node.complexIds,
      complexNames: node.complexNames,
      externalLinks: node.externalLinks,
    }),
    hpaProfile: isRecord(node.hpaProfile) ? node.hpaProfile : null,
  };
}
