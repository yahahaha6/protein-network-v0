"""
Evidence normalization helpers.

This module converts raw edge evidence fields from TSV / JSON graph data into a
stable backend-owned evidence model. Frontend code should render these normalized
fields instead of parsing raw values.

Supported raw fields include:

- sources
- hpa_datasets
- methods
- publications
- supporting_structures
- n_ddi
- n_dmi
- ddi
- dmi
- gold_record_count
- evidence_in_ppi_graph
"""

from __future__ import annotations

import json
import math
import re
from typing import Any, Dict, Iterable, List, Optional

from app.schemas.visualization import EvidenceLevel, EvidenceSummary, ExternalLink


_MISSING_STRINGS = {"", "nan", "none", "null", "na", "n/a", "<na>"}


def is_missing(value: Any) -> bool:
    """Return True for None, NaN, empty strings, and common missing markers."""

    if value is None:
        return True

    if isinstance(value, bool):
        return False

    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0

    if isinstance(value, float):
        return math.isnan(value)

    text = str(value).strip()
    return text.lower() in _MISSING_STRINGS


def parse_int(value: Any, default: int = 0) -> int:
    """Parse integer-like values from Python, pandas, or string data."""

    if is_missing(value):
        return default

    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default


def parse_bool(value: Any, default: Optional[bool] = None) -> Optional[bool]:
    """Parse boolean-like values from TSV or JSON fields."""

    if is_missing(value):
        return default

    if isinstance(value, bool):
        return value

    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "y", "t"}:
        return True
    if text in {"false", "0", "no", "n", "f"}:
        return False

    return default


def _clean_identifier(value: Any) -> str:
    """Normalize identifier-like strings, including pandas float IDs such as 123.0."""

    text = str(value).strip()

    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]

    return text


def _flatten_list_value(value: Any) -> Iterable[Any]:
    """Flatten nested list-like values without treating strings as iterables."""

    if isinstance(value, (list, tuple, set)):
        for item in value:
            yield from _flatten_list_value(item)
    else:
        yield value


def normalize_list(
    value: Any,
    *,
    split_semicolon: bool = True,
    split_pipe: bool = True,
) -> List[str]:
    """
    Normalize raw scalar/list evidence values into a clean string list.

    This supports both TSV fields such as "BioGRID;IntAct" and JSON fields such
    as ["BioGRID", "IntAct"]. It also supports DDI/DMI strings separated by " | ".
    """

    if is_missing(value):
        return []

    parts: List[str] = []

    for item in _flatten_list_value(value):
        if is_missing(item):
            continue

        if isinstance(item, dict):
            text = json.dumps(item, ensure_ascii=False, sort_keys=True)
        else:
            text = str(item).strip()

        if is_missing(text):
            continue

        candidates = [text]

        if split_semicolon:
            candidates = [
                piece
                for candidate in candidates
                for piece in candidate.split(";")
            ]

        if split_pipe:
            candidates = [
                piece
                for candidate in candidates
                for piece in candidate.split("|")
            ]

        for candidate in candidates:
            clean = _clean_identifier(candidate)
            if clean and clean.lower() not in _MISSING_STRINGS:
                parts.append(clean)

    seen = set()
    result: List[str] = []

    for part in parts:
        if part not in seen:
            seen.add(part)
            result.append(part)

    return result


def normalize_pmids(value: Any) -> List[str]:
    """Normalize PubMed IDs from raw publication fields."""

    pmids = normalize_list(value, split_semicolon=True, split_pipe=True)
    result: List[str] = []

    for pmid in pmids:
        clean = _clean_identifier(pmid)
        if re.fullmatch(r"\d+", clean):
            result.append(clean)

    return _dedupe(result)


def normalize_pdb_ids(value: Any) -> List[str]:
    """Normalize PDB IDs from raw supporting_structures fields."""

    pdb_ids = normalize_list(value, split_semicolon=True, split_pipe=True)
    result: List[str] = []

    for pdb_id in pdb_ids:
        clean = _clean_identifier(pdb_id).upper()
        if re.fullmatch(r"[A-Z0-9]{4}", clean):
            result.append(clean)

    return _dedupe(result)


def _dedupe(values: Iterable[str]) -> List[str]:
    """Deduplicate values while preserving order."""

    seen = set()
    result: List[str] = []

    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)

    return result


def build_pubmed_links(pmids: Iterable[str]) -> List[ExternalLink]:
    """Build normalized PubMed links."""

    return [
        ExternalLink(
            label=f"PubMed {pmid}",
            url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            type="pubmed",
        )
        for pmid in _dedupe(pmids)
    ]


def build_pdb_links(pdb_ids: Iterable[str]) -> List[ExternalLink]:
    """Build normalized RCSB PDB links."""

    return [
        ExternalLink(
            label=f"PDB {pdb_id}",
            url=f"https://www.rcsb.org/structure/{pdb_id}",
            type="pdb",
        )
        for pdb_id in _dedupe(pdb_ids)
    ]


def compute_evidence_level(summary: EvidenceSummary) -> EvidenceLevel:
    """Compute the first-pass evidence level in the backend."""

    if summary.isCoComplexOnly:
        return "co_complex_only"

    if summary.hasStructuralEvidence:
        return "high"

    if (summary.hasDDI or summary.hasDMI) and summary.publicationCount > 0:
        return "high"

    if (
        summary.sourceCount >= 2
        or summary.publicationCount >= 2
        or summary.goldRecordCount >= 2
    ):
        return "medium"

    if (
        summary.sourceCount > 0
        or summary.methodCount > 0
        or summary.publicationCount > 0
    ):
        return "low"

    return "unknown"


def normalize_evidence(
    raw: Dict[str, Any],
    *,
    is_confirmed_ppi: Optional[bool] = None,
    is_co_complex_only: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Normalize evidence fields from a raw edge row or JSON edge object.

    The returned dictionary is shaped to be unpacked into VizEdge fields.
    """

    evidence_in_ppi_graph = parse_bool(raw.get("evidence_in_ppi_graph"))

    if is_confirmed_ppi is None and evidence_in_ppi_graph is not None:
        is_confirmed_ppi = evidence_in_ppi_graph

    if is_co_complex_only is None and evidence_in_ppi_graph is not None:
        is_co_complex_only = not evidence_in_ppi_graph

    is_confirmed_ppi = bool(is_confirmed_ppi)
    is_co_complex_only = bool(is_co_complex_only)

    evidence_sources = normalize_list(raw.get("sources"))
    hpa_datasets = normalize_list(raw.get("hpa_datasets"))
    methods = normalize_list(raw.get("methods"))

    publications = normalize_pmids(raw.get("publications"))
    supporting_structures = normalize_pdb_ids(raw.get("supporting_structures"))

    ddi = normalize_list(raw.get("ddi"), split_semicolon=False, split_pipe=True)
    dmi = normalize_list(raw.get("dmi"), split_semicolon=False, split_pipe=True)

    n_ddi = parse_int(raw.get("n_ddi"))
    n_dmi = parse_int(raw.get("n_dmi"))
    gold_record_count = parse_int(raw.get("gold_record_count"))

    has_ddi = n_ddi > 0 or len(ddi) > 0
    has_dmi = n_dmi > 0 or len(dmi) > 0
    has_structural_evidence = len(supporting_structures) > 0

    summary = EvidenceSummary(
        sourceCount=len(evidence_sources),
        methodCount=len(methods),
        publicationCount=len(publications),
        structureCount=len(supporting_structures),
        goldRecordCount=gold_record_count,
        hasDDI=has_ddi,
        hasDMI=has_dmi,
        hasPDB=has_structural_evidence,
        hasStructuralEvidence=has_structural_evidence,
        isConfirmedPpi=is_confirmed_ppi,
        isCoComplexOnly=is_co_complex_only,
    )

    return {
        "evidenceSources": evidence_sources,
        "hpaDatasets": hpa_datasets,
        "methods": methods,
        "publications": publications,
        "supportingStructures": supporting_structures,
        "ddi": ddi,
        "dmi": dmi,
        "hasDDI": has_ddi,
        "hasDMI": has_dmi,
        "hasStructuralEvidence": has_structural_evidence,
        "isConfirmedPpi": is_confirmed_ppi,
        "isCoComplexOnly": is_co_complex_only,
        "evidenceSummary": summary,
        "evidenceLevel": compute_evidence_level(summary),
        "externalLinks": build_pubmed_links(publications)
        + build_pdb_links(supporting_structures),
    }
