from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import re
import math
from sqlalchemy.orm import Session

from app.schemas import TaladroSchema, CorridaSchema, SurveySchema, DiscontinuidadSchema, EnsayoPltSchema
from app.database import get_db, Base, engine
from app import models
from app.calculator import calculate_row_rmr
from app.validator import validate_row_qaqc

app = FastAPI(title="Geolog Pro API", version="2.0")

# Habilitar CORS para desarrollo local con Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_taladro_name(name: str):
    # Match FEGT20-001 or FEGT25-002
    match = re.match(r"^([A-Za-z]+)(\d+)-(\d+)$", name.strip())
    if match:
        prefix, year_str, num_str = match.groups()
        year = int("20" + year_str)
        number = int(num_str)
        return prefix, year, number
    else:
        # Fallback
        return "FEGT", 2025, 1

def make_taladro_name(prefix: str, year: int, number: int) -> str:
    year_str = str(year)[-2:]
    return f"{prefix}{year_str}-{number:03d}"


# ──────────────────────────────────────────────────────────────────────────────
# Helpers de normalización: campos con valor centínela -1 (sin dato)
# ──────────────────────────────────────────────────────────────────────────────
def to_m(val) -> float:
    """Convierte -1 (sin dato) a 0.0 para campos de metraje físico.
    Impide que valores negativ os contaminen sumas de balance físico."""
    try:
        v = float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0
    return 0.0 if v < 0 else round(v, 4)

def to_int0(val) -> int:
    """Convierte -1 (sin dato) a 0 para campos de conteo entero.
    Impide que bins de buzamiento o conteos queden negativos en BD."""
    try:
        v = int(val) if val is not None else 0
    except (ValueError, TypeError):
        return 0
    return 0 if v < 0 else v

def delete_registros_cascade(db: Session, taladro_id: int):
    """
    Elimina todos los Registros de un taladro en orden correcto para SQL Server.

    Todos los hijos de ParametrosTaladroLG comparten el mismo FK padre (parametrosTaladroLG_id).
    SQL Server verifica integridad referencial incluso entre tablas hermanas: si se borra
    DatosLogueoGral con logueo_id=X, SQL Server verifica que ParametrosTaladroLG(id=X)
    no sea referenciado por otras tablas (Discontinuidades, ValidacionRMR, etc.).
    Por eso, todos los hijos de ParametrosTaladroLG DEBEN borrarse juntos en una sola
    transacción ANTES de borrar ParametrosTaladroLG.

    Orden correcto:
      EnsayoPltRegulares     (FK → Registro) - raw SQL patch
      DatosLogueoEstructural (FK → Registro)
      GradoFracturamiento    (FK → ParametrosTaladroLG)
      Discontinuidades       (FK → ParametrosTaladroLG)
      MaterialRocoso         (FK → ParametrosTaladroLG)
      ValidacionRMR          (FK → ParametrosTaladroLG)
      DatosLogueoGral        (FK → ParametrosTaladroLG)  ← debe ir DESPUÉS de sus hermanos
      ParametrosTaladroLG    (FK → Registro)
      Registro               (FK → Taladro)
    """
    from sqlalchemy import text
    try:
        db.execute(
            text(
                "DELETE FROM EnsayoPltRegulares WHERE registro_id IN "
                "(SELECT id FROM Registro WHERE taladro_id = :taladro_id)"
            ),
            {"taladro_id": taladro_id}
        )
        db.flush()
    except Exception:
        pass

    registros = db.query(models.Registro).filter_by(taladro_id=taladro_id).all()
    for reg in registros:
        # 1. DatosLogueoEstructural (FK directa a Registro)
        db.query(models.DatosLogueoEstructural).filter_by(
            registro_id=reg.id
        ).delete(synchronize_session=False)

        if reg.parametros:
            pid = reg.parametros.id
            # 2. Borrar TODOS los hijos de ParametrosTaladroLG en orden seguro
            #    GradoFracturamiento primero (sin dependientes)
            db.query(models.GradoFracturamiento).filter_by(
                parametrosTaladroLG_id=pid
            ).delete(synchronize_session=False)
            #    Discontinuidades (debe ir antes de DatosLogueoGral)
            db.query(models.Discontinuidades).filter_by(
                parametrosTaladroLG_id=pid
            ).delete(synchronize_session=False)
            #    MaterialRocoso
            db.query(models.MaterialRocoso).filter_by(
                parametrosTaladroLG_id=pid
            ).delete(synchronize_session=False)
            #    ValidacionRMR
            db.query(models.ValidacionRMR).filter_by(
                parametrosTaladroLG_id=pid
            ).delete(synchronize_session=False)
            #    DatosLogueoGral (FK → ParametrosTaladroLG — va al final entre los hermanos)
            db.query(models.DatosLogueoGral).filter_by(
                logueo_id=pid
            ).delete(synchronize_session=False)
            # 3. Ahora sí se puede borrar ParametrosTaladroLG (sin hijos pendientes)
            db.query(models.ParametrosTaladroLG).filter_by(
                id=pid
            ).delete(synchronize_session=False)

    db.flush()
    # 4. Ahora es seguro eliminar los Registros (sin hijos)
    db.query(models.Registro).filter_by(
        taladro_id=taladro_id
    ).delete(synchronize_session=False)
    db.flush()


@app.get("/api/taladros")
def get_taladros(db: Session = Depends(get_db)):
    """Retorna la lista simplificada de todos los taladros de la base de datos relacional."""
    taladros_db = db.query(models.Taladro).all()
    summary = []
    
    for t in taladros_db:
        collar = t.collar
        # Leer geologo y fecha desde Collar (fuente canónica del header)
        geologo = (collar.geologo if collar and collar.geologo else None) or "RD/RB"
        fecha   = (collar.fecha_registro if collar and collar.fecha_registro else None) or "2025-01-18"

        # Name representation
        name = make_taladro_name("FEGT", t.anio.anio, t.numero)
        
        summary.append({
            "name": name,
            "proyecto": "Proyecto A",  # Default campaign
            "geologo": geologo,
            "diametro": "HQ3",         # Default
            "inclinacion": t.surveys[0].dip if t.surveys else -60.0,
            "fecha_registro": fecha,
            "corridas_count": len(t.registros),
            "surveys_count": len(t.surveys)
        })
    return summary


@app.get("/api/dashboard/rqd-summary")
def get_dashboard_rqd_summary(db: Session = Depends(get_db)):
    """
    Endpoint eficiente para el Dashboard RQD & Espaciamiento.
    Realiza un JOIN profundo en una sola query SQL para agregar todos los datos
    necesarios (RQD%, Espaciamiento mm, FF/m, nombre taladro, profundidad)
    de TODOS los taladros activos, equivalente a un procedimiento almacenado.
    """
    from sqlalchemy import text
    import math as _math

    try:
        # Query principal: join Taladro → Anio + Registro + ParametrosTaladroLG + GradoFracturamiento
        # Reconstruye en Python los mismos cálculos que hace formulaEngine.ts en el front
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
        # Fallback vacío si la BD no está disponible
        return {"points_rqd_esp": [], "points_ff_rqd": [], "taladros": []}

    points_rqd_esp = []
    points_ff_rqd  = []
    taladros_set   = {}

    for row in rows:
        numero, anio, de_m, a_m, rec_m, rqd_m, lrf_m, frac_nat, frf_db, mec_frac = row

        name = make_taladro_name("FEGT", anio, numero)

        # Replicar exactamente la lógica de formulaEngine.ts
        perf = round(float(a_m) - float(de_m), 4)
        if perf <= 0 or perf > 1.6:
            continue

        rec_m  = float(rec_m  or 0)
        rqd_m  = float(rqd_m  or 0)
        lrf_m  = float(lrf_m  or 0)
        frac_nat = int(frac_nat or 0)

        if rec_m > perf or rqd_m > rec_m:
            continue

        # Calcular frf igual que el front (si DB ya lo tiene, usarlo; sino recalcular)
        if frf_db is not None and frf_db >= 0:
            frf = int(frf_db)
        else:
            frf = (_math.floor(round(lrf_m * 100) / 5) + 1) if lrf_m > 0 else 0

        total_frac = frac_nat + frf
        spacing_mm = round((perf / total_frac * 1000) if total_frac > 0 else perf * 1000)
        rqd_pct    = round((rqd_m / perf * 100) if perf > 0 else 0)
        ff_per_m   = round(total_frac / perf, 4) if perf > 0 else 0

        # Curva teórica Priest & Hudson (1976): RQD = 100 * e^(-0.1λ) * (0.1λ + 1)
        ph_teorico = round(100 * _math.exp(-0.1 * ff_per_m) * (0.1 * ff_per_m + 1), 2)

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

    # Resumen por taladro
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

def resolve_litologia3(db, lito1: str, lito2: str, lito3: str):
    import re
    def clean(s: str) -> str:
        if not s:
            return ""
        return re.sub(r'[\s_/-]', '', s.strip().upper())
        
    c1 = clean(lito1)
    c2 = clean(lito2)
    c3 = clean(lito3)
    
    if c2 in ("", "1", "NINGUNA", "-1", "-"):
        c2 = ""
    if c3 in ("", "1", "NINGUNA", "-1", "-"):
        c3 = ""
        
    from app import models
    results = db.query(models.Litologia3, models.Litologia2, models.Litologia1)\
        .filter(models.Litologia3.litologia2_id == models.Litologia2.id)\
        .filter(models.Litologia2.litologia1_id == models.Litologia1.id)\
        .all()
        
    for l3, l2, l1 in results:
        cl1 = clean(l1.nombre)
        cl2 = clean(l2.nombre)
        cl3 = clean(l3.nombre)
        if cl1 == c1 and cl2 == c2 and cl3 == c3:
            return l3
            
    for l3, l2, l1 in results:
        cl1 = clean(l1.nombre)
        cl2 = clean(l2.nombre)
        cl3 = clean(l3.nombre)
        if cl1 == c1 and cl2 == c2 and (cl3 in ("VARIOS", "", "-")):
            return l3
            
    for l3, l2, l1 in results:
        cl1 = clean(l1.nombre)
        cl2 = clean(l2.nombre)
        if cl1 == c1 and cl2 == c2:
            return l3
            
    for l3, l2, l1 in results:
        cl1 = clean(l1.nombre)
        if cl1 == c1:
            return l3
            
    if results:
        return results[0][0]
    return None

@app.get("/api/taladros/{name}", response_model=TaladroSchema)
def get_taladro(name: str, db: Session = Depends(get_db)):
    """Obtiene toda la información de un taladro por su código, reconstruyendo el JSON plano."""
    prefix, year, number = parse_taladro_name(name)
    
    # Load lithology map from database
    lito_map = {}
    try:
        from sqlalchemy import text
        litos_db = db.execute(
            text(
                "SELECT l3.id, gl.nombre, l1.nombre, l2.nombre, l3.nombre, l3.factor_k "
                "FROM Litologia3 l3 "
                "JOIN Litologia2 l2 ON l3.litologia2_id = l2.id "
                "JOIN Litologia1 l1 ON l2.litologia1_id = l1.id "
                "JOIN GrupoLitologico gl ON l1.unidad_geotecnica_id = gl.id"
            )
        ).fetchall()
        for row in litos_db:
            lito_map[row[0]] = {
                "clase": row[1].strip(),
                "l1": row[2].strip(),
                "l2": row[3].strip(),
                "l3": row[4].strip(),
                "k": row[5]
            }
    except Exception as e:
        print("Error pre-loading lithology mapping:", e)
    
    # Query Taladro
    anio_obj = db.query(models.Anio).filter_by(anio=year).first()
    if not anio_obj:
        raise HTTPException(status_code=404, detail="Taladro no encontrado (Año inexistente)")
        
    t = db.query(models.Taladro).filter_by(numero=number, anio_id=anio_obj.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Taladro no encontrado")
        
    # Get Collar details
    collar = t.collar
    
    # Leer header desde Collar (fuente canónica — independiente de las corridas)
    geologo = (collar.geologo if collar and collar.geologo else None) or "RD/RB"
    fecha_registro = (collar.fecha_registro if collar and collar.fecha_registro else None) or "2025-01-18"
                    
    # Rebuild surveys
    surveys_list = []
    for s in sorted(t.surveys, key=lambda x: x.depth):
        surveys_list.append(SurveySchema(
            depth=s.depth,
            dip=s.dip,
            azimuth=s.azim_utm
        ))
        
    # Rebuild corridas (Registros)
    corridas_list = []
    discontinuidades_list = []
    
    for idx, r in enumerate(sorted(t.registros, key=lambda x: x.de)):
        corrida_num = idx + 1
        
        # Get parameters
        param = r.parametros
        
        # Get parent and grandparent names of litologia3
        lito1 = "LMT"
        lito2 = r.lito2_nombre if r.lito2_nombre else "-1"
        lito3 = r.lito3_nombre if r.lito3_nombre else "-1"
        clase = "Intrusivas"
        
        if r.litologia and r.litologia3_id in lito_map:
            mapping = lito_map[r.litologia3_id]
            lito1 = mapping["l1"]
            if not r.lito2_nombre:
                lito2 = mapping["l2"]
            if not r.lito3_nombre:
                lito3 = mapping["l3"]
            clase = mapping["clase"]
            
        weathering = r.grado_intemperismo_code or "-1"
        
        rec_m = param.longitud_recuperada_m if param else (r.a - r.de)
        rqd_m = param.frags_mayor_10_cm if param else (r.a - r.de)
        lrf_m = param.longitud_roca_fracturada_m if param else 0.0
        
        small_frag_m = 0.0
        mec_frac = 0
        if param and param.fracturamiento:
            small_frag_m = param.fracturamiento.sum_frags_menor_10_cm
            mec_frac = param.fracturamiento.n_fracturas_mecanicas or 0
            
        orientacion = "N"
        offset = 0.0
        if param:
            mat = db.query(models.MaterialRocoso).filter_by(parametrosTaladroLG_id=param.id).first()
            if mat:
                orientacion = mat.linea_de_orientacion
                offset = float(mat.desplazamiento_0_360_offset)
                
        tipo_est1 = param.tipo_estructura_code if param and param.tipo_estructura_code else "-1"
        frac_nat = param.sum_frac_nat if param else 0
        
        frac_buz30 = 0
        frac_buz60 = 0
        frac_buz90 = 0
        if param:
            disc = db.query(models.Discontinuidades).filter_by(parametrosTaladroLG_id=param.id).first()
            if disc:
                frac_buz30 = disc.n_frac_nat_buz_menor_30 or 0
                frac_buz60 = disc.n_frac_nat_buz_menor_60 or 0
                frac_buz90 = disc.n_frac_nat_buz_mayor_60 or 0
                
        abertura = param.abertura_mm if param and param.abertura_mm is not None else 0.0
        rugosidad = param.rugosidad_isrm if param and param.rugosidad_isrm is not None else 1
        jrc10 = param.jrc_10 if param and param.jrc_10 is not None else 0
        relleno1 = param.tipo_de_relleno_1_code if param and param.tipo_de_relleno_1_code else "-1"
        espesor = param.espesor_relleno_mm if param and param.espesor_relleno_mm is not None else 0.0
        agua_obs = param.presen_agua_code if param and param.presen_agua_code else "CDC"
        resistencia = param.resistencia_estimada_code if param and param.resistencia_estimada_code else "-1"
        
        tipo_est2 = disc.tipo_estructura_2_code if (disc and disc.tipo_estructura_2_code) else "-1"
        relleno2 = disc.tipo_de_relleno_2_code if (disc and disc.tipo_de_relleno_2_code) else "-1"
        
        turno = "D"
        comentarios = ""
        if param:
            gral = db.query(models.DatosLogueoGral).filter_by(logueo_id=param.id).first()
            if gral:
                turno = gral.turno or "D"
                comentarios = gral.comentarios or ""
                
        corridas_list.append(CorridaSchema(
            corrida=corrida_num,
            de=r.de,
            a=r.a,
            rec_m=rec_m,
            rqd_m=rqd_m,
            lrf_m=lrf_m,
            small_frag_m=small_frag_m,
            mec_frac=mec_frac,
            lito1=lito1,
            lito2=lito2 if lito2 else "-1",
            lito3=lito3 if lito3 else "-1",
            resistencia=resistencia,
            orientacion=orientacion,
            offset=offset,
            tipo_est1=tipo_est1,
            tipo_est2=tipo_est2,
            frac_nat=frac_nat,
            frac_buz30=frac_buz30,
            frac_buz60=frac_buz60,
            frac_buz90=frac_buz90,
            abertura=abertura,
            rugosidad=rugosidad,
            jrc10=jrc10,
            intemperismo=weathering,
            relleno1=relleno1,
            relleno2=relleno2,
            espesor=espesor,
            agua_obs=agua_obs,
            turno=turno,
            comentarios=comentarios
        ))
        
        # Load associated structural discontinuities
        for d in r.discontinuidades:
            discontinuidades_list.append(DiscontinuidadSchema(
                id=d.id,
                de=r.de,
                a=r.a,
                profundidad=d.profundida if d.profundida is not None else r.de,
                litologia=lito_map[d.litologia3_id]["l1"] if (d.litologia and d.litologia3_id in lito_map) else lito1,
                tipo_estructura=d.tipo_estructura_code or "JN",
                alfa=d.alpha if d.alpha is not None else 0.0,
                beta=d.beta if d.beta is not None else 0.0,
                forma=d.rugosidad_codigo or 1,
                rugosidad=d.rugosidad_codigo or 1,
                jrc10=d.jrc if d.jrc is not None else 0,
                abertura=d.abertura_mm if d.abertura_mm is not None else 0.0,
                weathering=weathering,
                espesor=d.espesor_relleno_mm if d.espesor_relleno_mm is not None else 0.0,
                relleno1=d.tipo_de_relleno_1_code or "cwf",
                relleno2=d.tipo_de_relleno_2_code or "-1",
                dureza_pared=d.resistenciaISRM_abreviatura or "-1",
                agua=d.presen_agua_code or "CDC",
                geotecnico=d.geotecnico or geologo,
                comentario=d.intervalo_comentario or "",
                corrida=corrida_num,
                tipo="Natural"
            ))

    # Rebuild PLT assays
    ensayos_plt_list = []
    reg_ids = [r.id for r in t.registros]
    if reg_ids:
        db_plts = db.query(models.EnsayoPltRegulares).filter(models.EnsayoPltRegulares.registro_id.in_(reg_ids)).all()

        for plt in sorted(db_plts, key=lambda x: (to_m(x.from_m))):
            reg = next((r for r in t.registros if r.id == plt.registro_id), None)
            l1, l2, l3, clase, factor_k = "", "", "", "", 10.0
            if reg and reg.litologia3_id in lito_map:
                mapping = lito_map[reg.litologia3_id]
                l1 = mapping["l1"]
                l2 = reg.lito2_nombre or mapping["l2"]
                l3 = reg.lito3_nombre or mapping["l3"]
                clase = mapping["clase"]
                factor_k = mapping["k"]
                
                # Friendly capitalize clase
                if clase.upper() == "INTRUSIVOS":
                    clase = "Intrusivas"
                elif clase.upper() == "SEDIMENTARIOS":
                    clase = "Sedimentarias"
                elif clase.upper() == "METAMORFICAS":
                    clase = "Metamórficas"
                elif clase.upper() == "BRECHAS":
                    clase = "Brechas"
                elif clase.upper() == "ENDOSKARN":
                    clase = "Endoskarn"

            ensayos_plt_list.append(EnsayoPltSchema(
                id=plt.id,
                fecha=(plt.fecha or "").strip(),
                nro_muestra=(plt.nro_muestra or "").strip(),
                nro_caja=to_int0(plt.nro_caja),
                from_m=to_m(plt.from_m),
                to_m=to_m(plt.to_m),
                verif_corrida="OK" if plt.verif_corrida == 1 else "Error",
                long_de_corrida_m=to_m(plt.long_de_corrida_m),
                este_m=to_m(plt.este_m),
                norte_m=to_m(plt.norte_m),
                elevacion_msnm=to_m(plt.elevacion_msnm),
                long_de_muestra_mm=to_m(plt.long_de_muestra_mm),
                tipo_de_ensayo=(plt.tipo_de_ensayo or "D").strip(),
                diametro_taladro_nominacion=(plt.diametro_taladro_nominacion or "HQ").strip(),
                litologia_1=l1,
                litologia_2=l2 if l2 != "-1" else "-",
                litologia_3=l3 if l3 != "-1" else "-",
                tipo_litologico=clase,
                d_mm=to_m(plt.d_mm),
                verif_de_longitud="OK" if plt.verif_de_longitud == 1 else "Error",
                p_instr_kn=to_m(plt.p_instr_kn),
                tipo_rotura_code=(plt.tipo_rotura_code or "M").strip(),
                direccion_rotura_code=(plt.direccion_rotura_code or "NA").strip(),
                ejecutadoPor=(plt.ejecutadoPor or "").strip(),
                is_mpa=to_m(plt.is_mpa),
                fact_corr=to_m(plt.fact_corr),
                is_50_mpa=to_m(plt.is_50_mpa),
                factor_k=factor_k,
                ucs=to_m(plt.ucs),
                isrm_indice_r=(plt.isrm_indice_r or "R0").strip(),
                observaciones="" if (plt.observaciones == "-1" or not plt.observaciones) else plt.observaciones.strip()
            ))

    return TaladroSchema(
        name=name,
        proyecto=(collar.proyecto if collar and collar.proyecto else None) or "Proyecto A",
        geologo=geologo,
        diametro=(collar.diametro if collar and collar.diametro else None) or "HQ3",
        inclinacion=t.surveys[0].dip if t.surveys else -60.0,
        campana=(collar.campana if collar and collar.campana else "") or "",
        fecha_registro=fecha_registro,
        # Proyectado
        collar_este_proyectado=collar.east_proyectado if (collar and collar.east_proyectado is not None) else 0.0,
        collar_norte_proyectado=collar.north_proyectado if (collar and collar.north_proyectado is not None) else 0.0,
        collar_cota_proyectado=collar.rl_proyectado if (collar and collar.rl_proyectado is not None) else 0.0,
        prof_final_eoh_proyectada=collar.eoh_proyectado if (collar and collar.eoh_proyectado is not None) else -1.0,
        comentarios_proyectado=collar.comentarios_proyectado if (collar and collar.comentarios_proyectado is not None) else "",
        # Oficial
        collar_este=collar.east if (collar and collar.east is not None) else 0.0,
        collar_norte=collar.north if (collar and collar.north is not None) else 0.0,
        collar_cota=collar.rl if (collar and collar.rl is not None) else 0.0,
        prof_final_eoh=collar.eoh if (collar and collar.eoh is not None) else -1.0,
        comentarios=collar.comentarios if (collar and collar.comentarios is not None) else "",
        turno=(collar.turno if collar and collar.turno else "D") or "D",
        surveys=surveys_list,
        corridas=corridas_list,
        discontinuidades=discontinuidades_list,
        ensayos_plt=ensayos_plt_list
    )

@app.post("/api/taladros")
def save_taladro(taladro: TaladroSchema, db: Session = Depends(get_db)):
    """Crea o actualiza un registro de taladro guardándolo en cascada en las tablas relacionales."""
    prefix, year, number = parse_taladro_name(taladro.name)
    
    # 1. Look up or create Anio
    anio_obj = db.query(models.Anio).filter_by(anio=year).first()
    if not anio_obj:
        anio_obj = models.Anio(anio=year)
        db.add(anio_obj)
        db.flush()
        
    # 2. Look up or create/update Collar
    # Look for existing Taladro to reuse Collar if possible
    existing_t = db.query(models.Taladro).filter_by(numero=number, anio_id=anio_obj.id).first()
    if existing_t and existing_t.collar:
        collar = existing_t.collar
        # Proyectado
        collar.east_proyectado = taladro.collar_este_proyectado
        collar.north_proyectado = taladro.collar_norte_proyectado
        collar.rl_proyectado = taladro.collar_cota_proyectado
        collar.eoh_proyectado = taladro.prof_final_eoh_proyectada if taladro.prof_final_eoh_proyectada != -1.0 else None
        collar.comentarios_proyectado = taladro.comentarios_proyectado
        # Oficial
        collar.east = taladro.collar_este
        collar.north = taladro.collar_norte
        collar.rl = taladro.collar_cota
        collar.eoh = taladro.prof_final_eoh if taladro.prof_final_eoh != -1.0 else None
        collar.comentarios = taladro.comentarios
        
        collar.proyecto = taladro.proyecto
        collar.diametro = taladro.diametro
        collar.geologo = taladro.geologo
        collar.fecha_registro = taladro.fecha_registro
        collar.campana = taladro.campana
        collar.turno = taladro.turno
    else:
        collar = models.Collar(
            # Proyectado
            east_proyectado=taladro.collar_este_proyectado,
            north_proyectado=taladro.collar_norte_proyectado,
            rl_proyectado=taladro.collar_cota_proyectado,
            eoh_proyectado=taladro.prof_final_eoh_proyectada if taladro.prof_final_eoh_proyectada != -1.0 else None,
            comentarios_proyectado=taladro.comentarios_proyectado,
            # Oficial
            east=taladro.collar_este,
            north=taladro.collar_norte,
            rl=taladro.collar_cota,
            eoh=taladro.prof_final_eoh if taladro.prof_final_eoh != -1.0 else None,
            comentarios=taladro.comentarios,
            
            proyecto=taladro.proyecto,
            diametro=taladro.diametro,
            geologo=taladro.geologo,
            fecha_registro=taladro.fecha_registro,
            campana=taladro.campana,
            turno=taladro.turno,
        )
        db.add(collar)
        db.flush()
        
    # 3. Create or get Taladro
    if not existing_t:
        t = models.Taladro(
            collar_id=collar.id,
            numero=number,
            anio_id=anio_obj.id
        )
        db.add(t)
        db.flush()
    else:
        t = existing_t
        t.collar_id = collar.id
        # Eliminar surveys y registros en orden correcto (SQL Server rechaza bulk DELETE con FK activas)
        db.query(models.Survey).filter_by(taladro_id=t.id).delete(synchronize_session=False)
        delete_registros_cascade(db, t.id)

    # 4. Insert surveys
    for s in taladro.surveys:
        srv = models.Survey(
            taladro_id=t.id,
            depth=int(s.depth),
            dip=s.dip,
            azim_utm=s.azimuth
        )
        db.add(srv)
        
    # Intentar parsear la campaña como un número entero para Registro.campania, si no usar el año del taladro
    try:
        digits = re.sub(r"\D", "", taladro.campana)
        campania_val = int(digits) if digits else year
    except Exception:
        campania_val = year

    # 5. Insert runs (Registros) and children
    registros_map = {} # Maps (de, a) to Registro.id
    for c in taladro.corridas:
        # Match Litologia using hierarchy
        lito_obj = resolve_litologia3(db, c.lito1, c.lito2, c.lito3)
        litologia_id = lito_obj.id if lito_obj else None
        
        # Match Intemperismo
        int_obj = db.query(models.GradoIntemperismo).filter_by(code=c.intemperismo).first()
        int_code = int_obj.code if int_obj else None
        
        reg = models.Registro(
            taladro_id=t.id,
            de=c.de,
            a=c.a,
            campania=campania_val,
            grado_intemperismo_code=int_code,
            litologia3_id=litologia_id,
            lito2_nombre=c.lito2 if c.lito2 and c.lito2 not in ("-1", "") else None,
            lito3_nombre=c.lito3 if c.lito3 and c.lito3 not in ("-1", "") else None,
        )
        db.add(reg)
        db.flush()
        
        registros_map[(c.de, c.a)] = reg.id
        
        # Create ParametrosTaladroLG
        param = models.ParametrosTaladroLG(
            registro_id=reg.id,
            perf=c.a - c.de,
            perf_lr_ver=False,
            tipo_estructura_code=c.tipo_est1 if c.tipo_est1 != "-1" else None,
            longitud_recuperada_m=c.rec_m,
            frags_mayor_10_cm=c.rqd_m,
            longitud_roca_fracturada_m=c.lrf_m,
            abertura_mm=c.abertura,
            rugosidad_isrm=c.rugosidad,
            sum_frac_nat=c.frac_nat,
            jrc_10=c.jrc10,
            tipo_de_relleno_1_code=c.relleno1 if c.relleno1 != "-1" else None,
            espesor_relleno_mm=c.espesor,
            presen_agua_code=c.agua_obs if c.agua_obs != "-1" else None,
            resistencia_estimada_code=c.resistencia if c.resistencia != "-1" else None
        )
        db.add(param)
        db.flush()
        
        # Create GradoFracturamiento — normalizar -1 a 0 antes de sumar
        gf = models.GradoFracturamiento(
            parametrosTaladroLG_id=param.id,
            sum_frags_menor_10_cm=to_m(c.small_frag_m),
            rqd_plus_lrf_plus_frags_menor_10_cm=to_m(c.rqd_m) + to_m(c.lrf_m) + to_m(c.small_frag_m),
            lr_rqd_plus_lrf=False,
            n_fracturas_mecanicas=None if c.mec_frac < 0 else to_int0(c.mec_frac),
            frf=None,
            n_fracciones_naturales=None
        )
        db.add(gf)
        
        # Create MaterialRocoso
        mr = models.MaterialRocoso(
            parametrosTaladroLG_id=param.id,
            linea_de_orientacion=c.orientacion,
            desplazamiento_0_360_offset=int(c.offset)
        )
        db.add(mr)
        
        # Create Discontinuidades (bins) — normalizar -1 a 0 para conteos
        disc = models.Discontinuidades(
            parametrosTaladroLG_id=param.id,
            tipo_estructura_2_code=c.tipo_est2 if c.tipo_est2 not in ("-1", "") else None,
            n_frac_nat_buz_menor_30=to_int0(c.frac_buz30),
            n_frac_nat_buz_menor_60=to_int0(c.frac_buz60),
            n_frac_nat_buz_mayor_60=to_int0(c.frac_buz90),
            n_frac_nat=to_int0(c.frac_nat),
            rug_jrc=True,
            rest_intep=True,
            tipo_de_relleno_2_code=c.relleno2 if c.relleno2 not in ("-1", "") else None,
            abert_rell=None
        )
        db.add(disc)
        
        # Create DatosLogueoGral
        dlg = models.DatosLogueoGral(
            logueo_id=param.id,
            geotecnico=taladro.geologo,
            fecha=taladro.fecha_registro,
            turno=c.turno if c.turno else taladro.turno,
            comentarios=c.comentarios
        )
        db.add(dlg)
        
        # Create ValidacionRMR — usar helpers para evitar divisiones por -1 o cero
        _perf_v = max(0.01, c.a - c.de)
        _lrf_m = to_m(c.lrf_m)
        _frf_v = math.floor(round(_lrf_m * 100) / 5) + 1 if _lrf_m > 0 else 0
        _frac_nat_v = to_int0(c.frac_nat)
        _frac_v = _frac_nat_v + _frf_v
        val = models.ValidacionRMR(
            parametrosTaladroLG_id=param.id,
            fecha=taladro.fecha_registro,
            logueador=taladro.geologo,
            corrida=c.corrida,
            rec_porcentaje=round((to_m(c.rec_m) / _perf_v) * 100, 0),
            rqd_porcentaje=round((to_m(c.rqd_m) / _perf_v) * 100, 0),
            frf_zonas_trituradas=_lrf_m,
            total_de_fracturas=_frac_v,
            ff_1_m=round(_frac_v / _perf_v, 0),
            espaciamiento_mm=round((_perf_v / _frac_v) * 1000, 0) if _frac_v > 0 else 0,
            clasificacion_relleno=1
        )
        db.add(val)
        
    # 6. Insert structural discontinuities linked to Registros
    for d in taladro.discontinuidades:
        # Find which registro id fits
        reg_id = None
        for (r_de, r_a), r_id in registros_map.items():
            if r_de <= d.profundidad <= r_a:
                reg_id = r_id
                break
        
        if reg_id:
            lito_obj = resolve_litologia3(db, d.litologia, None, None)
            litologia_id = lito_obj.id if lito_obj else None
            
            struct_log = models.DatosLogueoEstructural(
                registro_id=reg_id,
                profundida=d.profundidad,
                tipo_estructura_code=d.tipo_estructura if d.tipo_estructura != "-1" else None,
                alpha=float(d.alfa) if d.alfa is not None else None,
                beta=float(d.beta) if d.beta is not None else None,
                dip=None,
                azimuth=None,
                rugosidad_codigo=d.forma,
                jrc=d.jrc10,
                abertura_mm=d.abertura,
                espesor_relleno_mm=d.espesor,
                tipo_de_relleno_1_code=d.relleno1 if d.relleno1 != "-1" else None,
                tipo_de_relleno_2_code=d.relleno2 if d.relleno2 != "-1" else None,
                resistenciaISRM_abreviatura=d.dureza_pared if d.dureza_pared != "-1" else None,
                presen_agua_code=d.agua if d.agua != "-1" else None,
                geotecnico=d.geotecnico,
                intervalo_comentario=d.comentario,
                litologia3_id=litologia_id
            )
            db.add(struct_log)

    # 7. Insert PLT assays mapped to runs
    for plt in taladro.ensayos_plt:
        reg_id = None
        for (r_de, r_a), r_id in registros_map.items():
            if r_de <= plt.from_m <= plt.to_m <= r_a:
                reg_id = r_id
                break
        
        if not reg_id:
            for (r_de, r_a), r_id in registros_map.items():
                if r_de <= plt.from_m <= r_a:
                    reg_id = r_id
                    break
        
        if not reg_id and registros_map:
            reg_id = list(registros_map.values())[0]

        if reg_id:
            db_plt = models.EnsayoPltRegulares(
                registro_id=reg_id,
                fecha=plt.fecha,
                nro_muestra=plt.nro_muestra,
                nro_caja=to_int0(plt.nro_caja),
                from_m=to_m(plt.from_m),
                to_m=to_m(plt.to_m),
                verif_corrida=1 if plt.verif_corrida == "OK" else 0,
                long_de_corrida_m=to_m(plt.long_de_corrida_m),
                este_m=to_m(plt.este_m),
                norte_m=to_m(plt.norte_m),
                elevacion_msnm=to_m(plt.elevacion_msnm),
                long_de_muestra_mm=to_m(plt.long_de_muestra_mm),
                tipo_de_ensayo=plt.tipo_de_ensayo if plt.tipo_de_ensayo not in ("-1", "", None) else None,
                diametro_taladro_nominacion=plt.diametro_taladro_nominacion if plt.diametro_taladro_nominacion not in ("-1", "", None) else None,
                d_mm=to_m(plt.d_mm),
                verif_de_longitud=1 if plt.verif_de_longitud == "OK" else 0,
                p_instr_kn=to_m(plt.p_instr_kn),
                tipo_rotura_code=plt.tipo_rotura_code if plt.tipo_rotura_code not in ("-1", "", None) else None,
                direccion_rotura_code=plt.direccion_rotura_code if plt.direccion_rotura_code not in ("-1", "", None) else None,
                ejecutadoPor=plt.ejecutadoPor,
                is_mpa=to_m(plt.is_mpa),
                fact_corr=to_m(plt.fact_corr),
                is_50_mpa=to_m(plt.is_50_mpa),
                ucs=to_m(plt.ucs),
                isrm_indice_r=plt.isrm_indice_r,
                observaciones="" if (plt.observaciones == "-1" or not plt.observaciones) else plt.observaciones.strip()
            )
            db.add(db_plt)

    db.commit()
    return {"status": "success", "message": f"Taladro {taladro.name} guardado correctamente en la base de datos relacional"}

@app.delete("/api/taladros/{name}")
def delete_taladro(name: str, db: Session = Depends(get_db)):
    """Elimina un taladro de la base de datos relacional."""
    prefix, year, number = parse_taladro_name(name)
    
    anio_obj = db.query(models.Anio).filter_by(anio=year).first()
    if not anio_obj:
        raise HTTPException(status_code=404, detail="Taladro no encontrado")
        
    t = db.query(models.Taladro).filter_by(numero=number, anio_id=anio_obj.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Taladro no encontrado")
        
    # Get Collar to delete it too
    collar = t.collar
    
    # Delete dependent registers and children (including EnsayoPltRegulares)
    delete_registros_cascade(db, t.id)
    
    # Delete Taladro and collar
    db.delete(t)
    if collar:
        db.delete(collar)
        
    db.commit()
    return {"status": "success", "message": f"Taladro {name} eliminado correctamente de la base de datos"}

@app.post("/api/calculate-row")
def calculate_row(corrida: Dict[str, Any] = Body(...), water_table_m: float = 97.0):
    """Realiza el cálculo de RMR'76 y RMR'89 para una fila."""
    result = calculate_row_rmr(corrida, water_table_m)
    return result

@app.post("/api/validate-row")
def validate_row(corrida: Dict[str, Any] = Body(...)):
    """Ejecuta los controles de consistencia física QA/QC para una fila."""
    alerts = validate_row_qaqc(corrida)
    return {
        "alerts": alerts,
        "is_valid": len([a for a in alerts if a["type"] == "CRITICAL"]) == 0
    }

@app.get("/api/catalogs")
def get_catalogs(db: Session = Depends(get_db)):
    """Catálogos dinámicos cargados directamente de la base de datos relacional (ex-BCP)."""
    try:
        resistencia = [r.abreviatura for r in db.query(models.ResistenciaISRM).all()]
        if "-1" not in resistencia:
            resistencia.append("-1")
            
        estructuras = [e.code for e in db.query(models.TipoEstructura).all()]
        
        # Load fill types and map classes
        tipo_rellenos = db.query(models.TipoRelleno).all()
        rellenos = []
        for tr in tipo_rellenos:
            code = tr.code
            name = tr.descripcion
            
            # Map fill class
            if code == "cwf" or code == "-1":
                cls = 3
            elif code in ['FBX', 'SIO', 'QZ', 'SU', 'OX', 'ep']:
                cls = 2
            else:
                cls = 1
                
            rellenos.append({
                "code": code,
                "name": name,
                "class": cls
            })
            
        weathering = [w.code for w in db.query(models.GradoIntemperismo).all()]
        agua = [a.code for a in db.query(models.PresenAgua).all()]
        
        # Add litologies to help frontend lookup
        litologias = [l.nombre.strip() for l in db.query(models.Litologia3).all()]
        
        # Load PLT specific catalogs
        from sqlalchemy import text
        tipo_ensayo_plt = [
            {"code": "D", "name": "Diametral"},
            {"code": "A", "name": "Axial"},
            {"code": "B", "name": "Bloques"},
            {"code": "I", "name": "Irregular"}
        ]
        
        diametros_perforacion = []
        try:
            diametros_perforacion = [{"code": d.nominacion.strip(), "value": d.diametro_nominal_mm} for d in db.query(models.DiametroPerforacion).all()]
        except Exception:
            pass
            
        tipo_roturas = []
        try:
            tipo_roturas = [{"code": r.code.strip(), "name": r.descripcion.strip()} for r in db.query(models.TipoRotura).all()]
        except Exception:
            pass
            
        direccion_roturas = []
        try:
            direccion_roturas = [{"code": r.code.strip(), "name": r.descripcion.strip()} for r in db.query(models.DireccionRotura).all()]
        except Exception:
            pass
            
        tabla_litologia = []
        try:
            litos_db = db.execute(
                text(
                    "SELECT gl.nombre, l1.nombre, l2.nombre, l3.nombre, l3.factor_k "
                    "FROM Litologia3 l3 "
                    "JOIN Litologia2 l2 ON l3.litologia2_id = l2.id "
                    "JOIN Litologia1 l1 ON l2.litologia1_id = l1.id "
                    "JOIN GrupoLitologico gl ON l1.unidad_geotecnica_id = gl.id"
                )
            ).fetchall()
            for row in litos_db:
                clase = row[0].strip()
                if clase.upper() == "INTRUSIVOS":
                    clase = "Intrusivas"
                elif clase.upper() == "SEDIMENTARIOS":
                    clase = "Sedimentarias"
                elif clase.upper() == "METAMORFICAS":
                    clase = "Metamórficas"
                elif clase.upper() == "BRECHAS":
                    clase = "Brechas"
                elif clase.upper() == "ENDOSKARN":
                    clase = "Endoskarn"
                tabla_litologia.append({
                    "clase": clase,
                    "l1": row[1].strip(),
                    "l2": row[2].strip() if row[2].strip() != "-1" else "-",
                    "l3": row[3].strip() if row[3].strip() != "-1" else "-",
                    "k": row[4]
                })
        except Exception as e:
            print("Error loading Litologia list for catalogs:", e)
        
        return {
            "resistencia": resistencia,
            "estructuras": estructuras,
            "rellenos": rellenos,
            "weathering": weathering,
            "agua": agua,
            "litologias": litologias,
            "tipo_ensayo_plt": tipo_ensayo_plt,
            "diametros_perforacion": diametros_perforacion,
            "tipo_roturas": tipo_roturas,
            "direccion_roturas": direccion_roturas,
            "tabla_litologia": tabla_litologia
        }
    except Exception as e:
        # Fallback to static if DB is not ready
        return {
            "resistencia": ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "-1"],
            "estructuras": ["JN", "F-10", "SZ", "BED", "VN", "CON", "SE", "F+10", "RF"],
            "rellenos": [
                {"code": "ca", "name": "Calcita", "class": 1},
                {"code": "cwf", "name": "Limpia, sin relleno", "class": 3}
            ],
            "weathering": ["UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"],
            "agua": ["CDC", "DPH", "WTM", "DGE", "FGF"],
            "litologias": ["LMT"],
            "tipo_ensayo_plt": [
                {"code": "D", "name": "Diametral"},
                {"code": "A", "name": "Axial"},
                {"code": "B", "name": "Bloques"},
                {"code": "I", "name": "Irregular"}
            ],
            "diametros_perforacion": [
                {"code": "BQ", "value": 36.5},
                {"code": "NQ", "value": 47.6},
                {"code": "HQ", "value": 61.1},
                {"code": "PQ", "value": 85.0}
            ],
            "tipo_roturas": [
                {"code": "M", "name": "Rotura por matriz (Si la muestra no se rompe no se considera M)"},
                {"code": "E", "name": "Rotura por estructura"},
                {"code": "C", "name": "Rotura combinada, por matriz y estructura"}
            ],
            "direccion_roturas": [
                {"code": "Pa", "name": "Paralela a los planos de debilidad (estratificacion, foliacion)"},
                {"code": "Pe", "name": "Perpendicular a los planos de debilidad (estratificacion, foliacion)"},
                {"code": "NA", "name": "No aplica (rocas masivas sin planos de debilidad)"}
            ],
            "tabla_litologia": []
        }

# Force Uvicorn Auto-reload triggered by code update for PLT


