export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type SearchResult = {
  id?: string;
  key?: string;
  label?: string;
  name?: string;
  type?: string;
  uniprot_ac?: string;
  complex_id?: string;
  description?: string;
  summary?: Record<string, unknown>;
};

export type SearchApiResponse =
  | SearchResult[]
  | {
      query?: string;
      type?: string;
      count?: number;
      results?: SearchResult[];
      proteins?: SearchResult[];
      complexes?: SearchResult[];
    };

export type DetailRecord = Record<string, unknown>;

export type NetworkNode = {
  data?: {
    id: string;
    label?: string;
    type?: string;
    [key: string]: unknown;
  };
  id?: string;
  label?: string;
  type?: string;
  displayName?: string;
  proteinCategory?: string;
  badges?: string[];
  hpaProfile?: Record<string, unknown>;
  externalLinks?: Record<string, unknown>[];
  raw?: Record<string, unknown>;
  [key: string]: unknown;
};

export type NetworkEdge = {
  data?: {
    id: string;
    source: string;
    target: string;
    type?: string;
    [key: string]: unknown;
  };
  id?: string;
  source?: string;
  target?: string;
  type?: string;
  label?: string;
  evidenceSources?: string[];
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
  evidenceSummary?: Record<string, unknown>;
  externalLinks?: Record<string, unknown>[];
  raw?: Record<string, unknown>;
  [key: string]: unknown;
};

export type NetworkResponse = {
  graphType?: string;
  center?: NetworkNode & {
    uniprotAc?: string;
  };
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  total?: number;
  total_edges?: number;
  limit?: number;
  offset?: number;
  pagination?: {
    limit?: number;
    offset?: number;
    total?: number;
    returned?: number;
    nextOffset?: number | null;
    hasMore?: boolean;
  };
  stats?: {
    nodeCount?: number;
    edgeCount?: number;
    [key: string]: unknown;
  };
  filters?: Record<string, unknown>;
  legend?: Record<string, unknown>;
  warnings?: string[];
  truncated?: boolean;
};

export type ProteinNeighborFilters = {
  source?: string;
  protein_category?: string;
  has_ddi?: boolean;
  has_dmi?: boolean;
  has_pdb?: boolean;
};

export type ComplexIntraFilters = {
  confirmed_ppi?: boolean;
  co_complex_only?: boolean;
  has_ddi?: boolean;
  has_dmi?: boolean;
  has_pdb?: boolean;
};

export type ComplexExtFilters = {
  source?: string;
  protein_category?: string;
  has_ddi?: boolean;
  has_dmi?: boolean;
  has_pdb?: boolean;
  is_subunit_of_other_complex?: boolean;
};

export type GlobalPpiNeighborFilters = {
  source?: string;
  protein_category?: string;
  has_ddi?: boolean;
  has_dmi?: boolean;
  has_pdb?: boolean;
};

export type GlobalPpiInfo = {
  loaded: boolean;
  dataFile?: string;
  name?: string;
  notes?: string;
  nodeCount?: number;
  edgeCount?: number;
  exampleProteinIds?: string[];
  metadata?: Record<string, unknown>;
};

export type GlobalPpiProteinDetail = DetailRecord & {
  id?: string;
  key?: string;
  type?: string;
  label?: string;
  summary?: {
    uniprotAc?: string;
    geneName?: string;
    proteinName?: string;
    category?: string;
    sequenceLength?: string | number;
    neighborCount?: number;
    [key: string]: unknown;
  };
};

export type GlobalPpiEdgeResponse = {
  source: string;
  target: string;
  edge: NetworkEdge;
  raw?: Record<string, unknown>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function normalizeSearchResults(data: SearchApiResponse): SearchResult[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  const merged: SearchResult[] = [];

  if (Array.isArray(data.proteins)) {
    merged.push(...data.proteins);
  }

  if (Array.isArray(data.complexes)) {
    merged.push(...data.complexes);
  }

  return merged;
}

export function getSearchResultTitle(result: SearchResult) {
  return result.label || result.name || result.id || result.key || "Unknown result";
}

export function getSearchResultType(result: SearchResult) {
  return result.type || "unknown";
}

export function getSearchResultHref(result: SearchResult) {
  const type = getSearchResultType(result).toLowerCase();
  const id = result.id || result.key || "";

  if (type.includes("protein") || id.startsWith("UniProt:")) {
    const proteinId = result.uniprot_ac || id.replace("UniProt:", "");
    return proteinId ? `/protein/${proteinId}` : "#";
  }

  if (type.includes("complex") || id.startsWith("CORUM:")) {
    const rawComplexId = result.complex_id || id;
    const complexId = rawComplexId.replace("CORUM:", "");
    return complexId ? `/complex/${complexId}` : "#";
  }

  return "#";
}

export async function searchEntities(
  query: string,
  type: "protein" | "complex" | "all" = "all"
) {
  const data = await fetchJson<SearchApiResponse>(
    `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&type=${type}`
  );

  return normalizeSearchResults(data);
}

export async function getProteinDetail(proteinId: string) {
  return fetchJson<DetailRecord>(`${API_BASE_URL}/api/protein/${proteinId}`);
}

export async function getProteinNeighbors(
  proteinId: string,
  limit = 20,
  filters: ProteinNeighborFilters = {}
) {
  const query = new URLSearchParams({
    limit: String(limit),
  });

  if (filters.source) {
    query.set("source", filters.source);
  }

  if (filters.protein_category) {
    query.set("protein_category", filters.protein_category);
  }

  if (typeof filters.has_ddi === "boolean") {
    query.set("has_ddi", String(filters.has_ddi));
  }

  if (typeof filters.has_dmi === "boolean") {
    query.set("has_dmi", String(filters.has_dmi));
  }

  if (typeof filters.has_pdb === "boolean") {
    query.set("has_pdb", String(filters.has_pdb));
  }

  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/protein/${proteinId}/neighbors?${query.toString()}`
  );
}

export async function getComplexDetail(complexId: string) {
  return fetchJson<DetailRecord>(`${API_BASE_URL}/api/complex/${complexId}`);
}

export async function getComplexIntraNetwork(
  complexId: string,
  filters: ComplexIntraFilters = {}
) {
  const query = new URLSearchParams();

  if (typeof filters.confirmed_ppi === "boolean") {
    query.set("confirmed_ppi", String(filters.confirmed_ppi));
  }

  if (typeof filters.co_complex_only === "boolean") {
    query.set("co_complex_only", String(filters.co_complex_only));
  }

  if (typeof filters.has_ddi === "boolean") {
    query.set("has_ddi", String(filters.has_ddi));
  }

  if (typeof filters.has_dmi === "boolean") {
    query.set("has_dmi", String(filters.has_dmi));
  }

  if (typeof filters.has_pdb === "boolean") {
    query.set("has_pdb", String(filters.has_pdb));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/complex/${complexId}/intra${suffix}`
  );
}

export async function getComplexExtNetwork(
  complexId: string,
  limit = 20,
  offset = 0,
  filters: ComplexExtFilters = {}
) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (filters.source) {
    query.set("source", filters.source);
  }

  if (filters.protein_category) {
    query.set("protein_category", filters.protein_category);
  }

  if (typeof filters.has_ddi === "boolean") {
    query.set("has_ddi", String(filters.has_ddi));
  }

  if (typeof filters.has_dmi === "boolean") {
    query.set("has_dmi", String(filters.has_dmi));
  }

  if (typeof filters.has_pdb === "boolean") {
    query.set("has_pdb", String(filters.has_pdb));
  }

  if (typeof filters.is_subunit_of_other_complex === "boolean") {
    query.set(
      "is_subunit_of_other_complex",
      String(filters.is_subunit_of_other_complex)
    );
  }

  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/complex/${complexId}/ext?${query.toString()}`
  );
}

export function getTotalEdges(network: NetworkResponse) {
  return (
    network.pagination?.total ??
    network.total_edges ??
    network.total ??
    network.edges.length
  );
}

export async function getGlobalPpiInfo() {
  return fetchJson<GlobalPpiInfo>(`${API_BASE_URL}/api/global-ppi/info`);
}

export async function getGlobalPpiProteinDetail(proteinId: string) {
  return fetchJson<GlobalPpiProteinDetail>(
    `${API_BASE_URL}/api/global-ppi/protein/${encodeURIComponent(proteinId)}`
  );
}

export async function getGlobalPpiProteinNeighbors(
  proteinId: string,
  limit = 20,
  filters: GlobalPpiNeighborFilters = {}
) {
  const query = new URLSearchParams({
    limit: String(limit),
  });

  if (filters.source) {
    query.set("source", filters.source);
  }

  if (filters.protein_category) {
    query.set("protein_category", filters.protein_category);
  }

  if (typeof filters.has_ddi === "boolean") {
    query.set("has_ddi", String(filters.has_ddi));
  }

  if (typeof filters.has_dmi === "boolean") {
    query.set("has_dmi", String(filters.has_dmi));
  }

  if (typeof filters.has_pdb === "boolean") {
    query.set("has_pdb", String(filters.has_pdb));
  }

  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/global-ppi/protein/${encodeURIComponent(
      proteinId
    )}/neighbors?${query.toString()}`
  );
}

export async function getGlobalPpiEdge(source: string, target: string) {
  return fetchJson<GlobalPpiEdgeResponse>(
    `${API_BASE_URL}/api/global-ppi/edge?source=${encodeURIComponent(
      source
    )}&target=${encodeURIComponent(target)}`
  );
}