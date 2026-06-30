from sqlalchemy import Column, Integer, Float, String, ForeignKey, Boolean, Date, DateTime, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# --- ESQUEMA: dbo (Campañas, Sondajes, Collar, Logueos, Validación RMR) ---

class Campaña(Base):
    __tablename__ = "Campañas"
    __table_args__ = {"schema": "dbo"}
    CampañaID = Column(Integer, primary_key=True)
    NombreCampaña = Column(String(100), unique=True, nullable=False)
    FechaInicio = Column(Date, nullable=True)
    FechaFin = Column(Date, nullable=True)
    Descripcion = Column(String(500), nullable=True)
    Estado = Column(String(20), nullable=False, default="Activa")
    FechaRegistro = Column(DateTime, nullable=False)

class Turno(Base):
    __tablename__ = "Turno"
    __table_args__ = {"schema": "cat"}
    TurnoID = Column(Integer, primary_key=True, autoincrement=True)
    Codigo = Column(String(5), unique=True, nullable=False)
    Descripcion = Column(String(50), nullable=False)
    FechaRegistro = Column(DateTime, nullable=False)

class Sondaje(Base):
    __tablename__ = "Sondajes"
    __table_args__ = {"schema": "dbo"}

    SondajeID = Column(Integer, primary_key=True, autoincrement=True)
    CodigoSondaje = Column(String(50), unique=True, nullable=False)
    CampañaID = Column(Integer, ForeignKey("dbo.Campañas.CampañaID"), nullable=False)
    DiametroPerfora = Column(String(10), nullable=True)
    InclinacionTaladro = Column(Numeric(5, 2), nullable=True)
    Proyecto = Column(String(100), nullable=True)
    Geotecnico = Column(String(100), nullable=True)
    FechaPerforacion = Column(Date, nullable=True)
    Estado = Column(String(20), nullable=False, default="Activo")
    Observaciones = Column(String, nullable=True)
    TurnoID = Column(Integer, ForeignKey("cat.Turno.TurnoID"), nullable=True) 
    FechaRegistro = Column(DateTime, nullable=False)

    # ─── 1. MAPEOS BIDIRECCIONALES ORIGINALES DE GEMA (Inalterados) ───
    collar = relationship("Collar", back_populates="sondaje", uselist=False, cascade="all, delete-orphan")
    surveys = relationship("Survey", back_populates="sondaje", cascade="all, delete-orphan")

    # ─── 2. NUEVOS MAPEOS UNIDIRECCIONALES SÍNCRONOS ───
    registros = relationship("LogueoGeotecnicoGeneral", cascade="all, delete-orphan")
    ensayos_plt = relationship("EnsayoPLT", cascade="all, delete-orphan")

class Collar(Base):
    __tablename__ = "Collar"
    __table_args__ = {"schema": "dbo"}
    CollarID = Column(Integer, primary_key=True, autoincrement=True)
    SondajeID = Column(Integer, ForeignKey("dbo.Sondajes.SondajeID"), unique=True, nullable=False)
    CoordenadaEste = Column(Numeric(12, 3), nullable=False)
    CoordenadaNorte = Column(Numeric(12, 3), nullable=False)
    Elevacion = Column(Numeric(10, 3), nullable=False)
    ProfundidadTotal = Column(Numeric(10, 2), nullable=False)
    FechaRegistro = Column(DateTime, nullable=False)
    Comentarios = Column(String(500), nullable=True)

    CoordenadaEsteProyectado = Column(Numeric(12, 3), nullable=True)
    CoordenadaNorteProyectado = Column(Numeric(12, 3), nullable=True)
    ElevacionProyectado = Column(Numeric(10, 3), nullable=True)
    ProfundidadTotalProyectada = Column(Numeric(10, 2), nullable=True)
    ComentariosProyectado = Column(String(500), nullable=True)


    sondaje = relationship("Sondaje", back_populates="collar")

class Survey(Base):
    __tablename__ = "Survey"
    __table_args__ = {"schema": "dbo"}
    SurveyID = Column(Integer, primary_key=True, autoincrement=True)
    SondajeID = Column(Integer, ForeignKey("dbo.Sondajes.SondajeID"), nullable=False)
    Profundidad = Column(Numeric(10, 2), nullable=False)
    Inclinacion = Column(Numeric(6, 2), nullable=False)
    Azimut = Column(Numeric(6, 2), nullable=False)
    FechaRegistro = Column(DateTime, nullable=False)

    sondaje = relationship("Sondaje", back_populates="surveys")

class Litologia(Base):
    __tablename__ = "Litologias"
    __table_args__ = {"schema": "dbo"}
    LitologiaID = Column(Integer, primary_key=True, autoincrement=True)
    CodigoLitologia = Column(String(20), nullable=False)
    NombreLitologia = Column(String(100), nullable=False)
    Descripcion = Column(String(500), nullable=True)
    TipoRoca = Column(String(50), nullable=True)
    FechaRegistro = Column(DateTime, nullable=False)

class TipoEstructura(Base):
    __tablename__ = "TiposEstructura"
    __table_args__ = {"schema": "dbo"}
    TipoEstructuraID = Column(Integer, primary_key=True, autoincrement=True)
    CodigoEstructura = Column(String(20), unique=True, nullable=False)
    NombreEstructura = Column(String(100), nullable=False)
    Descripcion = Column(String(500), nullable=True)
    FechaRegistro = Column(DateTime, nullable=False)

class Geotecnico(Base):
    __tablename__ = "Geotecnicos"
    __table_args__ = {"schema": "dbo"}
    GeotecnicoID = Column(Integer, primary_key=True, autoincrement=True)
    NombreCompleto = Column(String(150), nullable=False)
    Especialidad = Column(String(100), nullable=True)
    Email = Column(String(100), nullable=True)
    Telefono = Column(String(20), nullable=True)
    Estado = Column(String(20), nullable=False, default="Activo")
    FechaRegistro = Column(DateTime, nullable=False)

class LogueoGeotecnicoGeneral(Base):
    __tablename__ = "LogueoGeotecnicoGeneral"
    __table_args__ = {"schema": "dbo"}
    LogueoGeneralID = Column(Integer, primary_key=True, autoincrement=True)
    SondajeID = Column(Integer, ForeignKey("dbo.Sondajes.SondajeID"), nullable=False)
    NumeroRegistro = Column(Integer, nullable=False)
    IntervaloDe = Column(Numeric(10, 2), nullable=False)
    IntervaloA = Column(Numeric(10, 2), nullable=False)
    LongitudRecuperada = Column(Numeric(10, 2), nullable=True)
    SumaFragmentos10cm = Column(Numeric(10, 2), nullable=True)
    LongitudRocaFracturada = Column(Numeric(10, 2), nullable=True)
    FRF = Column(Numeric(10, 2), nullable=True)
    NumFracturasNaturales = Column(Integer, nullable=True)
    Litologia1ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    Litologia2ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    Litologia3ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    ResistenciaEstimada = Column(String(50), nullable=True)
    TipoEstructura1ID = Column(Integer, ForeignKey("dbo.TiposEstructura.TipoEstructuraID"), nullable=True)
    TipoEstructura2ID = Column(Integer, ForeignKey("dbo.TiposEstructura.TipoEstructuraID"), nullable=True)
    NumFracBuz30 = Column(Integer, nullable=True)
    NumFrac30a60 = Column(Integer, nullable=True)
    NumFracBuz60 = Column(Integer, nullable=True)
    Abertura = Column(Numeric(10, 2), nullable=True)
    Rugosidad = Column(String(50), nullable=True)
    JRC10 = Column(Numeric(5, 2), nullable=True)
    GradoIntemperismo = Column(String(50), nullable=True)
    TipoRelleno1 = Column(String(100), nullable=True)
    TipoRelleno2 = Column(String(100), nullable=True)
    EspesorRelleno = Column(Numeric(10, 2), nullable=True)
    PresenciaAgua = Column(String(50), nullable=True)
    GeotecnicoID = Column(Integer, ForeignKey("dbo.Geotecnicos.GeotecnicoID"), nullable=True)
    Comentarios = Column(String, nullable=True)
    CampañaID = Column(Integer, ForeignKey("dbo.Campañas.CampañaID"), nullable=False)
    FechaRegistro = Column(DateTime, nullable=False)

class LogueoEstructural(Base):
    __tablename__ = "LogueoEstructural"
    __table_args__ = {"schema": "dbo"}
    LogueoEstructuralID = Column(Integer, primary_key=True, autoincrement=True)
    SondajeID = Column(Integer, ForeignKey("dbo.Sondajes.SondajeID"), nullable=False)
    IntervaloDe = Column(Numeric(10, 2), nullable=False)
    IntervaloA = Column(Numeric(10, 2), nullable=False)
    Profundidad = Column(Numeric(10, 2), nullable=True)
    Litologia1ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    Litologia2ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    Litologia3ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    TipoEstructuraID = Column(Integer, ForeignKey("dbo.TiposEstructura.TipoEstructuraID"), nullable=True)
    Alpha = Column(Numeric(6, 2), nullable=True)
    Beta = Column(Numeric(6, 2), nullable=True)
    Dip = Column(Numeric(6, 2), nullable=True)
    Azimuth = Column(Numeric(6, 2), nullable=True)
    Forma = Column(String(50), nullable=True)
    Rugosidad = Column(String(50), nullable=True)
    JRC10 = Column(Numeric(5, 2), nullable=True)
    Abertura = Column(Numeric(10, 2), nullable=True)
    GradoIntemperismo = Column(String(50), nullable=True)
    EspesorRelleno = Column(Numeric(10, 2), nullable=True)
    TipoRelleno1 = Column(String(100), nullable=True)
    TipoRelleno2 = Column(String(100), nullable=True)
    DurezaParedEstructura = Column(String(100), nullable=True)
    PresenciaAgua = Column(String(50), nullable=True)
    GeotecnicoID = Column(Integer, ForeignKey("dbo.Geotecnicos.GeotecnicoID"), nullable=True)
    IntervaloComentario = Column(String, nullable=True)
    CampañaID = Column(Integer, ForeignKey("dbo.Campañas.CampañaID"), nullable=False)
    FechaRegistro = Column(DateTime, nullable=False)

class ValidacionRMR(Base):
    __tablename__ = "ValidacionRMR"
    __table_args__ = {"schema": "dbo"}
    ValidacionRMRID = Column(Integer, primary_key=True, autoincrement=True)
    SondajeID = Column(Integer, ForeignKey("dbo.Sondajes.SondajeID"), nullable=False)
    FechaValidacion = Column(Date, nullable=True)
    LogueadorID = Column(Integer, ForeignKey("dbo.Geotecnicos.GeotecnicoID"), nullable=True)
    NumeroCorrida = Column(Integer, nullable=False)
    Litologia1ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    Litologia2ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    Litologia3ID = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    IntervaloDe = Column(Numeric(10, 2), nullable=False)
    IntervaloA = Column(Numeric(10, 2), nullable=False)
    LongitudCorrida = Column(Numeric(10, 2), nullable=True)
    Recuperacion = Column(Numeric(10, 2), nullable=True)
    RecuperacionPorc = Column(Numeric(5, 2), nullable=True)
    RQD = Column(Numeric(10, 2), nullable=True)
    RQDPorc = Column(Numeric(5, 2), nullable=True)
    LongitudTramoFracturado = Column(Numeric(10, 2), nullable=True)
    FRF = Column(Numeric(10, 2), nullable=True)
    FracturasNaturales = Column(Integer, nullable=True)
    TotalFracturas = Column(Integer, nullable=True)
    FF_1m = Column(Numeric(10, 2), nullable=True)
    Espaciamiento = Column(Numeric(10, 2), nullable=True)
    Resistencia = Column(String(50), nullable=True)
    TipoEstructura = Column(String(100), nullable=True)
    Abertura = Column(Numeric(10, 2), nullable=True)
    Rugosidad = Column(String(50), nullable=True)
    Relleno = Column(String(100), nullable=True)
    ClasificacionRelleno = Column(String(100), nullable=True)
    Intemperismo = Column(String(50), nullable=True)
    JRC10 = Column(Numeric(5, 2), nullable=True)
    EspesorRelleno = Column(Numeric(10, 2), nullable=True)
    PresenciaAgua = Column(String(50), nullable=True)
    RMR76_Resistencia = Column(Integer, nullable=True)
    RMR76_RQD = Column(Integer, nullable=True)
    RMR76_Espaciamiento = Column(Integer, nullable=True)
    RMR76_Abertura = Column(Integer, nullable=True)
    RMR76_Rugosidad = Column(Integer, nullable=True)
    RMR76_Relleno = Column(Integer, nullable=True)
    RMR76_Intemperismo = Column(Integer, nullable=True)
    RMR76_Persistencia = Column(Integer, nullable=True)
    RMR76_CondicionJuntas = Column(Integer, nullable=True)
    RMR76_PresenciaAgua = Column(Integer, nullable=True)
    RMR76_Total = Column(Integer, nullable=True)
    RMR76_CalidadRoca = Column(String(50), nullable=True)
    RMR89_Resistencia = Column(Integer, nullable=True)
    RMR89_RQD = Column(Integer, nullable=True)
    RMR89_Espaciamiento = Column(Integer, nullable=True)
    RMR89_Abertura = Column(Integer, nullable=True)
    RMR89_Rugosidad = Column(Integer, nullable=True)
    RMR89_Relleno = Column(Integer, nullable=True)
    RMR89_Intemperismo = Column(Integer, nullable=True)
    RMR89_Persistencia = Column(Integer, nullable=True)
    RMR89_CondicionJuntas = Column(Integer, nullable=True)
    RMR89_PresenciaAgua = Column(Integer, nullable=True)
    RMR89_Total = Column(Integer, nullable=True)
    RMR89_CalidadRoca = Column(String(50), nullable=True)
    LitologiaFinal = Column(String(100), nullable=True)
    CampañaID = Column(Integer, ForeignKey("dbo.Campañas.CampañaID"), nullable=False)
    FechaRegistro = Column(DateTime, nullable=False)

# --- ESQUEMA: cat (Catálogos Maestrías PLT) ---

class DiametroPerfora(Base):
    __tablename__ = "DiametroPerfora"
    __table_args__ = {"schema": "cat"}
    DiametroID = Column(Integer, primary_key=True, autoincrement=True)
    Codigo = Column(String(5), unique=True, nullable=False)
    DiametroNominal_mm = Column(Numeric(5, 1), nullable=False)
    DiametroCore_mm = Column(Numeric(5, 1), nullable=True)
    Descripcion = Column(String(50), nullable=True)

class DireccionRuptura(Base):
    __tablename__ = "DireccionRuptura"
    __table_args__ = {"schema": "cat"}
    DireccionID = Column(Integer, primary_key=True, autoincrement=True)
    Codigo = Column(String(3), unique=True, nullable=False)
    Descripcion = Column(String(80), nullable=False)

class TipoFracturaPLT(Base):
    __tablename__ = "TipoFracturaPLT"
    __table_args__ = {"schema": "cat"}
    TipoFracturaPLT_ID = Column(Integer, primary_key=True, autoincrement=True)
    Codigo = Column(String(5), unique=True, nullable=False)
    Descripcion = Column(String(100), nullable=False)

class ResistenciaISRM(Base):
    __tablename__ = "ResistenciaISRM"
    __table_args__ = {"schema": "cat"}
    ResistenciaISRM_ID = Column(Integer, primary_key=True, autoincrement=True)
    Codigo = Column(String(3), unique=True, nullable=False)
    UCS_Min_MPa = Column(Numeric(8, 2), nullable=False)
    UCS_Max_MPa = Column(Numeric(8, 2), nullable=True)
    Denominacion = Column(String(40), nullable=False)

class TipoEnsayoPLT(Base):
    __tablename__ = "TipoEnsayoPLT"
    __table_args__ = {"schema": "cat"}
    TipoEnsayoPLT_ID = Column(Integer, primary_key=True, autoincrement=True)
    Codigo = Column(String(2), unique=True, nullable=False)
    Descripcion = Column(String(100), nullable=False)

class FactorK_PLT(Base):
    __tablename__ = "FactorK_PLT"
    __table_args__ = {"schema": "cat"}
    FactorK_ID = Column(Integer, primary_key=True, autoincrement=True)
    UnidadGeotecnica = Column(String(20), nullable=False)
    Lito1 = Column(String(15), nullable=False)
    Lito2 = Column(String(15), nullable=True)
    Lito3 = Column(String(15), nullable=True)
    ValidacionLito = Column(String(30), nullable=True)
    FactorK = Column(Numeric(5, 2), nullable=False)

# --- ESQUEMA: plt (Ensayos de Rotura PLT) ---

class EnsayoPLT(Base):
    __tablename__ = "EnsayoPLT"
    __table_args__ = {"schema": "plt"}
    EnsayoPLT_ID = Column(Integer, primary_key=True, autoincrement=True)
    CodigoMuestra = Column(String(20), nullable=False)
    CampañaID = Column(Integer, ForeignKey("dbo.Campañas.CampañaID"), nullable=False)
    LitologiaID_1 = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    LitologiaID_2 = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    LitologiaID_3 = Column(Integer, ForeignKey("dbo.Litologias.LitologiaID"), nullable=True)
    TipoEnsayoPLT_ID = Column(Integer, ForeignKey("cat.TipoEnsayoPLT.TipoEnsayoPLT_ID"), nullable=True)
    DireccionID = Column(Integer, ForeignKey("cat.DireccionRuptura.DireccionID"), nullable=True)
    TipoFracturaPLT_ID = Column(Integer, ForeignKey("cat.TipoFracturaPLT.TipoFracturaPLT_ID"), nullable=True)
    ResistenciaISRM_ID = Column(Integer, ForeignKey("cat.ResistenciaISRM.ResistenciaISRM_ID"), nullable=True)
    FactorK_ID = Column(Integer, ForeignKey("cat.FactorK_PLT.FactorK_ID"), nullable=True)
    FechaEnsayo = Column(Date, nullable=True)
    CoordenadaEste = Column(Numeric(10, 4), nullable=True)
    CoordenadaNorte = Column(Numeric(11, 4), nullable=True)
    Elevacion = Column(Numeric(8, 2), nullable=True)
    Espesor_D_cm = Column(Numeric(5, 2), nullable=True)
    Longitud_L_cm = Column(Numeric(6, 2), nullable=True)
    Ancho_W1_cm = Column(Numeric(6, 2), nullable=True)
    Ancho_W2_cm = Column(Numeric(6, 2), nullable=True)
    Ancho_W_cm = Column(Numeric(6, 2), nullable=True)
    MuestraValidaLong = Column(Boolean, nullable=True)
    MuestraValidaAncho = Column(Boolean, nullable=True)
    FuerzaP_kN = Column(Numeric(8, 4), nullable=True)
    DiametroEquiv_cm = Column(Numeric(7, 4), nullable=True)
    FactorF = Column(Numeric(6, 4), nullable=True)
    Is_MPa = Column(Numeric(8, 4), nullable=True)
    Is50_MPa = Column(Numeric(8, 4), nullable=True)
    UCS_MPa = Column(Numeric(9, 3), nullable=True)
    Observaciones = Column(String(300), nullable=True)
    FechaRegistro = Column(DateTime, nullable=False)
    OrigenPLT = Column(String(10), nullable=False, default="IRREGULAR")
    SondajeID = Column(Integer, ForeignKey("dbo.Sondajes.SondajeID"), nullable=True)
    DiametroID = Column(Integer, ForeignKey("cat.DiametroPerfora.DiametroID"), nullable=True)
    NroMuestra = Column(String(8), nullable=True)
    NroCaja = Column(String(10), nullable=True)
    CorridaDesde_m = Column(Numeric(8, 3), nullable=True)
    CorridaHasta_m = Column(Numeric(8, 3), nullable=True)
    From_m = Column(Numeric(8, 3), nullable=True)
    To_m = Column(Numeric(8, 3), nullable=True)
    LongCorrida_m = Column(Numeric(8, 3), nullable=True)
    LongMuestra_mm = Column(Numeric(8, 2), nullable=True)
    FactorCorr = Column(Numeric(7, 4), nullable=True)
    TipoLitologico = Column(String(20), nullable=True)
    EjecutadoPor = Column(String(15), nullable=True)