from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import taladros, catalogs, calculations, auditoria

app = FastAPI(
    title="Geolog Pro API",
    description="API Modularizada y Optimizada de Geolog Pro 2.0",
    version="2.0"
)

# Habilitar CORS para desarrollo local con Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir los sub-routers de la aplicación
app.include_router(taladros.router)
app.include_router(catalogs.router)
app.include_router(calculations.router)
app.include_router(auditoria.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Geolog Pro 2.0 API",
        "documentation": "/docs"
    }
