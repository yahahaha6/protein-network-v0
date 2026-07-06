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


Repository
https://github.com/yahahaha6/protein-network-v0
Important Data Privacy Rule

The data/ directory must stay local and must not be committed to GitHub.

Before every commit, run:

git ls-files data

Expected result:

no output

Do not use git add . unless the status is carefully checked.

Local Data Layout
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
Backend

Backend stack:

Python
FastAPI
NetworkX
Pandas
Uvicorn

Run backend:

cd /Users/bobo/Documents/protein-network-v0/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

Backend URL:

http://localhost:8000

Docs:

http://localhost:8000/docs
Backend Files

Important files:

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
Backend API
Existing V0 APIs
GET /api/health
GET /api/search?q={keyword}&type={protein|complex|all}
GET /api/protein/{uniprot_ac}
GET /api/protein/{uniprot_ac}/neighbors
GET /api/complex/{complex_id}
GET /api/complex/{complex_id}/intra
GET /api/complex/{complex_id}/ext
V1 Global PPI APIs
GET /api/global-ppi/info
GET /api/global-ppi/protein/{uniprot_ac}
GET /api/global-ppi/protein/{uniprot_ac}/neighbors?limit=20
GET /api/global-ppi/edge?source={source}&target={target}
Frontend

Frontend stack:

Next.js
React
TypeScript
Tailwind CSS
Cytoscape.js

Run frontend:

cd /Users/bobo/Documents/protein-network-v0/frontend
npm run dev

Frontend URL:

http://localhost:3000
Frontend Pages
frontend/app/page.tsx
frontend/app/protein/[proteinId]/page.tsx
frontend/app/protein/[proteinId]/network/page.tsx
frontend/app/complex/[complexId]/page.tsx
frontend/app/complex/[complexId]/intra/page.tsx
frontend/app/complex/[complexId]/ext/page.tsx
frontend/app/global-ppi/page.tsx
frontend/app/global-ppi/protein/[proteinId]/network/page.tsx
Frontend Components
frontend/components/NetworkGraph.tsx
frontend/components/DetailFields.tsx
frontend/lib/api.ts
NetworkGraph Features

NetworkGraph.tsx supports:

Cytoscape graph rendering
Node click inspection
Edge click inspection
Focus node highlighting
Fit View
Reset Layout
Download PNG
Download Raw JSON
Default node navigation
Global PPI node navigation
Global PPI Explorer Flow

Entry page:

/global-ppi

Example input:

Q15910

Network page:

/global-ppi/protein/Q15910/network

Supported display controls:

Show 20
Show 50
Show All

For stable frontend behavior, Show All currently requests a safe upper limit instead of unlimited full-graph loading.

Edge Evidence Panel

The right-side edge detail panel includes:

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

The Full Edge Fields section preserves raw fields for debugging and traceability.

Raw Data Download

The frontend supports downloading the currently displayed graph as raw JSON.

The downloaded JSON contains:

graphName
downloadedAt
focusNodeId
nodeCount
edgeCount
nodes
edges

This only exports the current network payload already loaded in the browser. It does not expose the full local private data/ directory.

Manual V1 Test Checklist

Run backend and frontend, then open:

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

Check:

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
Current Known Limitations
Global PPI search mainly expects UniProt ID.
Gene symbol search for global PPI is not fully implemented yet.
Show All uses a safe limit rather than unrestricted full graph export.
Full graph visualization is intentionally avoided because it would be visually cluttered.
Edge evidence quality depends on fields available in the source data.
No production deployment yet.
No database-backed graph query engine yet.