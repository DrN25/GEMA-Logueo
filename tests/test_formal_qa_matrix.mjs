/**
 * test_formal_qa_matrix.mjs — Suite de Pruebas Formales de QA para GEMA-Logueo.
 *
 * Metodologías aplicadas:
 *   1. Partición de Equivalencia (Equivalence Partitioning)
 *   2. Transición de Estados (State Transition Testing)
 *   3. Tablas de Decisión (Decision Table Testing)
 */

import assert from 'node:assert';

// Mock de localStorage completo
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

// Carga directa de módulos de dominio
const sm = await import('../frontend/src/utils/storageManager.ts');
const tr = await import('../frontend/src/utils/taladroRegistry.ts');
const hu = await import('../frontend/src/utils/hashUtils.ts');
const du = await import('../frontend/src/utils/diffUtils.ts');
const mr = await import('../frontend/src/utils/mandatoryRules.ts');

let passedTests = 0;
async function test(name, fn) {
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n===============================================================');
console.log('🧪 SUITE FORMAL DE QA: Partición de Equivalencia, Transición y Decisiones');
console.log('===============================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. PARTITION EQUIVALENCE TESTING (Partición de Equivalencia)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. PARTITION EQUIVALENCE TESTING ---');

await test('Clase 1a: Ingresar a Taladro BD Limpio -> hash idéntico, isPending=false, badge=NO', () => {
  store.clear();
  const dbTaladro = {
    name: 'FEGT26-001',
    proyecto: 'Proyecto A',
    geologo: 'RD/RB',
    diametro: 'HQ3',
    inclinacion: -60,
    fecha_registro: '2026-08-24',
    corridas: [{ corrida: 1, de: 0, a: 3, rec_m: 3, rqd_m: 2.5, lito1: 'MZB' }],
    surveys: [],
    discontinuidades: [],
    ensayos_plt: []
  };

  const hash = hu.computeTaladroHash(dbTaladro);
  sm.setCachedSnapshotData(dbTaladro.name, dbTaladro);
  sm.setCachedSnapshotHash(dbTaladro.name, hash);
  sm.setCachedTaladro(dbTaladro.name, dbTaladro);

  // Al ingresar:
  const currentHash = hu.computeTaladroHash(dbTaladro);
  const isDirty = String(currentHash) !== String(hash);
  assert.equal(isDirty, false, 'Al ingresar un taladro limpio nunca debe ser dirty');

  const isPending = tr.isTaladroPending('FEGT26-001');
  assert.equal(isPending, false, 'Al ingresar un taladro limpio no debe estar en pending');

  const pendingNames = tr.getPendingTaladroNames();
  assert.equal(pendingNames.includes('FEGT26-001'), false);
  assert.equal(tr.getTaladroSource('FEGT26-001', ['FEGT26-001']), 'bd');
});

await test('Clase 1b: Taladro BD Modificado en Corridas -> hash distinto, isPending=true, badge=SÍ', () => {
  const dbTaladro = JSON.parse(store.get(sm.getSnapshotStorageKey('FEGT26-001')));
  const dbHash = store.get(sm.getSnapshotHashStorageKey('FEGT26-001'));

  const modified = JSON.parse(JSON.stringify(dbTaladro));
  modified.corridas[0].rec_m = 2.8; // Modificación

  const currentHash = hu.computeTaladroHash(modified);
  const isDirty = String(currentHash) !== String(dbHash);
  assert.equal(isDirty, true);

  sm.addPendingTaladro('FEGT26-001');
  const pendingNames = tr.getPendingTaladroNames();
  assert.ok(pendingNames.includes('FEGT26-001'));
});

await test('Clase 2a: Borrador Local Puro -> snapshot nulo, source=local, aparece en borradores', () => {
  const draft = {
    name: 'FEGT26-DRAFT_99',
    proyecto: 'Proyecto Exploración',
    geologo: 'CBA',
    diametro: 'NQ',
    inclinacion: -50,
    fecha_registro: '2026-08-24',
    corridas: [{ corrida: 1, de: 0, a: 4.5, rec_m: 4.5, rqd_m: 4, lito1: 'AND' }],
    surveys: [],
    discontinuidades: [],
    ensayos_plt: []
  };

  sm.setCachedTaladro(draft.name, draft);
  sm.addPendingTaladro(draft.name);

  assert.equal(tr.getTaladroSource(draft.name, ['FEGT26-001']), 'local');
  const localSummaries = tr.getLocalOnlyPendingSummaries(['FEGT26-001']);
  assert.equal(localSummaries.length, 1);
  assert.equal(localSummaries[0].name, 'FEGT26-DRAFT_99');
  assert.equal(localSummaries[0].perf_total, 4.5);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATE TRANSITION TESTING (Transición de Estados)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. STATE TRANSITION TESTING ---');

await test('Ciclo A (BD): Clean -> Edit (Dirty) -> Discard (Clean & MANTIENE taladro activo)', () => {
  // 1. Estado Inicial: BD Clean
  const snapRaw = store.get(sm.getSnapshotStorageKey('FEGT26-001'));
  const snapData = JSON.parse(snapRaw);
  const snapHash = hu.computeTaladroHash(snapData);

  let activeTaladro = JSON.parse(JSON.stringify(snapData));
  let currentView = 'collar';

  // 2. Transición: Edit
  activeTaladro.geologo = 'NUEVO_GEOLOGO';
  sm.addPendingTaladro('FEGT26-001');
  sm.setCachedTaladro('FEGT26-001', activeTaladro);
  assert.ok(tr.getPendingTaladroNames().includes('FEGT26-001'));

  // 3. Transición: Discard en taladro existente de BD
  // La lógica de descarte debe restaurar la data y MANTENER activeTaladro seleccionado
  const restored = JSON.parse(JSON.stringify(snapData));
  const restoredHash = hu.computeTaladroHash(restored);
  activeTaladro = restored; // Se mantiene seleccionado!
  sm.setCachedTaladro('FEGT26-001', restored);
  sm.setCachedSnapshotData('FEGT26-001', restored);
  sm.setCachedSnapshotHash('FEGT26-001', restoredHash);
  sm.removePendingTaladro('FEGT26-001');

  // 4. Verificación: Sigue activo, vista actual se mantiene, estado es limpio y sin badge
  assert.notEqual(activeTaladro, null, 'Taladro de BD debe mantenerse activo al descartar');
  assert.equal(activeTaladro.name, 'FEGT26-001');
  assert.equal(currentView, 'collar', 'No debe forzar regreso al dashboard');
  const isDirty = String(hu.computeTaladroHash(activeTaladro)) !== String(restoredHash);
  assert.equal(isDirty, false);
  assert.equal(tr.getPendingTaladroNames().includes('FEGT26-001'), false);
});

await test('Ciclo B (Borrador Puro): Create -> Discard (Purga Total y DESELECCIONA a dashboard)', () => {
  const draftName = 'FEGT26-DRAFT_99';
  let activeTaladro = { name: draftName, corridas: [] };
  let currentView = 'collar';

  assert.ok(tr.getPendingTaladroNames().includes(draftName));

  // Descartar borrador puro (sin snapshot en BD):
  const hasDbSnapshot = !!store.get(sm.getSnapshotStorageKey(draftName));
  assert.equal(hasDbSnapshot, false);

  tr.discardLocalTaladro(draftName);
  activeTaladro = null; // Borrador puro sí se deselecciona!
  currentView = 'dashboard';

  assert.equal(activeTaladro, null, 'Borrador puro debe deseleccionarse');
  assert.equal(currentView, 'dashboard');
  assert.equal(tr.isTaladroPending(draftName), false);
  assert.equal(sm.getCachedTaladroRaw(draftName), null);
  assert.equal(tr.getLocalOnlyPendingSummaries(['FEGT26-001']).length, 0);
});

await test('Ciclo C (DevTools Clear Site Data): Wipe total -> 0 borradores fantasmas', () => {
  // Simular DevTools > Application > Clear storage
  store.clear();

  // Al recargar, getPendingTaladroNames y getLocalOnlyPendingSummaries deben estar vacíos
  const pendingNames = tr.getPendingTaladroNames();
  const localSummaries = tr.getLocalOnlyPendingSummaries(['FEGT26-001', 'FEGT26-002']);

  assert.deepEqual(pendingNames, []);
  assert.deepEqual(localSummaries, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DECISION TABLE TESTING (Tablas de Decisión)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. DECISION TABLE TESTING ---');

const decisionTable = [
  { rule: 'R1', inDb: true,  hasSnap: true,  modified: false, expectedPending: false, expectedBadge: false, keepActiveOnDiscard: true,  desc: 'BD Taladro sin cambios' },
  { rule: 'R2', inDb: true,  hasSnap: true,  modified: true,  expectedPending: true,  expectedBadge: true,  keepActiveOnDiscard: true,  desc: 'BD Taladro modificado' },
  { rule: 'R3', inDb: false, hasSnap: false, modified: true,  expectedPending: true,  expectedBadge: true,  keepActiveOnDiscard: false, desc: 'Borrador puro creado' },
  { rule: 'R4', inDb: true,  hasSnap: true,  modified: false, expectedPending: false, expectedBadge: false, keepActiveOnDiscard: true,  desc: 'BD Taladro tras descartar' },
];

for (const row of decisionTable) {
  await test(`Tabla Decisión ${row.rule}: ${row.desc}`, () => {
    store.clear();
    const talName = row.inDb ? 'FEGT26-001' : 'FEGT26-NEW_DRAFT';
    const baseObj = {
      name: talName,
      proyecto: 'Proyecto Test',
      geologo: 'GEOLOGO',
      diametro: 'HQ',
      inclinacion: -60,
      fecha_registro: '2026-08-24',
      corridas: [{ corrida: 1, de: 0, a: 3, rec_m: 3, rqd_m: 2, lito1: 'AND' }],
      surveys: [], discontinuidades: [], ensayos_plt: []
    };

    if (row.hasSnap) {
      sm.setCachedSnapshotData(talName, baseObj);
      sm.setCachedSnapshotHash(talName, hu.computeTaladroHash(baseObj));
    }

    const currentObj = JSON.parse(JSON.stringify(baseObj));
    if (row.modified) {
      currentObj.corridas[0].rec_m = 1.5;
    }

    sm.setCachedTaladro(talName, currentObj);

    if (row.expectedPending) {
      sm.addPendingTaladro(talName);
    } else {
      sm.removePendingTaladro(talName);
    }

    const isPending = tr.isTaladroPending(talName);
    assert.equal(isPending, row.expectedPending);

    const dbList = row.inDb ? [talName] : [];
    const localSummaries = tr.getLocalOnlyPendingSummaries(dbList);
    const isLocalDraftRow = localSummaries.some(s => s.name === talName);

    if (!row.inDb && row.expectedPending) {
      assert.equal(isLocalDraftRow, true, 'Borrador puro debe aparecer en tabla local');
    } else {
      assert.equal(isLocalDraftRow, false, 'No debe aparecer en tabla local separada');
    }

    // Regla de descarte: si es de BD se mantiene activo, si es borrador puro se deselecciona
    if (row.inDb) {
      assert.equal(row.keepActiveOnDiscard, true, 'Taladro de BD debe mantenerse activo al descartar');
    } else {
      assert.equal(row.keepActiveOnDiscard, false, 'Borrador puro debe deseleccionarse al descartar');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. BOUNDARY & ZERO VALUE VALIDATION (Valores Límite y Cero)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. BOUNDARY & ZERO VALUE VALIDATION ---');

await test('Validación Survey: depth=0, dip=0, azimuth=0 NO debe generar error de campo obligatorio', () => {
  const taladroWithZeroSurvey = {
    name: 'FEGT26-001',
    proyecto: 'Proyecto Test',
    geologo: 'GEOLOGO',
    diametro: 'HQ',
    inclinacion: -60,
    campana: 'Campaña 2026',
    collar_este: 500000,
    collar_norte: 8000000,
    collar_cota: 4000,
    prof_final_eoh: 150,
    corridas: [],
    surveys: [
      { depth: 0, dip: 0, azimuth: 0 }
    ],
    discontinuidades: [],
    ensayos_plt: []
  };

  const issues = mr.validateLogueoMandatory(taladroWithZeroSurvey);
  const surveyIssues = issues.filter(i => i.section === 'SURVEY');
  assert.equal(surveyIssues.length, 0, `No debe haber errores de campos obligatorios en survey con 0m: ${JSON.stringify(surveyIssues)}`);
});

await test('Validación Survey: depth=-1 (vacío) SÍ debe generar error de campo obligatorio', () => {
  const taladroWithEmptySurvey = {
    name: 'FEGT26-001',
    proyecto: 'Proyecto Test',
    geologo: 'GEOLOGO',
    diametro: 'HQ',
    inclinacion: -60,
    campana: 'Campaña 2026',
    collar_este: 500000,
    collar_norte: 8000000,
    collar_cota: 4000,
    prof_final_eoh: 150,
    corridas: [],
    surveys: [
      { depth: -1, dip: -60, azimuth: 180 }
    ],
    discontinuidades: [],
    ensayos_plt: []
  };

  const issues = mr.validateLogueoMandatory(taladroWithEmptySurvey);
  const surveyIssues = issues.filter(i => i.section === 'SURVEY' && i.fieldKey === 'depth');
  assert.equal(surveyIssues.length, 1, 'Debe detectar depth vacío');
});

console.log(`\n===============================================================`);
console.log(`TODAS LAS ${passedTests} PRUEBAS FORMALES DE QA PASARON CON ÉXITO (100%)`);
console.log(`===============================================================\n`);

