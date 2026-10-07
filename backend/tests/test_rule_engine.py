"""
tests/test_rule_engine.py
Pruebas unitarias para el Motor de Reglas Modular de Auditoría Geomecánica.
Valida el funcionamiento de ValidationContext, BaseRule, RuleRegistry y RuleEngineRunner.
"""

import pytest
from app.core.engine.models import Severity, Anomaly
from app.core.engine.context import ValidationContext
from app.core.engine.registry import RuleRegistry
from app.core.engine.runner import RuleEngineRunner
from app.core.engine.rules import (
    LGG_PhysicalAndGeometricRule,
    LGG_FracturesAndFRFRule,
    LGG_GeomechanicalCompatibilityRule,
    Estructural_SpatialContainmentRule,
    RMR_CrossCheckWithLGGRule,
    RMR_FormulasAndRatingsRule,
    CrossModule_EOHRule,
)


def test_validation_context_indexing():
    """Verifica que el contexto indexe corridas por taladro y ordene por profundidad."""
    lgg_runs = [
        {"taladro": "TAL-01", "corrida": 2, "de": 1.5, "a": 3.0},
        {"taladro": "TAL-01", "corrida": 1, "de": 0.0, "a": 1.5},
        {"taladro": "TAL-02", "corrida": 1, "de": 0.0, "a": 1.2},
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)

    assert len(ctx.get_lgg_runs("TAL-01")) == 2
    # Debe estar ordenado por 'de'
    assert ctx.get_lgg_runs("TAL-01")[0]["corrida"] == 1
    assert ctx.get_lgg_runs("TAL-01")[1]["corrida"] == 2
    assert ctx.max_lgg_by_taladro["TAL-01"] == 3.0
    assert ctx.max_lgg_by_taladro["TAL-02"] == 1.2


def test_lgg_physical_rules_detection():
    """Verifica detección de avance negativo, exceso de avance y recuperación mayor al avance."""
    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 0.0, "a": 2.0, "perf": 2.0, "rec_m": 2.5, "rqd_m": 1.0, "lrf_m": 0.5, "small_frag_m": 0.2},
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "de": 2.5, "a": 2.0},  # Ruptura continuidad y avance negativo
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = LGG_PhysicalAndGeometricRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    assert "R102" in codes  # Excede 1.6m
    assert "R103" in codes  # Rec (2.5) > Perf (2.0)
    assert "R101" in codes  # Avance negativo (2.0 - 2.5 = -0.5)
    assert "R122" in codes  # Ruptura de continuidad (inicia en 2.5m pero anterior terminó en 2.0m)


def test_lgg_frf_formula():
    """Verifica que la regla valide la fórmula oficial de FRF = floor(round(lrf*100)/5) + 1."""
    # LRF = 0.40m -> round(40)/5 = 8 + 1 = 9
    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "lrf_m": 0.40, "frf": 9, "frac_nat": 5, "frac_buz30": 2, "frac_buz60": 2, "frac_buz90": 1},
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "lrf_m": 0.40, "frf": 4, "frac_nat": 5, "frac_buz30": 1, "frac_buz60": 1, "frac_buz90": 1},  # FRF erróneo y suma buzamientos errónea
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = LGG_FracturesAndFRFRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    assert "R120" in codes  # Discrepancia FRF en corrida 2
    assert "R107" in codes  # Discrepancia sumatoria buzamientos (3 != 5)


def test_estructural_containment():
    """Verifica detección de profundidades huérfanas o fuera de corrida en Estructural."""
    lgg_runs = [
        {"taladro": "T1", "corrida": 1, "de": 0.0, "a": 1.5},
        {"taladro": "T1", "corrida": 2, "de": 1.5, "a": 3.0},
    ]
    est_structs = [
        {"_fila_excel": 2, "taladro": "T1", "profundidad": 1.2, "de": 0.0, "a": 1.5},  # OK
        {"_fila_excel": 3, "taladro": "T1", "profundidad": 4.5, "de": 4.0, "a": 5.0},  # Huérfana y excede límite
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs, est_structures=est_structs)
    rule = Estructural_SpatialContainmentRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    assert "R201" in codes  # Huérfana
    assert "R216" in codes  # Excede límite final (4.5 > 3.0)


def test_rmr_formulas_and_filling_normalization():
    """Verifica fórmulas de RMR, clasificación de relleno ('OX', 'SIO') y agua teórica."""
    rmr_runs = [
        {
            "_fila_excel": 2, "sondaje": "T1", "corrida": 1, "a": 95.0, "long_corrida": 1.5,
            "rec_m": 1.5, "rec_pct": 100, "rqd_m": 1.2, "rqd_pct": 80,
            "frf": 4, "frac_nat": 6, "total_frac": 10, "ff_1m": 7, "espaciamiento_mm": 150,
            "relleno": "OX", "clasificacion_relleno": 2,  # Óxido de cobre -> Clase 2 (Duro)
            "presencia_agua": "DPH",  # 92 <= 95 < 97 -> DPH
            "rmr76": 50.0, "r76_resistencia": 10.0, "r76_rqd": 15.0, "r76_espaciamiento": 10.0, "r76_juntas": 5.0, "r76_agua": 10.0
        },
        {
            "_fila_excel": 3, "sondaje": "T1", "corrida": 2, "a": 50.0, "long_corrida": 1.5,
            "relleno": "ox", "clasificacion_relleno": 1,  # Erróneo: ox debe ser Clase 2
            "presencia_agua": "WTM",  # Erróneo: a=50m debe ser CDC (<92m)
            "rmr76": 60.0, "r76_resistencia": 10.0, "r76_rqd": 10.0, "r76_espaciamiento": 10.0, "r76_juntas": 0.0, "r76_agua": 10.0 # Suma = 40 != 60
        }
    ]
    ctx = ValidationContext(rmr_runs=rmr_runs)
    rule = RMR_FormulasAndRatingsRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    # Fila 1 no debe tener errores
    f2_anoms = [a for a in anomalies if a.row_excel == 2]
    assert len(f2_anoms) == 0

    # Fila 2 debe reportar clase de relleno, agua y descuadre RMR76
    assert "R421" in codes
    assert "R310" in codes
    assert "R_RMR76_MISMATCH" in codes


def test_rule_engine_runner_pipeline():
    """Verifica que RuleEngineRunner ejecute todas las reglas y consolide el ValidationResult."""
    registry = RuleRegistry()
    registry.register(LGG_PhysicalAndGeometricRule)
    registry.register(LGG_FracturesAndFRFRule)
    registry.register(CrossModule_EOHRule)

    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 0.0, "a": 1.0, "perf": 1.0, "rec_m": 0.8, "rqd_m": 0.5, "lrf_m": 0.2, "small_frag_m": 0.1, "frf": 5, "frac_nat": 2, "frac_buz30": 1, "frac_buz60": 1, "frac_buz90": 0, "campana": "2024", "geologo": "GEO1"},
    ]
    collar_data = {"T1": 1.0}  # Coincide con LGG
    ctx = ValidationContext(lgg_runs=lgg_runs, collar_data=collar_data)

    runner = RuleEngineRunner(registry)
    result = runner.run(ctx)

    assert result.total_filas_procesadas == 1
    assert result.metricas_globales.total_celdas_padre == 1
    assert result.resumen_por_celda_padre["T1"]["estado_celda"] == "OK"
    assert len(result.incidencias) == 0


def test_heavy_dependent_fields_rule():
    """Verifica que dependencias negativas por mal cálculo sean aisladas bajo R130."""
    from app.core.engine.rules.heavy_rules import DependentFieldsIncompleteRule

    rmr_runs = [
        {"_fila_excel": 2, "sondaje": "T1", "corrida": 1, "frf": -1, "frac_nat": 5, "total_frac": 4},
        {"_fila_excel": 3, "sondaje": "T1", "corrida": 2, "frf": 4, "frac_nat": -2, "total_frac": -2}
    ]
    ctx = ValidationContext(rmr_runs=rmr_runs)
    rule = DependentFieldsIncompleteRule()
    anomalies = rule.evaluate(ctx)

    assert len(anomalies) == 2
    assert all(a.rule_code == "R130" for a in anomalies)


def test_heavy_continuous_crushed_zone_rule():
    """Verifica detección de zona altamente triturada a lo largo de 3 corridas sin estructura mayor."""
    from app.core.engine.rules.heavy_rules import ContinuousCrushedZoneAnomalyRule

    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 10.0, "a": 11.5, "perf": 1.5, "lrf_m": 1.0, "rqd_m": 0.0},
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "de": 11.5, "a": 13.0, "perf": 1.5, "lrf_m": 0.9, "rqd_m": 0.0},
        {"_fila_excel": 4, "taladro": "T1", "corrida": 3, "de": 13.0, "a": 14.5, "perf": 1.5, "lrf_m": 1.1, "rqd_m": 0.0},
    ]
    # Sin estructuras en Estructural
    ctx = ValidationContext(lgg_runs=lgg_runs, est_structures=[])
    rule = ContinuousCrushedZoneAnomalyRule()
    anomalies = rule.evaluate(ctx)

    assert len(anomalies) == 1
    assert anomalies[0].rule_code == "R_HVY_CRUSHED_ZONE"
    assert anomalies[0].severity == Severity.ADVERTENCIA


def test_heavy_abrupt_competence_drop_rule():
    """Verifica detección de caída abrupta de RQD (>50% de caída) en misma litología."""
    from app.core.engine.rules.heavy_rules import AbruptCompetenceDropRule

    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 0.0, "a": 1.5, "perf": 1.5, "rqd_m": 1.3, "lito1": "MZM"}, # RQD = 86.6%
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "de": 1.5, "a": 3.0, "perf": 1.5, "rqd_m": 0.1, "lito1": "MZM"}, # RQD = 6.6%
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = AbruptCompetenceDropRule()
    anomalies = rule.evaluate(ctx)

    assert len(anomalies) == 1
    assert anomalies[0].rule_code == "R_HVY_COMPETENCE_DROP"


def test_rqd_weak_weathered_compatibility_r141():
    """Verifica la regla R141 de incompatibilidad geomecánica en RQD para roca blanda (R0-R1) o meteorización intensa (>=IV)."""
    lgg_runs = [
        # Caso 1: R1 + HWA con RQD = 0 -> Correcto, sin anomalía
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "rqd_m": 0.0, "resistencia": "R1", "intemperismo": "HWA", "_raw_dict": {"resistencia": "R1", "intemperismo": "HWA"}},
        # Caso 2: R1 + HWA con RQD > 0 -> Alerta R141 (ambos factores)
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "rqd_m": 0.6, "resistencia": "R1", "intemperismo": "HWA", "_raw_dict": {"resistencia": "R1", "intemperismo": "HWA"}},
        # Caso 3: R0 + SWD con RQD > 0 -> Alerta R141 (resistencia blanda)
        {"_fila_excel": 4, "taladro": "T1", "corrida": 3, "rqd_m": 0.4, "resistencia": "R0", "intemperismo": "SWD", "_raw_dict": {"resistencia": "R0", "intemperismo": "SWD"}},
        # Caso 4: R3 + CWC con RQD > 0 -> Alerta R141 (meteorización grado V)
        {"_fila_excel": 5, "taladro": "T1", "corrida": 4, "rqd_m": 0.5, "resistencia": "R3", "intemperismo": "CWC", "_raw_dict": {"resistencia": "R3", "intemperismo": "CWC"}},
        # Caso 5: R3 + SWD con RQD > 0 -> Competente, sin anomalía
        {"_fila_excel": 6, "taladro": "T1", "corrida": 5, "rqd_m": 1.2, "resistencia": "R3", "intemperismo": "SWD", "_raw_dict": {"resistencia": "R3", "intemperismo": "SWD"}},
        # Caso 6: R1 con RQD vacío / None -> No debe disparar R141 (lo maneja R100_EMPTY)
        {"_fila_excel": 7, "taladro": "T1", "corrida": 6, "rqd_m": None, "resistencia": "R1", "intemperismo": "HWA", "_raw_dict": {"resistencia": "R1", "intemperismo": "HWA"}},
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = LGG_GeomechanicalCompatibilityRule()
    anomalies = rule.evaluate(ctx)

    r141_anoms = [a for a in anomalies if a.rule_code == "R141"]
    assert len(r141_anoms) == 3

    # Filas 3, 4, 5 dispararon anomalías
    rows_flagged = {a.row_excel for a in r141_anoms}
    assert rows_flagged == {3, 4, 5}

    # Todas son de severidad ADVERTENCIA
    assert all(a.severity == Severity.ADVERTENCIA for a in r141_anoms)

    # Ningún mensaje debe contener la palabra 'procedimiento'
    for a in r141_anoms:
        assert "procedimiento" not in a.mensaje.lower(), f"Mensaje no debe mencionar procedimiento: {a.mensaje}"


def test_rmr_condicion_de_juntas_validation():
    """Valida la regla geomecánica Condición de Juntas = Persistencia + Abertura + Rugosidad + Relleno + Intemperismo."""
    rule = RMR_FormulasAndRatingsRule()

    # Caso 1: Fila conforme (76 y 89 cuadran exactamente)
    row_ok = {
        "_fila_excel": 2, "sondaje": "T1", "corrida": 1,
        # RMR 76
        "r76_persistencia": 2.0, "r76_abertura": 4.0, "r76_rugosidad": 3.0, "r76_relleno": 4.0, "r76_intemperismo": 5.0,
        "r76_juntas": 18.0,
        "r76_resistencia": 7.0, "r76_rqd": 13.0, "r76_espaciamiento": 10.0, "r76_agua": 10.0, "rmr76": 58.0,
        # RMR 89
        "r89_persistencia": 4.0, "r89_abertura": 4.0, "r89_rugosidad": 3.0, "r89_relleno": 4.0, "r89_intemperismo": 5.0,
        "r89_juntas": 20.0,
        "r89_resistencia": 7.0, "r89_rqd": 13.0, "r89_espaciamiento": 10.0, "r89_agua": 10.0, "rmr89": 60.0,
    }

    # Caso 2: Descuadre en Condición de Juntas RMR 89 (reporta 22, pero suma es 20)
    row_mismatch_89 = {
        "_fila_excel": 3, "sondaje": "T1", "corrida": 2,
        "r89_persistencia": 4.0, "r89_abertura": 4.0, "r89_rugosidad": 3.0, "r89_relleno": 4.0, "r89_intemperismo": 5.0,
        "r89_juntas": 22.0,  # Descuadre
    }

    # Caso 3: Descuadre en Condición de Juntas RMR 76 (reporta 15, pero suma es 18)
    row_mismatch_76 = {
        "_fila_excel": 4, "sondaje": "T1", "corrida": 3,
        "r76_persistencia": 2.0, "r76_abertura": 4.0, "r76_rugosidad": 3.0, "r76_relleno": 4.0, "r76_intemperismo": 5.0,
        "r76_juntas": 15.0,  # Descuadre
    }

    # Caso 4: Parámetros presentes pero celda de juntas vacía en Excel
    row_empty_juntas = {
        "_fila_excel": 5, "sondaje": "T1", "corrida": 4,
        "r89_persistencia": 4.0, "r89_abertura": 4.0, "r89_rugosidad": 3.0, "r89_relleno": 4.0, "r89_intemperismo": 5.0,
        "r89_juntas": None,  # Vacía
    }

    # Caso 5: Valor de juntas fuera de rango (0 a 30)
    row_out_of_range = {
        "_fila_excel": 6, "sondaje": "T1", "corrida": 5,
        "r89_juntas": 35.0,
    }

    # Caso 6: Tramo OVD / Suelo (todo None, sin logueo geomecánico) -> NO debe generar anomalías
    row_ovd = {
        "_fila_excel": 7, "sondaje": "T1", "corrida": 6,
        "r76_persistencia": None, "r76_abertura": None, "r76_rugosidad": None, "r76_relleno": None, "r76_intemperismo": None,
        "r76_juntas": None, "rmr76": None,
        "r89_persistencia": None, "r89_abertura": None, "r89_rugosidad": None, "r89_relleno": None, "r89_intemperismo": None,
        "r89_juntas": None, "rmr89": None,
    }

    ctx = ValidationContext(rmr_runs=[row_ok, row_mismatch_89, row_mismatch_76, row_empty_juntas, row_out_of_range, row_ovd])
    anomalies = rule.evaluate(ctx)

    # Filtrar solo anomalías relacionadas a condición de juntas
    juntas_anoms = [a for a in anomalies if "JUNTAS" in a.rule_code]
    anom_by_row = {a.row_excel: a for a in juntas_anoms}

    # Fila 2 (OK) no debe tener anomalías
    assert 2 not in anom_by_row

    # Fila 3: R_RMR89_JUNTAS_MISMATCH
    assert 3 in anom_by_row
    assert anom_by_row[3].rule_code == "R_RMR89_JUNTAS_MISMATCH"
    assert "Persistencia(4.0)" in anom_by_row[3].mensaje

    # Fila 4: R_RMR76_JUNTAS_MISMATCH
    assert 4 in anom_by_row
    assert anom_by_row[4].rule_code == "R_RMR76_JUNTAS_MISMATCH"
    assert "Excel registra 15.0" in anom_by_row[4].mensaje

    # Fila 5: R_RMR89_JUNTAS_MISMATCH por celda vacía
    assert 5 in anom_by_row
    assert anom_by_row[5].rule_code == "R_RMR89_JUNTAS_MISMATCH"
    assert "se encuentra vacía" in anom_by_row[5].mensaje

    # Fila 6: R_RMR89_JUNTAS_RANGE
    assert 6 in anom_by_row
    assert anom_by_row[6].rule_code == "R_RMR89_JUNTAS_RANGE"

    # Fila 7 (OVD): no debe tener anomalías
    assert 7 not in anom_by_row


def test_rmr_subratings_column_resolution():
    """Verifica que resolve_rmr_subratings_from_sheet identifique con precisión los bloques RMR'76 y RMR'89 sin colisiones."""
    import openpyxl
    from app.core.adapters.excel.rmr_reader import resolve_rmr_subratings_from_sheet

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Validación_RMR"

    # Encabezados en fila 1:
    # Col 1..5: Datos de entrada (Persistencia, Abertura, Rugosidad, Relleno, Intemperismo)
    # Col 6..10: Bloque RMR 76 (con rmr76 al final)
    # Col 11..15: Bloque RMR 89 (con rmr89 al final)
    headers = [
        "Sondaje", "De", "A", "Abertura (mm)", "Rugosidad ISRM",  # 1..5
        # Bloque 76:
        "R76 Resistencia", "R76 RQD", "Espaciamiento", "Persistencia", "Abertura", "Rugosidad", "Relleno", "Intemperismo", "Condición de Juntas", "Presencia de Agua", "RMR 76",  # 6..16
        # Bloque 89:
        "R89 Resistencia", "R89 RQD", "Espaciamiento", "Persistencia", "Abertura", "Rugosidad", "Relleno", "Intemperismo", "Condición de Juntas", "Presencia de Agua", "RMR 89",  # 17..27
    ]
    ws.append(headers)

    res = resolve_rmr_subratings_from_sheet(ws, h_idx=1)

    # Debe haber encontrado rmr76 en col 16 y rmr89 en col 27
    assert res["rmr76"] == 16
    assert res["rmr89"] == 27

    # Subratings de 76 deben ser anteriores a col 16
    assert res["r76_persistencia"] == 9
    assert res["r76_abertura"] == 10
    assert res["r76_rugosidad"] == 11
    assert res["r76_relleno"] == 12
    assert res["r76_intemperismo"] == 13
    assert res["r76_juntas"] == 14

    # Subratings de 89 deben estar entre col 17 y 27
    assert res["r89_persistencia"] == 20
    assert res["r89_abertura"] == 21
    assert res["r89_rugosidad"] == 22
    assert res["r89_relleno"] == 23
    assert res["r89_intemperismo"] == 24
    assert res["r89_juntas"] == 25



