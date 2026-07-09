# Protein Network Explorer V1

Protein Network Explorer is a local web application for exploring protein complexes, protein-protein interaction networks, and evidence-backed relationship data.

The project is built as a full-stack demo with a FastAPI backend and a Next.js frontend. It supports searching proteins and complexes, visualizing intra-complex and external interaction networks, and exploring global PPI neighborhoods around a selected protein.

## Features

### Protein and complex search

- Search proteins by UniProt ID or protein/gene label
- Search complexes by CORUM ID or complex name
- Open detail pages for proteins and complexes

### Protein pages

- Protein detail view
- Protein neighbor network view
- Node detail panel
- Edge evidence detail panel

### Complex pages

- Complex detail view
- Intra-complex network visualization
- External interaction network visualization
- Clickable node and edge inspection

### Global PPI Explorer

- Open `/global-ppi`
- Enter a UniProt ID such as `Q15910`
- Explore a protein-centered global PPI neighborhood
- Show 20, 50, or all available local neighbors
- Click edges to inspect relationship evidence
- Click nodes to continue exploring another protein neighborhood
- Download the current graph as PNG
- Download the current graph data as raw JSON

## Tech Stack

### Backend

- Python
- FastAPI
- NetworkX
- Pandas
- Uvicorn

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Cytoscape.js

## Project Structure

```text
protein-network-v0/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── datastore.py
│   │   ├── transform.py
│   │   ├── global_ppi_store.py
│   │   └── routers/
│   │       ├── health.py
│   │       ├── search.py
│   │       ├── protein.py
│   │       ├── complex.py
│   │       └── global_ppi.py
│   └── scripts/
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── protein/
│   │   ├── complex/
│   │   └── global-ppi/
│   ├── components/
│   │   ├── NetworkGraph.tsx
│   │   └── DetailFields.tsx
│   └── lib/
│       └── api.ts
├── data/
│   └── local private data, ignored by Git
└── docs/
```

## Data Privacy

The real biological graph data is intentionally not included in this repository.

The `data/` directory is ignored by Git because it may contain large or private research files, including GraphML, JSON, and TSV data files.

Before committing, always check:

```bash
git ls-files data
```

This command should return no output.

## Local Data Layout

The backend expects local data files under `data/`.

Current local layout:

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

## Run Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Backend URL:

```text
http://localhost:8000
```

API docs:

```text
http://localhost:8000/docs
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

## Main Pages

```text
/
```

Home page with search and module entry points.

```text
/protein/Q15910
```

Protein detail page.

```text
/protein/Q15910/network
```

Protein neighbor network page.

```text
/complex/996
```

Complex detail page.

```text
/complex/996/intra
```

Intra-complex network page.

```text
/complex/996/ext
```

External complex-protein interaction network page.

```text
/global-ppi
```

Global PPI Explorer entry page.

```text
/global-ppi/protein/Q15910/network
```

Protein-centered global PPI neighborhood page.

## Backend API

### Health

```text
GET /api/health
```

### Search

```text
GET /api/search?q={keyword}&type={protein|complex|all}
```

### Protein

```text
GET /api/protein/{uniprot_ac}
GET /api/protein/{uniprot_ac}/neighbors
```

### Complex

```text
GET /api/complex/{complex_id}
GET /api/complex/{complex_id}/intra
GET /api/complex/{complex_id}/ext
```

### Global PPI

```text
GET /api/global-ppi/info
GET /api/global-ppi/protein/{uniprot_ac}
GET /api/global-ppi/protein/{uniprot_ac}/neighbors?limit=20
GET /api/global-ppi/edge?source={source}&target={target}
```

## V1 Status

V1 includes:

- Full-stack FastAPI + Next.js workflow
- Protein and complex detail pages
- Cytoscape.js network visualization
- Node detail inspection
- Edge evidence inspection
- Global PPI neighborhood exploration
- PNG graph export
- Network JSON graph export for the canonical current backend response page
- Local-only private data workflow

## Future Work

Potential V1.1 / V2 improvements:

- Search global PPI by gene symbol, not only UniProt ID
- Add PubMed links for publication fields
- Add source database badges
- Add edge filtering by source database or evidence type
- Add shortest path search between proteins
- Add second-hop neighborhood expansion
- Add Neo4j-backed graph queries
- Add deployment configuration