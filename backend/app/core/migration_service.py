import datetime
import math
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app import models
from app.calculator import calculate_row_rmr

class GemaMigrationEngine:
    def __init__(self, db: Session):
        self.db = db
        # Inicializar cachés para optimizar rendimiento de inserción en lotes
        self.litologia_cache = {l.CodigoLitologia.strip().upper(): l.LitologiaID for l in db.query(models.Litologia).all()}
        self.estructura_cache = {e.CodigoEstructura.strip().upper(): e.TipoEstructuraID for e in db.query(models.TipoEstructura).all()}
        self.geotecnico_cache = {g.NombreCompleto.strip().upper(): g.GeotecnicoID for g in db.query(models.Geotecnico).all()}
        self.campana_cache = {c.NombreCampaña.strip().upper(): c.CampañaID for c in db.query(models.Campaña).all()}
        self.diametro_cache = {d.Codigo.strip().upper(): d.DiametroID for d in db.query(models.DiametroPerfora).all()}
        self.ensayo_plt_cache = {t.Codigo.strip().upper(): t.TipoEnsayoPLT_ID for t in db.query(models.TipoEnsayoPLT).all()}
        self.fractura_plt_cache = {f.Codigo.strip().upper(): f.TipoFracturaPLT_ID for f in db.query(models.TipoFracturaPLT).all()}
        self.direccion_ruptura_cache = {d.Codigo.strip().upper(): d.DireccionID for d in db.query(models.DireccionRuptura).all()}
        self.resistencia_isrm_cache = {r.Codigo.strip().upper(): r.ResistenciaISRM_ID for r in db.query(models.ResistenciaISRM).all()}
        self.turno_cache = {t.Codigo.strip().upper(): t.TurnoID for t in db.query(models.Turno).all()}

    def sanitize_val(self, val, target_type=float):
        """Sanitiza celdas vacías, -1, o N/A para guardarse como NULL físico en SQL Server."""
        if val is None:
            return None
        val_str = str(val).strip().upper()
        if val_str in ("", "-1", "N/A", "NULL", "NONE"):
            return None
        try:
            return target_type(val)
        except (ValueError, TypeError):
            return None

    def normalize_strength(self, val):
        """Normaliza cualquier código o índice de resistencia (ej: 0..6, '0'..'6', 'r4') a 'R0'..'R6' o NULL."""
        if val is None:
            return None
        val_str = str(val).strip().upper()
        if val_str in ("", "-1", "-1.0", "NONE", "NULL", "S/D", "-"):
            return None
        if val_str in ("0", "1", "2", "3", "4", "5", "6"):
            return f"R{val_str}"
        if val_str in ("R0", "R1", "R2", "R3", "R4", "R5", "R6"):
            return val_str
        return None

    def resolve_campana(self, name_str: str) -> int:
        clean_name = str(name_str).strip().upper()
        if "CAMPAÑA" not in clean_name and len(clean_name) == 4:
            clean_name = f"CAMPAÑA {clean_name}"
        
        if clean_name in self.campana_cache:
            return self.campana_cache[clean_name]
        
        # Crear en caliente si no existe para evitar fallo de FK
        nueva = models.Campaña(NombreCampaña=clean_name, FechaRegistro=datetime.datetime.now())
        self.db.add(nueva)
        self.db.flush()
        self.campana_cache[clean_name] = nueva.CampañaID
        return nueva.CampañaID

    def resolve_turno(self, code_str: str) -> int:
        """Resuelve dinámicamente el TurnoID a partir de cadenas del Excel o JSON."""
        if not code_str:
            return self.turno_cache.get("D") # Default a Día (ID 1)
        clean = str(code_str).strip().upper()
        if clean in ["DIA", "DAY", "D"]:
            return self.turno_cache.get("D", 1)
        if clean in ["NOCHE", "NIGHT", "N"]:
            return self.turno_cache.get("N", 2)
        return self.turno_cache.get(clean, 1)

    def resolve_geotecnico(self, name_str: str) -> int:
        if not name_str:
            return None
        clean_name = str(name_str).strip().upper()
        if clean_name in self.geotecnico_cache:
            return self.geotecnico_cache[clean_name]
            
        nuevo = models.Geotecnico(NombreCompleto=clean_name, FechaRegistro=datetime.datetime.now())
        self.db.add(nuevo)
        self.db.flush()
        self.geotecnico_cache[clean_name] = nuevo.GeotecnicoID
        return nuevo.GeotecnicoID

    def resolve_lito(self, code_str: str) -> int:
        if not code_str:
            return None
        clean_code = str(code_str).strip().upper()
        return self.litologia_cache.get(clean_code)

    def resolve_estructura(self, code_str: str) -> int:
        if not code_str:
            return None
        clean_code = str(code_str).strip().upper()
        if clean_code == "J":
            clean_code = "JN"
        return self.estructura_cache.get(clean_code)

    def resolve_factor_k_and_id(self, l1: str, l2: str, l3: str):
        """Busca dinámicamente en cat.FactorK_PLT la relación geotécnica y extrae el factor K."""
        query = self.db.query(models.FactorK_PLT).filter(models.FactorK_PLT.Lito1 == l1)
        if l2 and l2 != "-1":
            query = query.filter(models.FactorK_PLT.Lito2 == l2)
        else:
            query = query.filter(models.FactorK_PLT.Lito2 == None)
            
        if l3 and l3 != "-1":
            query = query.filter(models.FactorK_PLT.Lito3 == l3)
        else:
            query = query.filter(models.FactorK_PLT.Lito3 == None)
            
        res = query.first()
        if res:
            return res.FactorK_ID, float(res.FactorK)
        return None, 10.0 # Default factor K = 10

    def migrate_sondaje_collar(self, data: dict) -> int:
        """Migra la metadata y coordenadas del pozo a GEMA."""
        sondaje_code = str(data.get("name")).strip()
        camp_id = self.resolve_campana(data.get("campana", "2020"))
        
        sondaje = self.db.query(models.Sondaje).filter_by(CodigoSondaje=sondaje_code).first()

        resolved_turno_id = self.resolve_turno(data.get("turno", "D"))
        if not sondaje:
            sondaje = models.Sondaje(
                CodigoSondaje=sondaje_code,
                CampañaID=camp_id,
                DiametroPerfora=data.get("diametro", "HQ"),
                InclinacionTaladro=data.get("inclinacion", -60.0),
                Proyecto=data.get("proyecto", "Proyecto A"),
                Geotecnico=data.get("geologo", "RD/RB"),
                TurnoID=resolved_turno_id,
                FechaRegistro=datetime.datetime.now()
            )
            self.db.add(sondaje)
            self.db.flush()
        else:
            sondaje.CampañaID = camp_id
            sondaje.DiametroPerfora = data.get("diametro", "HQ")
            sondaje.InclinacionTaladro = data.get("inclinacion", -60.0)
            sondaje.Proyecto = data.get("proyecto", "Proyecto A")
            sondaje.Geotecnico = data.get("geologo", "RD/RB")
            sondaje.TurnoID = resolved_turno_id

        # Guardar Collar (Oficial y Proyectado)
        collar = self.db.query(models.Collar).filter_by(SondajeID=sondaje.SondajeID).first()
        if not collar:
            collar = models.Collar(
                SondajeID=sondaje.SondajeID,
                CoordenadaEste=self.sanitize_val(data.get("collar_este", 794000.0)) or 0.0,
                CoordenadaNorte=self.sanitize_val(data.get("collar_norte", 8441000.0)) or 0.0,
                Elevacion=self.sanitize_val(data.get("collar_cota", 4000.0)) or 0.0,
                ProfundidadTotal=self.sanitize_val(data.get("prof_final_eoh", 100.0)) or 0.0,
                Comentarios=data.get("comentarios", ""),
                CoordenadaEsteProyectado=self.sanitize_val(data.get("collar_este_proyectado")),
                CoordenadaNorteProyectado=self.sanitize_val(data.get("collar_norte_proyectado")),
                ElevacionProyectado=self.sanitize_val(data.get("collar_cota_proyectado")),
                ProfundidadTotalProyectada=self.sanitize_val(data.get("prof_final_eoh_proyectada")),
                ComentariosProyectado=data.get("comentarios_proyectado", ""),
                FechaRegistro=datetime.datetime.now()
            )
            self.db.add(collar)
        else:
            collar.CoordenadaEste = self.sanitize_val(data.get("collar_este", 794000.0)) or 0.0
            collar.CoordenadaNorte = self.sanitize_val(data.get("collar_norte", 8441000.0)) or 0.0
            collar.Elevacion = self.sanitize_val(data.get("collar_cota", 4000.0)) or 0.0
            collar.ProfundidadTotal = self.sanitize_val(data.get("prof_final_eoh", 100.0)) or 0.0
            collar.Comentarios = data.get("comentarios", "")
            collar.CoordenadaEsteProyectado = self.sanitize_val(data.get("collar_este_proyectado"))
            collar.CoordenadaNorteProyectado = self.sanitize_val(data.get("collar_norte_proyectado"))
            collar.ElevacionProyectado = self.sanitize_val(data.get("collar_cota_proyectado"))
            collar.ProfundidadTotalProyectada = self.sanitize_val(data.get("prof_final_eoh_proyectada"))
            collar.ComentariosProyectado = data.get("comentarios_proyectado", "")
        
        self.db.flush()
        return sondaje.SondajeID

    def migrate_surveys(self, sondaje_id: int, surveys: list):
        """Persiste las trayectorias de Survey en la tabla dbo.Survey."""
        self.db.query(models.Survey).filter_by(SondajeID=sondaje_id).delete()
        self.db.flush()

        for s in surveys:
            survey = models.Survey(
                SondajeID=sondaje_id,
                Profundidad=self.sanitize_val(s.get("depth")) or 0.0,
                Inclinacion=self.sanitize_val(s.get("dip")) or 0.0,
                Azimut=self.sanitize_val(s.get("azimuth")) or 0.0,
                FechaRegistro=datetime.datetime.now()
            )
            self.db.add(survey)
        self.db.flush()

    def migrate_corridas_and_calculate_rmr(self, sondaje_id: int, campana_id: int, geotecnico_id: int, corridas: list):
        """Inserta las corridas en dbo.LogueoGeotecnicoGeneral y procesa Validación RMR."""
        # Limpiar registros previos del pozo para evitar duplicados en cascada
        self.db.query(models.LogueoGeotecnicoGeneral).filter_by(SondajeID=sondaje_id).delete()
        self.db.query(models.ValidacionRMR).filter_by(SondajeID=sondaje_id).delete()
        self.db.flush()

        seen_intervals = set()
        for c in corridas:
            de_val = self.sanitize_val(c.get("de"), float)
            a_val = self.sanitize_val(c.get("a"), float)

            if de_val is None or a_val is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Corrida {c.get('corrida')}: los campos 'de' y 'a' son obligatorios y no pueden estar vacíos."
                )
            if (de_val, a_val) in seen_intervals:
                raise HTTPException(
                    status_code=400,
                    detail=f"Corrida {c.get('corrida')}: intervalo [{de_val}, {a_val}] duplicado — corrija los valores antes de guardar."
                )
            seen_intervals.add((de_val, a_val))
            
            l1_id = self.resolve_lito(c.get("lito1"))
            l2_id = self.resolve_lito(c.get("lito2"))
            l3_id = self.resolve_lito(c.get("lito3"))
            
            tipo_est1_id = self.resolve_estructura(c.get("tipo_est1"))
            tipo_est2_id = self.resolve_estructura(c.get("tipo_est2"))

            lrf_val = self.sanitize_val(c.get("lrf_m"))
            frf_val = c.get("frf")
            if frf_val is None or frf_val == 0:
                frf_val = math.floor(round((lrf_val or 0.0) * 100) / 5) + 1 if (lrf_val and lrf_val > 0) else 0

            # 1. Grabar Logueo Geotécnico General (LGG)
            lgg_row = models.LogueoGeotecnicoGeneral(
                SondajeID=sondaje_id,
                NumeroRegistro=int(c.get("corrida")),
                IntervaloDe=de_val,
                IntervaloA=a_val,
                LongitudRecuperada=self.sanitize_val(c.get("rec_m")),
                SumaFragmentos10cm=self.sanitize_val(c.get("rqd_m")),
                LongitudRocaFracturada=lrf_val,
                FRF=frf_val,
                NumFracturasNaturales=self.sanitize_val(c.get("frac_nat"), int),
                Litologia1ID=l1_id,
                Litologia2ID=l2_id,
                Litologia3ID=l3_id,
                ResistenciaEstimada=self.normalize_strength(c.get("resistencia")),
                TipoEstructura1ID=tipo_est1_id,
                TipoEstructura2ID=tipo_est2_id,
                NumFracBuz30=self.sanitize_val(c.get("frac_buz30"), int),
                NumFrac30a60=self.sanitize_val(c.get("frac_buz60"), int),
                NumFracBuz60=self.sanitize_val(c.get("frac_buz90"), int),
                Abertura=self.sanitize_val(c.get("abertura")),
                Rugosidad=self.sanitize_val(c.get("rugosidad"), str),
                JRC10=self.sanitize_val(c.get("jrc10")),
                GradoIntemperismo=self.sanitize_val(c.get("intemperismo"), str),
                TipoRelleno1=self.sanitize_val(c.get("relleno1"), str),
                TipoRelleno2=self.sanitize_val(c.get("relleno2"), str),
                EspesorRelleno=self.sanitize_val(c.get("espesor")),
                PresenciaAgua=self.sanitize_val(c.get("agua_obs"), str),
                GeotecnicoID=geotecnico_id,
                Comentarios=c.get("comentarios", ""),
                CampañaID=campana_id,
                FechaRegistro=datetime.datetime.now()
            )
            self.db.add(lgg_row)

            # 2. Computar RMR dinámicamente usando el calculador
            rmr_res = calculate_row_rmr(c)
            if "error" not in rmr_res:
                sc = rmr_res.get("scores", {})
                v_rmr = models.ValidacionRMR(
                    SondajeID=sondaje_id,
                    FechaValidacion=datetime.date.today(),
                    LogueadorID=geotecnico_id,
                    NumeroCorrida=int(c.get("corrida")),
                    Litologia1ID=l1_id,
                    Litologia2ID=l2_id,
                    Litologia3ID=l3_id,
                    IntervaloDe=de_val,
                    IntervaloA=a_val,
                    LongitudCorrida=rmr_res.get("perf"),
                    Recuperacion=self.sanitize_val(c.get("rec_m")),
                    RecuperacionPorc=rmr_res.get("rec_pct"),
                    RQD=self.sanitize_val(c.get("rqd_m")),
                    RQDPorc=rmr_res.get("rqd_pct"),
                    LongitudTramoFracturado=self.sanitize_val(c.get("lrf_m")),
                    FRF=rmr_res.get("frf"),
                    FracturasNaturales=self.sanitize_val(c.get("frac_nat"), int),
                    TotalFracturas=rmr_res.get("total_frac"),
                    FF_1m=round(rmr_res.get("total_frac") / max(0.01, rmr_res.get("perf")), 2),
                    Espaciamiento=rmr_res.get("spacing_mm"),
                    Resistencia=self.sanitize_val(c.get("resistencia"), str),
                    TipoEstructura=self.sanitize_val(c.get("tipo_est1"), str),
                    Abertura=self.sanitize_val(c.get("abertura")),
                    Rugosidad=self.sanitize_val(c.get("rugosidad"), str),
                    Relleno=self.sanitize_val(c.get("relleno1"), str),
                    ClasificacionRelleno=str(sc.get("relleno_76", 1)),
                    Intemperismo=self.sanitize_val(c.get("intemperismo"), str),
                    JRC10=self.sanitize_val(c.get("jrc10")),
                    EspesorRelleno=self.sanitize_val(c.get("espesor")),
                    PresenciaAgua=rmr_res.get("water_code"),
                    
                    # Puntajes RMR'76
                    RMR76_Resistencia=sc.get("resistencia"),
                    RMR76_RQD=sc.get("rqd"),
                    RMR76_Espaciamiento=sc.get("spacing_76"),
                    RMR76_Abertura=sc.get("abertura_76"),
                    RMR76_Rugosidad=sc.get("rugosidad_76"),
                    RMR76_Relleno=sc.get("relleno_76"),
                    RMR76_Intemperismo=sc.get("weathering_76"),
                    RMR76_Persistencia=sc.get("persistencia_76"),
                    RMR76_CondicionJuntas=sc.get("juntas_76"),
                    RMR76_PresenciaAgua=sc.get("agua_76"),
                    RMR76_Total=rmr_res.get("rmr_76"),
                    RMR76_CalidadRoca=rmr_res.get("class_76"),
                    
                    # Puntajes RMR'89
                    RMR89_Resistencia=sc.get("resistencia"),
                    RMR89_RQD=sc.get("rqd"),
                    RMR89_Espaciamiento=sc.get("spacing_89"),
                    RMR89_Abertura=sc.get("abertura_89"),
                    RMR89_Rugosidad=sc.get("rugosidad_89"),
                    RMR89_Relleno=sc.get("relleno_89"),
                    RMR89_Intemperismo=sc.get("weathering_89"),
                    RMR89_Persistencia=sc.get("persistencia_89"),
                    RMR89_CondicionJuntas=sc.get("juntas_89"),
                    RMR89_PresenciaAgua=sc.get("agua_89"),
                    RMR89_Total=rmr_res.get("rmr_89"),
                    RMR89_CalidadRoca=rmr_res.get("class_89"),
                    
                    LitologiaFinal=c.get("lito1", "LMT"),
                    CampañaID=campana_id,
                    FechaRegistro=datetime.datetime.now()
                )
                self.db.add(v_rmr)
        self.db.flush()

    def migrate_discontinuidades(self, sondaje_id: int, campana_id: int, geotecnico_id: int, discontinuidades: list):
        """Inserta las estructuras puntuales en la tabla corregida dbo.LogueoEstructural."""
        self.db.query(models.LogueoEstructural).filter_by(SondajeID=sondaje_id).delete()
        self.db.flush()

        for d in discontinuidades:
            de_val = self.sanitize_val(d.get("de"))
            a_val = self.sanitize_val(d.get("a"))
            if de_val is None or a_val is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Discontinuidad en profundidad {d.get('profundidad')}: los campos 'de' y 'a' son obligatorios y no pueden estar vacíos."
                )
            l1_id = self.resolve_lito(d.get("litologia"))
            l2_id = self.resolve_lito(d.get("litologia2")) # Mapeado de litología secundaria
            l3_id = self.resolve_lito(d.get("litologia3")) # Mapeado de litología terciaria
            tipo_est_id = self.resolve_estructura(d.get("tipo_estructura"))
            
            struct = models.LogueoEstructural(
                SondajeID=sondaje_id,
                IntervaloDe=de_val,
                IntervaloA=a_val,
                Profundidad=self.sanitize_val(d.get("profundidad")),
                Litologia1ID=l1_id,
                Litologia2ID=l2_id,
                Litologia3ID=l3_id,
                TipoEstructuraID=tipo_est_id,
                Alpha=self.sanitize_val(d.get("alfa")),
                Beta=self.sanitize_val(d.get("beta")),
                Dip=self.sanitize_val(d.get("dip")),
                Azimuth=self.sanitize_val(d.get("azimuth")),
                Forma=self.sanitize_val(d.get("forma"), str),
                Rugosidad=self.sanitize_val(d.get("rugosidad"), str),
                JRC10=self.sanitize_val(d.get("jrc10")),
                Abertura=self.sanitize_val(d.get("abertura")),
                GradoIntemperismo=self.sanitize_val(d.get("weathering"), str),
                EspesorRelleno=self.sanitize_val(d.get("espesor")),
                TipoRelleno1=self.sanitize_val(d.get("relleno1"), str),
                TipoRelleno2=self.sanitize_val(d.get("relleno2"), str),
                DurezaParedEstructura=self.normalize_strength(d.get("dureza_pared")),
                PresenciaAgua=self.sanitize_val(d.get("agua"), str),
                GeotecnicoID=self.resolve_geotecnico(d.get("geotecnico")),
                IntervaloComentario=d.get("comentario", ""),
                CampañaID=campana_id,
                FechaRegistro=datetime.datetime.now()
            )
            self.db.add(struct)
        self.db.flush()

    def migrate_ensayos_plt(self, sondaje_id: int, campana_id: int, ensayos_plt: list):
        """Inserta y calcula automáticamente los ensayos PLT con validación física."""
        self.db.query(models.EnsayoPLT).filter_by(SondajeID=sondaje_id).delete()
        self.db.flush()

        for plt in ensayos_plt:
            l1_str = plt.get("litologia_1")
            l2_str = plt.get("litologia_2") if plt.get("litologia_2") != "-" else None
            l3_str = plt.get("litologia_3") if plt.get("litologia_3") != "-" else None
            
            l1_id = self.resolve_lito(l1_str)
            l2_id = self.resolve_lito(l2_str)
            l3_id = self.resolve_lito(l3_str)
            
            # Recuperar factor K dinámicamente del catálogo de GEMA
            factor_k_id, factor_k_val = self.resolve_factor_k_and_id(l1_str, l2_str, l3_str)
            
            # Conversión de mm a cm de diámetro antes de grabar
            d_mm_val = self.sanitize_val(plt.get("d_mm"), float)
            d_cm_val = (d_mm_val / 10.0) if d_mm_val else None

            db_plt = models.EnsayoPLT(
                CodigoMuestra=f"{plt.get('nro_muestra')}", # Autogenerado de forma interna
                CampañaID=campana_id,
                LitologiaID_1=l1_id,
                LitologiaID_2=l2_id,
                LitologiaID_3=l3_id,
                SondajeID=sondaje_id,
                NroMuestra=plt.get("nro_muestra"),
                NroCaja=plt.get("nro_caja"),
                From_m=self.sanitize_val(plt.get("from_m")),
                To_m=self.sanitize_val(plt.get("to_m")),
                LongCorrida_m=self.sanitize_val(plt.get("long_de_corrida_m")),
                LongMuestra_mm=self.sanitize_val(plt.get("long_de_muestra_mm")),
                Espesor_D_cm=d_cm_val,
                FuerzaP_kN=self.sanitize_val(plt.get("p_instr_kn")),
                Is_MPa=self.sanitize_val(plt.get("is_mpa")),
                FactorCorr=self.sanitize_val(plt.get("fact_corr")),
                Is50_MPa=self.sanitize_val(plt.get("is_50_mpa")),
                UCS_MPa=self.sanitize_val(plt.get("ucs")),
                FactorK_ID=factor_k_id,
                TipoLitologico=plt.get("tipo_litologico"),
                EjecutadoPor=plt.get("ejecutadoPor"),
                Observaciones=plt.get("observaciones"),
                OrigenPLT="REGULAR",
                FechaRegistro=datetime.datetime.now()
            )
            self.db.add(db_plt)
        self.db.flush()