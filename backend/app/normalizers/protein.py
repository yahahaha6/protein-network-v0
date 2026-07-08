"""
Protein node normalization helpers.

This module converts raw protein rows from TSV or JSON graph data into the
standard VizNode schema.

Supported raw sources:
- ppi_unit_graph/ppi_nodes.tsv
- complex_intra_ppi_graph/protein_nodes.tsv
- complex_ext_ppi_graph/ext_protein_nodes.tsv
- global_ppi_graph/ppi_graph.json nodes

Important mapping difference:
- TSV files use uniprot_id and protein_category.
- global_ppi_graph JSON uses id and category.
"""

from __future__ import annotations

import json
import math
from typing import Any, Dict, List, Optional

from app.normalizers.links import build_uniprot_link
from app.schemas.visualization import HpaProfile, VizNode


VALID_PROTEIN_CATEGORIES = {"TF", "EF", "TF_and_EF", "Unknown"}
MISSING_STRINGS = {"", "nan", "none", "null", "na", "n/a", "<na>"}


def is_missing(value: Any) -> bool:
    if value is None:
        return True

    if isinstance(value, bool):
        return False

    if isinstance(value, float):
        return math.isnan(value)

    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0

    return str(value).strip().lower() in MISSING_STRINGS


def clean_optional_string(value: Any) -> Optional[str]:
    if is_missing(value):
        return None
    return str(value).strip()


def parse_optional_float(value: Any) -> Optional[float]:
    if is_missing(value):
        return None

    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_semicolon_list(value: Any) -> List[str]:
    if is_missing(value):
        return []

    if isinstance(value, list):
        return [
            str(item).strip()
            for item in value
            if not is_missing(item)
        ]

    return [
        item.strip()
        for item in str(value).split(";")
        if item.strip() and item.strip().lower() not in MISSING_STRINGS
    ]


def parse_json_or_semicolon_list(value: Any) -> List[Any]:
    if is_missing(value):
        return []

    if isinstance(value, list):
        return value

    text = str(value).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return parse_semicolon_list(text)

    if isinstance(parsed, list):
        return parsed

    return []


def normalize_protein_category(value: Any) -> str:
    category = clean_optional_string(value)

    if category in VALID_PROTEIN_CATEGORIES:
        return category

    return "Unknown"


def normalize_hpa_profile(raw: Dict[str, Any]) -> HpaProfile:
    return HpaProfile(
        scTypeSpecificity=clean_optional_string(raw.get("sc_type_specificity")),
        scTypeDistribution=clean_optional_string(raw.get("sc_type_distribution")),
        scTypeSpecificityScore=parse_optional_float(
            raw.get("sc_type_specificity_score")
        ),
        scTypeSpecificNcpm=parse_semicolon_list(raw.get("sc_type_specific_ncpm")),
        scGroupSpecificity=clean_optional_string(raw.get("sc_group_specificity")),
        scGroupDistribution=clean_optional_string(raw.get("sc_group_distribution")),
        scGroupSpecificityScore=parse_optional_float(
            raw.get("sc_group_specificity_score")
        ),
        scGroupSpecificNcpm=parse_semicolon_list(raw.get("sc_group_specific_ncpm")),
        proteinCtSpecificity=clean_optional_string(raw.get("protein_ct_specificity")),
        proteinCtDistribution=clean_optional_string(raw.get("protein_ct_distribution")),
        proteinCtSpecificityScore=parse_optional_float(
            raw.get("protein_ct_specificity_score")
        ),
        proteinCtSpecificIntensity=parse_semicolon_list(
            raw.get("protein_ct_specific_intensity")
        ),
        tissueCtEnrichment=parse_semicolon_list(raw.get("tissue_ct_enrichment")),
        scExpressionCluster=clean_optional_string(raw.get("sc_expression_cluster")),
        cancerRnaSpecificity=clean_optional_string(raw.get("cancer_rna_specificity")),
        cancerRnaDistribution=clean_optional_string(raw.get("cancer_rna_distribution")),
        cancerRnaSpecificityScore=parse_optional_float(
            raw.get("cancer_rna_specificity_score")
        ),
        cancerRnaSpecificPtpm=parse_optional_float(
            raw.get("cancer_rna_specific_ptpm")
        ),
    )


def normalize_protein_node(
    raw: Dict[str, Any],
    *,
    is_center: bool = False,
) -> VizNode:
    uniprot_id = clean_optional_string(raw.get("uniprot_id")) or clean_optional_string(
        raw.get("id")
    )

    if not uniprot_id:
        raise ValueError("Cannot normalize protein node without uniprot_id or id.")

    gene_name = clean_optional_string(raw.get("gene_name"))
    category = normalize_protein_category(
        raw.get("protein_category", raw.get("category"))
    )

    label = gene_name or uniprot_id
    display_name = f"{label} / {uniprot_id}"

    domains = parse_json_or_semicolon_list(raw.get("domains_json", raw.get("domains")))
    motifs = parse_json_or_semicolon_list(raw.get("motifs_json", raw.get("motifs")))

    badges: List[str] = []

    if is_center:
        badges.append("CENTER")

    if category != "Unknown":
        badges.append(category)

    if domains:
        badges.append("DOMAIN")

    if motifs:
        badges.append("MOTIF")

    node_raw = dict(raw)
    node_raw["normalized_domains"] = domains
    node_raw["normalized_motifs"] = motifs

    complex_ids = (
        parse_semicolon_list(raw.get("complex_ids"))
        + parse_semicolon_list(raw.get("connected_complex_ids"))
        + parse_semicolon_list(raw.get("member_complex_ids"))
    )

    complex_names = (
        parse_semicolon_list(raw.get("complex_names"))
        + parse_semicolon_list(raw.get("connected_complex_names"))
    )

    return VizNode(
        id=uniprot_id,
        label=label,
        type="protein",
        displayName=display_name,
        proteinCategory=category,
        badges=badges,
        hpaProfile=normalize_hpa_profile(raw),
        externalLinks=[build_uniprot_link(uniprot_id)],
        complexIds=complex_ids,
        complexNames=complex_names,
        raw=node_raw,
    )
