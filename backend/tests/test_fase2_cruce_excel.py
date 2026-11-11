"""
backend/tests/test_fase2_cruce_excel.py
Pruebas unitarias y de integración para la Fase 2: Hoja de cruce Collar/Survey en Excel.
Verifica decisiones D7, D8 y D9 implementadas en eoh_rules.py y ddh_excel_exporter.py.
"""

import unittest
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.services.ddh_excel_exporter import generar_excel_reporte_core
from app.core.engine.rules.eoh_rules import CrossModule_EOHRule
from app.core.engine.context import ValidationContext


class TestFase2CruceExcel(unittest.TestCase):

    def _build_dummy_compact(self):
        return {
            "resumen_por_celda_padre": {},
            "distribucion_campania": [],
            "distribucion_geotecnico": []
        }

    def test_d7_hoja_no_se_crea_si_no_hay_collar_ni_survey(self):
        """D7: Si no se cargó Collar ni Survey, la hoja Cruce Collar-Survey NO se crea."""
        diag = {
            "unique_lgg_runs": [],
            "unique_est_structures": [],
            "cruce_collar_survey": {
                "archivos": {
                    "collar": {"cargado": False, "total_registros": 0},
                    "survey": {"cargado": False, "total_registros": 0}
                },
                "taladros": {}
            }
        }
        wb = generar_excel_reporte_core(diag, self._build_dummy_compact(), [])
        try:
            self.assertNotIn("Cruce Collar-Survey", wb.sheetnames)
        finally:
            wb.close()

    def test_d7_posicion_hoja_posterior_a_taladros_unicos(self):
        """D7: La hoja se crea posterior a las otras hojas de cruce (LGG y Estructural) y antes de Detalle."""
        diag = {
            "unique_lgg_runs": [],
            "unique_est_structures": [],
            "cruce_collar_survey": {
                "archivos": {
                    "collar": {"cargado": True, "total_registros": 1},
                    "survey": {"cargado": True, "total_registros": 1}
                },
                "taladros": {}
            }
        }
        wb = generar_excel_reporte_core(diag, self._build_dummy_compact(), [])
        try:
            self.assertIn("Cruce Collar-Survey", wb.sheetnames)
            idx_lgg = wb.sheetnames.index("🗂️ Taladros Únicos LGG")
            idx_est = wb.sheetnames.index("🗂️ Taladros Únicos Estructural")
            idx_cruce = wb.sheetnames.index("Cruce Collar-Survey")
            idx_detalle = wb.sheetnames.index("📋 Detalle de Incidencias")
            self.assertTrue(idx_lgg < idx_est < idx_cruce < idx_detalle)
        finally:
            wb.close()

    def test_d7_columnas_ambos_cargados(self):
        """D7: Con ambos cargados, 11 columnas en el orden exacto de especificación."""
        diag = {
            "unique_lgg_runs": [],
            "unique_est_structures": [],
            "cruce_collar_survey": {
                "archivos": {
                    "collar": {"cargado": True, "total_registros": 1},
                    "survey": {"cargado": True, "total_registros": 1}
                },
                "taladros": {}
            }
        }
        wb = generar_excel_reporte_core(diag, self._build_dummy_compact(), [])
        try:
            ws = wb["Cruce Collar-Survey"]
            expected_headers = [
                "Taladro", "Campaña", "LGG Máx (m)", "Estructural Máx (m)",
                "Collar EOH (m)", "Survey Máx (m)", "Δ LGG-Collar",
                "Δ LGG-Survey", "Δ LGG-Estructural", "Estado", "Observación"
            ]
            actual_headers = [ws.cell(5, c).value for c in range(2, 2 + len(expected_headers))]
            self.assertEqual(actual_headers, expected_headers)
        finally:
            wb.close()

    def test_d7_columnas_solo_collar(self):
        """D7: Solo Collar cargado: 9 columnas (sin Survey ni Δ Survey, sin 'No Cargado')."""
        diag = {
            "unique_lgg_runs": [],
            "unique_est_structures": [],
            "cruce_collar_survey": {
                "archivos": {
                    "collar": {"cargado": True, "total_registros": 1},
                    "survey": {"cargado": False, "total_registros": 0}
                },
                "taladros": {}
            }
        }
        wb = generar_excel_reporte_core(diag, self._build_dummy_compact(), [])
        try:
            ws = wb["Cruce Collar-Survey"]
            expected_headers = [
                "Taladro", "Campaña", "LGG Máx (m)", "Estructural Máx (m)",
                "Collar EOH (m)", "Δ LGG-Collar", "Δ LGG-Estructural",
                "Estado", "Observación"
            ]
            actual_headers = [ws.cell(5, c).value for c in range(2, 2 + len(expected_headers))]
            self.assertEqual(actual_headers, expected_headers)
            for h in actual_headers:
                self.assertNotIn("Survey", h)
                self.assertNotIn("No Cargado", h)
        finally:
            wb.close()

    def test_d7_columnas_solo_survey(self):
        """D7: Solo Survey cargado: 9 columnas (sin Collar ni Δ Collar, sin 'No Cargado')."""
        diag = {
            "unique_lgg_runs": [],
            "unique_est_structures": [],
            "cruce_collar_survey": {
                "archivos": {
                    "collar": {"cargado": False, "total_registros": 0},
                    "survey": {"cargado": True, "total_registros": 1}
                },
                "taladros": {}
            }
        }
        wb = generar_excel_reporte_core(diag, self._build_dummy_compact(), [])
        try:
            ws = wb["Cruce Collar-Survey"]
            expected_headers = [
                "Taladro", "Campaña", "LGG Máx (m)", "Estructural Máx (m)",
                "Survey Máx (m)", "Δ LGG-Survey", "Δ LGG-Estructural",
                "Estado", "Observación"
            ]
            actual_headers = [ws.cell(5, c).value for c in range(2, 2 + len(expected_headers))]
            self.assertEqual(actual_headers, expected_headers)
            for h in actual_headers:
                self.assertNotIn("Collar", h)
                self.assertNotIn("No Cargado", h)
        finally:
            wb.close()

    def test_d8_y_d9_filas_valores_y_formato(self):
        """
        D8: Filas evaluadas + filas de inventario informativo ("SOLO EN COLLAR/SURVEY").
        D9: Celdas sin dato VACÍAS (None), números float con '0.00', deltas correctos.
        """
        diag = {
            "unique_lgg_runs": [],
            "unique_est_structures": [],
            "cruce_collar_survey": {
                "archivos": {
                    "collar": {"cargado": True, "total_registros": 3},
                    "survey": {"cargado": True, "total_registros": 3}
                },
                "taladros": {
                    "DH-01": {
                        "taladro": "DH-01",
                        "campania": 2024,
                        "lgg_max": 100.5,
                        "est_max": 100.5,
                        "collar_eoh": 100.5,
                        "survey_max": 100.5,
                        "estado_global": "COINCIDE",
                        "comparaciones": {}
                    },
                    "DH-02": {
                        "taladro": "DH-02",
                        "campania": "2023",
                        "lgg_max": 150.0,
                        "est_max": 150.0,
                        "collar_eoh": 145.0,
                        "survey_max": None,  # Ausente en survey
                        "estado_global": "DISCREPANCIA",
                        "comparaciones": {}
                    },
                    "DH-INV-01": {
                        "taladro": "DH-INV-01",
                        "campania": None,  # D8: campaña vacía
                        "lgg_max": None,  # D9: vacío
                        "est_max": None,
                        "collar_eoh": 200.0,
                        "survey_max": 200.0,
                        "estado_global": "SOLO EN COLLAR/SURVEY",
                        "comparaciones": {}
                    }
                }
            }
        }
        wb = generar_excel_reporte_core(diag, self._build_dummy_compact(), [])
        try:
            ws = wb["Cruce Collar-Survey"]
            # Fila 6: DH-01 (COINCIDE)
            self.assertEqual(ws.cell(6, 2).value, "DH-01")
            self.assertEqual(ws.cell(6, 3).value, 2024)
            self.assertEqual(ws.cell(6, 4).value, 100.5)
            self.assertEqual(ws.cell(6, 4).number_format, '0.00')
            self.assertEqual(ws.cell(6, 8).value, 0.0)  # delta LGG-Collar
            self.assertEqual(ws.cell(6, 8).number_format, '0.00')
            self.assertEqual(ws.cell(6, 11).value, "COINCIDE")

            # Fila 7: DH-02 (DISCREPANCIA)
            self.assertEqual(ws.cell(7, 2).value, "DH-02")
            self.assertEqual(ws.cell(7, 3).value, 2023)
            self.assertEqual(ws.cell(7, 4).value, 150.0)
            self.assertEqual(ws.cell(7, 6).value, 145.0)
            self.assertIsNone(ws.cell(7, 7).value)  # Survey Máx sin dato -> None (D9)
            self.assertEqual(ws.cell(7, 8).value, 5.0)  # delta LGG-Collar = 150 - 145 = 5.0
            self.assertIsNone(ws.cell(7, 9).value)  # delta LGG-Survey -> None (D9)
            self.assertEqual(ws.cell(7, 11).value, "DISCREPANCIA")

            # Fila 8: DH-INV-01 (SOLO EN COLLAR/SURVEY)
            self.assertEqual(ws.cell(8, 2).value, "DH-INV-01")
            self.assertIsNone(ws.cell(8, 3).value)  # Campaña vacía (None)
            self.assertIsNone(ws.cell(8, 4).value)  # LGG Máx vacío (None)
            self.assertIsNone(ws.cell(8, 5).value)  # Estructural Máx vacío (None)
            self.assertEqual(ws.cell(8, 6).value, 200.0)
            self.assertEqual(ws.cell(8, 7).value, 200.0)
            self.assertIsNone(ws.cell(8, 8).value)  # Deltas None
            self.assertIsNone(ws.cell(8, 9).value)
            self.assertIsNone(ws.cell(8, 10).value)
            self.assertEqual(ws.cell(8, 11).value, "SOLO EN COLLAR/SURVEY")
            self.assertIn("Inventario informativo", ws.cell(8, 12).value)
        finally:
            wb.close()

    def test_eoh_rules_inventory_d8_sin_emitir_r30x(self):
        """
        D8 en eoh_rules.py:
        Taladros solo presentes en Collar/Survey se agregan al cruce con
        estado 'SOLO EN COLLAR/SURVEY', campaña None, lgg_max None,
        y NO emiten ninguna anomalía R30x.
        """
        rule = CrossModule_EOHRule()
        collar_data = {
            "DH-01": 100.0,
            "DH-SOLO-COLLAR": 250.0
        }
        survey_data = {
            "DH-01": 100.0,
            "DH-SOLO-SURVEY": 300.0
        }
        lgg_by_taladro = {
            "DH-01": [{"HoleID": "DH-01", "Campania": 2024, "De": 0.0, "Hasta": 100.0}]
        }
        metadata = {
            "max_lgg": {"DH-01": 100.0},
            "max_est": {"DH-01": 100.0},
            "has_collar": True,
            "has_survey": True,
            "collar_meta": {"status": "ok", "total_taladros": 2},
            "survey_meta": {"status": "ok", "total_taladros": 2}
        }
        ctx = ValidationContext(
            collar_data=collar_data,
            survey_data=survey_data,
            lgg_by_taladro=lgg_by_taladro,
            metadata=metadata
        )
        anomalies = rule.evaluate(ctx)

        cruce = ctx.metadata.get("cruce_collar_survey", {})
        taladros = cruce.get("taladros", {})

        # 1. Los taladros de inventario están en cruce
        self.assertIn("DH-SOLO-COLLAR", taladros)
        self.assertIn("DH-SOLO-SURVEY", taladros)

        item_col = taladros["DH-SOLO-COLLAR"]
        self.assertEqual(item_col["estado_global"], "SOLO EN COLLAR/SURVEY")
        self.assertIsNone(item_col["campania"])
        self.assertIsNone(item_col["lgg_max"])
        self.assertIsNone(item_col["est_max"])
        self.assertEqual(item_col["collar_eoh"], 250.0)
        self.assertIsNone(item_col["survey_max"])

        item_sur = taladros["DH-SOLO-SURVEY"]
        self.assertEqual(item_sur["estado_global"], "SOLO EN COLLAR/SURVEY")
        self.assertIsNone(item_sur["campania"])
        self.assertIsNone(item_sur["lgg_max"])
        self.assertIsNone(item_sur["est_max"])
        self.assertIsNone(item_sur["collar_eoh"])
        self.assertEqual(item_sur["survey_max"], 300.0)

        # 2. NO hay anomalías para DH-SOLO-COLLAR ni DH-SOLO-SURVEY
        anom_holes = [a.celda_padre for a in anomalies]
        self.assertNotIn("DH-SOLO-COLLAR", anom_holes)
        self.assertNotIn("DH-SOLO-SURVEY", anom_holes)


if __name__ == "__main__":
    unittest.main()
