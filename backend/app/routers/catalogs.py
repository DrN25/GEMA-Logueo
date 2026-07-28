from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app import models

router = APIRouter(
    prefix="/api/catalogs",
    tags=["Catálogos"]
)

@router.get("")
def get_catalogs(db: Session = Depends(get_db)):
    """
    Retorna los catálogos geotécnicos dinámicos consultando directamente 
    las tablas físicas del esquema GEMA en SQL Server.
    """
    try:
        # 1. Resistencia ISRM (R0 a R7)
        resistencias_db = db.query(models.ResistenciaISRM).order_by(models.ResistenciaISRM.ResistenciaISRM_ID).all()
        resistencia = [r.Codigo.strip() for r in resistencias_db]
        if "-1" not in resistencia:
            resistencia.append("-1")
            
        # 2. Tipos de Estructuras Geológicas (esquema dbo)
        estructuras_db = db.query(models.TipoEstructura).order_by(models.TipoEstructura.CodigoEstructura).all()
        estructuras = [e.CodigoEstructura.strip() for e in estructuras_db]
        if "-1" not in estructuras:
            estructuras.append("-1")
            
        # 3. Litologías Maestras (esquema dbo)
        litologias_db = db.query(models.Litologia).order_by(models.Litologia.CodigoLitologia).all()
        litologias = [l.CodigoLitologia.strip() for l in litologias_db]
        
        # 4. Diámetros de Perforación (esquema cat)
        diametros_db = db.query(models.DiametroPerfora).order_by(models.DiametroPerfora.DiametroID).all()
        diametros_perforacion = [{"code": d.Codigo.strip(), "value": float(d.DiametroNominal_mm)} for d in diametros_db]
        
        # 5. Tipos de Ensayo PLT (esquema cat)
        ensayos_db = db.query(models.TipoEnsayoPLT).order_by(models.TipoEnsayoPLT.TipoEnsayoPLT_ID).all()
        tipo_ensayo_plt = [{"code": t.Codigo.strip(), "name": t.Descripcion.strip()} for t in ensayos_db]
        
        # 6. Direcciones de Ruptura PLT (esquema cat)
        direcciones_db = db.query(models.DireccionRuptura).order_by(models.DireccionRuptura.DireccionID).all()
        direccion_roturas = [{"code": d.Codigo.strip(), "name": d.Descripcion.strip()} for d in direcciones_db]
        
        # 7. Tipos de Fracturas PLT (esquema cat)
        fracturas_db = db.query(models.TipoFracturaPLT).order_by(models.TipoFracturaPLT.TipoFracturaPLT_ID).all()
        tipo_roturas = [{"code": f.Codigo.strip(), "name": f.Descripcion.strip()} for f in fracturas_db]
        
        # 8. Catálogo de Turnos de GEMA (esquema cat - ¡NUEVO!)
        turnos_db = db.query(models.Turno).order_by(models.Turno.TurnoID).all()
        turnos_list = [{"id": t.TurnoID, "code": t.Codigo.strip(), "name": t.Descripcion.strip()} for t in turnos_db]

        # 9. Presencia de Agua (Lectura dinámica desde dbo.ClasificacionPresenciaAgua)
        agua = []
        try:
            agua_db = db.execute(text("SELECT CodigoAgua FROM dbo.ClasificacionPresenciaAgua")).fetchall()
            agua = [r[0].strip() for r in agua_db]
        except Exception:
            agua = ["CDC", "DPH", "WTM", "DGE", "FGF"]
            
        if "-1" not in agua:
            agua.append("-1")

        # 10. Tipos de Relleno y su Clasificación de Dureza RMR
        # GEMA no requiere tabla de relleno por almacenarse como texto en Logueos,
        # pero el frontend requiere esta estructura de clases para el motor de cálculo.
        rellenos = [
            {"code": "ca", "name": "Calcita", "class": 1},
            {"code": "sand", "name": "Arena", "class": 1},
            {"code": "ch", "name": "Clorita", "class": 1},
            {"code": "cl", "name": "Arcilla", "class": 1},
            {"code": "gy", "name": "Yeso", "class": 1},
            {"code": "RXF", "name": "Roca triturada", "class": 1},
            {"code": "GOU", "name": "Panizo (Gouge)", "class": 1},
            {"code": "PAT", "name": "Patinas / Recubrimientos", "class": 1},
            {"code": "FBX", "name": "Brecha de falla", "class": 2},
            {"code": "SIO", "name": "Silicatos", "class": 2},
            {"code": "QZ", "name": "Cuarzo", "class": 2},
            {"code": "SU", "name": "Sulfuros", "class": 2},
            {"code": "OX", "name": "Óxido de cobre", "class": 2},
            {"code": "ep", "name": "Epidota", "class": 2},
            {"code": "cwf", "name": "Limpia, sin relleno", "class": 3},
            {"code": "-1", "name": "Sin dato / Vacío", "class": 3}
        ]

        # 11. Grados de Intemperismo (ISRM)
        weathering = ["UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"]

        # 12. Tabla de Matriz de Litología y Factor K de Ensayos PLT (cat.FactorK_PLT)
        tabla_litologia = []
        try:
            litos_factor_db = db.execute(
                text("SELECT UnidadGeotecnica, Lito1, Lito2, Lito3, FactorK FROM cat.FactorK_PLT")
            ).fetchall()
            for row in litos_factor_db:
                tabla_litologia.append({
                    "clase": row[0].strip() if row[0] else "",
                    "l1": row[1].strip() if row[1] else "",
                    "l2": row[2].strip() if row[2] else "-",
                    "l3": row[3].strip() if row[3] else "-",
                    "k": float(row[4]) if row[4] is not None else 10.0
                })
        except Exception as e:
            print("Error loading FactorK_PLT for catalogs:", e)

        # 13. Campañas Registradas (dbo.Campañas)
        campanas_db = db.query(models.Campaña).order_by(models.Campaña.NombreCampaña).all()
        campanas_list = [c.NombreCampaña.strip() for c in campanas_db if c.NombreCampaña]
        if not campanas_list:
            campanas_list = ["Campaña 2020", "Campaña 2021", "Campaña 2022", "Campaña 2023", "Campaña 2024", "Campaña 2025", "Campaña 2026"]

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
            "tabla_litologia": tabla_litologia,
            "turnos": turnos_list,
            "campanas": campanas_list
        }

    except Exception as e:
        # Fallback de contingencia idéntico al sistema anterior si falla la conexión
        return {
            "resistencia": ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "-1"],
            "estructuras": ["JN", "F-10", "SZ", "BED", "VN", "CON", "SE", "F+10", "RF", "-1"],
            "rellenos": [
                {"code": "ca", "name": "Calcita", "class": 1},
                {"code": "cwf", "name": "Limpia, sin relleno", "class": 3}
            ],
            "weathering": ["UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"],
            "agua": ["CDC", "DPH", "WTM", "DGE", "FGF", "-1"],
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
            "tabla_litologia": [],
            "turnos": [
                {"id": 1, "code": "D", "name": "Día / Day Shift"},
                {"id": 2, "code": "N", "name": "Noche / Night Shift"}
            ],
            "campanas": ["Campaña 2020", "Campaña 2021", "Campaña 2022", "Campaña 2023", "Campaña 2024", "Campaña 2025", "Campaña 2026"],
            "error_db": str(e)
        }

@router.get("/campanas")
def get_campanas(db: Session = Depends(get_db)):
    """
    Endpoint especializado para obtener únicamente los nombres de campañas registradas 
    en la tabla dbo.Campañas de SQL Server.
    """
    try:
        campanas_db = db.query(models.Campaña).order_by(models.Campaña.NombreCampaña).all()
        result = [c.NombreCampaña.strip() for c in campanas_db if c.NombreCampaña]
        if not result:
            return ["Campaña 2020", "Campaña 2021", "Campaña 2022", "Campaña 2023", "Campaña 2024", "Campaña 2025", "Campaña 2026"]
        return result
    except Exception as e:
        print("[!] Error al consultar campañas en SQL Server:", e)
        return ["Campaña 2020", "Campaña 2021", "Campaña 2022", "Campaña 2023", "Campaña 2024", "Campaña 2025", "Campaña 2026"]