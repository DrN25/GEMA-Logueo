from sqlalchemy import Column, Integer, Float, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Anio(Base):
    __tablename__ = "Anio"
    id = Column(Integer, primary_key=True, autoincrement=True)
    anio = Column(Integer, nullable=False)

    taladros = relationship("Taladro", back_populates="anio")

class Collar(Base):
    __tablename__ = "Collar"
    id = Column(Integer, primary_key=True, autoincrement=True)
    # Oficial
    east = Column(Float, nullable=True)
    north = Column(Float, nullable=True)
    rl = Column(Float, nullable=True)
    eoh = Column(Float, nullable=True)
    comentarios = Column(String(1000), nullable=True)
    
    # Proyectado
    east_proyectado = Column(Float, nullable=True)
    north_proyectado = Column(Float, nullable=True)
    rl_proyectado = Column(Float, nullable=True)
    eoh_proyectado = Column(Float, nullable=True)
    comentarios_proyectado = Column(String(1000), nullable=True)

    # Metadata del header del taladro
    proyecto = Column(String(200), nullable=True)
    diametro = Column(String(50), nullable=True)
    geologo = Column(String(200), nullable=True)
    fecha_registro = Column(String(50), nullable=True)
    campana = Column(String(200), nullable=True)
    turno = Column(String(50), nullable=True)

    taladros = relationship("Taladro", back_populates="collar")


class Taladro(Base):
    __tablename__ = "Taladro"
    id = Column(Integer, primary_key=True, autoincrement=True)
    collar_id = Column(Integer, ForeignKey("Collar.id"), nullable=False)
    numero = Column(Integer, nullable=False)
    anio_id = Column(Integer, ForeignKey("Anio.id"), nullable=False)

    collar = relationship("Collar", back_populates="taladros")
    anio = relationship("Anio", back_populates="taladros")
    surveys = relationship("Survey", back_populates="taladro", cascade="all, delete-orphan")
    registros = relationship("Registro", back_populates="taladro", cascade="all, delete-orphan")

class Survey(Base):
    __tablename__ = "Survey"
    id = Column(Integer, primary_key=True, autoincrement=True)
    taladro_id = Column(Integer, ForeignKey("Taladro.id"), nullable=False)
    depth = Column(Float, nullable=False)  # Mapped as float or integer
    dip = Column(Float, nullable=False)
    azim_utm = Column(Float, nullable=False)

    taladro = relationship("Taladro", back_populates="surveys")

class Registro(Base):
    __tablename__ = "Registro"
    id = Column(Integer, primary_key=True, autoincrement=True)
    taladro_id = Column(Integer, ForeignKey("Taladro.id"), nullable=False)
    de = Column(Float, nullable=False)
    a = Column(Float, nullable=False)
    campania = Column(Integer, nullable=False)
    grado_intemperismo_code = Column(String(1000), ForeignKey("GradoIntemperismo.code"), nullable=True)
    litologia3_id = Column(Integer, ForeignKey("Litologia3.id"), nullable=True)
    # Litologías secundaria y terciaria (nombre libre, no requieren FK)
    lito2_nombre = Column(String(200), nullable=True)
    lito3_nombre = Column(String(200), nullable=True)

    taladro = relationship("Taladro", back_populates="registros")
    intemperismo = relationship("GradoIntemperismo")
    litologia = relationship("Litologia3")
    
    # Children
    parametros = relationship("ParametrosTaladroLG", back_populates="registro", uselist=False, cascade="all, delete-orphan")
    discontinuidades = relationship("DatosLogueoEstructural", back_populates="registro", cascade="all, delete-orphan")
    ensayos_plt = relationship("EnsayoPltRegulares", back_populates="registro", cascade="all, delete-orphan")

class ParametrosTaladroLG(Base):
    __tablename__ = "ParametrosTaladroLG"
    id = Column(Integer, primary_key=True, autoincrement=True)
    registro_id = Column(Integer, ForeignKey("Registro.id"), nullable=False)
    perf = Column(Float, nullable=False)
    perf_lr_ver = Column(Boolean, nullable=False)
    tipo_estructura_code = Column(String(1000), ForeignKey("TipoEstructura.code"), nullable=True)
    longitud_recuperada_m = Column(Float, nullable=False)
    frags_mayor_10_cm = Column(Float, nullable=False)
    longitud_roca_fracturada_m = Column(Float, nullable=False)
    abertura_mm = Column(Float, nullable=True)
    rugosidad_isrm = Column(Integer, nullable=True)
    sum_frac_nat = Column(Integer, nullable=False)
    jrc_10 = Column(Integer, nullable=True)
    tipo_de_relleno_1_code = Column(String(1000), ForeignKey("TipoRelleno.code"), nullable=True)
    espesor_relleno_mm = Column(Float, nullable=True)
    presen_agua_code = Column(String(1000), ForeignKey("PresenAgua.code"), nullable=True)
    resistencia_estimada_code = Column(String(1000), ForeignKey("ResistenciaISRM.abreviatura"), nullable=True)

    registro = relationship("Registro", back_populates="parametros")
    tipo_estructura = relationship("TipoEstructura")
    tipo_relleno = relationship("TipoRelleno")
    presen_agua = relationship("PresenAgua")
    resistencia = relationship("ResistenciaISRM")
    
    fracturamiento = relationship("GradoFracturamiento", back_populates="parametros", uselist=False, cascade="all, delete-orphan")

class GradoFracturamiento(Base):
    __tablename__ = "GradoFracturamiento"
    id = Column(Integer, primary_key=True, autoincrement=True)
    parametrosTaladroLG_id = Column(Integer, ForeignKey("ParametrosTaladroLG.id"), nullable=False)
    sum_frags_menor_10_cm = Column(Float, nullable=False)
    rqd_plus_lrf_plus_frags_menor_10_cm = Column(Float, nullable=False)
    lr_rqd_plus_lrf = Column(Boolean, nullable=False)
    n_fracturas_mecanicas = Column(Integer, nullable=True)
    frf = Column(Integer, nullable=True)
    n_fracciones_naturales = Column(Integer, nullable=True)

    parametros = relationship("ParametrosTaladroLG", back_populates="fracturamiento")

class DatosLogueoEstructural(Base):
    __tablename__ = "DatosLogueoEstructural"
    id = Column(Integer, primary_key=True, autoincrement=True)
    registro_id = Column(Integer, ForeignKey("Registro.id"), nullable=False)
    profundida = Column(Float, nullable=True)  # matching lack of ending 'd'
    tipo_estructura_code = Column(String(1000), ForeignKey("TipoEstructura.code"), nullable=True)
    alpha = Column(Float, nullable=True)       # matching 'ph' spelling
    beta = Column(Float, nullable=True)
    dip = Column(Float, nullable=True)
    azimuth = Column(Float, nullable=True)
    rugosidad_codigo = Column(Integer, ForeignKey("RugosidadForma.codigo"), nullable=True)
    jrc = Column(Integer, nullable=True)
    abertura_mm = Column(Float, nullable=True)
    espesor_relleno_mm = Column(Float, nullable=True)
    tipo_de_relleno_1_code = Column(String(1000), ForeignKey("TipoRelleno.code"), nullable=True)
    tipo_de_relleno_2_code = Column(String(1000), ForeignKey("TipoRelleno.code"), nullable=True)
    resistenciaISRM_abreviatura = Column(String(1000), ForeignKey("ResistenciaISRM.abreviatura"), nullable=True)
    presen_agua_code = Column(String(1000), ForeignKey("PresenAgua.code"), nullable=True)
    geotecnico = Column(String(1000), nullable=True)
    intervalo_comentario = Column(String(1000), nullable=True)
    litologia3_id = Column(Integer, ForeignKey("Litologia3.id"), nullable=True)

    registro = relationship("Registro", back_populates="discontinuidades")
    tipo_estructura = relationship("TipoEstructura")
    rugosidad = relationship("RugosidadForma")
    tipo_relleno1 = relationship("TipoRelleno", foreign_keys=[tipo_de_relleno_1_code])
    tipo_relleno2 = relationship("TipoRelleno", foreign_keys=[tipo_de_relleno_2_code])
    resistencia = relationship("ResistenciaISRM")
    presen_agua = relationship("PresenAgua")
    litologia = relationship("Litologia3")

# Lookups & Catalogs
class Litologia1(Base):
    __tablename__ = "Litologia1"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(1000), nullable=False)
    unidad_geotecnica_id = Column(Integer, nullable=False)

class Litologia2(Base):
    __tablename__ = "Litologia2"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(1000), nullable=False)
    litologia1_id = Column(Integer, nullable=False)

class Litologia3(Base):
    __tablename__ = "Litologia3"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(1000), nullable=False)
    factor_k = Column(Float, nullable=False)
    litologia2_id = Column(Integer, nullable=False)

class ResistenciaISRM(Base):
    __tablename__ = "ResistenciaISRM"
    abreviatura = Column(String(1000), primary_key=True)
    ucs_min_mpa = Column(Float, nullable=False)
    denominacion = Column(String(1000), nullable=False)

class GradoIntemperismo(Base):
    __tablename__ = "GradoIntemperismo"
    code = Column(String(1000), primary_key=True)
    val_rmr_76 = Column(Integer, nullable=False)
    val_rmr89 = Column(Integer, nullable=False)
    descripcion = Column(String(1000), nullable=False)

class PresenAgua(Base):
    __tablename__ = "PresenAgua"
    code = Column(String(1000), primary_key=True)
    val_rmr76 = Column(Integer, nullable=False)
    val_rmr89 = Column(Integer, nullable=False)
    presen_water = Column(String(1000), nullable=False)

class TipoEstructura(Base):
    __tablename__ = "TipoEstructura"
    code = Column(String(1000), primary_key=True)
    tipoEstructura = Column(String(1000), nullable=False)
    traslacion = Column(String(1000), nullable=False)

class TipoRelleno(Base):
    __tablename__ = "TipoRelleno"
    code = Column(String(1000), primary_key=True)
    descripcion = Column(String(1000), nullable=False)

class RugosidadForma(Base):
    __tablename__ = "RugosidadForma"
    codigo = Column(Integer, primary_key=True)
    val_rmr_76 = Column(Integer, nullable=False)
    val_rmr89 = Column(Integer, nullable=False)
    descripcion = Column(String(255), nullable=False)

class ValidacionRMR(Base):
    __tablename__ = "ValidacionRMR"
    id = Column(Integer, primary_key=True, autoincrement=True)
    parametrosTaladroLG_id = Column(Integer, ForeignKey("ParametrosTaladroLG.id"), nullable=False)
    fecha = Column(String(1000), nullable=True)
    logueador = Column(String(1000), nullable=True)
    corrida = Column(Integer, nullable=False)
    rec_porcentaje = Column(Float, nullable=False)
    rqd_porcentaje = Column(Float, nullable=False)
    frf_zonas_trituradas = Column(Float, nullable=False)
    total_de_fracturas = Column(Integer, nullable=False)
    ff_1_m = Column(Integer, nullable=False)
    espaciamiento_mm = Column(Integer, nullable=False)
    clasificacion_relleno = Column(Integer, nullable=False)

class DatosLogueoGral(Base):
    __tablename__ = "DatosLogueoGral"
    id = Column(Integer, primary_key=True, autoincrement=True)
    logueo_id = Column(Integer, ForeignKey("ParametrosTaladroLG.id"), nullable=False)
    geotecnico = Column(String(1000), nullable=True)
    fecha = Column(String(1000), nullable=True)
    turno = Column(String(1000), nullable=True)
    comentarios = Column(String(1000), nullable=True)

class Discontinuidades(Base):
    __tablename__ = "Discontinuidades"
    id = Column(Integer, primary_key=True, autoincrement=True)
    parametrosTaladroLG_id = Column(Integer, ForeignKey("ParametrosTaladroLG.id"), nullable=False)
    tipo_estructura_2_code = Column(String(1000), ForeignKey("TipoEstructura.code"), nullable=True)
    n_frac_nat_buz_menor_30 = Column(Integer, nullable=False)
    n_frac_nat_buz_menor_60 = Column(Integer, nullable=False)
    n_frac_nat_buz_mayor_60 = Column(Integer, nullable=False)
    n_frac_nat = Column(Integer, nullable=False)
    rug_jrc = Column(Boolean, nullable=False)
    rest_intep = Column(Boolean, nullable=False)
    tipo_de_relleno_2_code = Column(String(1000), ForeignKey("TipoRelleno.code"), nullable=True)
    abert_rell = Column(Boolean, nullable=True)

class MaterialRocoso(Base):
    __tablename__ = "MaterialRocoso"
    id = Column(Integer, primary_key=True, autoincrement=True)
    parametrosTaladroLG_id = Column(Integer, ForeignKey("ParametrosTaladroLG.id"), nullable=False)
    linea_de_orientacion = Column(String(1000), nullable=False)
    desplazamiento_0_360_offset = Column(Integer, nullable=False)

class ValoracionRelleno(Base):
    __tablename__ = "ValoracionRelleno"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo_relleno_code = Column(String(1000), ForeignKey("TipoRelleno.code"), nullable=False)
    clasificacion = Column(Integer, nullable=True)
    sin_relleno_76 = Column(Integer, nullable=True)
    sin_relleno_89 = Column(Integer, nullable=True)
    relleno_duro_menor_5_mm_76 = Column(Integer, nullable=True)
    relleno_duro_menor_5_mm_89 = Column(Integer, nullable=True)
    relleno_duro_mayor_5_mm_76 = Column(Integer, nullable=True)
    relleno_duro_mayor_5_mm_89 = Column(Integer, nullable=True)
    relleno_blando_menor_5_mm_76 = Column(Integer, nullable=True)
    relleno_blando_menor_5_mm_89 = Column(Integer, nullable=True)
    relleno_blando_mayor_5_mm_76 = Column(Integer, nullable=True)
    relleno_blando_mayor_5_mm_89 = Column(Integer, nullable=True)

class DiametroPerforacion(Base):
    __tablename__ = "DiametroPerforacion"
    nominacion = Column(String(50), primary_key=True)
    diametro_nominal_mm = Column(Float, nullable=False)

class TipoRotura(Base):
    __tablename__ = "TipoRotura"
    code = Column(String(50), primary_key=True)
    descripcion = Column(String(200), nullable=False)

class DireccionRotura(Base):
    __tablename__ = "DireccionRotura"
    code = Column(String(50), primary_key=True)
    descripcion = Column(String(200), nullable=False)

class EnsayoPltRegulares(Base):
    __tablename__ = "EnsayoPltRegulares"
    id = Column(Integer, primary_key=True, autoincrement=True)
    registro_id = Column(Integer, ForeignKey("Registro.id"), nullable=False)
    fecha = Column(String(50), nullable=False)
    nro_muestra = Column(String(100), nullable=True)
    nro_caja = Column(Integer, nullable=True)
    from_m = Column(Float, nullable=True)
    to_m = Column(Float, nullable=True)
    verif_corrida = Column(Integer, nullable=True)
    long_de_corrida_m = Column(Float, nullable=True)
    este_m = Column(Float, nullable=True)
    norte_m = Column(Float, nullable=True)
    elevacion_msnm = Column(Float, nullable=True)
    long_de_muestra_mm = Column(Float, nullable=True)
    tipo_de_ensayo = Column(String(50), nullable=True)
    diametro_taladro_nominacion = Column(String(50), nullable=True)
    d_mm = Column(Float, nullable=True)
    verif_de_longitud = Column(Integer, nullable=False, default=1)
    p_instr_kn = Column(Float, nullable=True)
    tipo_rotura_code = Column(String(50), nullable=True)
    direccion_rotura_code = Column(String(50), nullable=True)
    ejecutadoPor = Column(String(100), nullable=True)
    is_mpa = Column(Float, nullable=True)
    fact_corr = Column(Float, nullable=True)
    is_50_mpa = Column(Float, nullable=True)
    ucs = Column(Float, nullable=True)
    isrm_indice_r = Column(String(50), nullable=True)
    observaciones = Column(String(1000), nullable=True)

    registro = relationship("Registro", back_populates="ensayos_plt")
