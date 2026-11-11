"""
Pruebas unitarias para las decisiones de negocio D0, D1, D2, D3 y D4 en el cruce Collar/Survey.
Verifica:
- D0: Collar/Survey no cargado -> NO_CARGADO sin efecto en estado global, R301 omite texto.
- D1: Collar ausente (R302), EOH vacío/no numérico (R304). Survey ausente (R303), all depths vacío (R305).
- D2: Collar duplicado discrepante (R306) con None y SIN_REFERENCIA; mismo EOH sin alerta; Survey múltiples filas sin alerta.
- D3: Taladro en Estructural o RMR sin LGG (R307) -> SIN_REFERENCIA, no emite R301.
- D4: Campaña solo número (año) o None. Nunca N/A, NA, Varias ni Sin campaña.
"""

import pytest
import openpyxl
from app.core.engine.models import Severity
from app.core.engine.context import ValidationContext
from app.core.engine.rules.eoh_rules import CrossModule_EOHRule
from app.core.adapters.excel.collar_survey_reader import read_collar_sheet, read_survey_sheet


def test_d0_collar_survey_no_cargados():
    """D0: Collar/Survey NO cargados -> NO_CARGADO, sin alertas R302/R303, R301 omite texto de no cargado."""
    ctx = ValidationContext(
        collar_data={},
        survey_data={},
        lgg_by_taladro={"DH-01": [{"de": 0, "a": 100, "campana": 2024}]},
        metadata={
            "max_lgg": {"DH-01": 100.0},
            "max_est": {"DH-01": 120.0},
            "has_collar": False,
            "has_survey": False,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    cruce = ctx.metadata["cruce_collar_survey"]

    tal = cruce["taladros"]["DH-01"]
    assert tal["comparaciones"]["lgg_vs_collar"]["estado"] == "NO_CARGADO"
    assert tal["comparaciones"]["lgg_vs_survey"]["estado"] == "NO_CARGADO"
    assert tal["comparaciones"]["lgg_vs_est"]["estado"] == "DISCREPANCIA"
    assert tal["estado_global"] == "DISCREPANCIA"

    # R301 emitida por discrepancia con Estructural, pero omite Collar y Survey
    r301 = [a for a in anomalies if a.rule_code == "R301"]
    assert len(r301) == 1
    assert "No Cargado" not in r301[0].mensaje
    assert "Collar EOH:" not in r301[0].mensaje
    assert "Survey Max:" not in r301[0].mensaje


def test_d1_collar_ausente_y_eoh_vacio():
    """D1: Collar cargado: taladro ausente emite ALERTA R302; celda EOH vacía guarda None y emite VACIO R304."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Collar"
    ws.append(["Taladro", "EOH"])
    ws.append(["DH-VACIO", None])
    ws.append(["DH-VALIDO", 150.0])

    data, meta = read_collar_sheet(wb, {"sheet": "Collar"})
    assert data["DH-VACIO"] is None
    assert data["DH-VALIDO"] == 150.0

    ctx = ValidationContext(
        collar_data=data,
        survey_data={},
        lgg_by_taladro={
            "DH-VACIO": [{"de": 0, "a": 100, "campana": "2023"}],
            "DH-VALIDO": [{"de": 0, "a": 150, "campana": "2023"}],
            "DH-AUSENTE": [{"de": 0, "a": 100, "campana": "2023"}]
        },
        metadata={
            "max_lgg": {"DH-VACIO": 100.0, "DH-VALIDO": 150.0, "DH-AUSENTE": 100.0},
            "max_est": {},
            "has_collar": True,
            "has_survey": False,
            "collar_meta": meta,
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    cruce = ctx.metadata["cruce_collar_survey"]

    # DH-AUSENTE: emite R302 ALERTA
    r302 = [a for a in anomalies if a.rule_code == "R302" and a.celda_padre == "DH-AUSENTE"]
    assert len(r302) == 1
    assert r302[0].severity == Severity.ALERTA
    assert "No existe Collar para el taladro DH-AUSENTE" in r302[0].mensaje
    assert cruce["taladros"]["DH-AUSENTE"]["comparaciones"]["lgg_vs_collar"]["estado"] == "SIN_REFERENCIA"

    # DH-VACIO: emite R304 VACIO y comparación SIN_REFERENCIA (no DISCREPANCIA)
    r304 = [a for a in anomalies if a.rule_code == "R304" and a.celda_padre == "DH-VACIO"]
    assert len(r304) == 1
    assert r304[0].severity == Severity.VACIO
    assert cruce["taladros"]["DH-VACIO"]["comparaciones"]["lgg_vs_collar"]["estado"] == "SIN_REFERENCIA"
    assert cruce["taladros"]["DH-VACIO"]["estado_global"] == "SIN_REFERENCIA"

    # DH-VALIDO: COINCIDE
    assert cruce["taladros"]["DH-VALIDO"]["comparaciones"]["lgg_vs_collar"]["estado"] == "COINCIDE"


def test_d1_survey_ausente_y_depths_vacias():
    """D1: Survey cargado: taladro ausente emite R303 ALERTA; todas las profundidades vacías emiten R305 VACIO."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Survey"
    ws.append(["Taladro", "Depth"])
    ws.append(["DH-VACIO", ""])
    ws.append(["DH-VACIO", None])
    ws.append(["DH-VALIDO", 50.0])
    ws.append(["DH-VALIDO", 200.0])

    data, meta = read_survey_sheet(wb, {"sheet": "Survey"})
    assert data["DH-VACIO"] is None
    assert data["DH-VALIDO"] == 200.0

    ctx = ValidationContext(
        collar_data={},
        survey_data=data,
        lgg_by_taladro={
            "DH-VACIO": [{"de": 0, "a": 100, "campana": 2024}],
            "DH-VALIDO": [{"de": 0, "a": 200, "campana": 2024}],
            "DH-AUSENTE": [{"de": 0, "a": 100, "campana": 2024}]
        },
        metadata={
            "max_lgg": {"DH-VACIO": 100.0, "DH-VALIDO": 200.0, "DH-AUSENTE": 100.0},
            "max_est": {},
            "has_collar": False,
            "has_survey": True,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": meta
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    cruce = ctx.metadata["cruce_collar_survey"]

    # DH-AUSENTE: emite R303 ALERTA
    r303 = [a for a in anomalies if a.rule_code == "R303" and a.celda_padre == "DH-AUSENTE"]
    assert len(r303) == 1
    assert r303[0].severity == Severity.ALERTA

    # DH-VACIO: emite R305 VACIO
    r305 = [a for a in anomalies if a.rule_code == "R305" and a.celda_padre == "DH-VACIO"]
    assert len(r305) == 1
    assert r305[0].severity == Severity.VACIO
    assert cruce["taladros"]["DH-VACIO"]["comparaciones"]["lgg_vs_survey"]["estado"] == "SIN_REFERENCIA"


def test_d2_collar_duplicados_discrepantes_vs_iguales():
    """D2: Collar con duplicado discrepante -> ALERTA R306, guarda None, SIN_REFERENCIA. Mismo EOH repetido -> sin alerta."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Collar"
    ws.append(["Taladro", "EOH"])
    ws.append(["DH-DISCREPANTE", 100.0])
    ws.append(["DH-DISCREPANTE", 150.0])
    ws.append(["DH-IGUALES", 200.0])
    ws.append(["DH-IGUALES", 200.0])

    data, meta = read_collar_sheet(wb, {"sheet": "Collar"})
    assert data["DH-DISCREPANTE"] is None
    assert data["DH-IGUALES"] == 200.0
    assert "DH-DISCREPANTE" in meta["duplicates_discrepant"]
    assert "DH-IGUALES" not in meta["duplicates_discrepant"]

    ctx = ValidationContext(
        collar_data=data,
        survey_data={},
        lgg_by_taladro={
            "DH-DISCREPANTE": [{"de": 0, "a": 100, "campana": 2022}],
            "DH-IGUALES": [{"de": 0, "a": 200, "campana": 2022}]
        },
        metadata={
            "max_lgg": {"DH-DISCREPANTE": 100.0, "DH-IGUALES": 200.0},
            "max_est": {},
            "has_collar": True,
            "has_survey": False,
            "collar_meta": meta,
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    cruce = ctx.metadata["cruce_collar_survey"]

    # DH-DISCREPANTE emite R306 con los valores en el mensaje
    r306 = [a for a in anomalies if a.rule_code == "R306"]
    assert len(r306) == 1
    assert "100.0" in r306[0].mensaje and "150.0" in r306[0].mensaje
    assert cruce["taladros"]["DH-DISCREPANTE"]["comparaciones"]["lgg_vs_collar"]["estado"] == "SIN_REFERENCIA"

    # DH-IGUALES coincide limpiamente
    assert cruce["taladros"]["DH-IGUALES"]["comparaciones"]["lgg_vs_collar"]["estado"] == "COINCIDE"


def test_d3_taladro_en_estructural_rmr_sin_lgg():
    """D3: Taladro presente en Estructural o RMR pero ausente en LGG -> ALERTA R307, SIN_REFERENCIA y no emite R301."""
    ctx = ValidationContext(
        collar_data={},
        survey_data={},
        lgg_by_taladro={"DH-LGG-OK": [{"de": 0, "a": 100, "campana": 2024}]},
        est_by_taladro={"DH-HUERFANO-EST": [{"profundidad": 50.0}]},
        rmr_by_taladro={"DH-HUERFANO-RMR": [{"corrida": 1}]},
        metadata={
            "max_lgg": {"DH-LGG-OK": 100.0},
            "max_est": {"DH-LGG-OK": 100.0, "DH-HUERFANO-EST": 50.0},
            "has_collar": False,
            "has_survey": False,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    cruce = ctx.metadata["cruce_collar_survey"]

    r307 = [a for a in anomalies if a.rule_code == "R307"]
    assert len(r307) == 2
    taladros_r307 = {a.celda_padre for a in r307}
    assert taladros_r307 == {"DH-HUERFANO-EST", "DH-HUERFANO-RMR"}

    # Ninguno de los huérfanos emite R301
    r301 = [a for a in anomalies if a.rule_code == "R301"]
    assert len(r301) == 0

    assert cruce["taladros"]["DH-HUERFANO-EST"]["estado_global"] == "SIN_REFERENCIA"
    assert cruce["taladros"]["DH-HUERFANO-RMR"]["estado_global"] == "SIN_REFERENCIA"


def test_d4_campania_unica_vs_varias_vs_vacia():
    """D4: Campaña solo año o None. Varias campañas -> None y R301 lista campañas encontradas."""
    ctx = ValidationContext(
        collar_data={"DH-VARIAS": 150.0, "DH-UNICA": 100.0, "DH-VACIA": 100.0},
        survey_data={},
        lgg_by_taladro={
            "DH-VARIAS": [{"de": 0, "a": 50, "campana": 2021}, {"de": 50, "a": 100, "campana": 2022}],
            "DH-UNICA": [{"de": 0, "a": 100, "campana": "2024"}],
            "DH-VACIA": [{"de": 0, "a": 100, "campana": ""}]
        },
        metadata={
            "max_lgg": {"DH-VARIAS": 100.0, "DH-UNICA": 100.0, "DH-VACIA": 100.0},
            "max_est": {},
            "has_collar": True,
            "has_survey": False,
            "collar_meta": {"status": "ok"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    cruce = ctx.metadata["cruce_collar_survey"]

    # DH-UNICA: campania = "2024"
    assert cruce["taladros"]["DH-UNICA"]["campania"] == "2024"

    # DH-VACIA: campania = None (nunca "Sin campaña" ni "N/A")
    assert cruce["taladros"]["DH-VACIA"]["campania"] is None

    # DH-VARIAS: campania = None (nunca "Varias"). Mensaje de R301 lista las campañas
    assert cruce["taladros"]["DH-VARIAS"]["campania"] is None
    r301_varias = [a for a in anomalies if a.rule_code == "R301" and a.celda_padre == "DH-VARIAS"]
    assert len(r301_varias) == 1
    assert r301_varias[0].campania is None
    assert "Campañas registradas en LGG: 2021, 2022" in r301_varias[0].mensaje