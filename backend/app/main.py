"""
FastAPI application entry point for Protein Network Explorer.

This file creates the API app, configures middleware, and registers route
modules for health checks, search, protein detail / neighborhood views, complex
views, and global PPI views.
"""


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, search, complex, protein, global_ppi

app = FastAPI(title=settings.api_title, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
# Register read-only API routers used by the Next.js frontend.
app.include_router(health.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(complex.router, prefix="/api")
app.include_router(protein.router, prefix="/api")
app.include_router(global_ppi.router, prefix="/api")