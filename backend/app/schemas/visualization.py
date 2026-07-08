"""
Standard visualization response schemas for Protein Network Explorer.

These Pydantic models define the stable contract between the backend and the
frontend. Routers should return these normalized models instead of exposing raw
TSV / JSON / GraphML fields directly to the frontend.

Important design rule:
- Backend normalizers compute evidence, links, badges, categories, and summaries.
- Frontend components render these fields.
- Frontend components should not parse raw fields for core biological logic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


GraphType = Literal[
    "protein_neighborhood",
    "global_ppi_neighborhood",
    "complex_intra",
    "complex_ext",
]

NodeType = Literal[
    "protein",
    "complex",
    "unknown",
]

EdgeType = Literal[
    "ppi",
    "complex_intra_ppi",
    "complex_external_ppi",
    "unknown",
]

ProteinCategory = Literal[
    "TF",
    "EF",
    "TF_and_EF",
    "Unknown",
]

EvidenceLevel = Literal[
    "high",
    "medium",
    "low",
    "co_complex_only",
    "unknown",
]

ExternalLinkType = Literal[
    "uniprot",
    "pubmed",
    "pdb",
    "other",
]


class ExternalLink(BaseModel):
    """A normalized external identifier link rendered directly by the frontend."""

    label: str
    url: str
    type: ExternalLinkType = "other"


class HpaProfile(BaseModel):
    """Normalized HPA expression fields for protein detail and node detail panels."""

    scTypeSpecificity: Optional[str] = None
    scTypeDistribution: Optional[str] = None
    scTypeSpecificityScore: Optional[float] = None
    scTypeSpecificNcpm: List[str] = Field(default_factory=list)

    scGroupSpecificity: Optional[str] = None
    scGroupDistribution: Optional[str] = None
    scGroupSpecificityScore: Optional[float] = None
    scGroupSpecificNcpm: List[str] = Field(default_factory=list)

    proteinCtSpecificity: Optional[str] = None
    proteinCtDistribution: Optional[str] = None
    proteinCtSpecificityScore: Optional[float] = None
    proteinCtSpecificIntensity: List[str] = Field(default_factory=list)

    tissueCtEnrichment: List[str] = Field(default_factory=list)
    scExpressionCluster: Optional[str] = None

    cancerRnaSpecificity: Optional[str] = None
    cancerRnaDistribution: Optional[str] = None
    cancerRnaSpecificityScore: Optional[float] = None
    cancerRnaSpecificPtpm: Optional[float] = None


class EvidenceSummary(BaseModel):
    """Computed evidence summary for one interaction edge."""

    sourceCount: int = 0
    methodCount: int = 0
    publicationCount: int = 0
    structureCount: int = 0
    goldRecordCount: int = 0

    hasDDI: bool = False
    hasDMI: bool = False
    hasPDB: bool = False
    hasStructuralEvidence: bool = False

    isConfirmedPpi: bool = False
    isCoComplexOnly: bool = False


class MediatingSubunit(BaseModel):
    """Normalized subunit information for complex external interactions."""

    id: str
    gene: Optional[str] = None
    displayName: Optional[str] = None
    externalLinks: List[ExternalLink] = Field(default_factory=list)


class VizNode(BaseModel):
    """Normalized graph node used by all network views."""

    id: str
    label: str
    type: NodeType = "unknown"
    displayName: Optional[str] = None

    proteinCategory: ProteinCategory = "Unknown"
    badges: List[str] = Field(default_factory=list)

    hpaProfile: Optional[HpaProfile] = None
    externalLinks: List[ExternalLink] = Field(default_factory=list)

    subunitCount: Optional[int] = None
    complexIds: List[str] = Field(default_factory=list)
    complexNames: List[str] = Field(default_factory=list)

    raw: Dict[str, Any] = Field(default_factory=dict)


class VizEdge(BaseModel):
    """Normalized graph edge used by all network views."""

    id: str
    source: str
    target: str
    type: EdgeType = "unknown"

    label: Optional[str] = None

    evidenceSources: List[str] = Field(default_factory=list)
    hpaDatasets: List[str] = Field(default_factory=list)
    methods: List[str] = Field(default_factory=list)
    publications: List[str] = Field(default_factory=list)
    supportingStructures: List[str] = Field(default_factory=list)

    ddi: List[str] = Field(default_factory=list)
    dmi: List[str] = Field(default_factory=list)

    hasDDI: bool = False
    hasDMI: bool = False
    hasStructuralEvidence: bool = False

    isConfirmedPpi: bool = False
    isCoComplexOnly: bool = False

    evidenceLevel: EvidenceLevel = "unknown"
    evidenceSummary: EvidenceSummary = Field(default_factory=EvidenceSummary)

    mediatingSubunits: List[MediatingSubunit] = Field(default_factory=list)
    externalPartnerId: Optional[str] = None
    externalPartnerGene: Optional[str] = None
    isSubunitOfOtherComplex: Optional[bool] = None
    otherComplexIds: List[str] = Field(default_factory=list)

    externalLinks: List[ExternalLink] = Field(default_factory=list)
    raw: Dict[str, Any] = Field(default_factory=dict)


class NetworkStats(BaseModel):
    """Computed graph-level statistics for summary cards and legends."""

    nodeCount: int = 0
    edgeCount: int = 0

    proteinNodeCount: int = 0
    complexNodeCount: int = 0

    tfCount: int = 0
    efCount: int = 0
    tfAndEfCount: int = 0
    unknownCategoryCount: int = 0

    ddiSupportedEdgeCount: int = 0
    dmiSupportedEdgeCount: int = 0
    structuralEvidenceEdgeCount: int = 0

    confirmedPpiEdgeCount: int = 0
    coComplexOnlyEdgeCount: int = 0

    highEvidenceEdgeCount: int = 0
    mediumEvidenceEdgeCount: int = 0
    lowEvidenceEdgeCount: int = 0
    unknownEvidenceEdgeCount: int = 0


class LegendItem(BaseModel):
    """One visual legend entry used by the frontend."""

    key: str
    label: str
    description: Optional[str] = None
    color: Optional[str] = None
    shape: Optional[str] = None
    lineStyle: Optional[str] = None


class NetworkLegend(BaseModel):
    """Legend groups for node and edge visual encodings."""

    nodeCategories: List[LegendItem] = Field(default_factory=list)
    edgeEvidence: List[LegendItem] = Field(default_factory=list)
    badges: List[LegendItem] = Field(default_factory=list)


class PaginationInfo(BaseModel):
    """Pagination metadata for large networks."""

    limit: Optional[int] = None
    offset: int = 0
    total: Optional[int] = None
    hasMore: bool = False


class NetworkResponse(BaseModel):
    """Standard response model for all network visualization endpoints."""

    graphType: GraphType
    center: Optional[VizNode] = None

    nodes: List[VizNode] = Field(default_factory=list)
    edges: List[VizEdge] = Field(default_factory=list)

    stats: NetworkStats = Field(default_factory=NetworkStats)
    legend: NetworkLegend = Field(default_factory=NetworkLegend)
    pagination: Optional[PaginationInfo] = None

    filters: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
