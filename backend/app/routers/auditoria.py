import os
import io
import json
import shutil
import math
import time
from datetime import datetime
from collections import Counter, defaultdict
from typing import Optional, Any, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse

from app.core.rules import MASTER_ERROR_RULES, get_rule_by_msg
from app.validator import validate_logueo_bulk_sheets, validate_revision_bulk_v2, safe_float, safe_int, safe_str
from app.services.ddh_excel_exporter import (
    generar_excel_reporte_core,
    simplify_message,
    get_safe_sheet_name,
    get_module_label,
    export_ddh_reporte_excel
)

router = APIRouter(prefix="/api", tags=["Auditoria"])
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")
history_dir = os.path.join(uploads_dir, "history")
temp_dir = os.path.join(uploads_dir, "temp")

os.makedirs(history_dir, exist_ok=True)
os.makedirs(temp_dir, exist_ok=True)

def safe_replace(src: str, dst: str, retries: int = 5, delay: float = 0.2):
    for i in range(retries):
        try:
            os.replace(src, dst)
            return
        except (PermissionError, OSError) as e:
            if i == retries - 1:
                try:
                    shutil.copyfile(src, dst)
                    try: os.remove(src)
                    except: pass
                    return
                except:
                    raise e
            time.sleep(delay)

def run_logueo_audit_pipeline(file_path: str, lgg_sheet: str, est_sheet: str, audit_id: str, formato: str = "auto"):
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    
    start_time = time.time()
    t_str = lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print(f"[*] [{t_str()}] Inicio de validación geotécnica física y cruzada para el reporte {audit_id}", flush=True)
    print(f"[*] [{t_str()}] Hojas de trabajo: LGG='{lgg_sheet}', Estructural='{est_sheet}', Formato='{formato}'", flush=True)
    
    print(f"[*] [{t_str()}] Leyendo y cruzando datos de Excel...", flush=True)
    validate_logueo_bulk_sheets(file_path, lgg_sheet, est_sheet, raw_json_out, formato=formato)
    
    elapsed_val = round(time.time() - start_time, 2)
    print(f"[+] [{t_str()}] Finalización de validación y guardado de JSON diagnóstico en ({elapsed_val}s)", flush=True)
    
    shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))
    
    print(f"[*] [{t_str()}] Inicio de compilación de KPIs y compactado del reporte para {audit_id}", flush=True)
    with open(raw_json_out, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    compact = {k: v for k, v in diag.items() if k != "incidencias"}
    incidencias = diag.get("incidencias", [])
    total_filas = diag.get("total_filas_procesadas", 0)
    
    resumen_celdas = diag.get("resumen_por_celda_padre", {})
    num_celdas_padre = len(resumen_celdas)
    promedio_hijas = sum(x["total_hijas"] for x in resumen_celdas.values()) / max(1, num_celdas_padre)
    total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())
    
    total_fields = total_filas * 20
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
    total_sin_informacion = sum(1 for i in incidencias if i.get("tipo_incidencia") == "SIN_INFORMACION")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = max(0, total_fields - (total_vacios + total_sin_informacion + total_advertencias + total_alertas))
    
    row_errors = defaultdict(set)
    for i in incidencias:
        row_errors[f"{i['modulo']}_{i['fila_excel']}"].add(i["tipo_incidencia"])
        
    discs_con_alerta = sum(1 for row, errs in row_errors.items() if "ALERTA" in errs)
    discs_con_advertencia = sum(1 for row, errs in row_errors.items() if "ADVERTENCIA" in errs and "ALERTA" not in errs)
    discs_con_vacio = sum(1 for row, errs in row_errors.items() if "VACIO" in errs or "SIN_INFORMACION" in errs)
    discs_correctas = max(0, total_filas - len(row_errors))
    
    camp_stats = defaultdict(lambda: {"vacios": 0, "sin_informacion": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    geo_stats = defaultdict(lambda: {"vacios": 0, "sin_informacion": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    sector_stats = defaultdict(lambda: {"vacios": 0, "sin_informacion": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    
    observaciones_por_año = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
    top_stations_por_año = defaultdict(lambda: defaultdict(lambda: Counter()))
    
    for i in incidencias:
        c = i.get("campania", "N/A")
        if c == "N/A": continue
        obs_key = simplify_message(i.get("mensaje", ""))
        celda = i.get("celda_padre", "N/A")
        
        observaciones_por_año[c][obs_key]["incidents"] += 1
        observaciones_por_año[c][obs_key]["stations"].add(celda)
        top_stations_por_año[c][obs_key][celda] += 1
        
        camp_stats[c]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
        geo_stats[g := i.get("geotecnico", "N/A")]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
        sector_stats[s := i.get("sector_geotecnico", "N/A")]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
        
        tipo = i.get("tipo_incidencia")
        if tipo == "VACIO":
            camp_stats[c]["vacios"] += 1
            geo_stats[g]["vacios"] += 1
            sector_stats[s]["vacios"] += 1
        elif tipo == "SIN_INFORMACION":
            camp_stats[c]["sin_informacion"] += 1
            geo_stats[g]["sin_informacion"] += 1
            sector_stats[s]["sin_informacion"] += 1
        elif tipo == "ADVERTENCIA":
            camp_stats[c]["advertencias"] += 1
            geo_stats[g]["advertencias"] += 1
            sector_stats[s]["advertencias"] += 1
        elif tipo == "ALERTA":
            camp_stats[c]["alertas"] += 1
            geo_stats[g]["alertas"] += 1
            sector_stats[s]["alertas"] += 1
            
    consolidado_tabla = {}
    for year, types in observaciones_por_año.items():
        consolidado_tabla[year] = {}
        total_inc_año = sum(v["incidents"] for k, v in types.items())
        severity = "LEVE" if total_inc_año < 50 else ("MODERADO" if total_inc_año < 250 else "CRÍTICO")
        consolidado_tabla[year]["severity"] = severity
        consolidado_tabla[year]["total_incidents"] = total_inc_año
        
        for obs_key, stats in types.items():
            worst = [{"celda": k, "count": v} for k, v in top_stations_por_año[year][obs_key].most_common(3)]
            consolidado_tabla[year][obs_key] = {
                "incidents": stats["incidents"],
                "affected_stations": len(stats["stations"]),
                "top_stations": worst
            }
            
    distribucion_campania = []
    for c, stats in camp_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 20
        distribucion_campania.append({
            "campania": c, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_geotecnico = []
    for g, stats in geo_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 20
        distribucion_geotecnico.append({
            "geotecnico": g, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_sector = []
    for s, stats in sector_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 20
        distribucion_sector.append({
            "sector": s, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    msg_alertas = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") in ["ADVERTENCIA", "VACIO", "SIN_INFORMACION"])
    
    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias + total_vacios + total_sin_informacion)) * 100} for k, v in msg_advertencias.most_common()]
    
    compact["audit_id"] = audit_id
    compact["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    compact["nombre_archivo"] = os.path.basename(file_path)
    compact["consolidado_observaciones"] = consolidado_tabla
    
    compact["familia1"] = {
        "num_celdas_padre": num_celdas_padre,
        "promedio_hijas": round(promedio_hijas, 2),
        "total_discontinuidades": total_filas,
        "total_metros": round(total_metros, 2)
    }
    compact["familia2"] = {"total_fields": total_fields, "total_vacios": total_vacios, "total_sin_informacion": total_sin_informacion, "total_advertencias": total_advertencias, "total_alertas": total_alertas, "total_correctos": total_correctos}
    compact["familia3"] = {"total_discontinuidades": total_filas, "discontinuidades_alertas": discs_con_alerta, "discontinuidades_advertencias": discs_con_advertencia, "discontinuidades_vacios": discs_con_vacio, "discontinuidades_correctas": discs_correctas}
    compact["distribucion_campania"] = distribucion_campania
    compact["distribucion_sector"] = distribucion_sector
    compact["distribucion_geotecnico"] = distribucion_geotecnico
    compact["top_5_alertas"] = top_5_alertas
    compact["error_types_detailed"] = {"alertas": lista_alertas, "advertencias": lista_advertencias}
    
    sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
    compact["worst_cells"] = [{"celda": k, **v} for k, v in sorted_worst]
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    compact["top_column_errors"] = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]
    
    # Guardar compact JSON
    compact_json_tmp = compact_json_out + ".tmp"
    with open(compact_json_tmp, "w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False)
    safe_replace(compact_json_tmp, compact_json_out)
    
    # Copiar resumen público
    public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
    public_compact_tmp = public_compact + ".tmp"
    shutil.copyfile(compact_json_out, public_compact_tmp)
    safe_replace(public_compact_tmp, public_compact)

    print(f"[+] [{t_str()}] Finalización de compactado y guardado del resumen JSON en {compact_json_out}", flush=True)

    # 3. Pre-generar Reporte Excel en segundo plano
    print(f"[*] [{t_str()}] Inicio de pre-generación del libro Excel para {audit_id}", flush=True)
    excel_start = time.time()
    try:
        wb_rep = generar_excel_reporte_core(diag, compact, incidencias)
        rep_tmp = excel_pregenerated_out + ".tmp"
        wb_rep.save(rep_tmp)
        safe_replace(rep_tmp, excel_pregenerated_out)
        
        # Copiar reporte público
        public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
        public_excel_tmp = public_excel + ".tmp"
        shutil.copyfile(excel_pregenerated_out, public_excel_tmp)
        safe_replace(public_excel_tmp, public_excel)
        elapsed_excel = round(time.time() - excel_start, 2)
        print(f"[+] [{t_str()}] Libro Excel generado y guardado en disco con éxito ({elapsed_excel}s)", flush=True)
    except Exception as e:
        print(f"[-] [{t_str()}] Error al pre-generar Excel de Logueo: {e}", flush=True)

# --- API ENDPOINTS ---

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
            try: os.remove(file_path)
            except: pass
        raise HTTPException(status_code=500, detail=f"Error leyendo el archivo Excel: {str(e)}")
    finally:
        if wb:
            try: wb.close()
            except: pass

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
            except:
                pass
    return sorted(audits, key=lambda x: x["fecha"], reverse=True)

def _is_year_match(val: Any, target_years: list) -> bool:
    if val is None:
        return False
    s = str(val).strip()
    if s in target_years:
        return True
    try:
        f = float(s)
        if str(int(round(f))) in target_years:
            return True
    except (ValueError, TypeError):
        pass
    return False


@router.get("/logueo/resumen-ligero")
def obtener_resumen_ligero(audit_id: str = None, years: str = None):
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

    with open(raw_file, "r", encoding="utf-8") as f:
        diag = json.load(f)

    if diag.get("status") == "error":
        return diag
        
    incidencias = diag.get("incidencias", [])
    
    if years and years not in ("TODOS", "TODAS", "ALL", ""):
        years_list = [y.strip() for y in years.split(",") if y.strip()]
        incidencias = [i for i in incidencias if _is_year_match(i.get("campania"), years_list)]
        resumen_celdas_raw = diag.get("resumen_por_celda_padre", {})
        resumen_celdas = {k: v for k, v in resumen_celdas_raw.items() if _is_year_match(v.get("campania"), years_list)}
        total_filas = sum(safe_int(diag.get("distribucion_filas_campana", {}).get(y, 0)) for y in years_list)
        if total_filas == 0 and incidencias:
            total_filas = len(set(f"{i.get('modulo', '')}_{i.get('fila_excel', '')}" for i in incidencias))
    else:
        resumen_celdas = diag.get("resumen_por_celda_padre", {})
        total_filas = diag.get("total_filas_procesadas", 0)

    num_celdas_padre = len(resumen_celdas)
    promedio_hijas = sum(x["total_hijas"] for x in resumen_celdas.values()) / max(1, num_celdas_padre)
    total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())
    
    total_fields = total_filas * 20
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = total_fields - (total_vacios + total_advertencias + total_alertas)
    
    row_errors = defaultdict(set)
    for i in incidencias:
        row_errors[f"{i['modulo']}_{i['fila_excel']}"].add(i["tipo_incidencia"])
        
    discs_con_alerta = sum(1 for row, errs in row_errors.items() if "ALERTA" in errs)
    discs_con_advertencia = sum(1 for row, errs in row_errors.items() if "ADVERTENCIA" in errs and "ALERTA" not in errs)
    discs_con_vacio = sum(1 for row, errs in row_errors.items() if "VACIO" in errs)
    discs_correctas = total_filas - len(row_errors)
    
    camp_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    geo_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    sector_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
    
    observaciones_por_año = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
    top_stations_por_año = defaultdict(lambda: defaultdict(lambda: Counter()))
    
    for i in incidencias:
        c = i.get("campania", "N/A")
        obs_key = simplify_message(i.get("mensaje", ""))
        celda = i.get("celda_padre", "N/A")
        
        observaciones_por_año[c][obs_key]["incidents"] += 1
        observaciones_por_año[c][obs_key]["stations"].add(celda)
        top_stations_por_año[c][obs_key][celda] += 1
        
        camp_stats[c]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
        geo_stats[i.get("geotecnico", "N/A")]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
        sector_stats[i.get("sector_geotecnico", "N/A")]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
        
        tipo = i.get("tipo_incidencia")
        if tipo == "VACIO":
            camp_stats[c]["vacios"] += 1
            geo_stats[i.get("geotecnico", "N/A")]["vacios"] += 1
            sector_stats[i.get("sector_geotecnico", "N/A")]["vacios"] += 1
        elif tipo == "ADVERTENCIA":
            camp_stats[c]["advertencias"] += 1
            geo_stats[i.get("geotecnico", "N/A")]["advertencias"] += 1
            sector_stats[i.get("sector_geotecnico", "N/A")]["advertencias"] += 1
        elif tipo == "ALERTA":
            camp_stats[c]["alertas"] += 1
            geo_stats[i.get("geotecnico", "N/A")]["alertas"] += 1
            sector_stats[i.get("sector_geotecnico", "N/A")]["alertas"] += 1
            
    consolidado_tabla = {}
    for year, types in observaciones_por_año.items():
        consolidado_tabla[year] = {}
        total_inc_año = sum(v["incidents"] for k, v in types.items())
        severity = "LEVE" if total_inc_año < 50 else ("MODERADO" if total_inc_año < 250 else "CRÍTICO")
        consolidado_tabla[year]["severity"] = severity
        consolidado_tabla[year]["total_incidents"] = total_inc_año
        for obs_key, stats in types.items():
            worst = [{"celda": k, "count": v} for k, v in top_stations_por_año[year][obs_key].most_common(3)]
            consolidado_tabla[year][obs_key] = {
                "incidents": stats["incidents"],
                "affected_stations": len(stats["stations"]),
                "top_stations": worst
            }
            
    distribucion_campania = []
    for c, stats in camp_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 20
        distribucion_campania.append({
            "campania": c, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_geotecnico = []
    for g, stats in geo_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 20
        distribucion_geotecnico.append({
            "geotecnico": g, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    distribucion_sector = []
    for s, stats in sector_stats.items():
        rows_count = len(stats["filas"])
        total_fields_group = rows_count * 20
        distribucion_sector.append({
            "sector": s, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
            "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
            "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
            "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
        })
        
    msg_alertas = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    msg_advertencias = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    
    top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
    lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
    lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common()]
    
    res_compact = {
        "audit_id": audit_id or "default",
        "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "nombre_archivo": os.path.basename(raw_file),
        "available_years": sorted([str(k) for k in diag.get("distribucion_filas_campana", {}).keys() if str(k) not in ("N/A", "")]),
        "consolidado_observaciones": consolidado_tabla,
        "resumen_por_celda_padre": resumen_celdas,
        "familia1": {
            "num_celdas_padre": num_celdas_padre,
            "promedio_hijas": round(promedio_hijas, 2),
            "total_discontinuidades": total_filas,
            "total_metros": round(total_metros, 2)
        },
        "familia2": {"total_fields": total_fields, "total_vacios": total_vacios, "total_advertencias": total_advertencias, "total_alertas": total_alertas, "total_correctos": total_correctos},
        "familia3": {"total_discontinuidades": total_filas, "discontinuidades_alertas": discs_con_alerta, "discontinuidades_advertencias": discs_con_advertencia, "discontinuidades_vacios": discs_con_vacio, "discontinuidades_correctas": discs_correctas},
        "distribucion_campania": distribucion_campania,
        "distribucion_sector": distribucion_sector,
        "distribucion_geotecnico": distribucion_geotecnico,
        "top_5_alertas": top_5_alertas,
        "error_types_detailed": {"alertas": lista_alertas, "advertencias": lista_advertencias}
    }
    
    sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
    res_compact["worst_cells"] = [{"celda": k, **v} for k, v in sorted_worst]
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    res_compact["top_column_errors"] = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]
    
    return res_compact

@router.get("/logueo/incidencias-paginadas")
def obtener_incidencias_paginadas(
    page: int = 1, limit: int = 50, tipo: str = None, celda: str = None, columna: str = None,
    campania: str = None, geotecnico: str = None, search: str = None, audit_id: str = None
):
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
        incidencias = [i for i in incidencias if _is_year_match(i.get("campania"), c_list)]
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

def run_revision_audit_pipeline(file_paths: dict, config: dict, audit_id: str, original_filename: str):
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    
    start_time = time.time()
    t_str = lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        print(f"[*] [{t_str()}] Inicio de revisión geotécnica cruzada (V2) para el reporte {audit_id}", flush=True)
        
        validate_revision_bulk_v2(file_paths, config, raw_json_out)
        
        elapsed_val = round(time.time() - start_time, 2)
        print(f"[+] [{t_str()}] Finalización de validación y guardado de JSON diagnóstico en ({elapsed_val}s)", flush=True)
        
        shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))
        
        print(f"[*] [{t_str()}] Inicio de compilación de KPIs y compactado del reporte para {audit_id}", flush=True)
        
        with open(raw_json_out, "r", encoding="utf-8") as f:
            diag = json.load(f)
            
        compact = {k: v for k, v in diag.items() if k != "incidencias"}
        incidencias = diag.get("incidencias", [])
        total_filas = diag.get("total_filas_procesadas", 0)
        
        resumen_celdas = diag.get("resumen_por_celda_padre", {})
        num_celdas_padre = len(resumen_celdas)
        promedio_hijas = sum(x["total_hijas"] for x in resumen_celdas.values()) / max(1, num_celdas_padre)
        total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())
        
        total_fields = total_filas * 20
        total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
        total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
        total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
        total_correctos = total_fields - (total_vacios + total_advertencias + total_alertas)
        
        row_errors = defaultdict(set)
        for i in incidencias:
            row_errors[f"{i['modulo']}_{i['fila_excel']}"].add(i["tipo_incidencia"])
            
        discs_con_alerta = sum(1 for row, errs in row_errors.items() if "ALERTA" in errs)
        discs_con_advertencia = sum(1 for row, errs in row_errors.items() if "ADVERTENCIA" in errs and "ALERTA" not in errs)
        discs_con_vacio = sum(1 for row, errs in row_errors.items() if "VACIO" in errs)
        discs_correctas = total_filas - len(row_errors)
        
        camp_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
        geo_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
        sector_stats = defaultdict(lambda: {"vacios": 0, "advertencias": 0, "alertas": 0, "filas": set()})
        
        observaciones_por_año = defaultdict(lambda: defaultdict(lambda: {"incidents": 0, "stations": set()}))
        top_stations_por_año = defaultdict(lambda: defaultdict(lambda: Counter()))
        
        for i in incidencias:
            c = i.get("campania", "N/A")
            if c == "N/A": continue
            obs_key = simplify_message(i.get("mensaje", ""))
            celda = i.get("celda_padre", "N/A")
            
            observaciones_por_año[c][obs_key]["incidents"] += 1
            observaciones_por_año[c][obs_key]["stations"].add(celda)
            top_stations_por_año[c][obs_key][celda] += 1
            
            camp_stats[c]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
            geo_stats[g := i.get("geotecnico", "N/A")]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
            sector_stats[s := i.get("sector_geotecnico", "N/A")]["filas"].add(f"{i['modulo']}_{i['fila_excel']}")
            
            tipo = i.get("tipo_incidencia")
            if tipo == "VACIO":
                camp_stats[c]["vacios"] += 1
                geo_stats[g]["vacios"] += 1
                sector_stats[s]["vacios"] += 1
            elif tipo == "ADVERTENCIA":
                camp_stats[c]["advertencias"] += 1
                geo_stats[g]["advertencias"] += 1
                sector_stats[s]["advertencias"] += 1
            elif tipo == "ALERTA":
                camp_stats[c]["alertas"] += 1
                geo_stats[g]["alertas"] += 1
                sector_stats[s]["alertas"] += 1
                
        consolidado_tabla = {}
        for year, types in observaciones_por_año.items():
            consolidado_tabla[year] = {}
            total_inc_año = sum(v["incidents"] for k, v in types.items())
            severity = "LEVE" if total_inc_año < 50 else ("MODERADO" if total_inc_año < 250 else "CRÍTICO")
            consolidado_tabla[year]["severity"] = severity
            consolidado_tabla[year]["total_incidents"] = total_inc_año
            
            for obs_key, stats in types.items():
                worst = [{"celda": k, "count": v} for k, v in top_stations_por_año[year][obs_key].most_common(3)]
                consolidado_tabla[year][obs_key] = {
                    "incidents": stats["incidents"],
                    "affected_stations": len(stats["stations"]),
                    "top_stations": worst
                }
                
        distribucion_campania = []
        for c, stats in camp_stats.items():
            rows_count = len(stats["filas"])
            total_fields_group = rows_count * 20
            distribucion_campania.append({
                "campania": c, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
                "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
                "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
                "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
            })
            
        distribucion_geotecnico = []
        for g, stats in geo_stats.items():
            rows_count = len(stats["filas"])
            total_fields_group = rows_count * 20
            distribucion_geotecnico.append({
                "geotecnico": g, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
                "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
                "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
                "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
            })
            
        distribucion_sector = []
        for s, stats in sector_stats.items():
            rows_count = len(stats["filas"])
            total_fields_group = rows_count * 20
            distribucion_sector.append({
                "sector": s, "discontinuidades": rows_count, "vacios_cant": stats["vacios"],
                "vacios_pct": (stats["vacios"] / max(1, total_fields_group)) * 100,
                "advertencias_cant": stats["advertencias"], "advertencias_pct": (stats["advertencias"] / max(1, total_fields_group)) * 100,
                "alertas_cant": stats["alertas"], "alertas_pct": (stats["alertas"] / max(1, total_fields_group)) * 100
            })
            
        msg_alertas = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
        msg_advertencias = Counter(simplify_message(i.get("mensaje")) for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
        
        top_5_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common(5)]
        lista_alertas = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_alertas)) * 100} for k, v in msg_alertas.most_common()]
        lista_advertencias = [{"mensaje": k, "cantidad": v, "pct": (v / max(1, total_advertencias)) * 100} for k, v in msg_advertencias.most_common()]
        
        compact["audit_id"] = audit_id
        compact["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        compact["nombre_archivo"] = original_filename
        compact["available_years"] = sorted([str(k) for k in diag.get("distribucion_filas_campana", {}).keys() if str(k) not in ("N/A", "")])
        compact["consolidado_observaciones"] = consolidado_tabla
        
        compact["familia1"] = {
            "num_celdas_padre": num_celdas_padre,
            "promedio_hijas": round(promedio_hijas, 2),
            "total_discontinuidades": total_filas,
            "total_metros": round(total_metros, 2)
        }
        compact["familia2"] = {"total_fields": total_fields, "total_vacios": total_vacios, "total_advertencias": total_advertencias, "total_alertas": total_alertas, "total_correctos": total_correctos}
        compact["familia3"] = {"total_discontinuidades": total_filas, "discontinuidades_alertas": discs_con_alerta, "discontinuidades_advertencias": discs_con_advertencia, "discontinuidades_vacios": discs_con_vacio, "discontinuidades_correctas": discs_correctas}
        compact["distribucion_campania"] = distribucion_campania
        compact["distribucion_sector"] = distribucion_sector
        compact["distribucion_geotecnico"] = distribucion_geotecnico
        compact["top_5_alertas"] = top_5_alertas
        compact["error_types_detailed"] = {"alertas": lista_alertas, "advertencias": lista_advertencias}
        
        sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
        compact["worst_cells"] = [{"celda": k, **v} for k, v in sorted_worst]
        col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
        compact["top_column_errors"] = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]
        
        compact_json_tmp = compact_json_out + ".tmp"
        with open(compact_json_tmp, "w", encoding="utf-8") as f:
            json.dump(compact, f, ensure_ascii=False)
        safe_replace(compact_json_tmp, compact_json_out)
        
        public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
        public_compact_tmp = public_compact + ".tmp"
        shutil.copyfile(compact_json_out, public_compact_tmp)
        safe_replace(public_compact_tmp, public_compact)

        print(f"[+] [{t_str()}] Finalización de compactado y guardado del resumen JSON en {compact_json_out}", flush=True)

        print(f"[*] [{t_str()}] Inicio de pre-generación del libro Excel para {audit_id}", flush=True)
        excel_start = time.time()
        wb_rep = generar_excel_reporte_core(diag, compact, incidencias)
        rep_tmp = excel_pregenerated_out + ".tmp"
        wb_rep.save(rep_tmp)
        safe_replace(rep_tmp, excel_pregenerated_out)
        
        public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
        public_excel_tmp = public_excel + ".tmp"
        shutil.copyfile(excel_pregenerated_out, public_excel_tmp)
        safe_replace(public_excel_tmp, public_excel)
        elapsed_excel = round(time.time() - excel_start, 2)
        print(f"[+] [{t_str()}] Libro Excel generado y guardado en disco con éxito ({elapsed_excel}s)", flush=True)

    except Exception as ex:
        import traceback
        error_msg = f"Error crítico en pipeline de auditoría: {str(ex)}\n{traceback.format_exc()}"
        print(error_msg, flush=True)
        
        error_diag = {
            "total_filas_procesadas": 0,
            "incidencias": [],
            "resumen_por_celda_padre": {},
            "status": "error",
            "message": "Fallo inesperado durante la lectura del Excel. Asegúrese de que el formato coincida con el estándar.",
            "error_detail": str(ex)
        }
        with open(raw_json_out, "w", encoding="utf-8") as f:
            json.dump(error_diag, f, ensure_ascii=False)

        error_compact = {
            "audit_id": audit_id,
            "status": "error",
            "message": "Fallo inesperado durante la lectura del Excel. Asegúrese de que el formato coincida con el estándar.",
            "error_detail": str(ex),
            "nombre_archivo": original_filename,
            "fecha_auditoria": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        with open(compact_json_out, "w", encoding="utf-8") as f:
            json.dump(error_compact, f, ensure_ascii=False)
