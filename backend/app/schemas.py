from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SurveySchema(BaseModel):
    depth: float = Field(..., description="Profundidad de la lectura de survey en metros")
    dip: float = Field(..., description="Dip / Inclinación (0 a 90 grados)")
    azimuth: float = Field(..., description="Azimut (0 a 360 grados)")

class CorridaSchema(BaseModel):
    corrida: int
    de: float
    a: float
    rec_m: float
    rqd_m: float
    lrf_m: float
    frf: Optional[int] = 0               # FRF (Calculado de LRF)
    small_frag_m: Optional[float] = 0.0  # Campo virtual para balance de fragmentos
    lito1: str
    lito2: Optional[str] = "-1"
    lito3: Optional[str] = "-1"
    resistencia: str
    orientacion: Optional[str] = "X"     # Opcional (No está en BD física)
    offset: Optional[float] = 0.0        # Opcional (No está en BD física)
    tipo_est1: str
    tipo_est2: Optional[str] = "-1"
    frac_nat: int
    frac_buz30: int
    frac_buz60: int
    frac_buz90: int
    abertura: float
    rugosidad: int
    jrc10: int
    intemperismo: str
    relleno1: str
    relleno2: Optional[str] = "-1"
    espesor: float
    agua_obs: str
    turno: Optional[str] = "D"
    comentarios: Optional[str] = ""

class DiscontinuidadSchema(BaseModel):
    id: int
    de: float
    a: float
    profundidad: float
    litologia: str
    litologia2: Optional[str] = "-1"
    litologia3: Optional[str] = "-1"
    tipo_estructura: str
    alfa: float
    beta: float
    forma: int
    rugosidad: int
    jrc10: int
    abertura: float
    weathering: str
    espesor: float
    relleno1: str
    relleno2: Optional[str] = "-1"
    dureza_pared: str
    agua: str
    geotecnico: str
    comentario: Optional[str] = ""
    corrida: int
    tipo: str = "Natural"

class EnsayoPltSchema(BaseModel):
    id: Optional[int] = None
    fecha: str
    nro_muestra: str
    nro_caja: int
    from_m: float
    to_m: float
    verif_corrida: str
    long_de_corrida_m: float
    este_m: float
    norte_m: float
    elevacion_msnm: float
    long_de_muestra_mm: float
    tipo_de_ensayo: str
    diametro_taladro_nominacion: str
    litologia_1: Optional[str] = ""
    litologia_2: Optional[str] = ""
    litologia_3: Optional[str] = ""
    tipo_litologico: Optional[str] = ""
    d_mm: float
    verif_de_longitud: str
    p_instr_kn: float
    tipo_rotura_code: str
    direccion_rotura_code: str
    ejecutadoPor: str
    is_mpa: float
    fact_corr: float
    is_50_mpa: float
    factor_k: float
    ucs: float
    isrm_indice_r: str
    observaciones: Optional[str] = ""

class TaladroSchema(BaseModel):
    name: str = Field(..., description="Código único del taladro (ej. FEGT25-001)")
    proyecto: str
    geologo: str
    diametro: str
    inclinacion: float
    campana: str = ""
    fecha_registro: str
    
    # Datos de Collar - Proyectado
    collar_este_proyectado: float = 0.0
    collar_norte_proyectado: float = 0.0
    collar_cota_proyectado: float = 0.0
    prof_final_eoh_proyectada: Optional[float] = -1.0
    comentarios_proyectado: Optional[str] = ""
    
    # Datos de Collar - Oficial
    collar_este: float = 0.0
    collar_norte: float = 0.0
    collar_cota: float = 0.0
    prof_final_eoh: Optional[float] = -1.0
    comentarios: Optional[str] = ""
    turno: str = "D"
    
    # Tablas hijas
    surveys: List[SurveySchema] = []
    corridas: List[CorridaSchema] = []
    discontinuidades: List[DiscontinuidadSchema] = []
    ensayos_plt: List[EnsayoPltSchema] = []

