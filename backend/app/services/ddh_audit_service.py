"""
app.services.ddh_audit_service
Servicio de orquestación de auditoría geomecánica DDH (Logueo General y Estructural).
Maneja la ejecución en background de los pipelines de auditoría y la compilación de métricas compactas/KPIs.
"""

import os
import json
import shutil
import time
from datetime import datetime
from collections import Counter, defaultdict
from typing import Optional, Any, Dict, List

from app.validator import validate_logueo_bulk_sheets, validate_revision_bulk_v2, safe_float, safe_int, safe_str
from app.services.ddh_excel_exporter import generar_excel_reporte_core, simplify_message

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
uploads_dir = os.path.join(BASE_DIR, "uploads")
history_dir = os.path.join(uploads_dir, "history")
temp_dir = os.path.join(uploads_dir, "temp")

os.makedirs(history_dir, exist_ok=True)
os.makedirs(temp_dir, exist_ok=True)


def safe_replace(src: str, dst: str, retries: int = 5, delay: float = 0.2):
    """Reemplaza atómicamente un archivo con reintentos para tolerancia en Windows."""
    for i in range(retries):
        try:
            os.replace(src, dst)
            return
        except (PermissionError, OSError) as e:
            if i == retries - 1:
                try:
                    shutil.copyfile(src, dst)
                    try:
                        os.remove(src)
                    except Exception:
                        pass
                    return
                except Exception:
                    raise e
            time.sleep(delay)


def is_year_match(val: Any, target_years: list) -> bool:
    """Verifica si un valor de año/campaña coincide con la lista objetivo."""
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


def build_ddh_compact_metrics(
    diag: dict,
    audit_id: str = "default",
    file_name: str = "Archivo.xlsx",
    years_filter: Optional[str] = None
) -> dict:
    """
    Construye las métricas compactas y KPIs para el dashboard de auditoría DDH.
    Unifica la consolidación de campañas, sectores, geólogos, familias de calidad y errores recurrentes.
    """
    incidencias = diag.get("incidencias", [])
    resumen_celdas_raw = diag.get("resumen_por_celda_padre") or diag.get("resumen_celdas") or {}
    
    if years_filter and years_filter.strip().upper() not in ("TODOS", "TODAS", "ALL", ""):
        years_list = [y.strip() for y in years_filter.split(",") if y.strip()]
        incidencias = [i for i in incidencias if is_year_match(i.get("campania"), years_list)]
        resumen_celdas = {k: v for k, v in resumen_celdas_raw.items() if is_year_match(v.get("campania"), years_list)}
        total_filas = sum(safe_int(diag.get("distribucion_filas_campana", {}).get(y, 0)) for y in years_list)
        if total_filas == 0 and incidencias:
            total_filas = len(set(f"{i.get('modulo', '')}_{i.get('fila_excel', '')}" for i in incidencias))
    else:
        resumen_celdas = resumen_celdas_raw
        total_filas = diag.get("total_filas_procesadas", 0)
        if total_filas == 0 and resumen_celdas:
            total_filas = sum(x.get("total_hijas", 0) for x in resumen_celdas.values())

    num_celdas_padre = len(resumen_celdas)
    promedio_hijas = sum(x.get("total_hijas", 0) for x in resumen_celdas.values()) / max(1, num_celdas_padre)
    total_metros = sum(safe_float(x.get("dist_celda", 0.0)) for x in resumen_celdas.values())
    
    total_fields = total_filas * 20
    total_vacios = sum(1 for i in incidencias if i.get("tipo_incidencia") == "VACIO")
    total_sin_informacion = sum(1 for i in incidencias if i.get("tipo_incidencia") == "SIN_INFORMACION")
    total_advertencias = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in incidencias if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = max(0, total_fields - (total_vacios + total_sin_informacion + total_advertencias + total_alertas))
    
    row_errors = defaultdict(set)
    for i in incidencias:
        row_errors[f"{i.get('modulo', '')}_{i.get('fila_excel', '')}"].add(i.get("tipo_incidencia"))
        
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
        c = i.get("campania", "N/A") or "N/A"
        obs_key = simplify_message(i.get("mensaje", ""))
        celda = i.get("celda_padre", "N/A")
        
        if c != "N/A":
            observaciones_por_año[c][obs_key]["incidents"] += 1
            observaciones_por_año[c][obs_key]["stations"].add(celda)
            top_stations_por_año[c][obs_key][celda] += 1
            camp_stats[c]["filas"].add(f"{i.get('modulo', '')}_{i.get('fila_excel', '')}")
            
        g = i.get("geotecnico", "N/A") or "N/A"
        s = i.get("sector_geotecnico", "N/A") or "N/A"
        geo_stats[g]["filas"].add(f"{i.get('modulo', '')}_{i.get('fila_excel', '')}")
        sector_stats[s]["filas"].add(f"{i.get('modulo', '')}_{i.get('fila_excel', '')}")
        
        tipo = i.get("tipo_incidencia")
        if tipo == "VACIO":
            if c != "N/A": camp_stats[c]["vacios"] += 1
            geo_stats[g]["vacios"] += 1
            sector_stats[s]["vacios"] += 1
        elif tipo == "SIN_INFORMACION":
            if c != "N/A": camp_stats[c]["sin_informacion"] += 1
            geo_stats[g]["sin_informacion"] += 1
            sector_stats[s]["sin_informacion"] += 1
        elif tipo == "ADVERTENCIA":
            if c != "N/A": camp_stats[c]["advertencias"] += 1
            geo_stats[g]["advertencias"] += 1
            sector_stats[s]["advertencias"] += 1
        elif tipo == "ALERTA":
            if c != "N/A": camp_stats[c]["alertas"] += 1
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
    
    compact = {k: v for k, v in diag.items() if k not in ("incidencias", "tablas_unicas")}
    compact["audit_id"] = audit_id
    compact["fecha_auditoria"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    compact["nombre_archivo"] = os.path.basename(file_name)
    compact["available_years"] = sorted([str(k) for k in diag.get("distribucion_filas_campana", {}).keys() if str(k) not in ("N/A", "")])
    compact["consolidado_observaciones"] = consolidado_tabla
    compact["resumen_por_celda_padre"] = resumen_celdas
    
    compact["familia1"] = {
        "num_celdas_padre": num_celdas_padre,
        "promedio_hijas": round(promedio_hijas, 2),
        "total_discontinuidades": total_filas,
        "total_metros": round(total_metros, 2)
    }
    compact["familia2"] = {
        "total_fields": total_fields,
        "total_vacios": total_vacios,
        "total_sin_informacion": total_sin_informacion,
        "total_advertencias": total_advertencias,
        "total_alertas": total_alertas,
        "total_correctos": total_correctos
    }
    compact["familia3"] = {
        "total_discontinuidades": total_filas,
        "discontinuidades_alertas": discs_con_alerta,
        "discontinuidades_advertencias": discs_con_advertencia,
        "discontinuidades_vacios": discs_con_vacio,
        "discontinuidades_correctas": discs_correctas
    }
    compact["distribucion_campania"] = distribucion_campania
    compact["distribucion_sector"] = distribucion_sector
    compact["distribucion_geotecnico"] = distribucion_geotecnico
    compact["top_5_alertas"] = top_5_alertas
    compact["error_types_detailed"] = {"alertas": lista_alertas, "advertencias": lista_advertencias}
    
    sorted_worst = sorted(resumen_celdas.items(), key=lambda x: (x[1].get("alertas", 0), x[1].get("vacios", 0), x[1].get("advertencias", 0)), reverse=True)[:20]
    compact["worst_cells"] = [{"celda": k, **v} for k, v in sorted_worst]
    col_counter = Counter(i.get("columna", "Desconocido") for i in incidencias)
    compact["top_column_errors"] = [{"columna": k, "cantidad": v} for k, v in col_counter.most_common(15)]
    
    return compact


def pregenerate_ddh_excel(diag: dict, compact: dict, incidencias: list, excel_out_path: str, public_out_path: str):
    """Genera y guarda el libro Excel completo en disco con reemplazo atómico."""
    try:
        t0 = time.time()
        wb_rep = generar_excel_reporte_core(diag, compact, incidencias)
        rep_tmp = excel_out_path + ".tmp"
        wb_rep.save(rep_tmp)
        safe_replace(rep_tmp, excel_out_path)
        
        public_excel_tmp = public_out_path + ".tmp"
        shutil.copyfile(excel_out_path, public_excel_tmp)
        safe_replace(public_excel_tmp, public_out_path)
        elapsed = round(time.time() - t0, 2)
        print(f"[+] [PRE-GENERACIÓN DDH] Libro Excel guardado con éxito ({elapsed}s) -> '{os.path.basename(excel_out_path)}'", flush=True)
    except Exception as e:
        print(f"[-] [ERROR PRE-GENERACIÓN DDH] Error al pre-generar Excel: {e}", flush=True)


def run_logueo_audit_pipeline(file_path: str, lgg_sheet: str, est_sheet: str, audit_id: str, formato: str = "auto"):
    """Pipeline de background para la importación simple/mono-archivo de Logueo."""
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
    public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
    
    start_time = time.time()
    t_str = lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print(f"[*] [{t_str()}] Inicio de validación física y cruzada DDH para el reporte {audit_id}", flush=True)
    validate_logueo_bulk_sheets(file_path, lgg_sheet, est_sheet, raw_json_out, formato=formato)
    print(f"[+] [{t_str()}] Validación y guardado de diagnóstico finalizados ({round(time.time() - start_time, 2)}s)", flush=True)
    
    shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))
    
    with open(raw_json_out, "r", encoding="utf-8") as f:
        diag = json.load(f)
        
    compact = build_ddh_compact_metrics(diag, audit_id=audit_id, file_name=file_path)
    
    compact_tmp = compact_json_out + ".tmp"
    with open(compact_tmp, "w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False)
    safe_replace(compact_tmp, compact_json_out)
    
    pub_compact_tmp = public_compact + ".tmp"
    shutil.copyfile(compact_json_out, pub_compact_tmp)
    safe_replace(pub_compact_tmp, public_compact)

    pregenerate_ddh_excel(diag, compact, diag.get("incidencias", []), excel_pregenerated_out, public_excel)


def run_revision_audit_pipeline(file_paths: dict, config: dict, audit_id: str, original_filename: str):
    """Pipeline de background para la revisión multi-archivo V2 (LGG, Estructural, RMR, Collar, Survey)."""
    raw_json_out = os.path.join(history_dir, f"{audit_id}_diagnostico.json")
    compact_json_out = os.path.join(history_dir, f"{audit_id}_compact.json")
    excel_pregenerated_out = os.path.join(history_dir, f"{audit_id}_reporte_completo.xlsx")
    public_excel = os.path.join(uploads_dir, "reporte_completo_ultimo.xlsx")
    public_compact = os.path.join(uploads_dir, "resumen_geomecanico_ligero.json")
    
    start_time = time.time()
    t_str = lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    try:
        print(f"[*] [{t_str()}] Inicio de revisión geotécnica cruzada (V2) para el reporte {audit_id}", flush=True)
        validate_revision_bulk_v2(file_paths, config, raw_json_out)
        print(f"[+] [{t_str()}] Validación y guardado de diagnóstico finalizados ({round(time.time() - start_time, 2)}s)", flush=True)
        
        shutil.copyfile(raw_json_out, os.path.join(uploads_dir, "diagnostico_geomecanico.json"))
        
        with open(raw_json_out, "r", encoding="utf-8") as f:
            diag = json.load(f)
            
        compact = build_ddh_compact_metrics(diag, audit_id=audit_id, file_name=original_filename)
        
        compact_tmp = compact_json_out + ".tmp"
        with open(compact_tmp, "w", encoding="utf-8") as f:
            json.dump(compact, f, ensure_ascii=False)
        safe_replace(compact_tmp, compact_json_out)
        
        pub_compact_tmp = public_compact + ".tmp"
        shutil.copyfile(compact_json_out, pub_compact_tmp)
        safe_replace(pub_compact_tmp, public_compact)

        pregenerate_ddh_excel(diag, compact, diag.get("incidencias", []), excel_pregenerated_out, public_excel)

    except Exception as ex:
        import traceback
        error_msg = f"Error crítico en pipeline de auditoría DDH: {str(ex)}\n{traceback.format_exc()}"
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
