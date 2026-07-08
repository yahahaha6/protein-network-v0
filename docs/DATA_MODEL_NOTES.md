# Data Model Notes

This document records the current local data model for Protein Network Explorer V1.

The backend should normalize raw local data into a stable visualization response before the frontend renders graph, evidence, filters, tables, and external links.

## Data files

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

## Core conclusion

The data sources are compatible enough to use shared backend schemas and normalizers.

The shared edge evidence fields are:

- sources
- methods
- publications
- supporting_structures
- n_ddi
- n_dmi
- ddi
- dmi
- gold_record_count
- hpa_datasets

The target normalized edge fields should be:

- evidenceSources
- methods
- publications
- supportingStructures
- hasDDI
- hasDMI
- hasStructuralEvidence
- evidenceLevel
- evidenceSummary
- externalLinks
- raw

## Protein node mapping

For TSV protein nodes:

- id -> uniprot_id
- label -> gene_name
- displayName -> gene_name / uniprot_id
- proteinCategory -> protein_category

For global_ppi_graph JSON nodes:

- id -> id
- label -> gene_name
- displayName -> gene_name / id
- proteinCategory -> category

## PPI edge mapping

For ppi_unit_graph/ppi_edges.tsv:

- source -> protein1_id
- target -> protein2_id
- evidenceSources -> sources
- methods -> methods
- publications -> publications
- supportingStructures -> supporting_structures
- hasDDI -> n_ddi > 0 or ddi non-empty
- hasDMI -> n_dmi > 0 or dmi non-empty
- hasStructuralEvidence -> supporting_structures non-empty

For global_ppi_graph/ppi_graph.json links:

- source -> source
- target -> target
- evidenceSources -> sources
- methods -> methods
- publications -> publications
- supportingStructures -> supporting_structures
- hasDDI -> ddi list non-empty
- hasDMI -> dmi list non-empty
- hasStructuralEvidence -> supporting_structures list non-empty

Important difference:

- ppi_unit_graph stores ddi/dmi as strings or NaN.
- global_ppi_graph stores ddi/dmi as lists.
- The evidence normalizer must support both.

## Complex intra edge mapping

For complex_intra_ppi_graph/intra_edges.tsv:

- source -> protein1_id
- target -> protein2_id
- isConfirmedPpi -> evidence_in_ppi_graph == true
- isCoComplexOnly -> evidence_in_ppi_graph == false
- evidenceSources -> sources
- methods -> methods
- publications -> publications
- supportingStructures -> supporting_structures
- hasDDI -> n_ddi > 0 or ddi non-empty
- hasDMI -> n_dmi > 0 or dmi non-empty
- hasStructuralEvidence -> supporting_structures non-empty

## Complex external edge mapping

For complex_ext_ppi_graph/ext_edges.tsv:

- source -> complex_id
- target -> ext_protein_id
- type -> complex_external_ppi
- mediatingSubunits -> mediating_subunit_ids + mediating_subunit_genes
- externalPartner -> ext_protein_id + ext_gene_name
- isSubunitOfOtherComplex -> is_subunit_of_other_complex
- otherComplexIds -> other_complex_ids
- evidenceSources -> sources
- methods -> methods
- publications -> publications
- supportingStructures -> supporting_structures
- hasDDI -> n_ddi > 0 or ddi non-empty
- hasDMI -> n_dmi > 0 or dmi non-empty
- hasStructuralEvidence -> supporting_structures non-empty

## Evidence level first-pass rule

The first version of evidenceLevel should be computed in the backend only.

co_complex_only:
- isCoComplexOnly is true

high:
- hasStructuralEvidence is true
- or hasDDI/hasDMI is true and publicationCount > 0

medium:
- sourceCount >= 2
- or publicationCount >= 2
- or goldRecordCount >= 2

low:
- at least one source/publication/method exists

unknown:
- no usable evidence fields

The frontend must not compute evidenceLevel.

## External links

The backend should generate external links.

UniProt:
https://www.uniprot.org/uniprotkb/{uniprot_id}

PubMed:
https://pubmed.ncbi.nlm.nih.gov/{pmid}/

RCSB PDB:
https://www.rcsb.org/structure/{pdb_id}

The frontend should render externalLinks only. It should not parse PMID, PDB ID, or UniProt ID from raw fields for core behavior.

## Recommended next step

Do not convert all endpoints at once.

Recommended order:

1. Define backend/app/schemas/visualization.py
2. Define backend/app/normalizers/evidence.py
3. Define backend/app/normalizers/protein.py
4. Define backend/app/normalizers/links.py
5. Convert one endpoint first:
   GET /api/global-ppi/protein/{uniprot_ac}/neighbors
