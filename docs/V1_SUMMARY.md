# Protein Network Explorer V1 Summary

## Goal

V1 turns the original V0 protein/complex network demo into a broader protein interaction exploration platform.

The main V1 goal is to support:

1. Protein detail exploration
2. Complex detail exploration
3. Intra-complex and external interaction visualization
4. Global PPI neighborhood exploration
5. Edge-level evidence inspection
6. Safe local-only data handling

## Current Local Project Path

```text
/Users/bobo/Documents/protein-network-v0
```

## Repository

```text
https://github.com/yahahaha6/protein-network-v0
```

## Important Data Privacy Rule

The `data/` directory must stay local and must not be committed to GitHub.

Before every commit, run:

```bash
git ls-files data
```

Expected result:

```text
no output
```

Do not use `git add .` unless the status is carefully checked.

## Local Data Layout

```text
data/
├── complex_ext_ppi_graph/
│   ├── complex_ext_ppi_graph.graphml
│   ├── complex_ext_ppi_graph.json
│   ├── complex_nodes.tsv
│   ├── ext_edges.tsv
│   └── ext_protein_nodes.tsv
├── complex_intra_ppi_graph/
│   ├── complex_intra_ppi_graph.graphml
│   ├── complex_intra_ppi_graph.json
│   ├── complex_nodes.tsv
│   ├── intra_edges.tsv
│   └── protein_nodes.tsv
├── global_ppi_graph/
│   ├── ppi_graph.graphml
│   └── ppi_graph.json
└── ppi_unit_graph/
    ├── ppi_edges.tsv
    └── ppi_nodes.tsv
```

## Backend

Backend stack:

- Python
- FastAPI
- NetworkX
- Pandas
- Uvicorn

Run backend:

```bash
cd /Users/bobo/Documents/protein-network-v0/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Backend URL:

```text
http://localhost:8000
```

Docs:

```text
http://localhost:8000/docs
```

## Backend Files

Important files:

```text
backend/app/main.py
backend/app/config.py
backend/app/datastore.py
backend/app/transform.py
backend/app/global_ppi_store.py
backend/app/routers/health.py
backend/app/routers/search.py
backend/app/routers/protein.py
backend/app/routers/complex.py
backend/app/routers/global_ppi.py
```

## Backend API

### Existing V0 APIs

```text
GET /api/health
GET /api/search?q={keyword}&type={protein|complex|all}
GET /api/protein/{uniprot_ac}
GET /api/protein/{uniprot_ac}/neighbors
GET /api/complex/{complex_id}
GET /api/complex/{complex_id}/intra
GET /api/complex/{complex_id}/ext
```

### V1 Global PPI APIs

```text
GET /api/global-ppi/info
GET /api/global-ppi/protein/{uniprot_ac}
GET /api/global-ppi/protein/{uniprot_ac}/neighbors?limit=20
GET /api/global-ppi/edge?source={source}&target={target}
```

## Frontend

Frontend stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Cytoscape.js

Run frontend:

```bash
cd /Users/bobo/Documents/protein-network-v0/frontend
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Frontend Pages

```text
frontend/app/page.tsx
frontend/app/protein/[proteinId]/page.tsx
frontend/app/protein/[proteinId]/network/page.tsx
frontend/app/complex/[complexId]/page.tsx
frontend/app/complex/[complexId]/intra/page.tsx
frontend/app/complex/[complexId]/ext/page.tsx
frontend/app/global-ppi/page.tsx
frontend/app/global-ppi/protein/[proteinId]/network/page.tsx
```

## Frontend Components

```text
frontend/components/NetworkGraph.tsx
frontend/components/DetailFields.tsx
frontend/lib/api.ts
```

## NetworkGraph Features

`NetworkGraph.tsx` supports:

- Cytoscape graph rendering
- Node click inspection
- Edge click inspection
- Focus node highlighting
- Fit View
- Reset Layout
- Download PNG
- Download Raw JSON
- Default node navigation
- Global PPI node navigation

## Global PPI Explorer Flow

Entry page:

```text
/global-ppi
```

Example input:

```text
Q15910
```

Network page:

```text
/global-ppi/protein/Q15910/network
```

Supported display controls:

```text
Show 20
Show 50
Show All
```

For stable frontend behavior, Show All currently requests a safe upper limit instead of unlimited full-graph loading.

## Edge Evidence Panel

The right-side edge detail panel includes:

```text
Selected Edge Evidence
Source
Target
Relationship Type

Evidence Summary
Source databases
Experimental methods
Publications
Supporting structures
Gold record count
DDI
DMI

Full Edge Fields
```

The Full Edge Fields section preserves raw fields for debugging and traceability.

## Raw Data Download

The frontend supports downloading the currently displayed graph as raw JSON.

The downloaded JSON contains:

```text
graphName
downloadedAt
focusNodeId
nodeCount
edgeCount
nodes
edges
```

This only exports the current network payload already loaded in the browser. It does not expose the full local private `data/` directory.

## Manual V1 Test Checklist

Run backend and frontend, then open:

```text
http://localhost:3000
http://localhost:3000/protein/Q15910
http://localhost:3000/protein/Q15910/network
http://localhost:3000/complex/996
http://localhost:3000/complex/996/intra
http://localhost:3000/complex/996/ext
http://localhost:3000/global-ppi
http://localhost:3000/global-ppi/protein/Q15910/network
http://localhost:3000/global-ppi/protein/Q15910/network?limit=50
http://localhost:3000/global-ppi/protein/Q15910/network?limit=all
```

Check:

```text
Page loads
No red error panel
Graph renders
Node click works
Edge click works
Fit View works
Reset Layout works
Download PNG works
Download Raw JSON works
Global PPI node navigation works
```

## Current Known Limitations

- Global PPI search mainly expects UniProt ID.
- Gene symbol search for global PPI is not fully implemented yet.
- Show All uses a safe limit rather than unrestricted full graph export.
- Full graph visualization is intentionally avoided because it would be visually cluttered.
- Edge evidence quality depends on fields available in the source data.
- No production deployment yet.
- No database-backed graph query engine yet.

## Recommended Next Steps

V1 finalization:

1. Run lint.
2. Manually test all pages.
3. Confirm `data/` is not tracked.
4. Push all local commits.
5. Tag the repository as `v1.0.0`.

V1.1 ideas:

1. Search global PPI by gene symbol.
2. Add source database filtering.
3. Convert PubMed IDs into links.
4. Hide empty `N/A` evidence fields.
5. Add layout switcher for global PPI graph.
6. Add shortest path query between two proteins.

V2 ideas:

1. Neo4j backend.
2. Multi-hop network expansion.
3. User-uploaded graph files.
4. Database storage.
5. Deployment.
6. Authentication and private data access control.