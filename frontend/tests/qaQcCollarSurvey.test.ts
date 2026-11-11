/**
 * frontend/tests/qaQcCollarSurvey.test.ts
 * Pruebas automatizadas para validaciones QA/QC de Collar & Survey y cruce con LGG.
 */

import assert from 'node:assert/strict';
import { validateLogueoQAQC, QAQC_RULE_REGISTRY } from '../src/utils/qaQcRules.ts';

function runTests() {
  console.log('=== Iniciando Suite de Pruebas QA/QC: Collar & Survey ===\n');
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  // 1. SURVEY_DEPTH_EXCEDE_EOH
  test('SURVEY_DEPTH_EXCEDE_EOH: Detecta lectura de survey que excede EOH', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 100.0 };
    const surveys = [
      { depth: 50.0, dip: 45.0, azimuth: 120.0 },
      { depth: 105.0, dip: 45.0, azimuth: 120.0 }
    ];
    const alerts = validateLogueoQAQC(collar, surveys, [], [], [], true);
    const alert = alerts.find(a => a.ruleId === 'SURVEY_DEPTH_EXCEDE_EOH');
    assert.ok(alert, 'Debe emitir alerta SURVEY_DEPTH_EXCEDE_EOH');
    assert.equal(alert.type, 'CRITICA');
    assert.equal(alert.fieldId, 'survey-depth-1');
    assert.match(alert.message, /105m.*100m/);
  });

  test('SURVEY_DEPTH_EXCEDE_EOH: No emite alerta si survey está dentro de EOH', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 100.0 };
    const surveys = [
      { depth: 50.0, dip: 45.0, azimuth: 120.0 },
      { depth: 100.0, dip: 45.0, azimuth: 120.0 }
    ];
    const alerts = validateLogueoQAQC(collar, surveys, [], [], [], true);
    const alert = alerts.find(a => a.ruleId === 'SURVEY_DEPTH_EXCEDE_EOH');
    assert.equal(alert, undefined, 'No debe haber alerta de exceso de EOH');
  });

  test('SURVEY_DEPTH_EXCEDE_EOH: Funciona con fallback collar_eoh', () => {
    const collar = { name: 'DH-01', collar_eoh: 80.0 };
    const surveys = [{ depth: 85.0, dip: 45.0, azimuth: 120.0 }];
    const alerts = validateLogueoQAQC(collar, surveys, [], [], [], true);
    const alert = alerts.find(a => a.ruleId === 'SURVEY_DEPTH_EXCEDE_EOH');
    assert.ok(alert, 'Debe emitir alerta con fallback collar_eoh');
    assert.equal(alert.type, 'CRITICA');
  });

  // 2. COLLAR_EOH_DISCREPA_LGG
  test('COLLAR_EOH_DISCREPA_LGG: Detecta discrepancia de EOH entre Collar y avance LGG (> 0.05m)', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 150.0 };
    const corridas = [
      { de: 0.0, a: 100.0, perf: 1.0, rec_m: 1.0, rqd_m: 1.0 },
      { de: 100.0, a: 155.0, perf: 1.0, rec_m: 1.0, rqd_m: 1.0 } // LGG max = 155m
    ];
    const alerts = validateLogueoQAQC(collar, [], corridas, [], [], true);
    const alert = alerts.find(a => a.ruleId === 'COLLAR_EOH_DISCREPA_LGG');
    assert.ok(alert, 'Debe emitir alerta COLLAR_EOH_DISCREPA_LGG');
    assert.equal(alert.type, 'ADVERTENCIA');
    assert.equal(alert.fieldId, 'header-prof_final_eoh');
    assert.match(alert.message, /150\.00m.*155\.00m.*tol 0\.05m/);
  });

  test('COLLAR_EOH_DISCREPA_LGG: Tolera diferencias menores o iguales a 0.05m', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 150.0 };
    const corridas = [
      { de: 0.0, a: 150.03, perf: 1.0, rec_m: 1.0, rqd_m: 1.0 } // diff = 0.03m <= 0.05m
    ];
    const alerts = validateLogueoQAQC(collar, [], corridas, [], [], true);
    const alert = alerts.find(a => a.ruleId === 'COLLAR_EOH_DISCREPA_LGG');
    assert.equal(alert, undefined, 'Diferencia <= 0.05m debe ser tolerada');
  });

  // 3. SURVEY_DIP_RANGO
  test('SURVEY_DIP_RANGO: Detecta Dip fuera del rango 0° - 90°', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 100.0 };
    const surveys = [{ depth: 10.0, dip: 95.0, azimuth: 120.0 }];
    const alerts = validateLogueoQAQC(collar, surveys, [], [], [], true);
    const alert = alerts.find(a => a.ruleId === 'SURVEY_DIP_RANGO');
    assert.ok(alert, 'Debe emitir alerta por Dip > 90°');
    assert.equal(alert.type, 'CRITICA');
    assert.equal(alert.fieldId, 'survey-dip-0');
  });

  // 4. SURVEY_AZIMUTH_RANGO
  test('SURVEY_AZIMUTH_RANGO: Detecta Azimut fuera del rango 0° - 360°', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 100.0 };
    const surveys = [{ depth: 10.0, dip: 45.0, azimuth: 375.0 }];
    const alerts = validateLogueoQAQC(collar, surveys, [], [], [], true);
    const alert = alerts.find(a => a.ruleId === 'SURVEY_AZIMUTH_RANGO');
    assert.ok(alert, 'Debe emitir alerta por Azimut > 360°');
    assert.equal(alert.type, 'CRITICA');
    assert.equal(alert.fieldId, 'survey-azimuth-0');
  });

  // 5. SURVEY_DIP_CAMBIO_BRUSCO
  test('SURVEY_DIP_CAMBIO_BRUSCO: Detecta cambio brusco > 2° entre lecturas consecutivas', () => {
    const collar = { name: 'DH-01', prof_final_eoh: 100.0 };
    const surveys = [
      { depth: 10.0, dip: 45.0, azimuth: 120.0 },
      { depth: 15.0, dip: 48.0, azimuth: 120.0 } // cambio de 3° > 2°
    ];
    const alerts = validateLogueoQAQC(collar, surveys, [], [], [], true);
    const alert = alerts.find(a => a.ruleId === 'SURVEY_DIP_CAMBIO_BRUSCO');
    assert.ok(alert, 'Debe emitir advertencia por cambio brusco de Dip');
    assert.equal(alert.type, 'ADVERTENCIA');
    assert.equal(alert.fieldId, 'survey-dip-1');
  });

  console.log(`\n==================================================`);
  console.log(`Resultado: ${passed}/${total} pruebas pasaron con éxito.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();

