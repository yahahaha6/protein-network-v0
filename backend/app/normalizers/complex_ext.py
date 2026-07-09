"""Pure normalizers for complex external network contracts.

This module does not import the datastore or FastAPI router objects.
It owns the standard complex_ext edge contract:

- core explanation fields are promoted to VizEdge top-level fields
- raw is retained only for source traceability
- legend uses the standard NetworkLegend schema fields
"""

from __future__ import annotations

from typing import Any, Optional

from app.normalizers.evidence import normalize_evidence
from app.schemas.visualization import (
    LegendItem,
    MediatingSubunit,
    NetworkLegend,
    VizEdge,
    VizNode,
)
from app.transform import bool_value, first_existing, split_list


_EMPTY_TEXT_VALUES = {
    "nan",
    "none",
    "null",
    "undefined",
    "n/a",
    "na",
    "no data",
    "not available",
    "missing",
}


def optional_complex_ext_text(value: Any) -> Optional[str]:
    """Return a clean optional string for normalized complex_ext fields."""

    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    if text.lower() in _EMPTY_TEXT_VALUES:
        return None

    if text in {"暂无数据", "无数据", "-", "—"}:
        return None

    return text


def _clean_text_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []

    for value in values:
        text = optional_complex_ext_text(value)

        if text is not None:
            cleaned.append(text)

    return cleaned


def make_mediating_subunits(
    *,
    ids: list[str],
    genes: list[str],
) -> list[MediatingSubunit]:
    """Build normalized mediating subunits from parallel ID/gene lists."""

    mediating_subunits: list[MediatingSubunit] = []

    for index, raw_subunit_id in enumerate(ids):
        subunit_id = optional_complex_ext_text(raw_subunit_id)

        if subunit_id is None:
            continue

        gene = (
            optional_complex_ext_text(genes[index])
            if index < len(genes)
            else None
        )
        display_name = f"{gene} / {subunit_id}" if gene else subunit_id

        mediating_subunits.append(
            MediatingSubunit(
                id=subunit_id,
                gene=gene,
                displayName=display_name,
            )
        )

    return mediating_subunits


def make_complex_ext_legend() -> NetworkLegend:
    """Return a schema-valid legend for complex external networks."""

    return NetworkLegend(
        nodeCategories=[
            LegendItem(
                key="complex",
                label="Center complex",
                description="The queried CORUM complex that connects to external protein partners.",
                color="slate",
            ),
            LegendItem(
                key="protein",
                label="External protein partner",
                description="A protein outside the selected complex that connects through one or more mediating subunits.",
                color="blue",
            ),
            LegendItem(
                key="TF",
                label="TF external partner",
                description="External partner annotated as a transcription factor.",
            ),
            LegendItem(
                key="EF",
                label="EF external partner",
                description="External partner annotated as an epigenetic factor.",
            ),
            LegendItem(
                key="TF_and_EF",
                label="TF and EF external partner",
                description="External partner annotated as both TF and EF.",
            ),
            LegendItem(
                key="Unknown",
                label="Unknown external partner category",
                description="External partner category is unavailable or unknown.",
            ),
        ],
        edgeEvidence=[
            LegendItem(
                key="complex_external_ppi",
                label="Complex external PPI partner",
                description="The complex connects to an external protein through one or more mediating subunit-level PPI relationships.",
                lineStyle="solid",
            ),
            LegendItem(
                key="other_complex",
                label="Partner also appears in other complexes",
                description="The external partner is annotated as a subunit of at least one other complex.",
                lineStyle="dashed",
            ),
            LegendItem(
                key="structural",
                label="Structural / PDB-supported external partner",
                description="The complex external relationship has supporting structural evidence.",
                lineStyle="solid",
            ),
            LegendItem(
                key="structural_other_complex",
                label="PDB-supported and in other complexes",
                description="The external partner has structural support and is also annotated in other complexes.",
                lineStyle="solid",
            ),
        ],
        badges=[
            LegendItem(
                key="DDI",
                label="DDI",
                description="Domain-domain interaction evidence exists.",
            ),
            LegendItem(
                key="DMI",
                label="DMI",
                description="Domain-motif interaction evidence exists.",
            ),
            LegendItem(
                key="PDB",
                label="PDB",
                description="Supporting structural evidence exists.",
            ),
            LegendItem(
                key="OtherComplex",
                label="Other complex",
                description="External partner is also a subunit of other complexes.",
            ),
        ],
    )


def make_complex_ext_edge(
    *,
    complex_id: str,
    row: dict[str, Any],
    source_id: str,
    target_id: str,
) -> VizEdge:
    """Build one normalized complex external interaction edge."""

    mediating_subunit_ids = _clean_text_list(
        split_list(first_existing(row, ["mediating_subunit_ids", "mediating_ids"]))
    )
    mediating_subunit_genes = _clean_text_list(
        split_list(first_existing(row, ["mediating_subunit_genes", "mediating_genes"]))
    )
    other_complex_ids = _clean_text_list(
        split_list(first_existing(row, ["other_complex_ids", "other_complexes"]))
    )

    complex_name = optional_complex_ext_text(
        first_existing(row, ["complex_name", "source_name"])
    )
    external_partner_gene = optional_complex_ext_text(
        first_existing(
            row,
            ["ext_gene_name", "external_partner_gene", "gene_symbol", "gene"],
        )
    )
    raw_is_subunit_of_other_complex = bool_value(
        first_existing(
            row,
            ["is_subunit_of_other_complex", "is_subunit_of_complex"],
        )
    )
    is_subunit_of_other_complex = raw_is_subunit_of_other_complex or bool(
        other_complex_ids
    )

    mediating_subunits = make_mediating_subunits(
        ids=mediating_subunit_ids,
        genes=mediating_subunit_genes,
    )

    edge_raw = {
        **row,
        "complexId": complex_id,
        "complexName": complex_name,
        "externalPartnerId": target_id,
        "externalPartnerGene": external_partner_gene,
        "extGeneName": external_partner_gene,
        "mediatingSubunits": [
            subunit.model_dump(mode="json") for subunit in mediating_subunits
        ],
        "mediatingSubunitIds": mediating_subunit_ids,
        "mediatingSubunitGenes": mediating_subunit_genes,
        "nMediatingSubunits": len(mediating_subunits),
        "isSubunitOfOtherComplex": is_subunit_of_other_complex,
        "otherComplexIds": other_complex_ids,
        "relationshipKind": "complex_external_ppi",
    }

    evidence = normalize_evidence(
        {
            **row,
            "sources": first_existing(row, ["sources", "source_dbs"]),
            "methods": first_existing(row, ["methods", "experimental_methods"]),
            "publications": first_existing(row, ["publications", "pmids", "pmid"]),
            "supporting_structures": first_existing(
                row,
                ["supporting_structures", "pdb_ids", "structures"],
            ),
            "ddi": first_existing(row, ["ddi", "domain_domain_interactions"]),
            "dmi": first_existing(row, ["dmi", "domain_motif_interactions"]),
            "n_ddi": first_existing(row, ["n_ddi", "ddi_count"]),
            "n_dmi": first_existing(row, ["n_dmi", "dmi_count"]),
        },
        is_confirmed_ppi=True,
        is_co_complex_only=False,
    )

    return VizEdge(
        id=f"COMPLEX_EXT|{complex_id}|{target_id}",
        source=source_id,
        target=target_id,
        type="complex_external_ppi",
        label="External PPI partner",
        raw=edge_raw,
        mediatingSubunits=mediating_subunits,
        externalPartnerId=target_id,
        externalPartnerGene=external_partner_gene,
        isSubunitOfOtherComplex=is_subunit_of_other_complex,
        otherComplexIds=other_complex_ids,
        **evidence,
    )


def _normalize_filter_text(value: Optional[str]) -> Optional[str]:
    text = optional_complex_ext_text(value)

    return text.lower() if text else None


def _matches_optional_bool(value: bool, expected: Optional[bool]) -> bool:
    if expected is None:
        return True

    return value is expected


def _edge_matches_source(edge: VizEdge, source_filter: Optional[str]) -> bool:
    expected = _normalize_filter_text(source_filter)

    if expected is None:
        return True

    candidates = list(edge.evidenceSources or [])

    raw = edge.raw or {}
    raw_sources = raw.get("sources") or raw.get("source_dbs")

    if isinstance(raw_sources, str):
        candidates.extend(split_list(raw_sources))
    elif isinstance(raw_sources, list):
        candidates.extend(str(item) for item in raw_sources)

    return any(
        expected in normalized_candidate
        for candidate in candidates
        if (normalized_candidate := _normalize_filter_text(str(candidate))) is not None
    )


def _node_matches_category(
    node: VizNode,
    protein_category: Optional[str],
) -> bool:
    expected = _normalize_filter_text(protein_category)

    if expected is None:
        return True

    return _normalize_filter_text(str(node.proteinCategory)) == expected


def complex_ext_edge_passes_filters(
    *,
    edge: VizEdge,
    target_node: VizNode,
    source: Optional[str],
    protein_category: Optional[str],
    has_ddi: Optional[bool],
    has_dmi: Optional[bool],
    has_pdb: Optional[bool],
    is_subunit_of_other_complex: Optional[bool],
) -> bool:
    """Return whether a complex_ext edge passes backend filter parameters."""

    if not _edge_matches_source(edge, source):
        return False

    if not _node_matches_category(target_node, protein_category):
        return False

    if not _matches_optional_bool(edge.hasDDI, has_ddi):
        return False

    if not _matches_optional_bool(edge.hasDMI, has_dmi):
        return False

    if not _matches_optional_bool(edge.hasStructuralEvidence, has_pdb):
        return False

    if not _matches_optional_bool(
        edge.isSubunitOfOtherComplex is True,
        is_subunit_of_other_complex,
    ):
        return False

    return True
