from fastapi import APIRouter, Query

from app.datastore import store
from app.transform import clean, first_existing

router = APIRouter()


@router.get("/search")
def search(
    q: str = Query(default="", description="搜索关键词，比如 TP53、EZH2、PRC2、996"),
    type: str = Query(default="all", description="protein / complex / all"),
):
    query = q.strip().lower()

    if not query:
        return {"results": []}

    results = []

    if type in {"all", "protein"}:
        results.extend(search_proteins(query))

    if type in {"all", "complex"}:
        results.extend(search_complexes(query))

    results.sort(key=lambda item: (item["rank"], item["label"]))

    for item in results:
        item.pop("rank", None)

    return {
        "query": q,
        "type": type,
        "count": len(results[:20]),
        "results": results[:20],
    }


def search_proteins(query: str):
    results = []
    seen_uniprot = set()

    protein_tables = [
        ("ppi_nodes", store.ppi_nodes),
        ("intra_protein_nodes", store.intra_protein_nodes),
        ("ext_protein_nodes", store.ext_protein_nodes),
    ]

    for table_name, df in protein_tables:
        for _, row in df.iterrows():
            row = row.to_dict()

            uniprot = first_existing(row, ["uniprot_ac", "uniprot_id", "id"])
            gene = first_existing(row, ["gene_symbol", "gene", "ext_gene_name", "gene_name"])
            protein_name = first_existing(row, ["protein_name", "name", "recommended_name"])
            category = first_existing(row, ["protein_category", "category"])

            if uniprot == "暂无数据":
                continue

            if uniprot in seen_uniprot:
                continue

            rank = None
            matched_by = None

            if query == uniprot.lower() or query == f"uniprot:{uniprot}".lower():
                rank = 0
                matched_by = "uniprot_ac"

            elif gene != "暂无数据" and query == gene.lower():
                rank = 1
                matched_by = "gene_symbol"

            elif gene != "暂无数据" and query in gene.lower():
                rank = 5
                matched_by = "gene_symbol"

            elif protein_name != "暂无数据" and query in protein_name.lower():
                rank = 8
                matched_by = "protein_name"

            if rank is not None:
                seen_uniprot.add(uniprot)

                results.append(
                    {
                        "type": "protein",
                        "id": uniprot,
                        "key": f"UniProt:{uniprot}",
                        "label": gene if gene != "暂无数据" else uniprot,
                        "secondaryLabel": protein_name,
                        "category": category,
                        "matchedBy": matched_by,
                        "sourceTable": table_name,
                        "rank": rank,
                    }
                )

    return results


def search_complexes(query: str):
    results = []
    seen_complex = set()

    complex_tables = [
        ("ext_complex_nodes", store.ext_complex_nodes),
        ("intra_complex_nodes", store.intra_complex_nodes),
    ]

    for table_name, df in complex_tables:
        for _, row in df.iterrows():
            row = row.to_dict()

            complex_id = first_existing(row, ["id", "complex_id", "corum_id"])
            name = first_existing(row, ["name", "complex_name"])
            n_subunits = first_existing(row, ["n_subunits", "subunit_count"])

            if complex_id == "暂无数据":
                continue

            if complex_id in seen_complex:
                continue

            rank = None
            matched_by = None

            if query == complex_id.lower() or query == f"corum:{complex_id}".lower():
                rank = 0
                matched_by = "complex_id"

            elif name != "暂无数据" and query in name.lower():
                rank = 5
                matched_by = "complex_name"

            if rank is not None:
                seen_complex.add(complex_id)

                results.append(
                    {
                        "type": "complex",
                        "id": complex_id,
                        "key": f"CORUM:{complex_id}",
                        "label": name if name != "暂无数据" else complex_id,
                        "secondaryLabel": f"{n_subunits} subunits",
                        "matchedBy": matched_by,
                        "sourceTable": table_name,
                        "rank": rank,
                    }
                )

    return results