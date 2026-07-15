# Protein Network Explorer

Protein Network Explorer is a local, read-only web application for examining proteins, protein complexes, and evidence-backed interaction networks. It combines a FastAPI backend with a Next.js/Cytoscape.js frontend and keeps the research data outside Git.

The current implementation is file-backed. It provides protein and complex search, detail pages, protein-centered PPI neighborhoods, intra-complex networks, complex external-partner networks, and a global PPI explorer.

## What You Can Explore

- Search proteins by UniProt accession, gene label, or protein label.
- Search complexes by complex ID or name.
- Inspect protein details, HPA information, complex memberships, and related network links.
- Compare confirmed direct PPI with co-complex-only relationships inside a complex.
- Inspect proteins connected to a complex through external interactions.
- Explore local or global protein-centered PPI neighborhoods.
- Select nodes and edges without losing their scientific color or line-style encoding.
- Export the visible network as PNG or canonical network JSON.

## Scientific Network Contract

All network pages consume the backend's canonical `NetworkResponse`. Core presentation does not reconstruct scientific fields from raw source records.

### Relationship semantics

| Canonical relation | Meaning |
|---|---|
| `protein_physical_interaction` | Direct protein-protein interaction |
| `complex_subunit_pair_supported` | Direct PPI confirmed between two subunits of the same complex |
| `complex_subunit_pair_co_membership_only` | Shared complex membership without direct PPI evidence |
| `complex_external_partner` | External protein associated with a complex through its subunits |

Protein-neighbor and global-PPI pages are two views of direct PPI; they are not additional relationship types.

### Evidence and reported counts

- DDI, DMI, structural/PDB, Gold, source, method, and publication evidence follow the canonical backend mapping.
- Reported counts preserve three distinct states: `null` means the source did not report a count, `0` means the source explicitly reported zero, and a positive integer is the reported quantity.
- A reported count and its detail records are independent. The application never derives a reported count from `details.length`.
- `hasDDI` and `hasDMI` are true when either a positive reported count or non-empty canonical detail records provide support.
- Malformed, negative, fractional, Boolean, or non-finite counts are rejected by the backend normalizer.

## Visual Semantics

### Nodes

| Node category | Color |
|---|---|
| TF | Green |
| EF | Blue |
| TF_and_EF | Orange |
| Focus protein | Yellow |
| Complex | Purple |

The UI supports `TF_and_EF` as a canonical category. The current local source set does not contain a complete authoritative TF-and-EF mapping, so the application does not infer this category from gene names.

### Edges

Relationship, evidence, and context are combined rather than compressed into one edge type.

- Direct PPI uses a blue solid line by default.
- Confirmed intra-complex PPI uses a green solid line by default.
- Co-complex-only relationships use orange dashed lines.
- Complex external partners use blue solid lines by default.
- DDI, DMI, combined DDI+DMI, and structural/PDB evidence override the default edge color and width in that priority order: structural, DDI+DMI, DDI, DMI, relation default.
- An external partner that belongs to another complex keeps a dashed context line, including when structural evidence makes the line thicker.
- Selection adds an outline or emphasis without changing node fill colors or edge colors and line styles.

The legend is derived from the same presentation registry as the graph and only shows items applicable to the current network.

## Technology

### Backend

- Python 3
- FastAPI 0.128.8
- Pydantic 2
- Pandas
- Uvicorn

### Frontend

- Next.js 16.2.10
- React 19
- TypeScript
- Cytoscape.js
- Tailwind CSS

## Repository Layout

```text
protein-network-v0/
├── backend/
│   ├── app/
│   │   ├── normalizers/     # source records -> canonical fields
│   │   ├── routers/         # read-only API routes
│   │   ├── schemas/         # canonical response models
│   │   ├── config.py
│   │   ├── datastore.py
│   │   └── main.py
│   ├── scripts/
│   └── tests/
├── frontend/
│   ├── app/                 # Next.js routes
│   ├── components/          # graph and detail UI
│   ├── lib/                 # API, semantics, presentation, view-models
│   └── tests/
├── docs/
├── data/                    # local research data; ignored by Git
└── README.md
```

## Prerequisites

- Python 3 with `venv` and `pip`.
- Node.js 20.9 or newer and npm.
- The required local graph files under `data/`, or an equivalent directory configured with `DATA_DIR`.

## Local Data

Real biological graph data is intentionally excluded from this repository. By default, when the backend is started from `backend/`, `DATA_DIR` resolves to `../data`.

The loaders expect these dataset groups:

```text
data/
├── complex_ext_ppi_graph/
├── complex_intra_ppi_graph/
├── global_ppi_graph/
└── ppi_unit_graph/
```

To use a different location, create `backend/.env`:

```dotenv
DATA_DIR=/absolute/path/to/data
```

Do not copy real source rows into tests, fixtures, logs, snapshots, or exports committed to Git. Before every commit, verify:

```bash
git ls-files data
```

The command must return no output.

## Run Locally

### 1. Start the backend

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

### 2. Start the frontend

In another terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend uses `http://localhost:8000` by default. To override it, create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Main Pages

| Page | Example route |
|---|---|
| Home and search | `/` |
| Protein detail | `/protein/Q15910` |
| Protein neighbor network | `/protein/Q15910/network` |
| Complex detail | `/complex/996` |
| Intra-complex network | `/complex/996/intra` |
| Complex external network | `/complex/996/ext` |
| Global PPI entry | `/global-ppi` |
| Global PPI neighborhood | `/global-ppi/protein/Q15910/network` |

Protein detail links identify each related complex separately, so a user can open the corresponding intra-complex or external network without guessing which complex an action targets.

A protein can exist in the detail and complex datasets without having a high-confidence direct PPI entry in `ppi_unit_graph`. The protein-network page treats this as an expected no-network state and explains that no qualifying direct PPI evidence is available.

## Backend API

All application routes are prefixed with `/api`.

| Area | Endpoint |
|---|---|
| Health | `GET /api/health` |
| Search | `GET /api/search?q={keyword}&type={protein\|complex\|all}` |
| Protein detail | `GET /api/protein/{uniprot_ac}` |
| Protein neighbors | `GET /api/protein/{uniprot_ac}/neighbors` |
| Complex detail | `GET /api/complex/{complex_id}` |
| Complex intra network | `GET /api/complex/{complex_id}/intra` |
| Complex external network | `GET /api/complex/{complex_id}/ext` |
| Global PPI metadata | `GET /api/global-ppi/info` |
| Global protein detail | `GET /api/global-ppi/protein/{uniprot_ac}` |
| Global PPI neighbors | `GET /api/global-ppi/protein/{uniprot_ac}/neighbors` |
| Global PPI edge | `GET /api/global-ppi/edge?source={source}&target={target}` |

Network routes support bounded pagination or limits where applicable and canonical filters such as source, protein category, DDI, DMI, PDB/structural evidence, confirmed PPI, co-complex-only, and other-complex membership.

## Validation

Run the complete backend suite from the repository root:

```bash
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover \
  -s backend/tests \
  -p 'test_*.py' \
  -v
```

Run frontend semantic tests, lint, and the production build:

```bash
cd frontend
npm run test:network-semantics
npm run lint
npm run build
```

Before committing any change, also run:

```bash
git diff --check
git ls-files data
```

## Current Boundaries

- The application is read-only and file-backed.
- Real research data is local and is not distributed with the repository.
- Network presentation depends only on canonical fields supplied by the backend; missing scientific evidence is not fabricated in the frontend.
- `TF_and_EF` is supported by the contract and UI, but runtime classification remains limited until an authoritative source mapping is supplied.
