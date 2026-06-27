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
    """Catálogos dinámicos cargados directamente de la base de datos relacional."""
    try:
        resistencia = [r.abreviatura for r in db.query(models.ResistenciaISRM).all()]
        if "-1" not in resistencia:
            resistencia.append("-1")
            
        estructuras = [e.code for e in db.query(models.TipoEstructura).all()]
        
        tipo_rellenos = db.query(models.TipoRelleno).all()
        rellenos = []
        for tr in tipo_rellenos:
            code = tr.code
            name = tr.descripcion
            
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
        litologias = [l.nombre.strip() for l in db.query(models.Litologia3).all()]
        
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
