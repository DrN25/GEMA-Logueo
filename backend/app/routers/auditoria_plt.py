"""
app/routers/auditoria_plt.py — Endpoints API para Auditoría QA/QC de Ensayos PLT Regulares (DDH).
Soporta subida de archivos Excel, validación geomecánica, consulta de KPIs, paginación de anomalías y descarga de reportes Excel.
"""

import os
import io
import json
import shutil
from datetime import datetime
from typing import Optional, List
import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse

from app.core.validator_plt_regulares import PltRegularesValidator
from app.services.plt_excel_exporter_regulares import export_plt_regulares_to_excel

router = APIRouter(prefix="/api", tags=["Auditoría PLT Regulares"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")
plt_history_dir = os.path.join(uploads_dir, "plt_history")
os.makedirs(plt_history_dir, exist_ok=True)

# Archivos de caché persistentes en uploads/
LATEST_PLT_DIAG = os.path.join(plt_history_dir, "plt_diagnostico_ultimo.json")
LATEST_PLT_COMPACT = os.path.join(plt_history_dir, "plt_compact_ultimo.json")
LATEST_PLT_EXCEL = os.path.join(plt_history_dir, "plt_reporte_completo_ultimo.xlsx")


def _pregenerate_plt_excel(diag: dict, excel_out_path: str, public_out_path: str):
    """Genera y guarda el libro Excel completo en disco."""
    try:
        export_plt_regulares_to_excel(diag, excel_out_path)
        try:
            shutil.copyfile(excel_out_path, public_out_path)
        except Exception:
            pass
        size_kb = os.path.getsize(excel_out_path) / 1024.0
        print(f"[QAQC PLT] [PRE-GENERACIÓN EXCEL] Reporte Excel guardado ({size_kb:.1f} KB) -> '{os.path.basename(excel_out_path)}'")
    except Exception as e:
        print(f"[QAQC PLT] [ERROR PRE-GENERACIÓN] Error al generar Excel: {e}")


def _build_compact_metrics(diag: dict, campania_filter: Optional[str] = None) -> dict:
    """Construye las métricas compactas y KPIs para el dashboard."""
    anomalies = diag.get("anomalies", [])
    
    # Aplicar filtro de campaña si se especifica
    if campania_filter and campania_filter.strip().upper() not in ("", "TODAS", "NONE", "NULL"):
        camps = [c.strip().upper() for c in campania_filter.split(",") if c.strip()]
        filtered_anomalies = [a for a in anomalies if str(a.get("campana", "")).strip().upper() in camps]
    else:
        filtered_anomalies = anomalies

    total_rows = diag.get("total_rows", 0)
    severity_counts = {"ALERTA": 0, "ADVERTENCIA": 0, "VACIO": 0}
    category_counts = {}
    drillholes_affected = set()

    for a in filtered_anomalies:
        sev = a.get("severity", "ALERTA")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        cat_code = a.get("category_code", "")
        category_counts[cat_code] = category_counts.get(cat_code, 0) + 1
        if a.get("taladro"):
            drillholes_affected.add(a["taladro"])

    # Top desviaciones
    top_deviations = []
    total_anoms = len(filtered_anomalies)
    for cat_code, cnt in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        cat_name = next((a["category_name"] for a in filtered_anomalies if a.get("category_code") == cat_code), cat_code)
        sev = next((a["severity"] for a in filtered_anomalies if a.get("category_code") == cat_code), "ALERTA")
        top_deviations.append({
            "code": cat_code,
            "name": cat_name,
            "severity": sev,
            "count": cnt,
            "percentage": round(cnt / max(1, total_anoms) * 100.0, 2)
        })

    # Distribución por campaña
    dist_camp = []
    for camp_name, c_stats in sorted(diag.get("campaign_stats", {}).items()):
        dist_camp.append({
            "campania": camp_name,
            "registros": c_stats.get("total", 0),
            "alertas": c_stats.get("alertas", 0),
            "advertencias": c_stats.get("advertencias", 0),
            "vacios": c_stats.get("vacios", 0),
            "calidad_pct": round(max(0.0, (c_stats.get("total", 0) - (c_stats.get("alertas", 0) + c_stats.get("vacios", 0))) / max(1, c_stats.get("total", 1)) * 100.0), 2)
        })

    # Top 5 taladros
    worst_drillholes = []
    for dh_name, dh_data in sorted(diag.get("drillhole_stats", {}).items(), key=lambda x: (x[1].get("alertas", 0) + x[1].get("vacios", 0)), reverse=True)[:5]:
        worst_drillholes.append({
            "taladro": dh_name,
            "total_muestras": dh_data.get("total", 0),
            "alertas": dh_data.get("alertas", 0),
            "advertencias": dh_data.get("advertencias", 0),
            "vacios": dh_data.get("vacios", 0),
            "salud_pct": round(max(0.0, (dh_data.get("total", 0) - (dh_data.get("alertas", 0) + dh_data.get("vacios", 0))) / max(1, dh_data.get("total", 1)) * 100.0), 2)
        })

    valid_rows = diag.get("valid_rows", 0)
    invalid_rows = diag.get("invalid_rows", 0)
    total_taladros = len(diag.get("drillhole_stats", {}))

    return {
        "total_registros_evaluados": total_rows,
        "registros_conformes": valid_rows,
        "registros_con_incidencias": invalid_rows,
        "total_taladros_evaluados": total_taladros,
        "taladros_afectados": len(drillholes_affected),
        "integridad_global_pct": diag.get("quality_index", 100.0),
        "total_alertas": severity_counts.get("ALERTA", 0),
        "total_advertencias": severity_counts.get("ADVERTENCIA", 0),
        "total_vacios": severity_counts.get("VACIO", 0),
        "total_incidencias": total_anoms,
        "top_deviations": top_deviations,
        "distribucion_campania": dist_camp,
        "worst_drillholes": worst_drillholes,
    }


@router.post("/auditoria/plt/upload")
@router.post("/audit/plt/upload-and-audit")
async def upload_plt_audit_file(
    file: UploadFile = File(...)
):
    """
    Recibe un archivo Excel de Ensayos PLT, ejecuta la validación integral y pre-genera el reporte Excel.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xlsm', '.xls')):
        raise HTTPException(status_code=400, detail="Formato no soportado. Debe ser un archivo Excel (.xlsx, .xlsm, .xls).")

    audit_id = f"plt_reg_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    temp_path = os.path.join(plt_history_dir, f"temp_{audit_id}_{file.filename}")
    saved_excel_path = os.path.join(plt_history_dir, f"{audit_id}_{file.filename}")

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        shutil.copyfile(temp_path, saved_excel_path)

        # Cargar DataFrame con Calamine o Pandas
        try:
            from python_calamine import CalamineWorkbook
            wb_cal = CalamineWorkbook.from_path(temp_path)
            sheet_names = wb_cal.sheet_names
            target_sheet = "ENSAYO PLT" if "ENSAYO PLT" in sheet_names else sheet_names[0]
            s0 = wb_cal.get_sheet_by_name(target_sheet)
            rows = s0.to_python()
            header = [str(c).replace("\n", " ").strip() if c is not None else f"COL_{idx}" for idx, c in enumerate(rows[0])]
            df = pd.DataFrame(rows[1:], columns=header)
        except Exception:
            df = pd.read_excel(temp_path, sheet_name=0)

        # Validar
        validator = PltRegularesValidator()
        diag = validator.audit_dataframe(df)

        diag["nombre_archivo"] = file.filename
        diag["fecha_auditoria"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        diag["audit_id"] = audit_id

        # Métricas compactas
        metricas = _build_compact_metrics(diag)
        metricas["nombre_archivo"] = file.filename
        metricas["fecha_auditoria"] = diag["fecha_auditoria"]
        metricas["audit_id"] = audit_id

        # Guardar diagnósticos JSON
        hist_diag = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
        hist_comp = os.path.join(plt_history_dir, f"{audit_id}_compact.json")
        hist_excel = os.path.join(plt_history_dir, f"{audit_id}_reporte.xlsx")

        with open(LATEST_PLT_DIAG, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False, indent=2)
        with open(LATEST_PLT_COMPACT, "w", encoding="utf-8") as f:
            json.dump(metricas, f, ensure_ascii=False, indent=2)

        with open(hist_diag, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False)
        with open(hist_comp, "w", encoding="utf-8") as f:
            json.dump(metricas, f, ensure_ascii=False)

        # Pre-generar Excel
        _pregenerate_plt_excel(diag, hist_excel, LATEST_PLT_EXCEL)

        return JSONResponse(
            content={
                "status": "success",
                "message": "Auditoría PLT ejecutada correctamente",
                "audit_id": audit_id,
                "filename": file.filename,
                "metricas": metricas,
            }
        )
    except Exception as e:
        print(f"[QAQC PLT] [ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Error durante la auditoría PLT: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/auditoria/plt/status")
@router.get("/audit/plt/status")
def get_plt_audit_status(audit_id: Optional[str] = Query(None)):
    """Estado de la auditoría y verificación de reporte Excel."""
    if audit_id:
        compact_file = os.path.join(plt_history_dir, f"{audit_id}_compact.json")
        reporte_file = os.path.join(plt_history_dir, f"{audit_id}_reporte.xlsx")
    else:
        compact_file = LATEST_PLT_COMPACT
        reporte_file = LATEST_PLT_EXCEL

    if os.path.exists(compact_file):
        try:
            with open(compact_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
        return {
            "status": "listo",
            "reporte_listo": os.path.exists(reporte_file),
            "nombre_archivo": meta.get("nombre_archivo"),
            "fecha_auditoria": meta.get("fecha_auditoria"),
            "audit_id": meta.get("audit_id", audit_id),
        }

    if os.path.exists(LATEST_PLT_DIAG):
        return {"status": "procesando", "reporte_listo": False}

    raise HTTPException(status_code=404, detail="No se encontró ninguna auditoría PLT activa.")


@router.get("/auditoria/plt/resumen-ligero")
@router.get("/audit/plt/resumen-ligero")
def get_plt_resumen_ligero(
    audit_id: Optional[str] = Query(None),
    campania: Optional[str] = Query(None),
):
    """Retorna los KPIs ejecutivos y estadísticas con soporte de filtrado."""
    if audit_id:
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        diag_path = LATEST_PLT_DIAG

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    metricas = _build_compact_metrics(diag, campania_filter=campania)
    metricas["nombre_archivo"] = diag.get("nombre_archivo", "Planilla PLT")
    metricas["fecha_auditoria"] = diag.get("fecha_auditoria", "")
    metricas["audit_id"] = diag.get("audit_id", audit_id)
    return JSONResponse(content=metricas)


@router.get("/auditoria/plt/incidencias-paginadas")
@router.get("/audit/plt/incidencias-paginadas")
def get_plt_incidencias_paginadas(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    tipo_incidencia: Optional[str] = Query(None),
    rule_code: Optional[str] = Query(None),
    campania: Optional[str] = Query(None),
    taladro: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    audit_id: Optional[str] = Query(None),
):
    """Retorna la lista paginada y filtrada de inconsistencias encontradas."""
    if audit_id:
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        diag_path = LATEST_PLT_DIAG

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="No hay ninguna auditoría PLT cargada en memoria.")

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    items = diag.get("anomalies", [])

    # Filtrar por campañas
    if campania:
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        if camps and "TODAS" not in camps:
            items = [i for i in items if str(i.get("campana", "")).strip().upper() in camps]

    # Filtrar por taladro
    if taladro:
        t_clean = taladro.strip().upper()
        if t_clean and t_clean != "TODOS":
            items = [i for i in items if str(i.get("taladro", "")).strip().upper() == t_clean]

    # Filtrar por severidad
    if tipo_incidencia and tipo_incidencia.upper() != "TODOS":
        items = [i for i in items if i.get("severity") == tipo_incidencia.upper()]

    # Filtrar por código de regla
    if rule_code:
        items = [i for i in items if i.get("category_code") == rule_code]

    # Filtrar por búsqueda de texto
    if search:
        q = search.strip().upper()
        items = [
            i for i in items
            if q in str(i.get("taladro", "")).upper()
            or q in str(i.get("muestra", "")).upper()
            or q in str(i.get("columna", "")).upper()
            or q in str(i.get("message", "")).upper()
            or q in str(i.get("category_code", "")).upper()
            or q in str(i.get("category_name", "")).upper()
        ]

    total_items = len(items)
    total_pages = max(1, (total_items + limit - 1) // limit)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    page_items = items[start_idx:end_idx]

    return JSONResponse(
        content={
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "items": page_items,
        }
    )


@router.get("/auditoria/plt/reporte-excel")
@router.get("/audit/plt/download-report/{audit_id}")
def download_plt_excel_report(
    audit_id: Optional[str] = None
):
    """Descarga el reporte Excel (.xlsx) generado."""
    if audit_id and audit_id != "latest":
        hist_excel = os.path.join(plt_history_dir, f"{audit_id}_reporte.xlsx")
        if os.path.exists(hist_excel):
            return FileResponse(
                path=hist_excel,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename=f"Reporte_Auditoria_PLT_Regulares_{audit_id}.xlsx"
            )

    if os.path.exists(LATEST_PLT_EXCEL):
        return FileResponse(
            path=LATEST_PLT_EXCEL,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="Reporte_Auditoria_PLT_Regulares.xlsx"
        )

    raise HTTPException(status_code=404, detail="No se encontró el reporte Excel generado.")


@router.get("/auditoria/plt/historial")
@router.get("/audit/plt/history")
def get_plt_audit_history():
    """Retorna la lista de auditorías PLT previas."""
    history = []
    if not os.path.exists(plt_history_dir):
        return JSONResponse(content={"history": []})

    for f in os.listdir(plt_history_dir):
        if f.endswith("_compact.json"):
            aid = f.replace("_compact.json", "")
            try:
                with open(os.path.join(plt_history_dir, f), "r", encoding="utf-8") as jf:
                    meta = json.load(jf)
                reporte_file = os.path.join(plt_history_dir, f"{aid}_reporte.xlsx")
                history.append({
                    "audit_id": aid,
                    "nombre_archivo": meta.get("nombre_archivo", "Planilla PLT"),
                    "fecha_auditoria": meta.get("fecha_auditoria", ""),
                    "total_registros": meta.get("total_registros_evaluados", 0),
                    "integridad_global_pct": meta.get("integridad_global_pct", 0.0),
                    "total_alertas": meta.get("total_alertas", 0),
                    "total_advertencias": meta.get("total_advertencias", 0),
                    "total_vacios": meta.get("total_vacios", 0),
                    "has_report": os.path.exists(reporte_file),
                })
            except Exception:
                continue

    history = sorted(history, key=lambda x: x["audit_id"], reverse=True)
    return JSONResponse(content={"history": history})


@router.delete("/auditoria/plt/historial")
@router.delete("/audit/plt/history")
def clear_plt_audit_history():
    """Limpia todos los registros del historial PLT."""
    try:
        for f in os.listdir(plt_history_dir):
            p = os.path.join(plt_history_dir, f)
            if os.path.isfile(p):
                os.remove(p)
        return {"status": "success", "message": "Historial de auditorías PLT limpiado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
