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
        if isinstance(val, (int, float)) and val == -1:
            return None
        val_str = str(val).strip().upper()
        if val_str in ("", "-1", "-1.0", "N/A", "NULL", "NONE"):
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
        """Guarda las corridas en dbo.LogueoGeotecnicoGeneral y procesa Validación RMR.

        UPSERT (ya NO delete+insert): los registros existentes se ACTUALIZAN por id
        (fallback por intervalo de/a) preservando columnas que otros sistemas llenan;
        solo se eliminan los que el usuario quitó de la lista.
        """
        now = datetime.datetime.now()
        existing = {
            l.LogueoGeneralID: l
            for l in self.db.query(models.LogueoGeotecnicoGeneral).filter_by(SondajeID=sondaje_id).all()
        }
        existing_rmr = {
            v.NumeroCorrida: v
            for v in self.db.query(models.ValidacionRMR).filter_by(SondajeID=sondaje_id).all()
        }
        used_ids = set()
        used_rmr_corridas = set()

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

            # ── Resolver registro destino (UPDATE por id, fallback por intervalo) ──
            target = None
            cid = c.get("id")
            if cid is not None and cid in existing:
                target = existing[cid]
            if target is None:
                for lid, l in existing.items():
                    if lid not in used_ids and float(l.IntervaloDe) == de_val and float(l.IntervaloA) == a_val:
                        target = l
                        break
            if target is None:
                target = models.LogueoGeotecnicoGeneral(SondajeID=sondaje_id, FechaRegistro=now)
                self.db.add(target)
            else:
                used_ids.add(target.LogueoGeneralID)

            l1_id = self.resolve_lito(c.get("lito1"))
            l2_id = self.resolve_lito(c.get("lito2"))
            l3_id = self.resolve_lito(c.get("lito3"))
            
            tipo_est1_id = self.resolve_estructura(c.get("tipo_est1"))
            tipo_est2_id = self.resolve_estructura(c.get("tipo_est2"))

            lrf_val = self.sanitize_val(c.get("lrf_m"))
            frf_val = c.get("frf")
            if frf_val is None or frf_val == 0:
                frf_val = math.floor(round((lrf_val or 0.0) * 100) / 5) + 1 if (lrf_val and lrf_val > 0) else 0

            # 1. Grabar / actualizar Logueo Geotécnico General (LGG)
            target.NumeroRegistro = int(c.get("corrida"))
            target.IntervaloDe = de_val
            target.IntervaloA = a_val
            target.LongitudRecuperada = self.sanitize_val(c.get("rec_m"))
            target.SumaFragmentos10cm = self.sanitize_val(c.get("rqd_m"))
            target.LongitudRocaFracturada = lrf_val
            target.FRF = frf_val
            target.NumFracturasNaturales = self.sanitize_val(c.get("frac_nat"), int)
            target.Litologia1ID = l1_id
            target.Litologia2ID = l2_id
            target.Litologia3ID = l3_id
            target.ResistenciaEstimada = self.normalize_strength(c.get("resistencia"))
            target.TipoEstructura1ID = tipo_est1_id
            target.TipoEstructura2ID = tipo_est2_id
            target.NumFracBuz30 = self.sanitize_val(c.get("frac_buz30"), int)
            target.NumFrac30a60 = self.sanitize_val(c.get("frac_buz60"), int)
            target.NumFracBuz60 = self.sanitize_val(c.get("frac_buz90"), int)
            target.Abertura = self.sanitize_val(c.get("abertura"))
            target.Rugosidad = self.sanitize_val(c.get("rugosidad"), str)
            target.JRC10 = self.sanitize_val(c.get("jrc10"))
            target.GradoIntemperismo = self.sanitize_val(c.get("intemperismo"), str)
            target.TipoRelleno1 = self.sanitize_val(c.get("relleno1"), str)
            target.TipoRelleno2 = self.sanitize_val(c.get("relleno2"), str)
            target.EspesorRelleno = self.sanitize_val(c.get("espesor"))
            target.PresenciaAgua = self.sanitize_val(c.get("agua_obs"), str)
            target.GeotecnicoID = geotecnico_id
            target.Comentarios = c.get("comentarios", "")
            target.CampañaID = campana_id

            # 2. Computar RMR dinámicamente usando el calculador
            corrida_num = int(c.get("corrida"))
            used_rmr_corridas.add(corrida_num)
            rmr_res = calculate_row_rmr(c)
            v_rmr = existing_rmr.get(corrida_num)
            if "error" not in rmr_res:
                sc = rmr_res.get("scores", {})
                if v_rmr is None:
                    v_rmr = models.ValidacionRMR(
                        SondajeID=sondaje_id,
                        CampañaID=campana_id,
                        FechaRegistro=now,
                    )
                    self.db.add(v_rmr)
                v_rmr.FechaValidacion = datetime.date.today()
                v_rmr.LogueadorID = geotecnico_id
                v_rmr.NumeroCorrida = corrida_num
                v_rmr.Litologia1ID = l1_id
                v_rmr.Litologia2ID = l2_id
                v_rmr.Litologia3ID = l3_id
                v_rmr.IntervaloDe = de_val
                v_rmr.IntervaloA = a_val
                v_rmr.LongitudCorrida = rmr_res.get("perf")
                v_rmr.Recuperacion = self.sanitize_val(c.get("rec_m"))
                v_rmr.RecuperacionPorc = rmr_res.get("rec_pct")
                v_rmr.RQD = self.sanitize_val(c.get("rqd_m"))
                v_rmr.RQDPorc = rmr_res.get("rqd_pct")
                v_rmr.LongitudTramoFracturado = self.sanitize_val(c.get("lrf_m"))
                v_rmr.FRF = rmr_res.get("frf")
                v_rmr.FracturasNaturales = self.sanitize_val(c.get("frac_nat"), int)
                v_rmr.TotalFracturas = rmr_res.get("total_frac")
                v_rmr.FF_1m = round(rmr_res.get("total_frac") / max(0.01, rmr_res.get("perf")))  # Solo enteros (Reglas.md)
                v_rmr.Espaciamiento = rmr_res.get("spacing_mm")
                v_rmr.Resistencia = self.sanitize_val(c.get("resistencia"), str)
                v_rmr.TipoEstructura = self.sanitize_val(c.get("tipo_est1"), str)
                v_rmr.Abertura = self.sanitize_val(c.get("abertura"))
                v_rmr.Rugosidad = self.sanitize_val(c.get("rugosidad"), str)
                v_rmr.Relleno = self.sanitize_val(c.get("relleno1"), str)
                v_rmr.ClasificacionRelleno = str(sc.get("relleno_76", 1))
                v_rmr.Intemperismo = self.sanitize_val(c.get("intemperismo"), str)
                v_rmr.JRC10 = self.sanitize_val(c.get("jrc10"))
                v_rmr.EspesorRelleno = self.sanitize_val(c.get("espesor"))
                v_rmr.PresenciaAgua = rmr_res.get("water_code")

                # Puntajes RMR'76
                v_rmr.RMR76_Resistencia = sc.get("resistencia")
                v_rmr.RMR76_RQD = sc.get("rqd")
                v_rmr.RMR76_Espaciamiento = sc.get("spacing_76")
                v_rmr.RMR76_Abertura = sc.get("abertura_76")
                v_rmr.RMR76_Rugosidad = sc.get("rugosidad_76")
                v_rmr.RMR76_Relleno = sc.get("relleno_76")
                v_rmr.RMR76_Intemperismo = sc.get("weathering_76")
                v_rmr.RMR76_Persistencia = sc.get("persistencia_76")
                v_rmr.RMR76_CondicionJuntas = sc.get("juntas_76")
                v_rmr.RMR76_PresenciaAgua = sc.get("agua_76")
                v_rmr.RMR76_Total = rmr_res.get("rmr_76")
                v_rmr.RMR76_CalidadRoca = rmr_res.get("class_76")

                # Puntajes RMR'89
                v_rmr.RMR89_Resistencia = sc.get("resistencia")
                v_rmr.RMR89_RQD = sc.get("rqd")
                v_rmr.RMR89_Espaciamiento = sc.get("spacing_89")
                v_rmr.RMR89_Abertura = sc.get("abertura_89")
                v_rmr.RMR89_Rugosidad = sc.get("rugosidad_89")
                v_rmr.RMR89_Relleno = sc.get("relleno_89")
                v_rmr.RMR89_Intemperismo = sc.get("weathering_89")
                v_rmr.RMR89_Persistencia = sc.get("persistencia_89")
                v_rmr.RMR89_CondicionJuntas = sc.get("juntas_89")
                v_rmr.RMR89_PresenciaAgua = sc.get("agua_89")
                v_rmr.RMR89_Total = rmr_res.get("rmr_89")
                v_rmr.RMR89_CalidadRoca = rmr_res.get("class_89")

                v_rmr.LitologiaFinal = c.get("lito1", "LMT")
            elif v_rmr is not None:
                # La corrida quedó incompleta -> su fila de ValidacionRMR no debe existir
                self.db.delete(v_rmr)

        # 3. DELETE selectivo: solo los registros que el usuario quitó de la lista
        for lid, l in existing.items():
            if lid not in used_ids:
                self.db.delete(l)
        for cnum, v in existing_rmr.items():
            if cnum not in used_rmr_corridas:
                self.db.delete(v)

        self.db.flush()

    def migrate_discontinuidades(self, sondaje_id: int, campana_id: int, geotecnico_id: int, discontinuidades: list):
        """Guarda las estructuras puntuales en dbo.LogueoEstructural (UPSERT por id)."""
        now = datetime.datetime.now()
        existing = {
            d.LogueoEstructuralID: d
            for d in self.db.query(models.LogueoEstructural).filter_by(SondajeID=sondaje_id).all()
        }
        used_ids = set()

        for d in discontinuidades:
            de_val = self.sanitize_val(d.get("de"))
            a_val = self.sanitize_val(d.get("a"))
            if de_val is None or a_val is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Discontinuidad en profundidad {d.get('profundidad')}: los campos 'de' y 'a' son obligatorios y no pueden estar vacíos."
                )
            # ── Resolver registro destino (UPDATE por id; id=0/sin id -> INSERT) ──
            target = None
            did = d.get("id")
            if did and did in existing:
                target = existing[did]
                used_ids.add(did)
            if target is None:
                target = models.LogueoEstructural(SondajeID=sondaje_id, FechaRegistro=now)
                self.db.add(target)

            l1_id = self.resolve_lito(d.get("litologia"))
            l2_id = self.resolve_lito(d.get("litologia2")) # Mapeado de litología secundaria
            l3_id = self.resolve_lito(d.get("litologia3")) # Mapeado de litología terciaria
            tipo_est_id = self.resolve_estructura(d.get("tipo_estructura"))

            target.IntervaloDe = de_val
            target.IntervaloA = a_val
            target.Profundidad = self.sanitize_val(d.get("profundidad"))
            target.Litologia1ID = l1_id
            target.Litologia2ID = l2_id
            target.Litologia3ID = l3_id
            target.TipoEstructuraID = tipo_est_id
            target.Alpha = self.sanitize_val(d.get("alfa"))
            target.Beta = self.sanitize_val(d.get("beta"))
            target.Dip = self.sanitize_val(d.get("dip"))
            target.Azimuth = self.sanitize_val(d.get("azimuth"))
            target.Forma = self.sanitize_val(d.get("forma"), str)
            target.Rugosidad = self.sanitize_val(d.get("rugosidad"), str)
            target.JRC10 = self.sanitize_val(d.get("jrc10"))
            target.Abertura = self.sanitize_val(d.get("abertura"))
            target.GradoIntemperismo = self.sanitize_val(d.get("weathering"), str)
            target.EspesorRelleno = self.sanitize_val(d.get("espesor"))
            target.TipoRelleno1 = self.sanitize_val(d.get("relleno1"), str)
            target.TipoRelleno2 = self.sanitize_val(d.get("relleno2"), str)
            target.DurezaParedEstructura = self.normalize_strength(d.get("dureza_pared"))
            target.PresenciaAgua = self.sanitize_val(d.get("agua"), str)
            target.GeotecnicoID = self.resolve_geotecnico(d.get("geotecnico"))
            target.IntervaloComentario = d.get("comentario", "")
            target.CampañaID = campana_id

        # DELETE selectivo: solo los que el usuario quitó de la lista
        for lid, d in existing.items():
            if lid not in used_ids:
                self.db.delete(d)
        self.db.flush()

    def migrate_ensayos_plt(self, sondaje_id: int, campana_id: int, ensayos_plt: list):
        """Guarda los ensayos PLT (UPSERT por id).

        Los ensayos EXISTENTES se actualizan SOLO en los campos que la app maneja:
        las columnas de otros sistemas (UsuarioRegistro, DenominacionISRM, DominioID,
        VentanaID, LithoModelo2022, ZonaGeomecanica, Nivel, SectorGeotecnicoID,
        FactorK_Valor, FuenteExcel_Fila...) se PRESERVAN intactas.
        Solo se eliminan los ensayos que el usuario quitó de la lista.
        """
        now = datetime.datetime.now()
        existing = {
            p.EnsayoPLT_ID: p
            for p in self.db.query(models.EnsayoPLT).filter_by(SondajeID=sondaje_id).all()
        }
        used_ids = set()

        for plt in ensayos_plt:
            l1_str = plt.get("litologia_1")
            l2_str = plt.get("litologia_2") if plt.get("litologia_2") != "-" else None
            l3_str = plt.get("litologia_3") if plt.get("litologia_3") != "-" else None
            
            l1_id = self.resolve_lito(l1_str)
            l2_id = self.resolve_lito(l2_str)
            l3_id = self.resolve_lito(l3_str)
            
            # Recuperar factor K dinámicamente del catálogo de GEMA
            factor_k_id, _factor_k_val = self.resolve_factor_k_and_id(l1_str, l2_str, l3_str)
            
            # Conversión de mm a cm de diámetro antes de grabar
            d_mm_val = self.sanitize_val(plt.get("d_mm"), float)
            d_cm_val = (d_mm_val / 10.0) if d_mm_val else None

            # ── Resolver registro destino (UPDATE por id; sin id -> INSERT) ──
            target = None
            pid = plt.get("id")
            if pid and pid in existing:
                target = existing[pid]
                used_ids.add(pid)
            if target is None:
                target = models.EnsayoPLT(
                    SondajeID=sondaje_id,
                    OrigenPLT="REGULAR",
                    FechaRegistro=now,
                )
                self.db.add(target)

            target.CodigoMuestra = f"{plt.get('nro_muestra')}"  # Autogenerado de forma interna
            target.CampañaID = campana_id
            target.LitologiaID_1 = l1_id
            target.LitologiaID_2 = l2_id
            target.LitologiaID_3 = l3_id
            target.NroMuestra = plt.get("nro_muestra")
            target.NroCaja = plt.get("nro_caja")
            target.From_m = self.sanitize_val(plt.get("from_m"))
            target.To_m = self.sanitize_val(plt.get("to_m"))
            target.LongCorrida_m = self.sanitize_val(plt.get("long_de_corrida_m"))
            target.LongMuestra_mm = self.sanitize_val(plt.get("long_de_muestra_mm"))
            target.Espesor_D_cm = d_cm_val
            target.FuerzaP_kN = self.sanitize_val(plt.get("p_instr_kn"))
            target.Is_MPa = self.sanitize_val(plt.get("is_mpa"))
            target.FactorCorr = self.sanitize_val(plt.get("fact_corr"))
            target.Is50_MPa = self.sanitize_val(plt.get("is_50_mpa"))
            target.UCS_MPa = self.sanitize_val(plt.get("ucs"))
            target.FactorK_ID = factor_k_id
            target.TipoLitologico = plt.get("tipo_litologico")
            target.EjecutadoPor = plt.get("ejecutadoPor")
            target.Observaciones = plt.get("observaciones")

        # DELETE selectivo: solo los ensayos que el usuario quitó de la lista
        for pid, p in existing.items():
            if pid not in used_ids:
                self.db.delete(p)
        self.db.flush()