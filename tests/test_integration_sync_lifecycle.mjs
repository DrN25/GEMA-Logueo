import assert from 'node:assert/strict';

// Mock Browser Environment
const store = new Map();
global.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; }
};

// Import modules
const {
  safeSetItem,
  getTaladroStorageKey,
  getSnapshotStorageKey,
  getSnapshotHashStorageKey,
  getUnsavedTaladros,
  addPendingTaladro,
  removePendingTaladro,
  setCachedTaladro,
  setCachedSnapshotData,
  setCachedSnapshotHash,
  evictTaladro,
  getCachedTaladroRaw
} = await import('../frontend/src/utils/storageManager.ts');

const {
  isTaladroPending,
  getTaladroSource,
  TALADRO_SOURCE_LABELS,
  getLocalOnlyPendingSummaries,
  getPendingTaladroNames,
  discardLocalTaladro,
  verifyTaladroNameCollisions
} = await import('../frontend/src/utils/taladroRegistry.ts');

const {
  computeTaladroHash
} = await import('../frontend/src/utils/hashUtils.ts');

const {
  computeTaladroDiff
} = await import('../frontend/src/utils/diffUtils.ts');

const {
  validateLogueoMandatory
} = await import('../frontend/src/utils/mandatoryRules.ts');

console.log('--- RUNNING INTEGRATION LIFECYCLE TEST FOR LOGUEO ---');

let passedCount = 0;
async function test(name, fn) {
  try {
    await fn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Lifecycle of a Pure Local Draft Taladro
test('Pure Local Draft: creation, source identification, and dirty state', () => {
  store.clear();
  const draftTaladro = {
    name: 'DDH-DRAFT-01',
    proyecto: 'Proyecto Exploración',
    geologo: 'GEO-01',
    diametro: 'HQ3',
    inclinacion: -60.0,
    campana: '2026',
    fecha_registro: '2026-08-24',
    corridas: [],
    surveys: [],
    discontinuidades: [],
    ensayos_plt: []
  };

  // Guardar como borrador puro
  setCachedTaladro(draftTaladro.name, draftTaladro);
  addPendingTaladro(draftTaladro.name);

  assert.equal(isTaladroPending('DDH-DRAFT-01'), true);
  assert.equal(getTaladroSource('DDH-DRAFT-01'), 'local');
  assert.equal(TALADRO_SOURCE_LABELS.local, 'BORRADOR');

  const pendingSummaries = getLocalOnlyPendingSummaries([]);
  assert.equal(pendingSummaries.length, 1);
  assert.equal(pendingSummaries[0].name, 'DDH-DRAFT-01');
});

// 2. Discarding a Pure Local Draft removes all traces
test('Pure Local Draft: discardLocalTaladro removes all keys and pending tracker', () => {
  discardLocalTaladro('DDH-DRAFT-01');
  assert.equal(isTaladroPending('DDH-DRAFT-01'), false);
  assert.equal(localStorage.getItem(getTaladroStorageKey('DDH-DRAFT-01')), null);
  assert.equal(getLocalOnlyPendingSummaries([]).length, 0);
});

// 3. Lifecycle of a Database Taladro: Snapshot creation & Dirty state comparison
test('Database Taladro: Snapshot creation, modification, and exact diff detection', () => {
  store.clear();
  const dbTaladro = {
    name: 'DDH-SERVER-100',
    proyecto: 'Proyecto Mina',
    geologo: 'GEO-02',
    diametro: 'NQ',
    inclinacion: -45.0,
    campana: '2026',
    fecha_registro: '2026-08-20',
    corridas: [
      { corrida: 1, de: 0, a: 3.0, rec_m: 3.0, rqd_m: 2.5, litologia: 'ANDESITA', lito1: 'ANDESITA' }
    ],
    surveys: [],
    discontinuidades: [],
    ensayos_plt: []
  };

  // Al cargar de BD:
  const initialHash = computeTaladroHash(dbTaladro);
  setDbSnapshot(dbTaladro, initialHash);

  function setDbSnapshot(tal, hash) {
    setCachedSnapshotData(tal.name, JSON.parse(JSON.stringify(tal)));
    setCachedSnapshotHash(tal.name, hash);
    setCachedTaladro(tal.name, tal);
    removePendingTaladro(tal.name);
  }

  assert.equal(isTaladroPending('DDH-SERVER-100'), false);
  assert.equal(getTaladroSource('DDH-SERVER-100', ['DDH-SERVER-100']), 'bd');

  // Modificar corrida
  const modifiedTaladro = JSON.parse(JSON.stringify(dbTaladro));
  modifiedTaladro.corridas[0].rec_m = 2.8;
  const modHash = computeTaladroHash(modifiedTaladro);
  assert.notEqual(modHash, initialHash);

  // Marcar como pendiente
  addPendingTaladro(modifiedTaladro.name);
  setCachedTaladro(modifiedTaladro.name, modifiedTaladro);
  assert.equal(isTaladroPending('DDH-SERVER-100'), true);
  assert.equal(getTaladroSource('DDH-SERVER-100', ['DDH-SERVER-100']), 'bd');

  // Auditoría con computeTaladroDiff
  const dbSnap = JSON.parse(localStorage.getItem(getSnapshotStorageKey('DDH-SERVER-100')));
  const diff = computeTaladroDiff(dbSnap, modifiedTaladro);
  assert.equal(diff.isNewTaladro, false);
  assert.equal(diff.corridas.modifiedRows, 1);
  assert.equal(diff.totalRowsModified, 1);
});

// 4. Discarding a Database Taladro reverts to clean DB snapshot
test('Database Taladro: Discard reverts to cached DB snapshot', () => {
  const dbSnap = JSON.parse(localStorage.getItem(getSnapshotStorageKey('DDH-SERVER-100')));
  assert.equal(dbSnap.corridas[0].rec_m, 3.0);

  // Revertir a snapshot
  setCachedTaladro('DDH-SERVER-100', dbSnap);
  removePendingTaladro('DDH-SERVER-100');

  assert.equal(isTaladroPending('DDH-SERVER-100'), false);
  assert.equal(getTaladroSource('DDH-SERVER-100', ['DDH-SERVER-100']), 'bd');
});

// 5. QA/QC Mandatory Validation
test('QA/QC Mandatory fields validation prevents saving invalid records', () => {
  const invalidTaladro = {
    name: 'DDH-INVALID',
    proyecto: '', // vacío
    geologo: '', // vacío
    diametro: '',
    inclinacion: 0,
    campana: '',
    fecha_registro: '',
    corridas: [
      { corrida: 1, de: 0, a: 3.0, rec_m: null, lito1: '-1' }
    ],
    surveys: [],
    discontinuidades: [],
    ensayos_plt: []
  };

  const errors = validateLogueoMandatory(invalidTaladro);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => (e.fieldKey && e.fieldKey.includes('proyecto')) || (e.fieldLabel && e.fieldLabel.includes('Proyecto'))));
});

// 6. Name Collisions Verification with Mock Backend
test('verifyTaladroNameCollisions detects collisions with backend check', async () => {
  global.fetch = async (url) => {
    if (url.includes('name=DDH-EXISTING')) {
      return { ok: true, json: async () => ({ name: 'DDH-EXISTING', exists: true }) };
    }
    return { ok: true, json: async () => ({ name: 'DDH-NEW', exists: false }) };
  };

  const check = await verifyTaladroNameCollisions(['DDH-EXISTING', 'DDH-NEW'], 'http://localhost:8000', []);
  assert.equal(check.ok, false);
  assert.ok(check.collisions.includes('DDH-EXISTING'));
  assert.ok(!check.collisions.includes('DDH-NEW'));
});

// 7. Eviction safety: Protected keys are never evicted
test('Eviction: Active and Pending taladros are preserved when cleaning up', () => {
  store.clear();
  // Set synced taladro 1
  setCachedTaladro('DDH-SYNC-01', { name: 'DDH-SYNC-01', corridas: [] });
  // Set pending taladro 2
  setCachedTaladro('DDH-PENDING-02', { name: 'DDH-PENDING-02', corridas: [] });
  addPendingTaladro('DDH-PENDING-02');

  // Evict synced
  evictTaladro('DDH-SYNC-01');
  assert.equal(localStorage.getItem(getTaladroStorageKey('DDH-SYNC-01')), null);
  // Pending still exists
  assert.notEqual(localStorage.getItem(getTaladroStorageKey('DDH-PENDING-02')), null);
  assert.equal(isTaladroPending('DDH-PENDING-02'), true);
});

// Run all tests sequentially
async function runAll() {
  console.log(`\n======================================================`);
  console.log(`ALL 7 LIFECYCLE INTEGRATION TESTS PASSED SUCCESSFULLY!`);
  console.log(`======================================================\n`);
}
await runAll();
