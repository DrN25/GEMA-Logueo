"""
app.validator
Orquestador central del pipeline de validación y auditoría geomecánica DDH y PLT.
Arquitectura Limpia desacoplada: delega I/O a app.core.adapters.excel y lógica de negocio a app.core.engine.rules.
"""

import os
import json
import math
import openpyxl
from collections import defaultdict
from typing import List, Dict, Any, Optional

from app.core.rules import WEATHERING_COMPATIBILITY, MASTER_ERROR_RULES
from app.core.report_config import CAMPOS_EXTRA_A_CAPTURAR
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext
from app.core.engine.rules.common import (
    safe_float, safe_int, safe_str, sanitize_val, get_canonical_value,
    VALID_STRUCTURES, VALID_STRENGTHS, VALID_RUGOSITY, VALID_WEATHERING,
    VALID_RELLENO, VALID_AGUA, VALID_FORMA, VALID_ORIENTACION, VALID_TURNOS
)
from app.core.engine.rules.lgg_rules import (
    LGG_MandatoryFieldsRule, LGG_CatalogsAndFormatsRule, LGG_PhysicalAndGeometricRule,
    LGG_FracturesAndFRFRule, LGG_GeomechanicalCompatibilityRule
)
from app.core.engine.rules.est_rules import (
    Estructural_MandatoryFieldsRule, Estructural_GeometryAndAnglesRule,
    Estructural_SpatialContainmentRule, Estructural_CrossCheckWithLGGRule
)
from app.core.engine.rules.rmr_rules import (
    RMR_MandatoryFieldsRule, RMR_CrossCheckWithLGGRule, RMR_FormulasAndRatingsRule
)
from app.core.engine.rules.eoh_rules import CrossModule_EOHRule

from app.core.adapters.excel import (
    LGG_PATTERNS, EST_PATTERNS, RMR_PATTERNS, COLLAR_PATTERNS, SURVEY_PATTERNS,
    FALLBACK_LGG_MAP, FALLBACK_LGG_MAP_2026, FALLBACK_EST_MAP, FALLBACK_EST_MAP_2026, FALLBACK_RMR_MAP,
    normalize_text, get_sheet_safe, find_header_row_and_mapping, get_row_dict,
    FaltantesCollector, capturar_faltantes_extra, find_rmr_sheet_name,
    read_lgg_sheet, read_est_sheet, read_rmr_sheet, read_collar_sheet, read_survey_sheet
)


def validate_row_qaqc(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """Ejecuta todos los controles de calidad geomecánicos QA/QC en una corrida de LGG en caliente."""
    alerts = []
    try:
        de = float(data.get("de", 0.0))
        a = float(data.get("a", 0.0))
        perf = round(a - de, 2)
        
        rec_val = float(data.get("rec_m", 0.0))
        rec_m = 0.0 if rec_val < 0 else rec_val
        rqd_val = float(data.get("rqd_m", 0.0))
        rqd_m = 0.0 if rqd_val < 0 else rqd_val
        lrf_val = float(data.get("lrf_m", 0.0))
        lrf_m = 0.0 if lrf_val < 0 else lrf_val
        small_val = float(data.get("small_frag_m", 0.0))
        small_frag_m = 0.0 if small_val < 0 else small_val
        
        fn_val = int(data.get("frac_nat", 0))
        frac_nat = 0 if fn_val < 0 else fn_val
        b30_val = int(data.get("frac_buz30", 0))
        buz30 = 0 if b30_val < 0 else b30_val
        buz60_val = int(data.get("frac_buz60", 0))
        buz60 = 0 if buz60_val < 0 else buz60_val
        buz90_val = int(data.get("frac_buz90", 0))
        buz90 = 0 if buz90_val < 0 else buz90_val
        
        resistencia = data.get("resistencia", "R4")
        weathering = data.get("intemperismo", "UWF")
        aperture = float(data.get("abertura", 0.0))
        thickness = float(data.get("espesor", 0.0))
        tipo_est1 = data.get("tipo_est1", "JN")
        tipo_est2 = data.get("tipo_est2", "")

        if perf <= 0:
            alerts.append({"type": "CRITICAL", "field": "a", "message": f"Profundidad final ({a}m) debe ser mayor a la inicial ({de}m)."})
        elif perf > 1.6:
            alerts.append({"type": "CRITICAL", "field": "a", "message": f"La longitud de corrida ({perf}m) excede el límite máximo de perforación de 1.6m."})
        
        if rec_m > perf:
            alerts.append({"type": "CRITICAL", "field": "rec_m", "message": f"Longitud recuperada ({rec_m}m) es físicamente mayor que la perforada ({perf}m)."})
        
        if rqd_m > rec_m:
            alerts.append({"type": "CRITICAL", "field": "rqd_m", "message": f"El metraje de RQD ({rqd_m}m) no puede ser mayor que la longitud recuperada ({rec_m}m)."})
        
        if lrf_m > rec_m:
            alerts.append({"type": "CRITICAL", "field": "lrf_m", "message": f"La longitud de roca fracturada LRF ({lrf_m}m) no puede ser mayor que la longitud recuperada ({rec_m}m)."})
            
        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf:
            alerts.append({"type": "CRITICAL", "field": "rqd_m", "message": f"La suma de fragmentos físicos ({sum_frags}m) supera el avance total de la corrida ({perf}m)."})
            
        sum_bins = buz30 + buz60 + buz90
        if sum_bins != frac_nat:
            alerts.append({"type": "WARNING", "field": "frac_nat", "message": f"La suma de fracturas naturales clasificadas por buzamiento ({sum_bins}) no coincide con el conteo general ({frac_nat})."})
            
        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
        if thickness > aperture and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
            alerts.append({"type": "CRITICAL", "field": "espesor", "message": f"El espesor de relleno ({thickness}mm) no puede ser mayor que la abertura de junta ({aperture}mm) excepto en estructuras F, RF, VN, SZ, F+10 o BED."})

        if thickness > 0 and aperture <= 0:
            alerts.append({"type": "WARNING", "field": "abertura", "message": f"Se ha registrado un espesor de relleno de {thickness}mm, pero la abertura de junta es 0mm."})
        elif thickness == 0 and aperture > 0:
            alerts.append({"type": "WARNING", "field": "espesor", "message": f"La abertura de junta es {aperture}mm, pero no se ha registrado espesor de relleno."})
            
        valid_weatherings = WEATHERING_COMPATIBILITY.get(resistencia)
        if valid_weatherings and weathering not in valid_weatherings:
            alerts.append({"type": "WARNING", "field": "intemperismo", "message": f"Incompatibilidad geológica: Roca con resistencia {resistencia} no puede registrar intemperismo {weathering}. Permitidos: {', '.join(valid_weatherings)}."})
    except Exception as e:
        alerts.append({"type": "CRITICAL", "field": "global", "message": f"Error al procesar reglas de consistencia: {str(e)}"})
    return alerts


def validate_lgg_sheet_data(
    ws_lgg,
    is_2026: bool,
    resumen_celdas: dict,
    incidencias: list,
    l_counters: dict,
    collector: Optional[FaltantesCollector] = None,
    filas_por_campana: Optional[dict] = None,
    filas_por_geotecnico: Optional[dict] = None,
    max_lgg: Optional[dict] = None
):
    """
    Escanea la hoja LGG mediante el adaptador y evalúa las reglas desacopladas de app.core.engine.rules.lgg_rules.
    """
    total_lgg_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, l_map = read_lgg_sheet(
        ws_lgg, is_2026, resumen_celdas, collector=collector,
        filas_por_campana=filas_por_campana, filas_por_geotecnico=filas_por_geotecnico, max_lgg=max_lgg
    )

    ctx = ValidationContext(
        lgg_runs=lgg_runs,
        lgg_by_taladro=lgg_runs_by_taladro,
        is_2026=is_2026,
        metadata={"lgg_columns": set(l_map.keys()), "skip_lgg_max_advance": True}
    )

    rows_with_alert = set()
    lgg_rules = [
        LGG_MandatoryFieldsRule(),
        LGG_CatalogsAndFormatsRule(),
        LGG_PhysicalAndGeometricRule(),
        LGG_FracturesAndFRFRule(),
        LGG_GeomechanicalCompatibilityRule()
    ]

    for rule in lgg_rules:
        for anom in rule.evaluate(ctx):
            incidencias.append({
                "fila_excel": anom.row_excel,
                "celda_padre": anom.celda_padre,
                "celda_hija": anom.celda_hija,
                "columna": anom.columna,
                "valor_actual": anom.valor_actual,
                "tipo_incidencia": anom.severity.value,
                "mensaje": anom.mensaje,
                "campania": safe_str(anom.campania) or "N/A",
                "geotecnico": safe_str(anom.geotecnico) or "N/A",
                "sector_geotecnico": safe_str(anom.sector_geotecnico) or "N/A",
                "modulo": anom.modulo
            })
            sev_val = anom.severity.value
            if sev_val == "VACIO":
                l_counters["total_vacios"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["vacios"] += 1
            elif sev_val == "SIN_INFORMACION":
                l_counters["total_sin_informacion"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre].setdefault("sin_informacion", 0)
                    resumen_celdas[anom.celda_padre]["sin_informacion"] += 1
            elif sev_val == "ADVERTENCIA":
                l_counters["total_advertencias"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["advertencias"] += 1
            elif sev_val == "ALERTA":
                l_counters["total_alertas"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["alertas"] += 1
                if anom.row_excel > 0:
                    rows_with_alert.add(anom.row_excel)

    l_counters["total_ok"] += (total_lgg_filas - len(rows_with_alert))

    unique_lgg_runs = []
    for run in lgg_runs:
        r = run["_fila_excel"]
        has_err = r in rows_with_alert
        de_val = run.get("de")
        a_val = run.get("a")
        c_num = run.get("corrida")
        unique_lgg_runs.append({
            "fila_excel": r,
            "taladro": run.get("taladro"),
            "de": de_val,
            "a": a_val,
            "corrida": f"{de_val:.2f} - {a_val:.2f}" if (de_val is not None and a_val is not None) else f"C{c_num}",
            "longitud": round(a_val - de_val, 2) if (de_val is not None and a_val is not None) else 0.0,
            "rec_m": run.get("rec_m"),
            "rqd_m": run.get("rqd_m"),
            "lito1": run.get("lito1"),
            "lito2": run.get("lito2"),
            "lito3": run.get("lito3"),
            "resistencia": run.get("resistencia"),
            "estado": "NO CONFORME" if has_err else "CONFORME"
        })

    return total_lgg_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, unique_lgg_runs


def validate_est_sheet_data(
    ws_est,
    is_2026: bool,
    lgg_runs: list,
    lgg_runs_by_taladro: dict,
    max_lgg: dict,
    resumen_celdas: dict,
    incidencias: list,
    e_counters: dict,
    collector: Optional[FaltantesCollector] = None,
    max_est: Optional[dict] = None
):
    """
    Escanea la hoja Estructural mediante el adaptador y evalúa las reglas desacopladas de app.core.engine.rules.est_rules.
    """
    total_est_filas, est_structures, est_by_taladro, max_est, e_map = read_est_sheet(
        ws_est, is_2026, resumen_celdas, collector=collector, max_est=max_est
    )

    ctx = ValidationContext(
        lgg_runs=lgg_runs,
        lgg_by_taladro=lgg_runs_by_taladro,
        est_structures=est_structures,
        est_by_taladro=est_by_taladro,
        is_2026=is_2026,
        metadata={"est_columns": set(e_map.keys()), "max_lgg": max_lgg}
    )

    rows_with_alert = set()
    est_rules = [
        Estructural_MandatoryFieldsRule(),
        Estructural_GeometryAndAnglesRule(),
        Estructural_SpatialContainmentRule(),
        Estructural_CrossCheckWithLGGRule()
    ]

    for rule in est_rules:
        for anom in rule.evaluate(ctx):
            incidencias.append({
                "fila_excel": anom.row_excel,
                "celda_padre": anom.celda_padre,
                "celda_hija": anom.celda_hija,
                "columna": anom.columna,
                "valor_actual": anom.valor_actual,
                "tipo_incidencia": anom.severity.value,
                "mensaje": anom.mensaje,
                "campania": safe_str(anom.campania) or "N/A",
                "geotecnico": safe_str(anom.geotecnico) or "N/A",
                "sector_geotecnico": safe_str(anom.sector_geotecnico) or "N/A",
                "modulo": anom.modulo
            })
            sev_val = anom.severity.value
            if sev_val == "VACIO":
                e_counters["total_vacios"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["vacios"] += 1
            elif sev_val == "SIN_INFORMACION":
                e_counters["total_sin_informacion"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre].setdefault("sin_informacion", 0)
                    resumen_celdas[anom.celda_padre]["sin_informacion"] += 1
            elif sev_val == "ADVERTENCIA":
                e_counters["total_advertencias"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["advertencias"] += 1
            elif sev_val == "ALERTA":
                e_counters["total_alertas"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["alertas"] += 1
                if anom.row_excel > 0:
                    rows_with_alert.add(anom.row_excel)

    e_counters["total_ok"] += (total_est_filas - len(rows_with_alert))

    unique_est_structures = []
    for s in est_structures:
        r = s["_fila_excel"]
        has_err = r in rows_with_alert
        est_de = s.get("de")
        est_a = s.get("a")
        unique_est_structures.append({
            "fila_excel": r,
            "taladro": s.get("taladro"),
            "de": est_de,
            "a": est_a,
            "profundidad": s.get("profundidad"),
            "corrida": f"{est_de:.2f} - {est_a:.2f}" if (est_de is not None and est_a is not None) else (f"C{s.get('corrida')}" if s.get("corrida") else "N/A"),
            "tipo_est": s.get("tipo_estructura"),
            "alfa": s.get("alfa"),
            "beta": s.get("beta"),
            "dip": s.get("dip") if not is_2026 else None,
            "azimuth": s.get("azimuth") if not is_2026 else None,
            "abertura": s.get("abertura"),
            "espesor": s.get("espesor"),
            "relleno": s.get("relleno1"),
            "dureza_pared": s.get("dureza_pared"),
            "lito1": s.get("lito1"),
            "lito2": s.get("lito2") if not is_2026 else None,
            "lito3": s.get("lito3") if not is_2026 else None,
            "estado": "NO CONFORME" if has_err else "CONFORME"
        })

    return total_est_filas, unique_est_structures, max_est


def validate_rmr_sheet_data(
    ws_rmr,
    lgg_runs: list,
    resumen_celdas: dict,
    incidencias: list,
    r_counters: dict,
    custom_map: Optional[dict] = None,
    collector: Optional[FaltantesCollector] = None
) -> int:
    """
    Escanea la hoja Validación_RMR mediante el adaptador y evalúa las reglas desacopladas de app.core.engine.rules.rmr_rules.
    """
    total_rmr_filas, all_rmr_runs, rmr_by_taladro, rmr_map, dry_thresh, nf_thresh = read_rmr_sheet(
        ws_rmr, resumen_celdas=resumen_celdas, collector=collector, custom_map=custom_map
    )
    if total_rmr_filas == 0:
        return 0

    ctx = ValidationContext(
        lgg_runs=lgg_runs,
        rmr_runs=all_rmr_runs,
        rmr_by_taladro=rmr_by_taladro,
        metadata={
            "rmr_columns": set(rmr_map.keys()),
            "dry_threshold": dry_thresh,
            "nf_threshold": nf_thresh
        }
    )

    rows_with_alert = set()
    rmr_rules = [
        RMR_MandatoryFieldsRule(),
        RMR_CrossCheckWithLGGRule(),
        RMR_FormulasAndRatingsRule()
    ]

    for rule in rmr_rules:
        for anom in rule.evaluate(ctx):
            incidencias.append({
                "fila_excel": anom.row_excel,
                "celda_padre": anom.celda_padre,
                "celda_hija": anom.celda_hija,
                "columna": anom.columna,
                "valor_actual": anom.valor_actual,
                "tipo_incidencia": anom.severity.value,
                "mensaje": anom.mensaje,
                "campania": safe_str(anom.campania) or "N/A",
                "geotecnico": safe_str(anom.geotecnico) or "N/A",
                "sector_geotecnico": safe_str(anom.sector_geotecnico) or "N/A",
                "modulo": anom.modulo
            })
            sev_val = anom.severity.value
            if sev_val == "VACIO":
                r_counters["total_vacios"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["vacios"] += 1
            elif sev_val == "SIN_INFORMACION":
                r_counters["total_sin_informacion"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre].setdefault("sin_informacion", 0)
                    resumen_celdas[anom.celda_padre]["sin_informacion"] += 1
            elif sev_val == "ADVERTENCIA":
                r_counters["total_advertencias"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["advertencias"] += 1
            elif sev_val == "ALERTA":
                r_counters["total_alertas"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["alertas"] += 1
                if anom.row_excel > 0:
                    rows_with_alert.add(anom.row_excel)

    r_counters["total_ok"] += (total_rmr_filas - len(rows_with_alert))
    return total_rmr_filas


def validate_logueo_bulk_sheets(file_path: str, lgg_sheet: str, est_sheet: str, output_json_path: str, formato: str = "auto"):
    """Función de compatibilidad unificada que delega la ejecución de archivo único al motor V2."""
    file_paths = {"lgg_est": file_path}
    config = {
        "formato": formato,
        "lgg": {"sheet": lgg_sheet},
        "est": {"sheet": est_sheet}
    }
    return validate_revision_bulk_v2(file_paths, config, output_json_path)


def validate_revision_bulk_v2(file_paths: dict, config: dict, output_json_path: str):
    """
    Versión 2.0 desacoplada: coordina la ingesta de archivos Excel (LGG/EST, Collar y Survey)
    y ejecuta el pipeline de validación geomecánica modular.
    """
    import time

    wb_main = openpyxl.load_workbook(file_paths["lgg_est"], data_only=True)
    wb_col = openpyxl.load_workbook(file_paths["collar"], data_only=True) if file_paths.get("collar") else None
    wb_sur = openpyxl.load_workbook(file_paths["survey"], data_only=True) if file_paths.get("survey") else None

    incidencias = []
    lgg_runs = []
    lgg_runs_by_taladro = defaultdict(list)
    unique_lgg_runs = []
    unique_est_structures = []
    total_lgg_filas = 0
    total_est_filas = 0
    total_rmr_filas = 0

    total_vacios = 0
    total_sin_informacion = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0

    resumen_celdas = {}
    filas_por_campana = {}
    filas_por_geotecnico = {}
    collector = FaltantesCollector()

    max_lgg = {}
    max_est = {}

    conf_lgg = config.get("lgg")
    conf_est = config.get("est")

    # Autodetección de esquema 2026 vs Tradicional
    formato_param = config.get("formato", "auto")
    if formato_param == "2026":
        is_2026 = True
    elif formato_param == "tradicional":
        is_2026 = False
    else:
        is_2026 = False
        if conf_lgg and conf_lgg.get("sheet") in wb_main.sheetnames:
            _, l_map_pre = find_header_row_and_mapping(wb_main[conf_lgg["sheet"]], LGG_PATTERNS)
            if "perf" in l_map_pre or "sum_frags_total" in l_map_pre or "linea_orientacion" in l_map_pre:
                is_2026 = True
        if not is_2026 and conf_est and conf_est.get("sheet") in wb_main.sheetnames:
            _, e_map_pre = find_header_row_and_mapping(wb_main[conf_est["sheet"]], EST_PATTERNS)
            if "corrida_avance" in e_map_pre or ("dip" not in e_map_pre and "azimuth" not in e_map_pre and "alfa" in e_map_pre):
                is_2026 = True

    # 1. PROCESAR HOJA LGG
    ws_lgg = get_sheet_safe(wb_main, conf_lgg.get("sheet") if conf_lgg else None, ["lgg", "general"])
    if ws_lgg:
        l_counters = {"total_ok": 0, "total_vacios": 0, "total_sin_informacion": 0, "total_advertencias": 0, "total_alertas": 0}
        total_lgg_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, unique_lgg_runs = validate_lgg_sheet_data(
            ws_lgg, is_2026, resumen_celdas, incidencias, l_counters, collector=collector,
            filas_por_campana=filas_por_campana, filas_por_geotecnico=filas_por_geotecnico, max_lgg=max_lgg
        )
        total_vacios += l_counters["total_vacios"]
        total_sin_informacion += l_counters["total_sin_informacion"]
        total_advertencias += l_counters["total_advertencias"]
        total_alertas += l_counters["total_alertas"]
        total_ok += l_counters["total_ok"]

    # 2. PROCESAR HOJA ESTRUCTURAL
    ws_est = get_sheet_safe(wb_main, conf_est.get("sheet") if conf_est else None, ["est"])
    if ws_est:
        e_counters = {"total_ok": 0, "total_vacios": 0, "total_sin_informacion": 0, "total_advertencias": 0, "total_alertas": 0}
        total_est_filas, unique_est_structures, max_est = validate_est_sheet_data(
            ws_est, is_2026, lgg_runs, lgg_runs_by_taladro, max_lgg, resumen_celdas, incidencias, e_counters,
            collector=collector, max_est=max_est
        )
        total_vacios += e_counters["total_vacios"]
        total_sin_informacion += e_counters["total_sin_informacion"]
        total_advertencias += e_counters["total_advertencias"]
        total_alertas += e_counters["total_alertas"]
        total_ok += e_counters["total_ok"]

    # 3. PROCESAR HOJA RMR
    conf_rmr = config.get("rmr")
    rmr_hint = conf_rmr.get("sheet") if conf_rmr else None
    ws_rmr = get_sheet_safe(wb_main, rmr_hint, ["rmr", "validacion"]) if (rmr_hint or find_rmr_sheet_name(wb_main.sheetnames)) else None
    if ws_rmr:
        custom_rmr_map = conf_rmr.get("mappings") if conf_rmr else None
        r_counters = {"total_ok": 0, "total_vacios": 0, "total_sin_informacion": 0, "total_advertencias": 0, "total_alertas": 0}
        total_rmr_filas = validate_rmr_sheet_data(
            ws_rmr, lgg_runs, resumen_celdas, incidencias, r_counters,
            custom_map=custom_rmr_map, collector=collector
        )
        total_vacios += r_counters["total_vacios"]
        total_sin_informacion += r_counters["total_sin_informacion"]
        total_advertencias += r_counters["total_advertencias"]
        total_alertas += r_counters["total_alertas"]
        total_ok += r_counters["total_ok"]

    # 4. PROCESAR COLLAR Y SURVEY
    eoh_collar = read_collar_sheet(wb_col, config.get("collar"))
    max_survey = read_survey_sheet(wb_sur, config.get("survey"))

    # 5. REGLA DESACOPLADA DE CRUCE CUÁDRUPLE (EOH)
    eoh_ctx = ValidationContext(
        collar_data=eoh_collar,
        survey_data=max_survey,
        metadata={
            "max_lgg": max_lgg,
            "max_est": max_est,
            "has_collar": bool(wb_col),
            "has_survey": bool(wb_sur)
        }
    )
    eoh_rule = CrossModule_EOHRule()
    for anom in eoh_rule.evaluate(eoh_ctx):
        incidencias.append({
            "fila_excel": anom.row_excel,
            "celda_padre": anom.celda_padre,
            "celda_hija": anom.celda_hija,
            "columna": anom.columna,
            "valor_actual": anom.valor_actual,
            "tipo_incidencia": anom.severity.value,
            "mensaje": anom.mensaje,
            "campania": anom.campania,
            "geotecnico": anom.geotecnico,
            "sector_geotecnico": anom.sector_geotecnico,
            "modulo": anom.modulo
        })
        if anom.severity == Severity.ALERTA:
            total_alertas += 1

    # 6. RESOLUCIÓN DE ESTADOS POR CELDA PADRE
    total_celdas_ok = 0
    for c_id, stats in resumen_celdas.items():
        if stats["alertas"] > 0:
            stats["estado_celda"] = "NO CONFORME"
        elif stats["advertencias"] > 0:
            stats["estado_celda"] = "OBSERVADO"
        else:
            stats["estado_celda"] = "OK"
            total_celdas_ok += 1

    total_filas = total_lgg_filas + total_est_filas + total_rmr_filas
    pct_ok = round((total_ok / total_filas) * 100, 2) if total_filas > 0 else 0.0

    diag = {
        "resumen_celdas": resumen_celdas,
        "incidencias": incidencias,
        "faltantes_extra": collector.dump() if collector else [],
        "metricas_globales": {
            "total_ok": total_ok,
            "total_vacios": total_vacios,
            "total_sin_informacion": total_sin_informacion,
            "total_advertencias": total_advertencias,
            "total_alertas": total_alertas,
            "total_celdas_ok": total_celdas_ok,
            "total_celdas": len(resumen_celdas),
            "porcentaje_ok": pct_ok
        },
        "tablas_unicas": {
            "lgg": unique_lgg_runs,
            "est": unique_est_structures
        },
        "distribucion_campana": filas_por_campana,
        "distribucion_geotecnico": filas_por_geotecnico,
        "total_filas_procesadas": total_filas,
        "formato_detectado": "2026" if is_2026 else "tradicional"
    }

    if output_json_path:
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(diag, f, ensure_ascii=False, indent=2)

    return diag
