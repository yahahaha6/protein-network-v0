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
import unicodedata
from numbers import Integral, Real
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from app.schemas.visualization import (
    EvidenceSummary,
    ExternalLink,
    validate_feature_support,
)


_MISSING_STRINGS = {"", "nan", "nat", "none", "null", "na", "n/a", "<na>"}
_LEGACY_EVIDENCE_MISSING_STRINGS = {"暂无数据"}

_EVIDENCE_INPUT_KEYS = (
    "sources",
    "hpa_datasets",
    "methods",
    "publications",
    "supporting_structures",
    "n_ddi",
    "n_dmi",
    "ddi",
    "dmi",
    "gold_record_count",
    "evidence_in_ppi_graph",
)


def extract_evidence_input(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Copy present canonical evidence fields without UI fallback or alias lookup."""

    return {
        key: raw[key]
        for key in _EVIDENCE_INPUT_KEYS
        if key in raw
    }


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

    text = unicodedata.normalize("NFKC", str(value)).strip().casefold()
    return text in _MISSING_STRINGS or text in _LEGACY_EVIDENCE_MISSING_STRINGS


def parse_optional_non_negative_int(value: Any) -> Optional[int]:
    """Parse a strict optional non-negative integer without collapsing errors."""

    if is_missing(value):
        return None

    if isinstance(value, bool):
        raise ValueError("boolean values are not valid evidence counts")

    if isinstance(value, Integral):
        parsed = int(value)
    elif isinstance(value, Real):
        numeric_value = float(value)
        if not math.isfinite(numeric_value) or not numeric_value.is_integer():
            raise ValueError("evidence counts must be finite integers")
        parsed = int(numeric_value)
    elif isinstance(value, str):
        text = value.strip()
        if not re.fullmatch(r"\d+", text):
            raise ValueError("evidence counts must be decimal integer strings")
        parsed = int(text)
    else:
        raise ValueError("evidence counts must be integer-like values")

    if parsed < 0:
        raise ValueError("evidence counts must be non-negative")

    return parsed


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
            if clean and not is_missing(clean):
                parts.append(clean)

    seen = set()
    result: List[str] = []

    for part in parts:
        if part not in seen:
            seen.add(part)
            result.append(part)

    return result


def normalize_counted_details(
    raw: Dict[str, Any],
    key: str,
    normalizer: Callable[[Any], List[str]],
) -> Tuple[List[str], Optional[int]]:
    """Normalize a list-backed field while preserving source presence semantics."""

    if key not in raw:
        return [], None

    value = raw[key]

    if isinstance(value, (dict, bool)):
        raise ValueError(f"{key} must not be a dict or boolean")

    if isinstance(value, (list, tuple, set)):
        if not value:
            return [], 0
        for item in _flatten_list_value(value):
            if isinstance(item, (dict, bool)):
                raise ValueError(f"{key} contains an invalid item")
            if isinstance(item, (int, float)) and not is_missing(item):
                raise ValueError(f"{key} contains a numeric item")
    elif isinstance(value, (int, float)):
        if is_missing(value):
            return [], None
        raise ValueError(f"{key} must not be a numeric value")
    elif is_missing(value):
        return [], None
    elif not isinstance(value, str):
        raise ValueError(f"{key} must be a string or list-like value")

    details = normalizer(value)

    if not details:
        return [], None

    return details, len(details)


def normalize_pmids(value: Any) -> List[str]:
    """Normalize PubMed IDs from raw publication fields."""

    pmids = normalize_list(value, split_semicolon=True, split_pipe=True)
    result: List[str] = []

    for pmid in pmids:
        clean = _clean_identifier(pmid)
        if not re.fullmatch(r"\d+", clean):
            raise ValueError(f"invalid PubMed identifier: {clean}")
        result.append(clean)

    return _dedupe(result)


def normalize_pdb_ids(value: Any) -> List[str]:
    """Normalize PDB IDs from raw supporting_structures fields."""

    pdb_ids = normalize_list(value, split_semicolon=True, split_pipe=True)
    result: List[str] = []

    for pdb_id in pdb_ids:
        clean = _clean_identifier(pdb_id).upper()
        if not re.fullmatch(r"[A-Z0-9]{4}", clean):
            raise ValueError(f"invalid PDB identifier: {clean}")
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


def _is_positive(count: Optional[int]) -> bool:
    return count is not None and count > 0


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

    evidence_sources, source_count = normalize_counted_details(
        raw,
        "sources",
        normalize_list,
    )
    hpa_datasets = normalize_list(raw.get("hpa_datasets"))
    methods, method_count = normalize_counted_details(raw, "methods", normalize_list)

    publications, publication_count = normalize_counted_details(
        raw,
        "publications",
        normalize_pmids,
    )
    supporting_structures, structure_count = normalize_counted_details(
        raw,
        "supporting_structures",
        normalize_pdb_ids,
    )

    ddi = normalize_list(raw.get("ddi"), split_semicolon=False, split_pipe=True)
    dmi = normalize_list(raw.get("dmi"), split_semicolon=False, split_pipe=True)

    ddi_record_count = parse_optional_non_negative_int(raw.get("n_ddi"))
    dmi_record_count = parse_optional_non_negative_int(raw.get("n_dmi"))
    gold_record_count = parse_optional_non_negative_int(raw.get("gold_record_count"))

    has_ddi = bool(ddi) or _is_positive(ddi_record_count)
    has_dmi = bool(dmi) or _is_positive(dmi_record_count)
    validate_feature_support(
        feature_name="DDI",
        is_supported=has_ddi,
        reported_count=ddi_record_count,
        details=ddi,
    )
    validate_feature_support(
        feature_name="DMI",
        is_supported=has_dmi,
        reported_count=dmi_record_count,
        details=dmi,
    )
    has_structural_evidence = len(supporting_structures) > 0

    summary = EvidenceSummary(
        sourceCount=source_count,
        methodCount=method_count,
        publicationCount=publication_count,
        structureCount=structure_count,
        ddiRecordCount=ddi_record_count,
        dmiRecordCount=dmi_record_count,
        goldRecordCount=gold_record_count,
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
        "externalLinks": build_pubmed_links(publications)
        + build_pdb_links(supporting_structures),
    }
