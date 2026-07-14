type DetailRecord = Record<string, unknown>;

type RelatedComplexLink = {
  id: string;
  label: string;
  internalHref?: string;
  externalHref?: string;
};

export type RelatedComplexNetworks = {
  memberComplexes: RelatedComplexLink[];
  externalComplexes: RelatedComplexLink[];
  memberCount: number;
  externalCount: number;
  externalTruncated: boolean;
};

function isRecord(value: unknown): value is DetailRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sectionItems(section: DetailRecord | undefined): DetailRecord[] {
  if (!section || !Array.isArray(section.items)) {
    return [];
  }

  return section.items.filter(isRecord);
}

function sectionCount(section: DetailRecord | undefined, fallback: number): number {
  return typeof section?.count === "number" ? section.count : fallback;
}

function toComplexLink(
  item: DetailRecord,
  network: "intra" | "ext"
): RelatedComplexLink | null {
  if (typeof item.id !== "string" && typeof item.id !== "number") {
    return null;
  }

  const id = String(item.id);
  const label = String(item.label ?? item.name ?? id);
  const href = `/complex/${encodeURIComponent(id)}/${network}`;

  return {
    id,
    label,
    ...(network === "intra" ? { internalHref: href } : { externalHref: href }),
  };
}

export function buildRelatedComplexNetworks(
  protein: DetailRecord
): RelatedComplexNetworks {
  const sections = Array.isArray(protein.sections)
    ? protein.sections.filter(isRecord)
    : [];
  const memberSection = sections.find((section) => section.id === "member_complexes");
  const externalSection = sections.find(
    (section) => section.id === "external_complexes"
  );
  const memberItems = sectionItems(memberSection);
  const externalItems = sectionItems(externalSection);
  const memberComplexes = memberItems
    .map((item) => toComplexLink(item, "intra"))
    .filter((item): item is RelatedComplexLink => item !== null);
  const externalComplexes = externalItems
    .map((item) => toComplexLink(item, "ext"))
    .filter((item): item is RelatedComplexLink => item !== null);

  return {
    memberComplexes,
    externalComplexes,
    memberCount: sectionCount(memberSection, memberComplexes.length),
    externalCount: sectionCount(externalSection, externalComplexes.length),
    externalTruncated: externalSection?.truncated === true,
  };
}
