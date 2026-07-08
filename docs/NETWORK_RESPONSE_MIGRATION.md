# Network Response Migration Plan

## 1. Goal

This document defines the migration contract for moving the three core network endpoints to the standard `NetworkResponse` shape.

The migration targets are:

- protein neighbors
- complex intra network
- complex external network

The goal is not to flatten all graph semantics into one generic graph. The goal is to share one response shell while preserving each graph type's biological interpretation.

Standardization should make the frontend simpler, but it must not erase the meaning of:

- direct protein-protein interaction evidence
- confirmed PPI versus co-complex-only intra-complex relationships
- external complex partners connected through mediating subunits
- DDI, DMI, PDB, PMID, source, and method evidence
- HPA expression context where available

Important principle:

```text
NetworkResponse is the shared response shell.
It is not a shared biological meaning.
```

---

## 2. Current endpoints to migrate

Current audited endpoints:

```text
/api/protein/{uniprot_ac}/neighbors
/api/complex/{complex_id}/intra
/api/complex/{complex_id}/ext
```

Audited examples:

```text
/api/protein/Q15910/neighbors?limit=20
/api/protein/P04637/neighbors?limit=20
/api/complex/996/intra
/api/complex/7955/ext?limit=20
```

These examples should remain the fixed validation cases during migration.

---

## 3. Current audited response shapes

### 3.1 Protein neighbors

Endpoint:

```text
/api/protein/{uniprot_ac}/neighbors
```

Audited examples:

```text
/api/protein/Q15910/neighbors?limit=20
/api/protein/P04637/neighbors?limit=20
```

Current top-level keys:

```text
center
nodes
edges
pagination
stats
truncated
```

Current node shape:

```text
nodes[i].data
```

Current edge shape:

```text
edges[i].data
```

Current sample edge fields under `edge.data`:

```text
id
source
target
type
protein1
protein2
gene1
gene2
sources
methods
publications
supportingStructures
nDdi
nDmi
hasDdi
hasDmi
ddi
dmi
```

Current stats shape:

```text
nodeCount
edgeCount
```

Current pagination shape:

```text
limit
offset
total
returned
nextOffset
```

---

### 3.2 Complex intra network

Endpoint:

```text
/api/complex/{complex_id}/intra
```

Audited example:

```text
/api/complex/996/intra
```

Current top-level keys:

```text
complex
nodes
edges
stats
```

Current node shape:

```text
nodes[i].data
```

Current edge shape:

```text
edges[i].data
```

Current sample edge fields under `edge.data`:

```text
id
source
target
type
complexId
evidenceInPpiGraph
evidenceLabel
sources
methods
publications
supportingStructures
sharedComplexCount
ddi
dmi
```

Current stats shape:

```text
nodeCount
edgeCount
confirmedEdgeCount
coComplexOnlyEdgeCount
```

---

### 3.3 Complex external network

Endpoint:

```text
/api/complex/{complex_id}/ext
```

Audited example:

```text
/api/complex/7955/ext?limit=20
```

Current top-level keys:

```text
complex
nodes
edges
pagination
stats
truncated
```

Current node shape:

```text
nodes[i].data
```

Current edge shape:

```text
edges[i].data
```

Current sample edge fields under `edge.data`:

```text
id
source
target
type
complexName
extGeneName
mediatingSubunitIds
mediatingSubunitGenes
nMediatingSubunits
isSubunitOfOtherComplex
otherComplexIds
sources
methods
publications
supportingStructures
```

Current stats shape:

```text
nodeCount
edgeCount
```

Current pagination shape:

```text
limit
offset
total
returned
nextOffset
```

---

## 4. Standard NetworkResponse shell

All migrated network endpoints should return the standard shell:

```text
graphType
center
nodes
edges
stats
legend
pagination
filters
warnings
```

The shell should follow the existing backend schema direction in:

```text
backend/app/schemas/visualization.py
```

Expected meaning:

```text
graphType:
  String identifying the biological network type.

center:
  The query center object, such as a protein or complex.

nodes:
  List of normalized VizNode objects.

edges:
  List of normalized VizEdge objects.

stats:
  Backend-computed NetworkStats object.

legend:
  Backend-provided NetworkLegend object.

pagination:
  PaginationInfo when the endpoint supports limit / offset.
  Use null when pagination is not applicable.

filters:
  Echo of backend filters that were applied.
  Use an empty object when no filters were applied.

warnings:
  Human-readable warnings for truncation, missing data, or unsupported combinations.
  Use an empty list when there are no warnings.
```

Target example shape:

```json
{
  "graphType": "protein_neighbors",
  "center": {},
  "nodes": [],
  "edges": [],
  "stats": {},
  "legend": {},
  "pagination": null,
  "filters": {},
  "warnings": []
}
```

---

## 5. Graph types

Recommended graph types:

```text
protein_neighbors
complex_intra
complex_external
global_ppi
```

Existing `global_ppi` already uses the standard response direction and should be treated as the reference implementation.

However, `global_ppi` should not become the only priority. The original MVP depends on the three core views:

```text
protein neighbors
complex intra
complex external
```

---

## 6. Edge relationship types

Standardization must preserve edge semantics.

Recommended edge relationship types:

```text
protein_ppi
complex_intra_confirmed_ppi
complex_intra_co_complex_only
complex_external_partner
```

These types should be represented in `VizEdge.type` or in an equivalent standard field.

The frontend can use this field for:

- edge styling
- legend explanation
- edge detail panel wording
- future Evidence Table grouping

---

## 7. Protein neighbors migration contract

Target endpoint:

```text
/api/protein/{uniprot_ac}/neighbors
```

Target response:

```text
graphType: protein_neighbors
center: normalized protein center
nodes: VizNode[]
edges: VizEdge[]
stats: NetworkStats
legend: NetworkLegend
pagination: PaginationInfo
filters: applied filter object
warnings: string[]
```

Protein neighbor edge meaning:

```text
protein edge = direct PPI or protein-protein association
```

Must preserve:

```text
source protein
target protein
protein1
protein2
gene1
gene2
sources
methods
publications
supportingStructures
nDdi
nDmi
hasDdi
hasDmi
ddi
dmi
evidenceLevel
evidenceSummary
externalLinks
```

Recommended mapping:

```text
edge.data.source -> VizEdge.source
edge.data.target -> VizEdge.target
edge.data.type -> VizEdge.type
edge.data.sources -> EvidenceSummary.sources
edge.data.methods -> EvidenceSummary.methods
edge.data.publications -> EvidenceSummary.publications
edge.data.supportingStructures -> EvidenceSummary.supportingStructures
edge.data.ddi -> EvidenceSummary.ddi
edge.data.dmi -> EvidenceSummary.dmi
edge.data.hasDdi -> EvidenceSummary.hasDDI
edge.data.hasDmi -> EvidenceSummary.hasDMI
```

Implementation notes:

- Reuse `normalize_protein_node`.
- Reuse `normalize_evidence`.
- Preserve raw fields during early migration if needed.
- Do not let the frontend parse raw fields for core evidence decisions.
- First migration should only standardize the response shape.
- Add filters in the following stage, not in the same commit.

Validation examples:

```text
Q15910 / EZH2
P04637 / TP53
```

Minimum validation commands:

```bash
curl "http://localhost:8000/api/protein/Q15910/neighbors?limit=20" | python3 -m json.tool | head -120

curl "http://localhost:8000/api/protein/P04637/neighbors?limit=20" | python3 -m json.tool | head -120
```

---

## 8. Complex intra migration contract

Target endpoint:

```text
/api/complex/{complex_id}/intra
```

Target response:

```text
graphType: complex_intra
center: normalized complex center
nodes: VizNode[]
edges: VizEdge[]
stats: NetworkStats
legend: NetworkLegend
pagination: null or PaginationInfo
filters: applied filter object
warnings: string[]
```

Complex intra edge meaning:

```text
complex intra edge = same-complex internal subunit relationship
```

Must distinguish:

```text
confirmed direct PPI
co-complex-only relationship
```

Important biological boundary:

```text
Two proteins belonging to the same complex does not automatically prove direct physical interaction.
```

Must preserve:

```text
source protein
target protein
complexId
complexIds
complexNames
evidenceInPpiGraph
evidenceLabel
sharedComplexCount
nComplexesShared
isConfirmedPpi
isCoComplexOnly
sources
methods
publications
supportingStructures
ddi
dmi
PDB evidence
```

Recommended mapping:

```text
edge.data.evidenceInPpiGraph == true:
  isConfirmedPpi = true
  isCoComplexOnly = false
  type = complex_intra_confirmed_ppi

edge.data.evidenceInPpiGraph == false:
  isConfirmedPpi = false
  isCoComplexOnly = true
  type = complex_intra_co_complex_only
```

If the current raw value is not a strict boolean, normalize it carefully.

Accepted truthy examples may include:

```text
true
True
1
yes
confirmed
```

Accepted falsy examples may include:

```text
false
False
0
no
co_complex_only
```

Validation example:

```text
complex_id=996
```

Minimum validation command:

```bash
curl "http://localhost:8000/api/complex/996/intra" | python3 -m json.tool | head -160
```

The edge detail panel must explain why an edge is confirmed PPI or co-complex-only.

---

## 9. Complex external migration contract

Target endpoint:

```text
/api/complex/{complex_id}/ext
```

Target response:

```text
graphType: complex_external
center: normalized complex center
nodes: VizNode[]
edges: VizEdge[]
stats: NetworkStats
legend: NetworkLegend
pagination: PaginationInfo
filters: applied filter object
warnings: string[]
```

Complex external edge meaning:

```text
complex ext edge = complex connects to an external partner through one or more mediating subunits
```

This is not the same as a simple protein-protein edge.

Must preserve:

```text
complexId
complexName
externalPartnerId
externalPartnerGene
extGeneName
mediatingSubunits
mediatingSubunitIds
mediatingSubunitGenes
nMediatingSubunits
isSubunitOfOtherComplex
otherComplexIds
sources
methods
publications
supportingStructures
nDdi
nDmi
ddi
dmi
evidenceLevel
evidenceSummary
externalLinks
```

Recommended mapping:

```text
edge.data.complexName -> complexName
edge.data.extGeneName -> externalPartnerGene
edge.data.mediatingSubunitIds -> mediatingSubunitIds
edge.data.mediatingSubunitGenes -> mediatingSubunitGenes
edge.data.nMediatingSubunits -> nMediatingSubunits
edge.data.isSubunitOfOtherComplex -> isSubunitOfOtherComplex
edge.data.otherComplexIds -> otherComplexIds
edge.data.sources -> EvidenceSummary.sources
edge.data.methods -> EvidenceSummary.methods
edge.data.publications -> EvidenceSummary.publications
edge.data.supportingStructures -> EvidenceSummary.supportingStructures
```

Validation example:

```text
complex_id=7955
```

Minimum validation command:

```bash
curl "http://localhost:8000/api/complex/7955/ext?limit=20" | python3 -m json.tool | head -160
```

Important rendering requirement:

```text
External networks can be large.
The endpoint must keep limit / offset pagination or another explicit truncation strategy.
```

The edge detail panel must show:

```text
external partner
mediating subunits
whether the external partner is also a subunit of other complexes
other complex IDs
DDI / DMI / structure / publication evidence
```

---

## 10. Must-preserve fields

### 10.1 Protein-level fields

```text
uniprotAc
geneName
proteinName
proteinCategory
hpaProfile
externalLinks
complexIds
complexNames
```

### 10.2 Evidence fields

```text
sources
methods
publications
supportingStructures
ddi
dmi
hasDdi
hasDmi
hasStructuralEvidence
isConfirmedPpi
isCoComplexOnly
evidenceLevel
evidenceSummary
externalLinks
```

### 10.3 Complex intra fields

```text
complexId
complexIds
complexNames
sharedComplexCount
nComplexesShared
evidenceInPpiGraph
evidenceLabel
```

### 10.4 Complex external fields

```text
complexName
externalPartnerId
externalPartnerGene
extGeneName
mediatingSubunits
mediatingSubunitIds
mediatingSubunitGenes
nMediatingSubunits
isSubunitOfOtherComplex
otherComplexIds
```

---

## 11. First-version filters

Filters must be implemented in the backend.

The frontend should pass URL parameters and render the returned filtered subgraph.

The frontend must not hide edges locally to pretend filtering was applied.

### 11.1 Protein neighbors filters

First version:

```text
source
protein_category
has_ddi
has_dmi
has_pdb
```

### 11.2 Complex intra filters

First version:

```text
confirmed_ppi
co_complex_only
has_ddi
has_dmi
has_pdb
```

### 11.3 Complex external filters

First version:

```text
mediating_subunit
has_ddi
has_dmi
is_subunit_of_other_complex
external_partner_category
```

Later optional filters:

```text
source
method
evidence_level
```

---

## 12. Stats, legend, and pagination definitions

Stats should be computed by the backend.

Recommended stats:

```text
nodeCount
edgeCount
proteinCount
complexCount
tfCount
efCount
tfAndEfCount
unknownCategoryCount
ddiEdgeCount
dmiEdgeCount
structuralEvidenceEdgeCount
confirmedPpiEdgeCount
coComplexOnlyEdgeCount
sourceDistribution
methodDistribution
evidenceLevelDistribution
publicationCount
```

Not every graph type needs every field in the first migration. Missing or irrelevant values can be zero or omitted according to the schema direction, but the frontend should not need to parse raw data to produce the main summary.

Legend should explain:

```text
node types
protein categories
edge relationship types
DDI / DMI / structural evidence encoding
confirmed PPI versus co-complex-only
evidence levels
```

Pagination should preserve current behavior where needed:

```text
limit
offset
total
returned
nextOffset
```

For `complex intra`, pagination can initially be absent if the graph is small, but the response should still follow the standard shell.

---

## 13. Validation examples

Use these examples throughout migration:

```text
EZH2 / Q15910
TP53 / P04637
PRC2/3 / complex_id=996
CREBBP-EP300-HDAC1-SP1-SP3 / complex_id=7955
```

Validation checklist for each migrated endpoint:

```text
response has graphType
response has center
response has nodes
response has edges
response has stats
response has legend
response has pagination or explicit null
response has filters
response has warnings
nodes are standard VizNode objects
edges are standard VizEdge objects
edge evidence is not lost
frontend network still renders
edge detail still explains relationship evidence
git ls-files data has no output
```

---

## 14. Data safety rule

Real biological data must remain local.

Before every commit and push:

```bash
git ls-files data
```

This command must produce no output.

If it produces any output, stop immediately and remove tracked data before committing.

The repository may contain code, docs, configuration, and synthetic test fixtures only.

Do not commit real files from:

```text
data/
```

Future tests must use synthetic fixtures, not real private data.

---

## 15. Migration order

Do not migrate all endpoints at once.

Recommended order:

```text
1. protein neighbors standard NetworkResponse
2. protein neighbors backend filters and frontend connection
3. complex intra standard NetworkResponse
4. complex intra backend filters and frontend connection
5. complex external standard NetworkResponse
6. complex external backend filters and frontend connection
7. Evidence Table
8. Current Network Summary
9. HPA shared expression context
10. domain / motif sequence feature track
11. export validation and export manifest
12. synthetic fixtures and contract tests
13. NetworkGraph split
```

Each endpoint migration should be split into small commits:

```text
A. standard response shape
B. backend filters
C. frontend connection
```

Do not combine schema migration, filters, frontend UI, Evidence Table, and NetworkGraph refactor in one commit.

---

## 16. Stage 0 completion criteria

Stage 0 is complete when:

```text
docs/NETWORK_RESPONSE_MIGRATION.md exists
the document is based on real audited endpoint shapes
git status only shows the new migration document
git ls-files data has no output
the document is committed and pushed
```

Recommended validation commands:

```bash
cd ~/Documents/protein-network-v0

sed -n '1,80p' docs/NETWORK_RESPONSE_MIGRATION.md

git status --short

git diff --stat

git ls-files data
```

Expected before commit:

```text
?? docs/NETWORK_RESPONSE_MIGRATION.md
```

Expected data safety output:

```text
no output
```
