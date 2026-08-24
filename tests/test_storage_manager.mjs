/**
 * test_storage_manager.mjs — Test unitario de storageManager en Logueo.
 */
let quotaFail = false;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (quotaFail) {
      throw new Error('QuotaExceededError');
    }
    store.set(k, String(v));
  },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const sm = await import('../frontend/src/utils/storageManager.ts');

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
};

console.log('\n=============================================');
console.log('🧪 TEST: storageManager (Logueo)');
console.log('=============================================\n');

// Test 1: Lista de pendientes idempotente
console.log('1. Lista de pendientes (geolog_unsaved_taladros):');
sm.addPendingTaladro('FEGT26-001');
sm.addPendingTaladro('fegt26-001'); // case-insensitive idempotente
sm.addPendingTaladro('FEGT26-002');
let unsaved = sm.getUnsavedTaladros();
ok(unsaved.length === 2, `Total de 2 pendientes: ${JSON.stringify(unsaved)}`);
ok(unsaved.includes('FEGT26-001'), 'Incluye FEGT26-001');
ok(unsaved.includes('FEGT26-002'), 'Incluye FEGT26-002');

sm.removePendingTaladro('FEGT26-001');
unsaved = sm.getUnsavedTaladros();
ok(unsaved.length === 1 && unsaved[0] === 'FEGT26-002', 'Remover pendiente funciona');

// Test 2: Caché y evicción
console.log('\n2. Caché y evicción:');
sm.safeSetItem('geolog_taladro_FEGT26-002', JSON.stringify({ name: 'FEGT26-002' }));
sm.safeSetItem('geolog_snapshot_data_FEGT26-002', JSON.stringify({ name: 'FEGT26-002' }));
sm.safeSetItem('geolog_snapshot_hash_FEGT26-002', '12345');

sm.safeSetItem('geolog_taladro_SYNCED-001', JSON.stringify({ name: 'SYNCED-001' }));
sm.safeSetItem('geolog_snapshot_data_SYNCED-001', JSON.stringify({ name: 'SYNCED-001' }));
sm.safeSetItem('geolog_snapshot_hash_SYNCED-001', '67890');

let cached = sm.getCachedTaladros();
ok(cached.includes('FEGT26-002') && cached.includes('SYNCED-001'), `Taladros cacheados: ${JSON.stringify(cached)}`);

// Protección: FEGT26-002 está en unsaved, SYNCED-001 no
ok(sm.isTaladroProtegido('FEGT26-002'), 'FEGT26-002 protegido porque está en pendientes');
ok(!sm.isTaladroProtegido('SYNCED-001'), 'SYNCED-001 NO protegido');
ok(sm.isTaladroProtegido('ACTIVE-001', { activeTaladro: 'ACTIVE-001' }), 'Taladro activo protegido por contexto');

// Evicción de sincronizados
const evictedCount = sm.evictSincronizados();
ok(evictedCount === 1, `Se evictó 1 taladro sincronizado`);
cached = sm.getCachedTaladros();
ok(!cached.includes('SYNCED-001'), 'SYNCED-001 fue eliminado del caché');
ok(cached.includes('FEGT26-002'), 'FEGT26-002 (pendiente) sigue en el caché');
ok(store.get('geolog_snapshot_data_SYNCED-001') === undefined, 'Snapshot data de SYNCED-001 fue limpiado');
ok(store.get('geolog_snapshot_hash_SYNCED-001') === undefined, 'Snapshot hash de SYNCED-001 fue limpiado');

// Test 3: safeSetItem con liberación ante fallo de cuota
console.log('\n3. safeSetItem con QuotaExceeded:');
// Guardamos otro sincronizado
sm.safeSetItem('geolog_taladro_SYNCED-002', JSON.stringify({ name: 'SYNCED-002' }));
// Hacemos que setItem falle la primera vez
quotaFail = true;
// Si falla pero hay taladros sincronizados para liberar, evictSincronizados los borra y el reintento funciona si simulamos que se liberó espacio
let customFailCount = 1;
globalThis.localStorage.setItem = (k, v) => {
  if (customFailCount > 0) {
    customFailCount--;
    throw new Error('QuotaExceededError');
  }
  store.set(k, String(v));
};
const resSafe = sm.safeSetItem('geolog_taladro_NEW-001', JSON.stringify({ name: 'NEW-001' }), { activeTaladro: 'NEW-001' });
ok(resSafe.ok === true, 'safeSetItem liberó espacio y guardó exitosamente');

// Test 4: Índice de validación
console.log('\n4. Índice de validación:');
sm.setTaladroValidation('FEGT26-002', { ok: false, count: 2, issues: ['Falta lito1', 'RQD inválido'] });
let valMap = sm.getTaladroValidationMap();
ok(valMap['FEGT26-002'] && valMap['FEGT26-002'].count === 2, 'setTaladroValidation persistió correctamente');
sm.clearTaladroValidation('FEGT26-002');
valMap = sm.getTaladroValidationMap();
ok(valMap['FEGT26-002'] === undefined, 'clearTaladroValidation limpió el registro');

console.log(`\n=============================================`);
console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
console.log(`=============================================\n`);

if (failed > 0) {
  process.exit(1);
}
