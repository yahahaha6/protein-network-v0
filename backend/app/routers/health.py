from fastapi import APIRouter

from app.datastore import store

router = APIRouter()


@router.get("/health")
def health():
    return {
        "ok": True,
        "loaded": {
            "ppi_nodes": len(store.ppi_nodes),
            "ppi_edges": len(store.ppi_edges),
            "intra_complex_nodes": len(store.intra_complex_nodes),
            "intra_protein_nodes": len(store.intra_protein_nodes),
            "intra_edges": len(store.intra_edges),
            "ext_complex_nodes": len(store.ext_complex_nodes),
            "ext_protein_nodes": len(store.ext_protein_nodes),
            "ext_edges": len(store.ext_edges),
        },
    }