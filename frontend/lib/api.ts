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
  data: {
    id: string;
    label?: string;
    type?: string;
    [key: string]: unknown;
  };
};

export type NetworkEdge = {
  data: {
    id: string;
    source: string;
    target: string;
    type?: string;
    [key: string]: unknown;
  };
};

export type NetworkResponse = {
  center?: {
    id?: string;
    uniprotAc?: string;
    label?: string;
    type?: string;
    [key: string]: unknown;
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
  };
  stats?: {
    nodeCount?: number;
    edgeCount?: number;
  };
  truncated?: boolean;
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

export async function getProteinNeighbors(proteinId: string, limit = 20) {
  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/protein/${proteinId}/neighbors?limit=${limit}`
  );
}

export async function getComplexDetail(complexId: string) {
  return fetchJson<DetailRecord>(`${API_BASE_URL}/api/complex/${complexId}`);
}

export async function getComplexIntraNetwork(complexId: string) {
  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/complex/${complexId}/intra`
  );
}

export async function getComplexExtNetwork(
  complexId: string,
  limit = 20,
  offset = 0
) {
  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/complex/${complexId}/ext?limit=${limit}&offset=${offset}`
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
  limit = 20
) {
  return fetchJson<NetworkResponse>(
    `${API_BASE_URL}/api/global-ppi/protein/${encodeURIComponent(
      proteinId
    )}/neighbors?limit=${limit}`
  );
}

export async function getGlobalPpiEdge(source: string, target: string) {
  return fetchJson<GlobalPpiEdgeResponse>(
    `${API_BASE_URL}/api/global-ppi/edge?source=${encodeURIComponent(
      source
    )}&target=${encodeURIComponent(target)}`
  );
}