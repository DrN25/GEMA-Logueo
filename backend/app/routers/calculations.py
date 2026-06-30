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
        # MIGRACIÓN SÍNCRONA: Query adaptada al esquema físico de GEMA con LEFT JOIN
        rows = db.execute(text("""
            SELECT
                s.CodigoSondaje           AS codigo_sondaje,
                c.NombreCampaña           AS campania,
                lgg.IntervaloDe           AS de_m,
                lgg.IntervaloA            AS a_m,
                lgg.LongitudRecuperada    AS rec_m,
                lgg.SumaFragmentos10cm    AS rqd_m,
                lgg.LongitudRocaFracturada AS lrf_m,
                lgg.NumFracturasNaturales AS frac_nat,
                lgg.FRF                   AS frf,
                0                         AS mec_frac
            FROM dbo.Sondajes s
            LEFT JOIN dbo.Campañas c                 ON s.CampañaID = c.CampañaID
            JOIN dbo.LogueoGeotecnicoGeneral lgg     ON lgg.SondajeID = s.SondajeID
            ORDER BY c.NombreCampaña, s.CodigoSondaje, lgg.IntervaloDe
        """)).fetchall()
    except Exception as e:
        print("Error en SQL Server RQD query adaptada a GEMA:", e)
        return {"points_rqd_esp": [], "points_ff_rqd": [], "taladros": []}

    points_rqd_esp = []
    points_ff_rqd  = []
    taladros_set   = {}

    for row in rows:
        name = row[0] or "TALADRO"
        campania = str(row[1] or "2026")
        de_m = float(row[2] or 0.0)
        a_m = float(row[3] or 0.0)
        rec_m = float(row[4] or 0.0)
        rqd_m = float(row[5] or 0.0)
        lrf_m = float(row[6] or 0.0)
        frac_nat = int(row[7] or 0)
        frf_db = row[8]
        mec_frac = int(row[9] or 0)

        perf = round(a_m - de_m, 4)
        
        # MODIFICACIÓN: Cambiamos de 1.6m a 5.0m para evitar descartar taladros con barril de 3.0m diamantino.
        if perf <= 0 or perf > 5.0:
            continue

        if rec_m > perf or rqd_m > rec_m:
            continue

        # Resolver FRF dinámicamente si es nulo
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
            taladros_set[name] = {
                "name": name, 
                "count_rqd_esp": 0, 
                "count_ff_rqd": 0,
                "rqd_sum": 0.0, 
                "spacing_sum": 0.0, 
                "ff_sum": 0.0
            }
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