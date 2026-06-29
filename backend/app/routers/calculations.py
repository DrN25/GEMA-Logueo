from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from sqlalchemy import text 
import math

from app.database import get_db
from app.calculator import calculate_row_rmr
from app.validator import validate_row_qaqc
from app import models

router = APIRouter(
    prefix="/api",
    tags=["Cálculos y Reportes"]
)

def make_taladro_name(prefix: str, year: int, number: int) -> str:
    year_str = str(year)[-2:]
    return f"{prefix}{year_str}-{number:03d}"

@router.post("/calculate-row")
def calculate_row(corrida: Dict[str, Any] = Body(...), water_table_m: float = 97.0):
    """Realiza el cálculo de RMR'76 y RMR'89 para una fila."""
    result = calculate_row_rmr(corrida, water_table_m)
    return result

@router.post("/validate-row")
def validate_row(corrida: Dict[str, Any] = Body(...)):
    """Ejecuta los controles de consistencia física QA/QC para una fila."""
    alerts = validate_row_qaqc(corrida)
    return {
        "alerts": alerts,
        "is_valid": len([a for a in alerts if a["type"] == "CRITICAL"]) == 0
    }

@router.get("/dashboard/rqd-summary")
def get_dashboard_rqd_summary(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("""
            SELECT
                t.numero            AS numero,
                a.anio              AS anio,
                r.de                AS de_m,
                r.a                 AS a_m,
                p.longitud_recuperada_m     AS rec_m,
                p.frags_mayor_10_cm         AS rqd_m,
                p.longitud_roca_fracturada_m AS lrf_m,
                p.sum_frac_nat              AS frac_nat,
                gf.frf                      AS frf,
                gf.n_fracturas_mecanicas    AS mec_frac
            FROM Taladro t
            JOIN Anio a         ON t.anio_id      = a.id
            JOIN Registro r     ON r.taladro_id   = t.id
            JOIN ParametrosTaladroLG p  ON p.registro_id = r.id
            LEFT JOIN GradoFracturamiento gf ON gf.parametrosTaladroLG_id = p.id
            ORDER BY a.anio, t.numero, r.de
        """)).fetchall()
    except Exception as e:
        print("Error en SQL Server RQD query:", e)
        return {"points_rqd_esp": [], "points_ff_rqd": [], "taladros": []}

    points_rqd_esp = []
    points_ff_rqd  = []
    taladros_set   = {}

    for row in rows:
        numero, anio, de_m, a_m, rec_m, rqd_m, lrf_m, frac_nat, frf_db, mec_frac = row

        name = make_taladro_name("FEGT", anio, numero)

        perf = round(float(a_m) - float(de_m), 4)
        if perf <= 0 or perf > 1.6:
            continue

        rec_m  = float(rec_m  or 0)
        rqd_m  = float(rqd_m  or 0)
        lrf_m  = float(lrf_m  or 0)
        frac_nat = int(frac_nat or 0)

        if rec_m > perf or rqd_m > rec_m:
            continue

        if frf_db is not None and frf_db >= 0:
            frf = int(frf_db)
        else:
            frf = (math.floor(round(lrf_m * 100) / 5) + 1) if lrf_m > 0 else 0

        total_frac = frac_nat + frf
        spacing_mm = round((perf / total_frac * 1000) if total_frac > 0 else perf * 1000)
        rqd_pct    = round((rqd_m / perf * 100) if perf > 0 else 0)
        ff_per_m   = round(total_frac / perf, 4) if perf > 0 else 0

        ph_teorico = round(100 * math.exp(-0.1 * ff_per_m) * (0.1 * ff_per_m + 1), 2)

        point_esp = {
            "taladro": name,
            "corrida": f"{de_m:.1f}-{a_m:.1f}",
            "prof_m": round((de_m + a_m) / 2, 2),
            "rqd_pct": rqd_pct,
            "spacing_mm": spacing_mm,
            "ff_per_m": ff_per_m,
            "ph_teorico": ph_teorico,
        }
        points_rqd_esp.append(point_esp)
        points_ff_rqd.append(point_esp)

        if name not in taladros_set:
            taladros_set[name] = {"name": name, "count_rqd_esp": 0, "count_ff_rqd": 0,
                                   "rqd_sum": 0.0, "spacing_sum": 0.0, "ff_sum": 0.0}
        taladros_set[name]["count_rqd_esp"] += 1
        taladros_set[name]["count_ff_rqd"]  += 1
        taladros_set[name]["rqd_sum"]        += rqd_pct
        taladros_set[name]["spacing_sum"]    += spacing_mm
        taladros_set[name]["ff_sum"]         += ff_per_m

    taladros_list = []
    for t_data in taladros_set.values():
        n = t_data["count_rqd_esp"]
        taladros_list.append({
            "name": t_data["name"],
            "count_rqd_esp": n,
            "count_ff_rqd": t_data["count_ff_rqd"],
            "rqd_avg": round(t_data["rqd_sum"] / n, 1) if n > 0 else 0,
            "spacing_avg": round(t_data["spacing_sum"] / n, 0) if n > 0 else 0,
            "ff_avg": round(t_data["ff_sum"] / n, 2) if n > 0 else 0,
        })

    return {
        "points_rqd_esp": points_rqd_esp,
        "points_ff_rqd": points_ff_rqd,
        "taladros": taladros_list,
    }
