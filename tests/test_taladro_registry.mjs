/**
 * test_taladro_registry.mjs — Test unitario de taladroRegistry en Logueo.
 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const tr = await import('../frontend/src/utils/taladroRegistry.ts');
const sm = await import('../frontend/src/utils/storageManager.ts');

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
};

console.log('\n=============================================');
console.log('🧪 TEST: taladroRegistry (Logueo)');
console.log('=============================================\n');

const TALADRO_BD = 'FEGT26-001';        // Existe en BD
const TALADRO_LOCAL = 'FEGT26-LOCAL_X';  // Creado localmente (borrador puro)

// 1. Preparar datos
sm.addPendingTaladro(TALADRO_BD);
sm.safeSetItem(`geolog_taladro_${TALADRO_BD}`, JSON.stringify({
  name: TALADRO_BD,
  fecha_registro: '2026-08-24',
  proyecto: 'Proyecto A',
  geologo: 'RD/RB',
  corridas: [{ de: 0, a: 3 }, { de: 3, a: 6 }]
}), { activeTaladro: TALADRO_BD });

sm.addPendingTaladro(TALADRO_LOCAL);
sm.safeSetItem(`geolog_taladro_${TALADRO_LOCAL}`, JSON.stringify({
  name: TALADRO_LOCAL,
  fecha_registro: '2026-08-24',
  proyecto: 'Proyecto B',
  geologo: 'AN/CB',
  corridas: [{ de: 0, a: 5 }]
}), { activeTaladro: TALADRO_LOCAL });

// Test 1: getPendingTaladroNames
console.log('1. Nombres pendientes:');
const pendingNames = tr.getPendingTaladroNames();
ok(pendingNames.includes(TALADRO_BD), `Incluye ${TALADRO_BD} (para badge BORRADOR en su fila)`);
ok(pendingNames.includes(TALADRO_LOCAL), `Incluye ${TALADRO_LOCAL}`);

// Test 2: getLocalOnlyPendingSummaries
console.log('\n2. Borradores puros (no duplicados en BD):');
const dbNames = [TALADRO_BD];
const localOnly = tr.getLocalOnlyPendingSummaries(dbNames);
ok(!localOnly.some(t => t.name === TALADRO_BD), `${TALADRO_BD} NO aparece como fila separada porque ya existe en BD`);
ok(localOnly.some(t => t.name === TALADRO_LOCAL), `${TALADRO_LOCAL} SÍ aparece como fila separada`);
const localSummary = localOnly.find(t => t.name === TALADRO_LOCAL);
ok(localSummary && localSummary.perf_total === 5, `Metraje calculado correctamente (${localSummary?.perf_total}m)`);

// Test 3: getTaladroSource y labels
console.log('\n3. Fuentes de taladros y labels:');
ok(tr.getTaladroSource(TALADRO_BD, dbNames) === 'bd', `${TALADRO_BD} tiene fuente 'bd'`);
ok(tr.getTaladroSource(TALADRO_LOCAL, dbNames) === 'local', `${TALADRO_LOCAL} tiene fuente 'local'`);
ok(tr.TALADRO_SOURCE_LABELS.local === 'BORRADOR', 'Label local es BORRADOR');

// Test 4: discardLocalTaladro
console.log('\n4. Descartar borrador puro:');
tr.discardLocalTaladro(TALADRO_LOCAL);
ok(!tr.isTaladroPending(TALADRO_LOCAL), `${TALADRO_LOCAL} ya no está pendiente`);
ok(sm.getCachedTaladroRaw(TALADRO_LOCAL) === null, `Caché de ${TALADRO_LOCAL} fue eliminado`);

// Test 5: Validaciones pendientes
console.log('\n5. Validaciones de taladros pendientes:');
tr.setTaladroValidation(TALADRO_BD, ['Error en corrida 1', 'Falta litología']);
let invalidList = tr.getInvalidPendingTaladros();
ok(invalidList.length === 1 && invalidList[0].taladro === TALADRO_BD, 'Detecta taladro pendiente inválido');
ok(invalidList[0].count === 2, 'Detecta 2 problemas de validación');

tr.setTaladroValidation(TALADRO_BD, []); // Corregido
invalidList = tr.getInvalidPendingTaladros();
ok(invalidList.length === 0, 'Al corregir problemas ya no es inválido');

console.log(`\n=============================================`);
console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
console.log(`=============================================\n`);

if (failed > 0) {
  process.exit(1);
}
