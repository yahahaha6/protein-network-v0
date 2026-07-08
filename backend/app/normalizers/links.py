"""
External link normalization helpers.

The backend generates externalLinks so the frontend can render links directly
without parsing raw UniProt, PubMed, or PDB fields.
"""

from __future__ import annotations

from typing import Iterable, List

from app.schemas.visualization import ExternalLink


def dedupe(values: Iterable[str]) -> List[str]:
    """Deduplicate string values while preserving order."""

    seen = set()
    result: List[str] = []

    for value in values:
        text = str(value).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)

    return result


def build_uniprot_link(uniprot_id: str) -> ExternalLink:
    """Build one normalized UniProt link."""

    clean_id = str(uniprot_id).strip()

    return ExternalLink(
        label=f"UniProt {clean_id}",
        url=f"https://www.uniprot.org/uniprotkb/{clean_id}",
        type="uniprot",
    )


def build_uniprot_links(uniprot_ids: Iterable[str]) -> List[ExternalLink]:
    """Build normalized UniProt links."""

    return [build_uniprot_link(uniprot_id) for uniprot_id in dedupe(uniprot_ids)]


def build_pubmed_link(pmid: str) -> ExternalLink:
    """Build one normalized PubMed link."""

    clean_id = str(pmid).strip()

    return ExternalLink(
        label=f"PubMed {clean_id}",
        url=f"https://pubmed.ncbi.nlm.nih.gov/{clean_id}/",
        type="pubmed",
    )


def build_pubmed_links(pmids: Iterable[str]) -> List[ExternalLink]:
    """Build normalized PubMed links."""

    return [build_pubmed_link(pmid) for pmid in dedupe(pmids)]


def build_pdb_link(pdb_id: str) -> ExternalLink:
    """Build one normalized RCSB PDB link."""

    clean_id = str(pdb_id).strip().upper()

    return ExternalLink(
        label=f"PDB {clean_id}",
        url=f"https://www.rcsb.org/structure/{clean_id}",
        type="pdb",
    )


def build_pdb_links(pdb_ids: Iterable[str]) -> List[ExternalLink]:
    """Build normalized RCSB PDB links."""

    return [build_pdb_link(pdb_id) for pdb_id in dedupe(pdb_ids)]
