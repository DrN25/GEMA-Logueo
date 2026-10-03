"""
app.core.adapters.excel.rmr_reader
Extractor y adaptador de datos de la hoja Validación RMR en libros Excel Openpyxl.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple, Set
from app.core.report_config import CAMPOS_EXTRA_A_CAPTURAR
from app.core.engine.rules.common import sanitize_val, safe_str, safe_int
from app.core.adapters.excel.patterns import RMR_PATTERNS, FALLBACK_RMR_MAP
from app.core.adapters.excel.helpers import (
    find_header_row_and_mapping, get_row_dict, capturar_faltantes_extra, FaltantesCollector
)


def read_rmr_sheet(
    ws_rmr,
    resumen_celdas: Optional[Dict[str, Any]] = None,
    collector: Optional[FaltantesCollector] = None,
    custom_map: Optional[Dict[str, int]] = None
) -> Tuple[int, List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]], Dict[str, int], float, float]:
    """
    Escanea la hoja Validación_RMR desde Openpyxl, limpia celdas y genera la lista de registros RMR estructurados.
    Retorna: (total_rmr_filas, all_rmr_runs, rmr_by_taladro, rmr_map, dry_thresh, nf_thresh)
    """
    h_idx, rmr_map = find_header_row_and_mapping(ws_rmr, RMR_PATTERNS)
    if not (("sondaje" in rmr_map or "taladro" in rmr_map) and ("de" in rmr_map or "a" in rmr_map)):
        return 0, [], {}, {}, 75.0, 80.0

    for k, v in FALLBACK_RMR_MAP.items():
        if k not in rmr_map:
            rmr_map[k] = v
    if custom_map:
        for k, v in custom_map.items():
            if v is not None and isinstance(v, int) and v >= 0:
                rmr_map[k] = v + 1

    rmr_extra = list(CAMPOS_EXTRA_A_CAPTURAR.get("Validación RMR", []))

    rmr_by_taladro = defaultdict(list)
    all_rmr_runs = []
    empty_streak = 0
    current_taladro = None
    total_rmr_filas = 0

    dry_thresh = 75.0
    nf_thresh = 80.0
    wb_parent = getattr(ws_rmr, "parent", None)
    if wb_parent:
        for sname in wb_parent.sheetnames:
            if "DATOS" in sname.upper() and "LG" in sname.upper():
                try:
                    ws_datos = wb_parent[sname]
                    for r_chk in ws_datos.iter_rows(max_row=15, values_only=True):
                        for c_i, val_c in enumerate(r_chk):
                            t_u = str(val_c or "").strip().upper()
                            if t_u in ("SECO", "SECO:"):
                                for c_val in r_chk[c_i+1:c_i+5]:
                                    try:
                                        f_val = float(c_val)
                                        if 0 < f_val < 500:
                                            dry_thresh = f_val
                                            break
                                    except (ValueError, TypeError):
                                        pass
                            if t_u in ("HÚMEDO", "HUMEDO", "HÚMEDO:", "HUMEDO:"):
                                for c_val in r_chk[c_i+1:c_i+5]:
                                    try:
                                        f_val = float(c_val)
                                        if 0 < f_val < 500:
                                            nf_thresh = f_val
                                            break
                                    except (ValueError, TypeError):
                                        pass
                except Exception:
                    pass
                break

    for r in range(h_idx + 1, ws_rmr.max_row + 1):
        row_dict, is_empty = get_row_dict(ws_rmr, r, rmr_map)

        t_val = row_dict.get("sondaje") or row_dict.get("taladro")
        if t_val is not None and str(t_val).strip() != "":
            current_taladro = safe_str(t_val)
        else:
            row_dict["sondaje"] = current_taladro

        if is_empty:
            empty_streak += 1
            if empty_streak >= 20:
                break
            continue

        if not current_taladro:
            continue

        empty_streak = 0
        total_rmr_filas += 1
        taladro = current_taladro
        corrida_num = safe_int(row_dict.get("corrida", 0))
        celda_padre = taladro
        celda_hija = f"{taladro}-RMR{corrida_num if corrida_num > 0 else r}"

        if isinstance(resumen_celdas, dict):
            if celda_padre not in resumen_celdas:
                resumen_celdas[celda_padre] = {
                    "total_hijas": 0, "vacios": 0, "sin_informacion": 0,
                    "advertencias": 0, "alertas": 0, "estado_celda": "OK",
                    "dist_celda": 0.0, "campania": "N/A"
                }
            resumen_celdas[celda_padre]["total_hijas"] += 1

        row_dict["_fila_excel"] = r
        row_dict["_celda_padre"] = celda_padre
        row_dict["_celda_hija"] = celda_hija

        # Sanitizar campos numéricos
        for k in [
            "de", "a", "long_corrida", "rec_m", "rec_pct", "rqd_m", "rqd_pct", "lrf_m",
            "total_frac", "ff_1m", "espaciamiento_mm", "abertura_mm", "espesor_relleno",
            "rmr76", "r76_resistencia", "r76_rqd", "r76_espaciamiento", "r76_juntas",
            "r76_agua", "rmr89", "r89_resistencia", "r89_rqd", "r89_espaciamiento",
            "r89_juntas", "r89_agua"
        ]:
            if k in row_dict:
                row_dict[k] = sanitize_val(row_dict[k], float)
        for k in ["corrida", "frf", "frac_nat", "clasificacion_relleno", "jrc10"]:
            if k in row_dict:
                row_dict[k] = sanitize_val(row_dict[k], int)

        capturar_faltantes_extra(
            collector, "Validación RMR", row_dict, rmr_extra, r,
            celda_padre, celda_hija, row_dict.get("campana"), row_dict.get("logueador")
        )

        all_rmr_runs.append(row_dict)
        rmr_by_taladro[taladro].append(row_dict)

    return total_rmr_filas, all_rmr_runs, rmr_by_taladro, rmr_map, dry_thresh, nf_thresh
