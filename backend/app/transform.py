"""
Transformation helpers for API responses and Cytoscape graph elements.

The raw TSV rows are not directly returned to the frontend. This module cleans
missing values, normalizes common identifiers, and converts protein / complex /
edge records into the JSON structure expected by the Next.js Cytoscape viewer.
"""

from typing import Optional
def clean(value):
    """
    把空值、NaN、None 统一处理成“暂无数据”
    """
    if value is None:
        return "暂无数据"

    text = str(value).strip()

    if text == "" or text.lower() in {"nan", "none", "null"}:
        return "暂无数据"

    return text


def first_existing(row: dict, candidates: list[str]):
    """
    从多个可能字段名里，找到第一个存在且非空的值。
    """
    for col in candidates:
        if col in row:
            value = clean(row.get(col))
            if value != "暂无数据":
                return value

    return "暂无数据"


def split_list(value, sep=";"):
    """
    把 TSV 里的分号分隔字段转成 list。
    例如 "EZH2;EED;SUZ12" -> ["EZH2", "EED", "SUZ12"]
    """
    value = clean(value)

    if value == "暂无数据":
        return []

    return [item.strip() for item in value.split(sep) if item.strip()]


def complex_key(complex_id: str):
    """Return the Cytoscape node ID used for a CORUM complex."""
    return f"CORUM:{complex_id}"


def protein_key(uniprot_ac: str):
    """Return the Cytoscape node ID used for a UniProt protein."""
    return f"UniProt:{uniprot_ac}"


def pair_items(ids_value, labels_value):
    """
    把两个并列列表字段组合起来。
    例如：
    ids:    P12345;Q99999
    labels: EZH2;EED

    返回：
    [
      {"id": "P12345", "label": "EZH2"},
      {"id": "Q99999", "label": "EED"}
    ]
    """
    ids = split_list(ids_value)
    labels = split_list(labels_value)

    result = []

    for i, item_id in enumerate(ids):
        label = labels[i] if i < len(labels) else item_id

        result.append(
            {
                "id": item_id,
                "label": label,
            }
        )

    return result

def bool_value(value):
    """
    把 TSV 中的是/否、true/false、1/0 转成 Python bool。
    """
    text = clean(value).lower()

    return text in {"true", "1", "yes", "y", "是", "yes", "confirmed"}


def complex_node(complex_id: str, row: Optional[dict] = None):
    """
    Build a Cytoscape node object for one protein complex.

    The frontend expects every node to have a data object with at least id,
    label, and type fields.
    """
    row = row or {}

    name = first_existing(row, ["name", "complex_name"])

    return {
        "data": {
            "id": complex_key(complex_id),
            "label": name if name != "暂无数据" else complex_key(complex_id),
            "type": "Complex",
            "complexId": complex_id,
        }
    }


def protein_node(uniprot_ac: str, row: Optional[dict] = None, node_type: str = "Protein"):
    """
    Build a Cytoscape node object for one protein.

    The node includes display fields such as gene label, protein name, and
    category so the frontend can color TF / EF / TF_and_EF nodes.
    """
    row = row or {}
    gene = first_existing(row, ["gene_symbol", "gene", "ext_gene_name", "gene_name"])
    protein_name = first_existing(row, ["protein_name", "name", "recommended_name"])
    category = first_existing(row, ["protein_category", "category"])

    return {
        "data": {
            "id": protein_key(uniprot_ac),
            "label": gene if gene != "暂无数据" else uniprot_ac,
            "type": node_type,
            "uniprotAc": uniprot_ac,
            "proteinName": protein_name,
            "category": category,
        }
    }

def edge(edge_id: str, source: str, target: str, edge_type: str, extra: Optional[dict] = None):
    """
    Build a Cytoscape edge object.

    Extra evidence fields such as sources, methods, publications, DDI, and DMI
    are merged into edge.data so the frontend can show detailed evidence panels.
    """
    data = {
        "id": edge_id,
        "source": source,
        "target": target,
        "type": edge_type,
    }

    if extra:
        data.update(extra)

    return {"data": data}