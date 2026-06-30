import re
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

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

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints de Dashboard e Historial
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Calcula estadísticas geomecánicas reales directo de SQL Server para el Dashboard."""
    try:
        total_sondajes = db.query(models.Sondaje).count()

        # Perforación total de HOY (Suma de IntervaloA - IntervaloDe de la tabla LogueoGeotecnicoGeneral)
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())
        
        perf_hoy = db.query(
            func.sum(models.LogueoGeotecnicoGeneral.IntervaloA - models.LogueoGeotecnicoGeneral.IntervaloDe)
        ).filter(
            models.LogueoGeotecnicoGeneral.FechaRegistro >= today_start,
            models.LogueoGeotecnicoGeneral.FechaRegistro <= today_end
        ).scalar() or 0.0

        # RMR Promedio Real (Matemático de la columna RMR89_Total en la tabla ValidacionRMR)
        rmr_avg = db.query(func.avg(models.ValidacionRMR.RMR89_Total)).scalar() or 0.0

        return {
            "total_taladros": total_sondajes,
            "perf_total_hoy": float(perf_hoy),
            "rmr_promedio": round(float(rmr_avg), 1)
        }
    except Exception as e:
        print("Error calculando estadísticas del dashboard en GEMA:", e)
        return {
            "total_taladros": 0,
            "perf_total_hoy": 0.0,
            "rmr_promedio": 0.0
        }

@router.get("")
def list_taladros(db: Session = Depends(get_db)):
    """Retorna un listado resumido de todos los sondajes cargados en GEMA."""
    sondajes = db.query(models.Sondaje).all()
    results = []
    
    for s in sondajes:
        collar = s.collar
        
        # Metraje perforado total acumulado por este sondaje en LGG
        perf_total = db.query(
            func.sum(models.LogueoGeotecnicoGeneral.IntervaloA - models.LogueoGeotecnicoGeneral.IntervaloDe)
        ).filter_by(SondajeID=s.SondajeID).scalar() or 0.0

        results.append({
            "name": s.CodigoSondaje,
            "proyecto": s.Spacer if hasattr(s, 'Spacer') else (s.Spacer if hasattr(s, 'Spacer') else (s.Proyecto if s.Proyecto else "Proyecto A")),
            "geologo": s.Geotecnico if s.Geotecnico else "RD/RB",
            "diametro": s.DiametroPerfora if s.DiametroPerfora else "HQ3",
            "inclinacion": s.InclinacionTaladro if s.InclinacionTaladro else -60.0,
            "fecha_registro": s.FechaRegistro.strftime("%Y-%m-%d") if s.FechaRegistro else "2026-06-29",
            "corridas_count": db.query(models.LogueoGeotecnicoGeneral).filter_by(SondajeID=s.SondajeID).count(),
            "surveys_count": db.query(models.Survey).filter_by(SondajeID=s.SondajeID).count(),
            "perf_total": round(float(perf_total), 2)
        })
    return results

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
        corridas_list.append(CorridaSchema(
            corrida=c.NumeroRegistro,
            de=float(c.IntervaloDe),
            a=float(c.IntervaloA),
            rec_m=float(c.LongitudRecuperada) if c.LongitudRecuperada is not None else 0.0,
            rqd_m=float(c.SumaFragmentos10cm) if c.SumaFragmentos10cm is not None else 0.0,
            lrf_m=float(c.LongitudRocaFracturada) if c.LongitudRocaFracturada is not None else 0.0,
            small_frag_m=0.0,
            mec_frac=0,
            lito1=lito_map.get(c.Litologia1ID, "LMT"),
            lito2=lito_map.get(c.Litologia2ID, "-1"),
            lito3=lito_map.get(c.Litologia3ID, "-1"),
            resistencia=c.ResistenciaEstimada or "-1",
            orientacion="N",
            offset=0.0,
            tipo_est1=est_map.get(c.TipoEstructura1ID, "-1"),
            tipo_est2=est_map.get(c.TipoEstructura2ID, "-1"),
            frac_nat=c.NumFracturasNaturales or 0,
            frac_buz30=c.NumFracBuz30 or 0,
            frac_buz60=c.NumFrac30a60 or 0,
            frac_buz90=c.NumFracBuz60 or 0,
            abertura=float(c.Abertura) if c.Abertura is not None else 0.0,
            text_nll_distillation_target_log_prob=0.0,
            rugosidad=int(c.Rugosidad) if (c.Rugosidad and c.Rugosidad.isdigit()) else 1,
            jrc10=int(c.JRC10) if c.JRC10 is not None else 0,
            intemperismo=c.GradoIntemperismo or "UWF",
            relleno1=c.TipoRelleno1 or "cwf",
            relleno2=c.TipoRelleno2 or "-1",
            espesor=float(c.EspesorRelleno) if c.EspesorRelleno is not None else 0.0,
            agua_obs=c.PresenciaAgua or "CDC",
            turno="D",
            comentarios=c.Comentarios or ""
        ))

    # 3. Recuperar Discontinuidades Estructurales (EST)
    discontinuidades_list = []
    db_discs = db.query(models.LogueoEstructural).filter_by(SondajeID=s.SondajeID).order_by(models.LogueoEstructural.Profundidad).all()
    for d in db_discs:
        discontinuidades_list.append(DiscontinuidadSchema(
            id=d.LogueoEstructuralID,
            de=float(d.IntervaloDe),
            a=float(d.IntervaloA),
            profundidad=float(d.Profundidad) if d.Profundidad is not None else float(d.IntervaloDe),
            litologia=lito_map.get(d.Litologia1ID, "LMT"),
            litologia2=lito_map.get(d.Litologia2ID, "-1"),
            litologia3=lito_map.get(d.Litologia3ID, "-1"),
            tipo_estructura=est_map.get(d.TipoEstructuraID, "JN"),
            alfa=float(d.Alpha) if d.Alpha is not None else 0.0,
            beta=float(d.Beta) if d.Beta is not None else 0.0,
            forma=1,
            rugosidad=d.Rugosidad or "1",
            jrc10=int(d.JRC10) if d.JRC10 is not None else 0,
            abertura=float(d.Abertura) if d.Abertura is not None else 0.0,
            weathering=d.GradoIntemperismo or "UWF",
            espesor=float(d.EspesorRelleno) if d.EspesorRelleno is not None else 0.0,
            relleno1=d.TipoRelleno1 or "cwf",
            relleno2=d.TipoRelleno2 or "-1",
            dureza_pared=d.DurezaParedEstructura or "-1",
            agua=d.PresenciaAgua or "CDC",
            geotecnico=s.Geotecnico or "RD/RB",
            comentario=d.IntervaloComentario or "",
            corrida=1,
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
            tipo_de_ensayo=db.query(models.TipoEnsayoPLT.Codigo).filter_by(TipoEnsayoPLT_ID=plt.TipoEnsayoPLT_ID).scalar() or "D",
            diametro_taladro_nominacion=db.query(models.DiametroPerfora.Codigo).filter_by(DiametroID=plt.DiametroID).scalar() or "HQ",
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
        
        # 2. Guardar Corridas y calcular RMR en ValidaciónRMR
        corridas_list = [c.dict() for c in taladro.corridas]
        engine.migrate_corridas_and_calculate_rmr(sondaje_id, campana_id, geotecnico_id, corridas_list)
        
        # 3. Guardar Discontinuidades Estructurales
        discontinuidades_list = [d.dict() for d in taladro.discontinuidades]
        engine.migrate_discontinuidades(sondaje_id, campana_id, geotecnico_id, discontinuidades_list)
        
        # 4. Guardar Ensayos PLT
        plt_list = [p.dict() for p in taladro.ensayos_plt]
        engine.migrate_ensayos_plt(sondaje_id, campana_id, plt_list)
        
        db.commit()
        return {"status": "success", "message": f"Taladro {taladro.name} migrado y guardado con éxito en GEMA"}
        
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
        db.query(models.EnsayoPLT).filter_by(SondajeID=s.SondajeID).delete()
        db.delete(s)
        db.commit()
        return {"status": "success", "message": f"Taladro {name} y todas sus dependencias eliminadas correctamente de GEMA"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar taladro de la base de datos: {str(e)}")