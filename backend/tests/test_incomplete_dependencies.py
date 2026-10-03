"""
tests/test_incomplete_dependencies.py
Pruebas unitarias para la validación atómica de causa raíz (R130) en dependencias incompletas.
Verifica que las variables calculadas que resultan negativas por insumos vacíos o en -1
generen R130 de causa raíz en lugar de alertas secundarias confusas, y que el valor 0 sea respetado.
"""

import math
import pytest
from app.core.engine.models import Severity
from app.core.engine.context import ValidationContext
from app.core.engine.rules.common import is_missing_or_no_info
from app.core.engine.rules.lgg_rules import LGG_PhysicalAndGeometricRule, LGG_FracturesAndFRFRule
from app.core.engine.rules.rmr_rules import RMR_FormulasAndRatingsRule


def test_is_missing_or_no_info():
    """Valida la distinción estricta entre vacío / sin información (-1) y el valor físico 0."""
    # Casos verdaderos de vacío o sin información
    assert is_missing_or_no_info(None) is True
    assert is_missing_or_no_info("") is True
    assert is_missing_or_no_info("   ") is True
    assert is_missing_or_no_info("-") is True
    assert is_missing_or_no_info("—") is True
    assert is_missing_or_no_info("N/A") is True
    assert is_missing_or_no_info("nan") is True
    assert is_missing_or_no_info("NAN") is True
    assert is_missing_or_no_info(float("nan")) is True
    assert is_missing_or_no_info(-1) is True
    assert is_missing_or_no_info(-1.0) is True
    assert is_missing_or_no_info("-1") is True
    assert is_missing_or_no_info("-1.0") is True
    assert is_missing_or_no_info("-1,0") is True

    # Casos que NO deben ser considerados ausentes (datos legítimos)
    assert is_missing_or_no_info(0) is False
    assert is_missing_or_no_info(0.0) is False
    assert is_missing_or_no_info("0") is False
    assert is_missing_or_no_info("0.0") is False
    assert is_missing_or_no_info(10) is False
    assert is_missing_or_no_info(0.35) is False
    assert is_missing_or_no_info(-2) is False
    assert is_missing_or_no_info(-19) is False


def test_lgg_frac_nat_root_cause_r130():
    """Verifica que frac_nat negativo por insumos de buzamiento en -1 o vacíos emita R130 con causa raíz."""
    # Fila 1: Insumos en -1 generan frac_nat = -3 -> Causa raíz R130
    # Fila 2: Insumos válidos pero geólogo escribió -5 a mano -> R130 indicando que no puede ser negativo
    # Fila 3: Cero legítimo -> No emite error de negativo
    runs = [
        {
            "_fila_excel": 2, "taladro": "T1", "corrida": 1,
            "_raw_dict": {"frac_nat": -3, "frac_buz30": -1, "frac_buz60": -1, "frac_buz90": -1},
            "frac_nat": -3, "frac_buz30": None, "frac_buz60": None, "frac_buz90": None
        },
        {
            "_fila_excel": 3, "taladro": "T1", "corrida": 2,
            "_raw_dict": {"frac_nat": -5, "frac_buz30": 2, "frac_buz60": 1, "frac_buz90": 0},
            "frac_nat": -5, "frac_buz30": 2, "frac_buz60": 1, "frac_buz90": 0
        },
        {
            "_fila_excel": 4, "taladro": "T1", "corrida": 3,
            "_raw_dict": {"frac_nat": 0, "frac_buz30": 0, "frac_buz60": 0, "frac_buz90": 0},
            "frac_nat": 0, "frac_buz30": 0, "frac_buz60": 0, "frac_buz90": 0
        }
    ]
    ctx = ValidationContext(lgg_runs=runs, metadata={"skip_lgg_max_advance": True})
    rule = LGG_PhysicalAndGeometricRule()
    anomalies = rule.evaluate(ctx)

    fn_anoms = [a for a in anomalies if a.columna == "frac_nat" and a.rule_code == "R130"]
    assert len(fn_anoms) == 2

    # Corrida 1: Causa raíz detectada
    anom_c1 = next(a for a in fn_anoms if a.row_excel == 2)
    assert "vacíos o sin información (-1)" in anom_c1.mensaje
    assert anom_c1.valor_actual == -3

    # Corrida 2: Error numérico directo
    anom_c2 = next(a for a in fn_anoms if a.row_excel == 3)
    assert "no puede ser negativo" in anom_c2.mensaje

    # Corrida 3: Sin anomalías para corrida 3
    assert not any(a.row_excel == 4 for a in fn_anoms)


def test_lgg_frf_root_cause_r130():
    """Verifica que FRF negativo por LRF en -1 emita R130 en vez de R118."""
    runs = [
        # Fila 1: lrf_m = -1 provoca frf = -19 -> R130
        {
            "_fila_excel": 2, "taladro": "T1", "corrida": 1,
            "_raw_dict": {"frf": -19, "lrf_m": -1},
            "frf": -19, "lrf_m": None
        },
        # Fila 2: lrf_m = 0.50 pero frf = -5 ingresado a mano -> R118
        {
            "_fila_excel": 3, "taladro": "T1", "corrida": 2,
            "_raw_dict": {"frf": -5, "lrf_m": 0.50},
            "frf": -5, "lrf_m": 0.50
        }
    ]
    ctx = ValidationContext(lgg_runs=runs, lgg_by_taladro={"T1": runs})
    rule = LGG_FracturesAndFRFRule()
    anomalies = rule.evaluate(ctx)

    r130_anoms = [a for a in anomalies if a.rule_code == "R130" and a.columna == "frf"]
    r118_anoms = [a for a in anomalies if a.rule_code == "R118" and a.columna == "frf"]

    assert len(r130_anoms) == 1
    assert r130_anoms[0].row_excel == 2
    assert "LRF está vacío o sin información (-1)" in r130_anoms[0].mensaje

    assert len(r118_anoms) == 1
    assert r118_anoms[0].row_excel == 3
    assert "no puede ser negativo" in r118_anoms[0].mensaje


def test_rmr_dependent_negative_fields_r130():
    """Verifica que campos calculados negativos en RMR supriman cascada cuando insumos son -1, y alerten si son manuales."""
    rmr_runs = [
        # Caso 1: total_frac = -2 por dependencias frf = -1 y fn = -1 -> Se suprime cascada secundaria
        {
            "_fila_excel": 2, "sondaje": "T1", "corrida": 1,
            "frf": -1, "frac_nat": -1, "total_frac": -2, "ff_1m": -2, "espaciamiento_mm": -100,
            "long_corrida": 1.0
        },
        # Caso 2: Insumos válidos (frf=4, fn=2), pero geólogo ingresó total_frac = -5 a mano -> R130 manual
        {
            "_fila_excel": 3, "sondaje": "T1", "corrida": 2,
            "frf": 4, "frac_nat": 2, "total_frac": -5, "ff_1m": 0, "espaciamiento_mm": 200,
            "long_corrida": 1.0
        }
    ]
    ctx = ValidationContext(rmr_runs=rmr_runs, rmr_by_taladro={"T1": rmr_runs})
    rule = RMR_FormulasAndRatingsRule()
    anomalies = rule.evaluate(ctx)

    # Caso 1 (fila 2): Suprime cascada secundaria
    anoms_c1 = [a for a in anomalies if a.row_excel == 2]
    assert len(anoms_c1) == 0  # Cero alertas secundarias en cascada

    # Caso 2 (fila 3): Detecta número negativo manual en total_frac
    anoms_c2 = [a for a in anomalies if a.row_excel == 3 and a.columna == "total_frac"]
    assert len(anoms_c2) == 1
    assert anoms_c2[0].rule_code == "R130"
    assert "no puede ser negativo" in anoms_c2[0].mensaje

