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

from app.core.validator_plt_regulares import PltRegularesValidator, extract_lgg_dataframe
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
        import traceback
        traceback.print_exc()
        print(f"[QAQC PLT] [ERROR PRE-GENERACIÓN] Error al generar Excel: {e}")


def _build_compact_metrics(diag: dict, campania_filter: Optional[str] = None) -> dict:
    """Construye las métricas compactas y KPIs para el dashboard."""
    anomalies = diag.get("anomalies") or diag.get("incidencias") or []
    
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
        "has_lgg_crosscheck": diag.get("has_lgg_crosscheck", False),
        "lgg_archivo": diag.get("lgg_archivo"),
    }


@router.post("/auditoria/plt/upload")
@router.post("/audit/plt/upload-and-audit")
async def upload_plt_audit_file(
    file: UploadFile = File(...),
    lgg_file: Optional[UploadFile] = File(None)
):
    """
    Recibe un archivo Excel de Ensayos PLT y opcionalmente la base de Logueo General (LGG),
    ejecuta la validación integral (autónoma o cruzada) y pre-genera el reporte Excel.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xlsm', '.xls')):
        raise HTTPException(status_code=400, detail="Formato no soportado. Debe ser un archivo Excel (.xlsx, .xlsm, .xls).")

    if lgg_file and not lgg_file.filename.lower().endswith(('.xlsx', '.xlsm', '.xls')):
        raise HTTPException(status_code=400, detail="Formato de archivo LGG no soportado. Debe ser un archivo Excel (.xlsx, .xlsm, .xls).")

    audit_id = f"plt_reg_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    temp_path = os.path.join(plt_history_dir, f"temp_{audit_id}_{file.filename}")
    saved_excel_path = os.path.join(plt_history_dir, f"{audit_id}_{file.filename}")

    temp_lgg_path = None
    if lgg_file:
        temp_lgg_path = os.path.join(plt_history_dir, f"temp_lgg_{audit_id}_{lgg_file.filename}")

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        shutil.copyfile(temp_path, saved_excel_path)

        df_lgg = None
        if lgg_file and temp_lgg_path:
            content_lgg = await lgg_file.read()
            with open(temp_lgg_path, "wb") as f:
                f.write(content_lgg)
            df_lgg = extract_lgg_dataframe(temp_lgg_path)
            if df_lgg is not None:
                print(f"[QAQC PLT] Archivo LGG cargado y procesado: {len(df_lgg)} corridas extraídas.")

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
        diag = validator.audit_dataframe(df, df_lgg=df_lgg)

        diag["nombre_archivo"] = file.filename
        diag["lgg_archivo"] = lgg_file.filename if lgg_file else None
        diag["fecha_auditoria"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        diag["audit_id"] = audit_id

        # Asegurar equivalencia de claves para anomalies / incidencias
        anomalies_list = diag.get("anomalies", [])
        for a in anomalies_list:
            if "muestra" not in a and "sample_code" in a:
                a["muestra"] = a["sample_code"]
            if "sample_code" not in a and "muestra" in a:
                a["sample_code"] = a["muestra"]
        diag["incidencias"] = anomalies_list

        # Métricas compactas
        metricas = _build_compact_metrics(diag)
        metricas["nombre_archivo"] = file.filename
        metricas["lgg_archivo"] = diag["lgg_archivo"]
        metricas["has_lgg_crosscheck"] = diag.get("has_lgg_crosscheck", False)
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
                "message": "Auditoría PLT ejecutada correctamente" + (" (con cruce LGG)" if df_lgg is not None else " (modo autónomo)"),
                "audit_id": audit_id,
                "filename": file.filename,
                "lgg_filename": lgg_file.filename if lgg_file else None,
                "has_lgg_crosscheck": diag.get("has_lgg_crosscheck", False),
                "metricas": metricas,
                "summary": metricas
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error durante el procesamiento del archivo PLT: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try: os.remove(temp_path)
            except Exception: pass
        if temp_lgg_path and os.path.exists(temp_lgg_path):
            try: os.remove(temp_lgg_path)
            except Exception: pass


@router.get("/auditoria/plt/diagnostico/ultimo")
def get_latest_plt_diagnostic():
    """Retorna el diagnóstico completo de la última auditoría PLT."""
    if not os.path.exists(LATEST_PLT_DIAG):
        raise HTTPException(status_code=404, detail="No se encontró ninguna auditoría PLT activa.")
    with open(LATEST_PLT_DIAG, "r", encoding="utf-8") as f:
        return JSONResponse(content=json.load(f))


@router.get("/auditoria/plt/resumen-ligero")
def get_plt_resumen_ligero(
    audit_id: Optional[str] = Query(None),
    campania: Optional[str] = Query(None)
):
    """Retorna las métricas ejecutivas para las tarjetas KPI y gráficos."""
    if audit_id:
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        diag_path = LATEST_PLT_DIAG

    if not os.path.exists(diag_path):
        raise HTTPException(status_code=404, detail="No se encontró la auditoría solicitada.")

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    metricas = _build_compact_metrics(diag, campania_filter=campania)
    metricas["nombre_archivo"] = diag.get("nombre_archivo", "")
    metricas["fecha_auditoria"] = diag.get("fecha_auditoria", "")
    metricas["audit_id"] = diag.get("audit_id", audit_id or "latest")
    return JSONResponse(content=metricas)


@router.get("/auditoria/plt/incidencias-paginadas")
def get_plt_paginated_incidencias(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    audit_id: Optional[str] = Query(None),
    tipo_incidencia: Optional[str] = Query(None),
    campania: Optional[str] = Query(None),
    taladro: Optional[str] = Query(None),
    rule_code: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """Retorna anomalías paginadas con filtrado dinámico."""
    if audit_id:
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json")
    else:
        diag_path = LATEST_PLT_DIAG

    if not os.path.exists(diag_path):
        return JSONResponse(content={"items": [], "total_items": 0, "page": 1, "total_pages": 1})

    with open(diag_path, "r", encoding="utf-8") as f:
        diag = json.load(f)

    items = diag.get("anomalies") or diag.get("incidencias") or []

    # Filtrar por severidad
    if tipo_incidencia and tipo_incidencia.strip().upper() not in ("", "TODOS", "ALL"):
        items = [i for i in items if str(i.get("severity", "")).strip().upper() == tipo_incidencia.strip().upper()]

    # Filtrar por campaña
    if campania and campania.strip().upper() not in ("", "TODAS", "ALL"):
        camps = [c.strip().upper() for c in campania.split(",") if c.strip()]
        items = [i for i in items if str(i.get("campana", "")).strip().upper() in camps]

    # Filtrar por taladro
    if taladro and taladro.strip():
        t_query = taladro.strip().upper()
        items = [i for i in items if t_query in str(i.get("taladro", "")).strip().upper()]

    # Filtrar por código de categoría
    if rule_code and rule_code.strip():
        rc = rule_code.strip().upper()
        items = [i for i in items if str(i.get("category_code", "")).strip().upper() == rc]

    # Búsqueda libre
    if search and search.strip():
        q = search.strip().upper()
        items = [
            i for i in items
            if q in str(i.get("taladro", "")).upper()
            or q in str(i.get("sample_code", i.get("muestra", ""))).upper()
            or q in str(i.get("columna", "")).upper()
            or q in str(i.get("message", "")).upper()
            or q in str(i.get("category_code", "")).upper()
        ]

    total_items = len(items)
    total_pages = max(1, (total_items + limit - 1) // limit)
    start_idx = (page - 1) * limit
    page_items = items[start_idx:start_idx + limit]

    # Garantizar que los nombres de campos sean consistentes para el frontend
    for a in page_items:
        if "muestra" not in a and "sample_code" in a:
            a["muestra"] = a["sample_code"]

    return JSONResponse(
        content={
            "items": page_items,
            "total_items": total_items,
            "page": page,
            "total_pages": total_pages
        }
    )


@router.get("/auditoria/plt/reporte-excel")
def download_plt_excel_report(
    audit_id: Optional[str] = Query(None)
):
    """Sirve el archivo Excel pre-generado de auditoría PLT."""
    target_file = None
    if audit_id:
        p1 = os.path.join(plt_history_dir, f"{audit_id}_reporte.xlsx")
        p2 = os.path.join(plt_history_dir, f"{audit_id}_reporte_completo.xlsx")
        if os.path.exists(p1):
            target_file = p1
        elif os.path.exists(p2):
            target_file = p2
    else:
        if os.path.exists(LATEST_PLT_EXCEL):
            target_file = LATEST_PLT_EXCEL

    if not target_file or not os.path.exists(target_file):
        # Si no existe pregenerado, intentar generarlo en tiempo real a partir del json
        diag_path = os.path.join(plt_history_dir, f"{audit_id}_diag.json") if audit_id else LATEST_PLT_DIAG
        if os.path.exists(diag_path):
            try:
                with open(diag_path, "r", encoding="utf-8") as f:
                    diag = json.load(f)
                gen_path = os.path.join(plt_history_dir, f"{audit_id or 'latest'}_reporte.xlsx")
                export_plt_regulares_to_excel(diag, gen_path)
                target_file = gen_path
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error generando reporte Excel: {str(e)}")

    if not target_file or not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail="No se encontró el reporte Excel para la auditoría solicitada.")

    filename = f"Reporte_Auditoria_PLT_Regulares_{audit_id or 'ultimo'}.xlsx"
    return FileResponse(
        target_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )


@router.get("/auditoria/plt/historial")
def get_plt_history():
    """Retorna la lista de auditorías PLT procesadas."""
    history = []
    if os.path.exists(plt_history_dir):
        for f in os.listdir(plt_history_dir):
            if f.endswith("_compact.json"):
                fpath = os.path.join(plt_history_dir, f)
                try:
                    with open(fpath, "r", encoding="utf-8") as file:
                        data = json.load(file)
                        a_id = data.get("audit_id", f.replace("_compact.json", ""))
                        history.append({
                            "id": a_id,
                            "audit_id": a_id,
                            "archivo": data.get("nombre_archivo", "Planilla PLT"),
                            "fecha": data.get("fecha_auditoria", "—"),
                            "total_registros": data.get("total_registros_evaluados", 0),
                            "integridad_global_pct": data.get("integridad_global_pct", 0.0),
                            "total_alertas": data.get("total_alertas", 0),
                            "total_advertencias": data.get("total_advertencias", 0),
                            "total_vacios": data.get("total_vacios", 0),
                            "has_lgg_crosscheck": data.get("has_lgg_crosscheck", False),
                            "lgg_archivo": data.get("lgg_archivo"),
                        })
                except Exception:
                    pass

    history.sort(key=lambda x: str(x.get("audit_id", "")), reverse=True)
    return JSONResponse(content={"history": history})


@router.delete("/auditoria/plt/historial")
def clear_plt_history():
    """Limpia todo el historial de auditorías PLT."""
    try:
        if os.path.exists(plt_history_dir):
            for item in os.listdir(plt_history_dir):
                item_path = os.path.join(plt_history_dir, item)
                try:
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                    elif os.path.isdir(item_path):
                        shutil.rmtree(item_path)
                except Exception:
                    pass
        return JSONResponse(content={"status": "success", "message": "Historial limpiado correctamente."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al limpiar historial: {str(e)}")
