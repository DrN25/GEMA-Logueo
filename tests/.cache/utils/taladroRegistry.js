"use strict";
/**
 * taladroRegistry.ts — Catálogo unificado de taladros/sondajes del sistema (Logueo).
 *
 * Es el ÚNICO punto de consulta para saber qué taladros existen y en qué estado:
 *   - 'bd'    : existe en la base de datos (listado del dashboard)
 *   - 'local' : borrador local pendiente de guardar (BORRADOR)
 *   - 'excel' : reservado para importaciones masivas
 *
 * Regla de capas: este módulo es la capa de DOMINIO; solo accede a localStorage
 * a través de storageManager (nunca directo).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TALADRO_SOURCE_LABELS = void 0;
exports.isTaladroPending = isTaladroPending;
exports.getTaladroSource = getTaladroSource;
exports.getAllKnownTaladros = getAllKnownTaladros;
exports.getAllKnownTaladroNames = getAllKnownTaladroNames;
exports.getPendingTaladroNames = getPendingTaladroNames;
exports.getLocalOnlyPendingSummaries = getLocalOnlyPendingSummaries;
exports.getPendingTaladroSummaries = getPendingTaladroSummaries;
exports.discardLocalTaladro = discardLocalTaladro;
exports.setTaladroValidation = setTaladroValidation;
exports.getTaladroValidation = getTaladroValidation;
exports.hasTaladroValidation = hasTaladroValidation;
exports.getInvalidPendingTaladros = getInvalidPendingTaladros;
exports.getLocalOnlyPendingTaladros = getLocalOnlyPendingTaladros;
exports.clearTaladroValidation = clearTaladroValidation;
exports.verifyTaladroNameCollisions = verifyTaladroNameCollisions;
exports.getCachedTaladroNames = getCachedTaladroNames;
const storageManager_ts_1 = require("./storageManager.ts");
/** Etiquetas de UI por estado. La UI solo las renderiza, nunca las decide. */
exports.TALADRO_SOURCE_LABELS = {
    bd: null,
    local: 'BORRADOR',
    excel: 'IMPORTADO',
};
// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
/** ¿El taladro tiene cambios locales pendientes de guardar? */
function isTaladroPending(name) {
    const up = name.trim().toUpperCase();
    return (0, storageManager_ts_1.getUnsavedTaladros)().some(n => n.trim().toUpperCase() === up);
}
/** Estado de un taladro ('bd' si existe en el listado, 'local' si es borrador). */
function getTaladroSource(name, knownFromDb) {
    const up = name.trim().toUpperCase();
    if ((knownFromDb || []).some(n => n.trim().toUpperCase() === up))
        return 'bd';
    if (isTaladroPending(name))
        return 'local';
    return 'bd';
}
/** Catálogo unificado: taladros de BD (listado actual) + borradores locales. */
function getAllKnownTaladros(knownFromDb) {
    const map = new Map();
    for (const n of knownFromDb || []) {
        const up = n.trim().toUpperCase();
        if (up)
            map.set(up, 'bd');
    }
    for (const n of (0, storageManager_ts_1.getUnsavedTaladros)()) {
        const up = n.trim().toUpperCase();
        if (up && !map.has(up))
            map.set(up, 'local');
    }
    return [...map.entries()].map(([name, source]) => ({ name, source }));
}
/** Solo los nombres (para validación de duplicados o modales). */
function getAllKnownTaladroNames(knownFromDb) {
    return getAllKnownTaladros(knownFromDb).map(c => c.name);
}
/** Nombres de TODOS los taladros pendientes para marcar sus filas en el Dashboard. */
function getPendingTaladroNames() {
    return (0, storageManager_ts_1.getUnsavedTaladros)();
}
/**
 * Resúmenes de los borradores locales que NO existen en BD.
 * Los taladros pendientes que YA existen en la base (modificaciones a existentes)
 * se muestran sobre su fila normal, NO como una fila BORRADOR aparte.
 */
function getLocalOnlyPendingSummaries(knownFromDb) {
    const dbSet = new Set((knownFromDb || []).map(n => n.trim().toUpperCase()));
    return getPendingTaladroSummaries().filter(pt => !dbSet.has(pt.name.trim().toUpperCase()));
}
/** Resúmenes de los borradores locales para el Dashboard. */
function getPendingTaladroSummaries() {
    const summaries = [];
    for (const name of (0, storageManager_ts_1.getUnsavedTaladros)()) {
        try {
            const raw = (0, storageManager_ts_1.getCachedTaladroRaw)(name);
            if (!raw)
                continue;
            const data = JSON.parse(raw);
            if (!data?.name)
                continue;
            const corridas = Array.isArray(data.corridas) ? data.corridas : [];
            const surveys = Array.isArray(data.surveys) ? data.surveys : [];
            let perf_total = 0;
            if (corridas.length > 0) {
                perf_total = corridas.reduce((acc, c) => {
                    const de = parseFloat(c.de) || 0;
                    const a = parseFloat(c.a) || 0;
                    return acc + Math.max(0, a - de);
                }, 0);
            }
            summaries.push({
                name: data.name,
                proyecto: data.proyecto || 'Proyecto A',
                geologo: data.geologo || 'RD/RB',
                diametro: data.diametro || 'HQ3',
                inclinacion: typeof data.inclinacion === 'number' ? data.inclinacion : -60.0,
                fecha_registro: data.fecha_registro || '',
                corridas_count: corridas.length,
                surveys_count: surveys.length,
                perf_total: Math.round(perf_total * 100) / 100
            });
        }
        catch {
            continue; // caché corrupto: no bloquear el dashboard
        }
    }
    return summaries;
}
// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------
/**
 * Descarta un borrador local por completo: lo quita de la lista de pendientes,
 * elimina su caché (taladro, snapshot_data y snapshot_hash) y su registro de validación.
 * No toca la BD.
 */
function discardLocalTaladro(name) {
    (0, storageManager_ts_1.removePendingTaladro)(name);
    (0, storageManager_ts_1.evictTaladro)(name);
    (0, storageManager_ts_1.clearTaladroValidation)(name);
}
/** Persiste el resultado de validación de un taladro. */
function setTaladroValidation(taladro, issueMessages) {
    const clean = issueMessages.filter(Boolean);
    (0, storageManager_ts_1.setTaladroValidation)(taladro, {
        ok: clean.length === 0,
        count: clean.length,
        issues: clean,
    });
}
/** Registro de validación de un taladro (o null si nunca se evaluó). */
function getTaladroValidation(taladro) {
    const map = (0, storageManager_ts_1.getTaladroValidationMap)();
    return map[taladro.trim().toUpperCase()] ?? null;
}
/** ¿El taladro tiene un registro de validación persistido? */
function hasTaladroValidation(taladro) {
    return getTaladroValidation(taladro) !== null;
}
/** Taladros pendientes cuyo estado persistido es INVÁLIDO (bloquean el guardado). */
function getInvalidPendingTaladros() {
    const pending = new Set((0, storageManager_ts_1.getUnsavedTaladros)().map(n => n.trim().toUpperCase()));
    const map = (0, storageManager_ts_1.getTaladroValidationMap)();
    const result = [];
    for (const [taladro, record] of Object.entries(map)) {
        if (!record.ok && pending.has(taladro.trim().toUpperCase())) {
            result.push({ taladro, ok: false, count: record.count, issues: record.issues });
        }
    }
    return result;
}
/** Taladros pendientes que solo existen localmente (sin snapshot en BD). */
function getLocalOnlyPendingTaladros() {
    return (0, storageManager_ts_1.getUnsavedTaladros)().filter(taladro => !localStorage.getItem(`geolog_snapshot_data_${taladro}`));
}
/** Limpia el registro de validación de un taladro (al guardar exitosamente). */
function clearTaladroValidation(taladro) {
    (0, storageManager_ts_1.clearTaladroValidation)(taladro);
}
/**
 * Verifica que los nombres de taladros NUEVOS (sin snapshot) no hayan sido
 * creados en BD por otra persona después de crear el borrador local.
 * Utiliza el endpoint /api/taladros/existe?name=... del backend.
 */
async function verifyTaladroNameCollisions(names, apiBase, knownFromDb = []) {
    const dbSet = new Set((knownFromDb || []).map(n => n.trim().toUpperCase()));
    const unique = [...new Set(names.map(n => n.trim().toUpperCase()).filter(Boolean))];
    const collisions = [];
    const results = await Promise.all(unique.map(async (name) => {
        if (dbSet.has(name))
            return { name, collision: true };
        try {
            const res = await fetch(`${apiBase}/api/taladros/existe?name=${encodeURIComponent(name)}`);
            if (!res.ok)
                return { name, collision: true };
            const data = await res.json();
            return { name, collision: Boolean(data?.exists) };
        }
        catch {
            return { name, collision: true };
        }
    }));
    for (const r of results) {
        if (r.collision)
            collisions.push(r.name);
    }
    return { ok: collisions.length === 0, collisions };
}
/** Taladros cuyo caché existe en localStorage. */
function getCachedTaladroNames() {
    return (0, storageManager_ts_1.getCachedTaladros)();
}
