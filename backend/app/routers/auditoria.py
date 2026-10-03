"""
app.routers.auditoria
Controlador REST para la auditoría geomecánica DDH (Logueo General, Estructural y Cruces).
Arquitectura Limpia: endpoints HTTP delegando I/O de Excel a ddh_excel_exporter y pipelines a ddh_audit_service.
"""

import os
import io
import json
import shutil
import math
from datetime import datetime
from typing import Optional, Any, List

import openpyxl
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse

from app.validator import safe_float, safe_int, safe_str
from app.services.ddh_excel_exporter import (
    simplify_message,
    generar_excel_reporte_core,
    export_ddh_reporte_excel
)
from app.services.ddh_audit_service import (
    history_dir,
    uploads_dir,
    temp_dir,
    is_year_match,
    build_ddh_compact_metrics,
    run_logueo_audit_pipeline,
    run_revision_audit_pipeline
)

router = APIRouter(prefix="/api", tags=["Auditoria"])


@router.get("/logueo/estado-reporte")
def verificar_estado_reporte(audit_id: str):
    """Verifica si el reporte Excel pre-generado ya existe en disco."""
    file_path = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    return {"excel_ready": os.path.exists(file_path)}


@router.post("/logueo/cancelar-auditoria")
def cancelar_auditoria(audit_id: str):
    """Cancela la auditoría eliminando archivos del historial."""
    t_str = lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[*] [{t_str()}] Petición de cancelación recibida para {audit_id}", flush=True)
    
    extensiones_a_limpiar = [
        ".xlsx", 
        "_diagnostico.json", 
        "_compact.json", 
        "_reporte_completo.xlsx",
        "_lgg_est.xlsx", 
        "_collar.xlsx", 
        "_survey.xlsx"
    ]
    for ext in extensiones_a_limpiar:
        path = os.path.join(history_dir, f"{audit_id}{ext}")
        if os.path.exists(path):
            try:
                os.remove(path)
                print(f"[+] [{t_str()}] Archivo eliminado: {path}", flush=True)
            except Exception as e:
                print(f"[-] [{t_str()}] No se pudo eliminar {path}: {e}", flush=True)
                
    return {"status": "cancelado"}


@router.post("/logueo/sheets")
async def obtener_nombres_hojas(file: UploadFile = File(...)):
    """Sube un excel y extrae sus nombres de hoja."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Debe ser Excel.")
        
    temp_filename = f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(temp_dir, temp_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    wb = None
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True)
        sheet_names = wb.sheetnames
        return {"filename": temp_filename, "sheets": sheet_names}
    except Exception as e:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Error leyendo el archivo Excel: {str(e)}")
    finally:
        if wb:
            try:
                wb.close()
            except Exception:
                pass


@router.post("/logueo/importar-excel-bulk")
async def importar_excel_bulk(
    background_tasks: BackgroundTasks,
    payload: dict
):
    """Dispara el pipeline de auditoría de fondo con las hojas mapeadas."""
    filename = payload.get("filename")
    lgg_sheet = payload.get("lgg_sheet")
    est_sheet = payload.get("est_sheet")
    
    if not filename or not lgg_sheet or not est_sheet:
        raise HTTPException(status_code=400, detail="Faltan parámetros obligatorios.")
        
    temp_path = os.path.join(temp_dir, filename)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="El archivo subido ya no existe en el servidor temporal.")
        
    audit_id = f"audit_logueo_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    file_path = os.path.join(history_dir, f"{audit_id}.xlsx")
    
    shutil.move(temp_path, file_path)
    
    formato = payload.get("formato", "auto")
    background_tasks.add_task(run_logueo_audit_pipeline, file_path, lgg_sheet, est_sheet, audit_id, formato)
    return {"status": "procesando", "audit_id": audit_id}


@router.get("/logueo/auditorias")
def listar_auditorias():
    """Lista las auditorías registradas en el historial."""
    if not os.path.exists(history_dir):
        return []
    audits = []
    for f in os.listdir(history_dir):
        if f.endswith("_compact.json"):
            audit_id = f.replace("_compact.json", "")
            compact_file = os.path.join(history_dir, f)
            try:
                with open(compact_file, "r", encoding="utf-8") as file_content:
                    meta = json.load(file_content)
                    audits.append({
                        "audit_id": audit_id,
                        "fecha": meta.get("fecha_auditoria", "Desconocida"),
                        "archivo": meta.get("nombre_archivo", "Desconocido.xlsx"),
                        "formato": meta.get("formato_evaluado", "2026"),
                        "total_filas": meta.get("familia1", {}).get("total_discontinuidades", 0),
                        "total_vacios": meta.get("familia2", {}).get("total_vacios", 0),
                        "total_advertencias": meta.get("familia2", {}).get("total_advertencias", 0),
                        "total_alertas": meta.get("familia2", {}).get("total_alertas", 0)
                    })
            except Exception:
                pass
    return sorted(audits, key=lambda x: x["fecha"], reverse=True)


@router.get("/logueo/resumen-ligero")
def obtener_resumen_ligero(audit_id: str = None, years: str = None):
    """Retorna las métricas ejecutivas para las tarjetas KPI y gráficos de DDH."""
    if audit_id:
        raw_file = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
        compact_file = os.path.join(history_dir, f"{audit_id}_compact.json")
        excel_file_v1 = os.path.join(history_dir, f"{audit_id}.xlsx")
        excel_file_v2 = os.path.join(history_dir, f"{audit_id}_lgg_est.xlsx")
        
        if not os.path.exists(compact_file) or not os.path.exists(raw_file):
            if os.path.exists(excel_file_v1) or os.path.exists(excel_file_v2):
                if os.path.exists(compact_file):
                    with open(compact_file, "r", encoding="utf-8") as f:
                        c_data = json.load(f)
                        if c_data.get("status") == "error":
                            return c_data
                return JSONResponse(status_code=202, content={"status": "procesando", "message": "Revisión geotécnica en proceso..."})
            raise HTTPException(status_code=404, detail="La revisión no existe o fue eliminada.")
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        compact_file = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        if not os.path.exists(raw_file) or not os.path.exists(compact_file):
            jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json")]
            if jsons:
                jsons.sort(key=lambda x: os.path.getmtime(os.path.join(history_dir, x)), reverse=True)
                latest_id = jsons[0].replace("_diagnostico.json", "")
                raw_file = os.path.join(history_dir, f"{latest_id}_diagnostico.json")
                compact_file = os.path.join(history_dir, f"{latest_id}_compact.json")
            else:
                return JSONResponse(status_code=202, content={"status": "procesando", "message": "Esperando inicialización de datos de auditoría..."})

    # Si no hay filtro de años y ya existe el compact, retornar directamente el compact precalculado
    if (not years or years.strip().upper() in ("TODOS", "TODAS", "ALL", "")) and os.path.exists(compact_file):
        with open(compact_file, "r", encoding="utf-8") as f:
            return json.load(f)

    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)

    if diag.get("status") == "error":
        return diag
        
    return build_ddh_compact_metrics(diag, audit_id=audit_id or "default", file_name=raw_file, years_filter=years)


@router.get("/logueo/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1, limit: int = 50, tipo: str = None, celda: str = None, columna: str = None,
    campania: str = None, geotecnico: str = None, search: str = None, audit_id: str = None
):
    """Retorna incidencias con paginación y filtros dinámicos."""
    if audit_id: 
        raw_file = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
        if not os.path.exists(raw_file):
            return {"data": [], "page": 1, "total_pages": 1, "total_records": 0}
    else:
        raw_file = os.path.join(uploads_dir, "diagnostico_geomecanico.json")
        if not os.path.exists(raw_file):
            jsons = [f for f in os.listdir(history_dir) if f.endswith("_diagnostico.json")]
            if jsons:
                jsons.sort(key=lambda x: os.path.getmtime(os.path.join(history_dir, x)), reverse=True)
                raw_file = os.path.join(history_dir, jsons[0])
            else:
                return {"data": [], "page": 1, "total_pages": 1, "total_records": 0}

    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    incidencias = diag.get("incidencias", [])
    
    if tipo:
        incidencias = [i for i in incidencias if i.get("tipo_incidencia") == tipo]
    if celda:
        incidencias = [i for i in incidencias if i.get("celda_padre") == celda]
    if columna:
        incidencias = [i for i in incidencias if i.get("columna") == columna]
    if campania and campania not in ("TODOS", "TODAS", "ALL", ""):
        c_list = [c.strip() for c in campania.split(",") if c.strip()]
        incidencias = [i for i in incidencias if is_year_match(i.get("campania"), c_list)]
    if geotecnico:
        incidencias = [i for i in incidencias if i.get("geotecnico") == geotecnico]
    if search:
        search_lower = search.lower()
        incidencias = [
            i for i in incidencias 
            if search_lower in str(i.get("mensaje", "")).lower() 
            or search_lower in simplify_message(i.get("mensaje", "")).lower()
            or search_lower in str(i.get("columna", "")).lower()
            or search_lower in str(i.get("celda_padre", "")).lower()
            or search_lower in str(i.get("celda_hija", "")).lower()
        ]
        
    total_records = len(incidencias)
    total_pages = max(1, math.ceil(total_records / limit))
    page = max(1, min(page, total_pages))
    
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = incidencias[start_idx:end_idx]
    
    return {
        "data": paginated,
        "page": page,
        "total_pages": total_pages,
        "total_records": total_records
    }


@router.get("/logueo/reporte-excel")
def descargar_reporte_excel(audit_id: str = None):
    """Sirve el libro Excel pre-generado completo."""
    if audit_id:
        file_path = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    else:
        file_path = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El reporte Excel solicitado no se encuentra en el servidor. Espere a que termine el procesamiento.")
        
    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="Reporte_Auditoria_Geotecnica_Logueo.xlsx"
    )


@router.get("/logueo/reporte-markdown")
def descargar_reporte_markdown(audit_id: str = None, years: str = None):
    """Genera y descarga un informe ejecutivo en formato Markdown."""
    resumen = obtener_resumen_ligero(audit_id, years)
    if isinstance(resumen, JSONResponse):
        return resumen
        
    title = resumen.get("nombre_archivo", "Archivo de Logueo")
    m = resumen.get("metricas_globales", {})
    correct_pct = ((m.get("total_ok", 0) / max(1, m.get("total_celdas_hija_procesadas", 0))) * 100)
    
    md_content = f"""# REPORTE DE AUDITORÍA GEOTÉCNICA Y CONTROL DE CALIDAD (QA/QC)
Generado el: {resumen.get("fecha_auditoria", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))}
Archivo evaluado: {title}
Código de Auditoría: {resumen.get("audit_id", "default")}

---

## 1. RESUMEN EJECUTIVO DE INTEGRIDAD
El sistema de auditoría ha evaluado la consistencia física de las corridas de logueo general (LGG) y la relación espacial de las discontinuidades estructurales (Logueo Estructural), cruzando durezas, litologías, e intervalos.

*   **Total de Taladros Evaluados:** {resumen.get("familia1", {}).get("num_celdas_padre", 0)}
*   **Total de Registros de Logueo Procesados:** {resumen.get("familia1", {}).get("total_discontinuidades", 0)}
*   **Mapeo Lineal Equivalente:** {resumen.get("familia1", {}).get("total_metros", 0.0)} metros perforados.
*   **Integridad Global de Registros:** {correct_pct:.2f}% de filas sin desviaciones críticas.
*   **Total de Desviaciones Críticas (Alertas):** {m.get("total_alertas", 0)}
*   **Total de Advertencias de Consistencia:** {m.get("total_advertencias", 0)}
*   **Campos Obligatorios Vacíos:** {m.get("total_vacios", 0)}

---

## 2. PRINCIPALES ANOMALÍAS CRÍTICAS DETECTADAS
A continuación se listan las reglas que más frecuentemente se han incumplido:

"""
    for idx, item in enumerate(resumen.get("top_5_alertas", []), start=1):
        md_content += f"{idx}. **{item['mensaje']}** - {item['cantidad']} casos ({item['pct']:.2f}% de las alertas críticas).\n"
        
    md_content += """
---

## 3. DESEMPEÑO POR CAMPAÑA Y RESPONSABLE
A continuación se detalla la cantidad de desviaciones encontradas agrupadas por campaña de perforación:

| Campaña / Año | Registros | Alertas (N) | % Alertas | Vacíos (N) | % Vacíos |
|---|---|---|---|---|---|
"""
    for c in resumen.get("distribucion_campania", []):
        md_content += f"| {c['campania']} | {c['discontinuidades']} | {c['alertas_cant']} | {c['alertas_pct']:.2f}% | {c['vacios_cant']} | {c['vacios_pct']:.2f}% |\n"
        
    md_content += """
---
*Fin del Reporte Técnico de Auditoría. Geolog Pro 2.0.*
"""
    headers = {
        'Content-Disposition': f'attachment; filename="Reporte_Auditoria_{resumen.get("audit_id", "logueo")}.md"'
    }
    return StreamingResponse(io.BytesIO(md_content.encode("utf-8")), media_type="text/markdown", headers=headers)


@router.post("/logueo/importar-excel-bulk-v2")
async def importar_excel_bulk_v2(
    background_tasks: BackgroundTasks,
    file_lgg_est: UploadFile = File(...),
    file_collar: Optional[UploadFile] = File(None),
    file_survey: Optional[UploadFile] = File(None),
    config_json: str = Form(...)
):
    """Importación integral multi-archivo V2 con verificación de collar y survey."""
    try:
        config = json.loads(config_json)
    except Exception as e:
        raise HTTPException(status_code=400, detail="El objeto config_json no tiene un formato válido.")

    audit_id = f"audit_logueo_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    paths = {}
    
    path_lgg = os.path.join(history_dir, f"{audit_id}_lgg_est.xlsx")
    with open(path_lgg, "wb") as buffer:
        shutil.copyfileobj(file_lgg_est.file, buffer)
    paths["lgg_est"] = path_lgg
    
    if file_collar and file_collar.size > 0:
        path_collar = os.path.join(history_dir, f"{audit_id}_collar.xlsx")
        with open(path_collar, "wb") as buffer:
            shutil.copyfileobj(file_collar.file, buffer)
        paths["collar"] = path_collar
        
    if file_survey and file_survey.size > 0:
        path_survey = os.path.join(history_dir, f"{audit_id}_survey.xlsx")
        with open(path_survey, "wb") as buffer:
            shutil.copyfileobj(file_survey.file, buffer)
        paths["survey"] = path_survey
        
    background_tasks.add_task(run_revision_audit_pipeline, paths, config, audit_id, file_lgg_est.filename)
    
    return {"status": "procesando", "audit_id": audit_id}
