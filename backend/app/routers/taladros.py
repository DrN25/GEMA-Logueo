import math
import re
from datetime import date, datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from app.schemas import TaladroSchema, CorridaSchema, SurveySchema, DiscontinuidadSchema, EnsayoPltSchema
from app.database import get_db
from app import models
from app.core.migration_service import GemaMigrationEngine

router = APIRouter(
    prefix="/api/taladros",
    tags=["Taladros"]
)

# ──────────────────────────────────────────────────────────────────────────────
# Helpers de normalización y parseo de nombres
# ──────────────────────────────────────────────────────────────────────────────
def parse_taladro_name(name: str):
    match = re.match(r"^([A-Za-z]+)(\d+)-(\d+)$", name.strip())
    if match:
        prefix, year_str, num_str = match.groups()
        year = int("20" + year_str)
        number = int(num_str)
        return prefix, year, number
    else:
        return "FEGT", 2020, 1

def make_taladro_name(prefix: str, year: int, number: int) -> str:
    year_str = str(year)[-2:]
    return f"{prefix}{year_str}-{number:03d}"

def normalize_strength(val) -> str:
    if val is None:
        return "-1"
    val_str = str(val).strip().upper()
    if val_str in ("", "-1", "-1.0", "NONE", "NULL", "S/D", "-"):
        return "-1"
    if val_str in ("0", "1", "2", "3", "4", "5", "6"):
        return f"R{val_str}"
    if val_str in ("R0", "R1", "R2", "R3", "R4", "R5", "R6"):
        return val_str
    return "-1"

def to_m(val) -> float:
    try:
        v = float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0
    return 0.0 if v < 0 else round(v, 4)

def to_int0(val) -> int:
    try:
        v = int(val) if val is not None else 0
    except (ValueError, TypeError):
        return 0
    return 0 if v < 0 else v

def calc_frf(lrf_val) -> int:
    """Calcula el número de fragmentos de roca fracturada (FRF) a partir de LRF (m)."""
    lrf = lrf_val or 0.0
    return math.floor(round(lrf * 100) / 5) + 1 if lrf > 0 else 0

def safe_int(val, default: int = -1) -> int:
    """Convierte valores numéricos/string a entero; devuelve default si no es numérico."""
    if val is None:
        return default
    try:
        f = float(str(val).strip())
        return int(f) if f.is_integer() else round(f)
    except (ValueError, TypeError):
        return default

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints de Dashboard e Historial
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard-stats")
def get_dashboard_stats(
    fecha_desde: Optional[str] = Query(None, description="YYYY-MM-DD"),
    fecha_hasta: Optional[str] = Query(None, description="YYYY-MM-DD"),
    q: Optional[str] = Query(None, description="Buscar por código de sondaje"),
    search_global: bool = Query(False, description="Ignorar filtro de fecha"),
    proyecto: Optional[str] = Query(None),
    geologo: Optional[str] = Query(None),
    diametro: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Calcula estadísticas geomecánicas reales directo de SQL Server para el Dashboard.

    Acepta los MISMOS filtros que GET /api/taladros (paginado) para que los KPIs
    reflejen el subconjunto filtrado activo (patrón Mapeo: data.kpis).
    """
    try:
        # ── Subconjunto de sondajes filtrados (misma lógica que el listado) ──
        sondaje_q = db.query(models.Sondaje.SondajeID)

        if not search_global:
            if fecha_desde:
                try:
                    desde = datetime.strptime(fecha_desde, "%Y-%m-%d")
                    sondaje_q = sondaje_q.filter(models.Sondaje.FechaRegistro >= desde)
                except ValueError:
                    pass
            if fecha_hasta:
                try:
                    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d") + timedelta(days=1)
                    sondaje_q = sondaje_q.filter(models.Sondaje.FechaRegistro < hasta)
                except ValueError:
                    pass

        if q and q.strip():
            sondaje_q = sondaje_q.filter(models.Sondaje.CodigoSondaje.ilike(f"%{q.strip()}%"))
        if proyecto and proyecto.strip():
            sondaje_q = sondaje_q.filter(models.Sondaje.Proyecto.ilike(f"%{proyecto.strip()}%"))
        if geologo and geologo.strip():
            sondaje_q = sondaje_q.filter(models.Sondaje.Geotecnico.ilike(f"%{geologo.strip()}%"))
        if diametro and diametro.strip():
            sondaje_q = sondaje_q.filter(models.Sondaje.DiametroPerfora.ilike(f"%{diametro.strip()}%"))

        total_sondajes = sondaje_q.count()

        lgg_q = db.query(models.LogueoGeotecnicoGeneral).filter(
            models.LogueoGeotecnicoGeneral.SondajeID.in_(sondaje_q)
        )

        # Perforación acumulada total y perforación de HOY (del subconjunto filtrado)
        perf_total_raw = db.query(
            func.sum(models.LogueoGeotecnicoGeneral.IntervaloA - models.LogueoGeotecnicoGeneral.IntervaloDe)
        ).filter(
            models.LogueoGeotecnicoGeneral.SondajeID.in_(sondaje_q)
        ).scalar()
        perf_total = float(perf_total_raw) if perf_total_raw is not None else 0.0

        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())

        perf_hoy_raw = db.query(
            func.sum(models.LogueoGeotecnicoGeneral.IntervaloA - models.LogueoGeotecnicoGeneral.IntervaloDe)
        ).filter(
            models.LogueoGeotecnicoGeneral.SondajeID.in_(sondaje_q),
            models.LogueoGeotecnicoGeneral.FechaRegistro >= today_start,
            models.LogueoGeotecnicoGeneral.FechaRegistro <= today_end
        ).scalar()
        perf_hoy = float(perf_hoy_raw) if perf_hoy_raw is not None else 0.0

        # RMR89 Promedio (del subconjunto filtrado)
        rmr_avg_raw = db.query(func.avg(models.ValidacionRMR.RMR89_Total)).filter(
            models.ValidacionRMR.SondajeID.in_(sondaje_q)
        ).scalar()
        rmr_avg = float(rmr_avg_raw) if rmr_avg_raw is not None else 0.0

        # RQD % Promedio: Suma(Fragmentos>=10cm) / Suma(Avance) * 100
        rqd_avg = 0.0
        tot_rqd_m_raw = db.query(func.sum(models.LogueoGeotecnicoGeneral.SumaFragmentos10cm)).filter(
            models.LogueoGeotecnicoGeneral.SondajeID.in_(sondaje_q)
        ).scalar()
        tot_rqd_m = float(tot_rqd_m_raw) if tot_rqd_m_raw is not None else 0.0
        if perf_total > 0.0:
            rqd_avg = min(100.0, max(0.0, (tot_rqd_m / perf_total) * 100.0))

        # Geólogo / Mapeador más reciente (del subconjunto filtrado)
        last_sondaje = db.query(models.Sondaje).filter(
            models.Sondaje.SondajeID.in_(sondaje_q)
        ).order_by(models.Sondaje.FechaRegistro.desc()).first()
        last_geologo = last_sondaje.Geotecnico if last_sondaje and last_sondaje.Geotecnico else "RD/RB"

        return {
            "total_taladros": total_sondajes,
            "perf_total_m": round(perf_total, 2),
            "perf_total_hoy": round(perf_hoy, 2),
            "rmr_promedio": round(rmr_avg, 1),
            "rqd_promedio": round(rqd_avg, 1),
            "geologo_mas_reciente": last_geologo
        }
    except Exception as e:
        print("Error calculando estadísticas del dashboard en GEMA:", e)
        return {
            "total_taladros": 0,
            "perf_total_m": 0.0,
            "perf_total_hoy": 0.0,
            "rmr_promedio": 0.0,
            "rqd_promedio": 0.0,
            "geologo_mas_reciente": "N/A"
        }

@router.get("")
def list_taladros(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    fecha_desde: Optional[str] = Query(None, description="YYYY-MM-DD"),
    fecha_hasta: Optional[str] = Query(None, description="YYYY-MM-DD"),
    q: Optional[str] = Query(None, description="Buscar por código de sondaje"),
    search_global: bool = Query(False, description="Ignorar filtro de fecha y buscar en todo el historial"),
    proyecto: Optional[str] = Query(None),
    geologo: Optional[str] = Query(None),
    diametro: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Listado PAGINADO de sondajes con filtros en SQL (patrón GEMA-Mapeo).

    Devuelve solo la página solicitada: {items, total_filtered, total_pages, page, page_size}.
    Los conteos (corridas, surveys) y el metraje total se calculan con subqueries
    agregadas (1 sola query, sin N+1).
    """
    try:
        # ── Agregados en una sola consulta (elimina el N+1 del listado anterior) ──
        lgg_agg = db.query(
            models.LogueoGeotecnicoGeneral.SondajeID.label("sid"),
            func.sum(
                models.LogueoGeotecnicoGeneral.IntervaloA - models.LogueoGeotecnicoGeneral.IntervaloDe
            ).label("perf_total"),
            func.count().label("corridas_count"),
        ).group_by(models.LogueoGeotecnicoGeneral.SondajeID).subquery()

        survey_agg = db.query(
            models.Survey.SondajeID.label("sid"),
            func.count().label("surveys_count"),
        ).group_by(models.Survey.SondajeID).subquery()

        query = (
            db.query(
                models.Sondaje,
                lgg_agg.c.perf_total,
                lgg_agg.c.corridas_count,
                survey_agg.c.surveys_count,
            )
            .outerjoin(lgg_agg, lgg_agg.c.sid == models.Sondaje.SondajeID)
            .outerjoin(survey_agg, survey_agg.c.sid == models.Sondaje.SondajeID)
        )

        # ── Filtros (search_global=true ignora el rango de fechas, como Mapeo) ──
        if not search_global:
            if fecha_desde:
                try:
                    desde = datetime.strptime(fecha_desde, "%Y-%m-%d")
                    query = query.filter(models.Sondaje.FechaRegistro >= desde)
                except ValueError:
                    pass
            if fecha_hasta:
                try:
                    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d") + timedelta(days=1)
                    query = query.filter(models.Sondaje.FechaRegistro < hasta)
                except ValueError:
                    pass

        if q and q.strip():
            query = query.filter(models.Sondaje.CodigoSondaje.ilike(f"%{q.strip()}%"))

        if proyecto and proyecto.strip():
            query = query.filter(models.Sondaje.Proyecto.ilike(f"%{proyecto.strip()}%"))
        if geologo and geologo.strip():
            query = query.filter(models.Sondaje.Geotecnico.ilike(f"%{geologo.strip()}%"))
        if diametro and diametro.strip():
            query = query.filter(models.Sondaje.DiametroPerfora.ilike(f"%{diametro.strip()}%"))

        # ── Total + paginación ──
        total_filtered = query.count()
        total_pages = max(1, (total_filtered + page_size - 1) // page_size)

        items = (
            query.order_by(models.Sondaje.FechaRegistro.desc(), models.Sondaje.SondajeID.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        results = []
        for s, perf_total, corridas_count, surveys_count in items:
            results.append({
                "name": s.CodigoSondaje,
                "proyecto": s.Proyecto or "Proyecto A",
                "geologo": s.Geotecnico or "RD/RB",
                "diametro": s.DiametroPerfora or "HQ3",
                "inclinacion": float(s.InclinacionTaladro) if s.InclinacionTaladro is not None else -60.0,
                "fecha_registro": s.FechaRegistro.strftime("%Y-%m-%d") if s.FechaRegistro else "",
                "corridas_count": corridas_count or 0,
                "surveys_count": surveys_count or 0,
                "perf_total": round(float(perf_total or 0.0), 2)
            })

        return {
            "items": results,
            "total_filtered": total_filtered,
            "total_pages": total_pages,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        print("[!] Error en GET /api/taladros:", e)
        return {
            "items": [],
            "total_filtered": 0,
            "total_pages": 0,
            "page": page,
            "page_size": page_size,
        }

@router.get("/existe")
def check_taladro_existe(name: str = Query(..., description="Código de sondaje a verificar"), db: Session = Depends(get_db)):
    """Verifica si un código de sondaje ya existe (COUNT ligero, patrón Mapeo /ventanas-check)."""
    exists = db.query(models.Sondaje).filter(models.Sondaje.CodigoSondaje == name.strip()).first() is not None
    return {"name": name.strip(), "exists": exists}

@router.get("/{name}", response_model=TaladroSchema)
def get_taladro(name: str, db: Session = Depends(get_db)):
    """Obtiene toda la información de un sondaje por su código, traduciendo IDs a texto."""
    s = db.query(models.Sondaje).filter_by(CodigoSondaje=name).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sondaje no encontrado en GEMA")
        
    collar = s.collar
    geologo = s.Geotecnico or "RD/RB"  # ─── DECLARACIÓN INTEGRADA DE VARIABLE GEOLOGO ───
    
    campana_obj = db.query(models.Campaña).filter_by(CampañaID=s.CampañaID).first()
    campana_str = campana_obj.NombreCampaña if campana_obj else "Campaña 2020"

    turno_global = "D"
    if s.TurnoID:
        turno_obj = db.query(models.Turno).filter_by(TurnoID=s.TurnoID).first()
        if turno_obj:
            turno_global = turno_obj.Codigo.strip()

    # Pre-cargar diccionarios de resolución reversa (ID -> Texto) para evitar N+1 queries
    lito_map = {l.LitologiaID: l.CodigoLitologia.strip() for l in db.query(models.Litologia).all()}
    est_map = {e.TipoEstructuraID: e.CodigoEstructura.strip() for e in db.query(models.TipoEstructura).all()}
    rotura_map = {r.TipoFracturaPLT_ID: r.Codigo.strip() for r in db.query(models.TipoFracturaPLT).all()}
    dir_map = {d.DireccionID: d.Codigo.strip() for d in db.query(models.DireccionRuptura).all()}
    isrm_map = {r.ResistenciaISRM_ID: r.Codigo.strip() for r in db.query(models.ResistenciaISRM).all()}
    geotecnico_map = {g.GeotecnicoID: g.NombreCompleto.strip() for g in db.query(models.Geotecnico).all()}
    tipo_ensayo_map = {t.TipoEnsayoPLT_ID: t.Codigo.strip() for t in db.query(models.TipoEnsayoPLT).all()}
    diametro_map = {d.DiametroID: d.Codigo.strip() for d in db.query(models.DiametroPerfora).all()}

    # 1. Recuperar Trayectorias (Surveys)
    surveys_list = []
    db_surveys = db.query(models.Survey).filter_by(SondajeID=s.SondajeID).order_by(models.Survey.Profundidad).all()
    for srv in db_surveys:
        surveys_list.append(SurveySchema(
            depth=float(srv.Profundidad),
            dip=float(srv.Inclinacion),
            azimuth=float(srv.Azimut)
        ))

    # 2. Recuperar Corridas (LGG)
    corridas_list = []
    db_corridas = db.query(models.LogueoGeotecnicoGeneral).filter_by(SondajeID=s.SondajeID).order_by(models.LogueoGeotecnicoGeneral.IntervaloDe).all()
    for idx, c in enumerate(db_corridas):
        # Conversión segura a punto flotante
        rec_val = float(c.LongitudRecuperada) if c.LongitudRecuperada is not None else 0.0
        rqd_val = float(c.SumaFragmentos10cm) if c.SumaFragmentos10cm is not None else 0.0
        lrf_val = float(c.LongitudRocaFracturada) if c.LongitudRocaFracturada is not None else 0.0
        frf_val = int(c.FRF) if c.FRF is not None else calc_frf(lrf_val)
        
        # Reconstrucción matemática del balance de fragmentos del testigo
        calculated_small_frag = max(0.0, round(rec_val - rqd_val - lrf_val, 2))

        corridas_list.append(CorridaSchema(
            corrida=c.NumeroRegistro,
            de=float(c.IntervaloDe),
            a=float(c.IntervaloA),
            rec_m=rec_val,
            rqd_m=rqd_val,
            lrf_m=lrf_val,
            frf=frf_val,
            small_frag_m=calculated_small_frag, # Campo calculado dinámicamente
            lito1=lito_map.get(c.Litologia1ID) or "-1",
            lito2=lito_map.get(c.Litologia2ID) or "-1",
            lito3=lito_map.get(c.Litologia3ID) or "-1",
            resistencia=normalize_strength(c.ResistenciaEstimada),
            orientacion="X",                    # Campo opcional por defecto
            offset=0.0,                         # Campo opcional por defecto
            tipo_est1=est_map.get(c.TipoEstructura1ID) or "-1",
            tipo_est2=est_map.get(c.TipoEstructura2ID) or "-1",
            frac_nat=c.NumFracturasNaturales if c.NumFracturasNaturales is not None else -1,
            frac_buz30=c.NumFracBuz30 if c.NumFracBuz30 is not None else -1,
            frac_buz60=c.NumFrac30a60 if c.NumFrac30a60 is not None else -1,
            frac_buz90=c.NumFracBuz60 if c.NumFracBuz60 is not None else -1,
            abertura=float(c.Abertura) if c.Abertura is not None else -1.0,
            rugosidad=safe_int(c.Rugosidad, -1),
            jrc10=int(round(float(c.JRC10))) if c.JRC10 is not None else -1,
            intemperismo=c.GradoIntemperismo or "-1",
            relleno1=c.TipoRelleno1 or "-1",
            relleno2=c.TipoRelleno2 or "-1",
            espesor=float(c.EspesorRelleno) if c.EspesorRelleno is not None else -1.0,
            agua_obs=c.PresenciaAgua or "-1",
            turno="D",
            comentarios=c.Comentarios or ""
        ))

    # 3. Recuperar Discontinuidades Estructurales (EST)
    discontinuidades_list = []
    db_discs = db.query(models.LogueoEstructural).filter_by(SondajeID=s.SondajeID).order_by(models.LogueoEstructural.Profundidad).all()

    # Precomputar corridas en floats + mapa de intervalos para derivar el número
    # de corrida de cada discontinuidad sin O(n*m) sobre Decimal (perf: 631x257).
    corr_de = [float(c.IntervaloDe) for c in db_corridas]
    corr_a = [float(c.IntervaloA) for c in db_corridas]
    corr_num = [c.NumeroRegistro for c in db_corridas]
    interval_map = {(d, a): num for d, a, num in zip(corr_de, corr_a, corr_num)}

    for d in db_discs:
        prof = float(d.Profundidad) if d.Profundidad is not None else None
        corrida_num = 1
        if prof is not None:
            for i, de_ in enumerate(corr_de):
                if de_ <= prof <= corr_a[i]:
                    corrida_num = corr_num[i]
                    break
            else:
                corrida_num = interval_map.get(
                    (round(float(d.IntervaloDe), 2), round(float(d.IntervaloA), 2)), 1)
        else:
            corrida_num = interval_map.get(
                (round(float(d.IntervaloDe), 2), round(float(d.IntervaloA), 2)), 1)

        discontinuidades_list.append(DiscontinuidadSchema(
            id=d.LogueoEstructuralID,
            de=float(d.IntervaloDe),
            a=float(d.IntervaloA),
            profundidad=float(d.Profundidad) if d.Profundidad is not None else float(d.IntervaloDe),
            litologia=lito_map.get(d.Litologia1ID) or "-1",
            litologia2=lito_map.get(d.Litologia2ID) or "-1",
            litologia3=lito_map.get(d.Litologia3ID) or "-1",
            tipo_estructura=est_map.get(d.TipoEstructuraID) or "-1",
            alfa=float(d.Alpha) if d.Alpha is not None else -1.0,
            beta=float(d.Beta) if d.Beta is not None else -1.0,
            forma=safe_int(d.Forma, -1),
            rugosidad=safe_int(d.Rugosidad, -1),
            jrc10=int(round(float(d.JRC10))) if d.JRC10 is not None else -1,
            abertura=float(d.Abertura) if d.Abertura is not None else -1.0,
            weathering=d.GradoIntemperismo or "-1",
            espesor=float(d.EspesorRelleno) if d.EspesorRelleno is not None else -1.0,
            relleno1=d.TipoRelleno1 or "-1",
            relleno2=d.TipoRelleno2 or "-1",
            dureza_pared=normalize_strength(d.DurezaParedEstructura),
            agua=d.PresenciaAgua or "-1",
            geotecnico=geotecnico_map.get(d.GeotecnicoID) or "-1",
            comentario=d.IntervaloComentario or "",
            corrida=corrida_num,
            tipo="Natural"
        ))

    # 4. Recuperar Ensayos PLT
    ensayos_plt_list = []
    db_plts = db.query(models.EnsayoPLT).filter_by(SondajeID=s.SondajeID).order_by(models.EnsayoPLT.From_m).all()
    for plt in db_plts:
        espesor_mm = float(plt.Espesor_D_cm * 10) if plt.Espesor_D_cm else 0.0
        ensayos_plt_list.append(EnsayoPltSchema(
            id=plt.EnsayoPLT_ID,
            fecha=plt.FechaEnsayo.strftime("%Y-%m-%d") if plt.FechaEnsayo else "2020-08-20",
            nro_muestra=plt.NroMuestra or "",
            nro_caja=int(plt.NroCaja) if (plt.NroCaja and plt.NroCaja.isdigit()) else 0,
            from_m=float(plt.From_m) if plt.From_m else 0.0,
            to_m=float(plt.To_m) if plt.To_m else 0.0,
            verif_corrida="OK",
            long_de_corrida_m=float(plt.LongCorrida_m) if plt.LongCorrida_m else 0.0,
            este_m=float(plt.CoordenadaEste) if plt.CoordenadaEste else 0.0,
            norte_m=float(plt.CoordenadaNorte) if plt.CoordenadaNorte else 0.0,
            elevacion_msnm=float(plt.Elevacion) if plt.Elevacion else 0.0,
            long_de_muestra_mm=float(plt.LongMuestra_mm) if plt.LongMuestra_mm else 0.0,
            tipo_de_ensayo=tipo_ensayo_map.get(plt.TipoEnsayoPLT_ID, "D"),
            diametro_taladro_nominacion=diametro_map.get(plt.DiametroID, "HQ"),
            litologia_1=lito_map.get(plt.LitologiaID_1, "LMT"),
            litologia_2=lito_map.get(plt.LitologiaID_2, "-"),
            litologia_3=lito_map.get(plt.LitologiaID_3, "-"),
            tipo_litologico=plt.TipoLitologico or "",
            d_mm=espesor_mm,
            verif_de_longitud="OK" if plt.MuestraValidaLong else "Error",
            p_instr_kn=float(plt.FuerzaP_kN) if plt.FuerzaP_kN else 0.0,
            tipo_rotura_code=rotura_map.get(plt.TipoFracturaPLT_ID, "M"),
            direccion_rotura_code=dir_map.get(plt.DireccionID, "Na"),
            ejecutadoPor=plt.EjecutadoPor or "",
            is_mpa=float(plt.Is_MPa) if plt.Is_MPa else 0.0,
            fact_corr=float(plt.FactorCorr) if plt.FactorCorr else 1.0,
            is_50_mpa=float(plt.Is50_MPa) if plt.Is50_MPa else 0.0,
            factor_k=10.0,
            ucs=float(plt.UCS_MPa) if plt.UCS_MPa else 0.0,
            isrm_indice_r=isrm_map.get(plt.ResistenciaISRM_ID, "R4"),
            observaciones=plt.Observaciones or ""
        ))

    return TaladroSchema(
        name=name,
        proyecto=s.Proyecto or "Proyecto A",
        geologo=geologo,
        diametro=s.DiametroPerfora or "HQ",
        inclinacion=float(s.InclinacionTaladro) if s.InclinacionTaladro else -60.0,
        campana=campana_str,
        fecha_registro=s.FechaRegistro.strftime("%Y-%m-%d") if s.FechaRegistro else "2020-08-20",
        
        # --- COLUMNAS CONECTADAS (Traducción Relacional -> Frontend) ---
        collar_este_proyectado=float(collar.CoordenadaEsteProyectado) if (collar and collar.CoordenadaEsteProyectado is not None) else 0.0,
        collar_norte_proyectado=float(collar.CoordenadaNorteProyectado) if (collar and collar.CoordenadaNorteProyectado is not None) else 0.0,
        collar_cota_proyectado=float(collar.ElevacionProyectado) if (collar and collar.ElevacionProyectado is not None) else 0.0,
        prof_final_eoh_proyectada=float(collar.ProfundidadTotalProyectada) if (collar and collar.ProfundidadTotalProyectada is not None) else -1.0,
        comentarios_proyectado=collar.ComentariosProyectado if (collar and collar.ComentariosProyectado is not None) else "",
        
        collar_este=float(collar.CoordenadaEste) if collar else 0.0,
        collar_norte=float(collar.CoordenadaNorte) if collar else 0.0,
        collar_cota=float(collar.Elevacion) if collar else 0.0,
        prof_final_eoh=float(collar.ProfundidadTotal) if collar else -1.0,
        comentarios=collar.Comentarios if (collar and collar.Comentarios is not None) else "",
        turno=turno_global,
        surveys=surveys_list,
        corridas=corridas_list,
        discontinuidades=discontinuidades_list,
        ensayos_plt=ensayos_plt_list
    )

@router.post("")
def save_taladro(taladro: TaladroSchema, db: Session = Depends(get_db)):
    """Crea o actualiza un taladro migrándolo de forma directa al esquema físico de GEMA."""
    try:
        engine = GemaMigrationEngine(db)
        
        # 1. Guardar Sondaje y Collar (Soporta fallback de proyectados internos)
        sondaje_id = engine.migrate_sondaje_collar(taladro.dict())
        campana_id = engine.resolve_campana(taladro.campana or "2020")
        geotecnico_id = engine.resolve_geotecnico(taladro.geologo or "RD/RB")
        
        # 2. Guardar Surveys / Trayectorias
        surveys_list = [s.dict() for s in taladro.surveys]
        engine.migrate_surveys(sondaje_id, surveys_list)
        
        # 3. Guardar Corridas y calcular RMR en ValidaciónRMR
        corridas_list = [c.dict() for c in taladro.corridas]
        engine.migrate_corridas_and_calculate_rmr(sondaje_id, campana_id, geotecnico_id, corridas_list)
        
        # 4. Guardar Discontinuidades Estructurales
        discontinuidades_list = [d.dict() for d in taladro.discontinuidades]
        engine.migrate_discontinuidades(sondaje_id, campana_id, geotecnico_id, discontinuidades_list)
        
        # 5. Guardar Ensayos PLT
        plt_list = [p.dict() for p in taladro.ensayos_plt]
        engine.migrate_ensayos_plt(sondaje_id, campana_id, plt_list)
        
        db.commit()
        return {"status": "success", "message": f"Taladro {taladro.name} migrado y guardado con éxito en GEMA"}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fallo en migración de guardado: {str(e)}")

@router.delete("/{name}")
def delete_taladro(name: str, db: Session = Depends(get_db)):
    """Elimina un sondaje de GEMA, limpiando previamente dependencias manuales."""
    s = db.query(models.Sondaje).filter_by(CodigoSondaje=name).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sondaje no encontrado en GEMA")
        
    try:
        db.delete(s)
        db.commit()
        return {"status": "success", "message": f"Taladro {name} y todas sus dependencias eliminadas correctamente de GEMA"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar taladro de la base de datos: {str(e)}")