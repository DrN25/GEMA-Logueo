/**
 * storageManager.ts — Administración central del localStorage de taladros (Logueo).
 *
 * Responsabilidades:
 *  - Evicción de taladros sincronizados (barrido total):
 *    al cambiar de taladro o superar límites, todo caché que no esté protegido se elimina.
 *  - Límite duro de taladros cacheados (MAX_CACHED_TALADROS).
 *  - Escritura segura (safeSetItem): ante QuotaExceededError libera espacio
 *    y reintenta; si no hay nada que liberar, devuelve un código de error.
 *  - Estimación de espacio para importaciones (canImport).
 *
 * Regla de oro: NUNCA se borra un taladro protegido
 *   (activo, pendiente en geolog_unsaved_taladros o recién importado).
 */

import { STORAGE_CONFIG } from '../config/storage.ts';

export type StorageErrorCode = 'QUOTA_FULL' | 'IMPORT_LIMITED' | 'TOO_MANY_PENDING';

export interface StorageResult {
  ok: boolean;
  code?: StorageErrorCode;
  maxTaladros?: number;
  usedChars?: number;
  availableChars?: number;
}

export interface EvictionContext {
  /** Nombre del taladro activo (nunca se evicta). */
  activeTaladro?: string | null;
  /** Nombres recién importados (nunca se evictan hasta su guardado). */
  pendingImports?: string[];
}

// ---------------------------------------------------------------------------
// Claves por taladro
// ---------------------------------------------------------------------------

export const KEY_TALADRO = (name: string) => `geolog_taladro_${name}`;
export const KEY_SNAPSHOT = (name: string) => `geolog_snapshot_data_${name}`;
export const KEY_HASH = (name: string) => `geolog_snapshot_hash_${name}`;
export const KEY_UNSAVED = 'geolog_unsaved_taladros';

export const getTaladroStorageKey = KEY_TALADRO;
export const getSnapshotStorageKey = KEY_SNAPSHOT;
export const getSnapshotHashStorageKey = KEY_HASH;
export const getUnsavedStorageKey = () => KEY_UNSAVED;

/** Claves globales que empiezan con el prefijo geolog_ pero no son taladros individuales. */
const GLOBAL_KEYS = new Set([
  'geolog_active_view',
  'geolog_active_taladro_name',
  'geolog_dashboard_page',
  'geolog_dashboard_pagesize',
  'geolog_dashboard_date_range',
  'geolog_dashboard_search_term',
  'geolog_dashboard_is_global',
  'geolog_taladros_summaries',
  'geolog_unsaved_taladros',
  'geolog_taladro_validation'
]);

// ---------------------------------------------------------------------------
// Utilidades de lectura
// ---------------------------------------------------------------------------

/** Extrae el nombre de taladro de una clave `geolog_taladro_*` (o null si no lo es). */
function taladroFromKey(key: string): string | null {
  if (!key.startsWith('geolog_taladro_')) return null;
  if (GLOBAL_KEYS.has(key)) return null;
  if (key.startsWith('geolog_taladros_')) return null; // summaries (plural)
  if (key.startsWith('geolog_snapshot_data_')) return null;
  if (key.startsWith('geolog_snapshot_hash_')) return null;
  const name = key.slice('geolog_taladro_'.length);
  return name || null;
}

/** Nombres de todos los taladros actualmente cacheados en localStorage. */
export function getCachedTaladros(): string[] {
  const taladros: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const name = taladroFromKey(key);
    if (name && !taladros.includes(name)) taladros.push(name);
  }
  return taladros;
}

export function getCachedTaladrosCount(): number {
  return getCachedTaladros().length;
}

/** Espacio usado real en localStorage (chars UTF-16). */
export function getStorageUsage(): { usedChars: number; quotaChars: number; availableChars: number } {
  let usedChars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    usedChars += key.length + (localStorage.getItem(key)?.length ?? 0);
  }
  const quotaChars = STORAGE_CONFIG.QUOTA_CHARS;
  return { usedChars, quotaChars, availableChars: quotaChars - usedChars };
}

function getUnsavedList(): string[] {
  try {
    const raw = localStorage.getItem(KEY_UNSAVED);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lista de taladros pendientes (geolog_unsaved_taladros)
// ---------------------------------------------------------------------------

/** Nombres de todos los taladros con cambios pendientes por sincronizar. */
export function getUnsavedTaladros(): string[] {
  return getUnsavedList();
}

/** Registra un taladro como pendiente (idempotente). */
export function addPendingTaladro(name: string): void {
  const list = getUnsavedList();
  const clean = name.trim().toUpperCase();
  if (!list.some(n => n.trim().toUpperCase() === clean)) {
    try {
      localStorage.setItem(KEY_UNSAVED, JSON.stringify([...list, clean]));
    } catch {
      // ignorar: la lista de pendientes nunca debe romper el flujo principal
    }
  }
}

/** Quita un taladro de la lista de pendientes (idempotente). */
export function removePendingTaladro(name: string): void {
  const list = getUnsavedList();
  const clean = name.trim().toUpperCase();
  if (list.some(n => n.trim().toUpperCase() === clean)) {
    try {
      localStorage.setItem(KEY_UNSAVED, JSON.stringify(list.filter(n => n.trim().toUpperCase() !== clean)));
    } catch {
      // ignorar
    }
  }
}

// ---------------------------------------------------------------------------
// Índice de validación por taladro (geolog_taladro_validation)
// ---------------------------------------------------------------------------

export interface TaladroValidationRecord {
  ok: boolean;
  count: number;
  issues: string[];
}

const KEY_VALIDATION = 'geolog_taladro_validation';

/** Mapa completo de validaciones persistidas por taladro. */
export function getTaladroValidationMap(): Record<string, TaladroValidationRecord> {
  try {
    const raw = localStorage.getItem(KEY_VALIDATION);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persiste el resultado de validación de un taladro (se actualiza en cada evaluación). */
export function setTaladroValidation(name: string, record: TaladroValidationRecord): void {
  try {
    const map = getTaladroValidationMap();
    map[name.trim().toUpperCase()] = record;
    localStorage.setItem(KEY_VALIDATION, JSON.stringify(map));
  } catch {
    // ignorar: el índice nunca debe romper el flujo principal
  }
}

/** Elimina el registro de validación de un taladro (al guardar o descartar). */
export function clearTaladroValidation(name: string): void {
  try {
    const map = getTaladroValidationMap();
    const clean = name.trim().toUpperCase();
    if (clean in map) {
      delete map[clean];
      localStorage.setItem(KEY_VALIDATION, JSON.stringify(map));
    }
  } catch {
    // ignorar
  }
}

/** Elimina el índice completo (limpieza general). */
export function clearAllTaladroValidations(): void {
  try {
    localStorage.removeItem(KEY_VALIDATION);
  } catch {
    // ignorar
  }
}

/** ¿El taladro está protegido de evicción? */
export function isTaladroProtegido(name: string, ctx: EvictionContext = {}): boolean {
  const clean = name.trim().toUpperCase();
  if (ctx.activeTaladro && ctx.activeTaladro.trim().toUpperCase() === clean) return true;
  if (ctx.pendingImports && ctx.pendingImports.some(p => p.trim().toUpperCase() === clean)) return true;
  return getUnsavedList().some(n => n.trim().toUpperCase() === clean);
}

// ---------------------------------------------------------------------------
// Caché de taladros (acceso único a geolog_taladro_*)
// ---------------------------------------------------------------------------

/** Lee el caché crudo de un taladro (geolog_taladro_*) o null. */
export function getCachedTaladroRaw(name: string): string | null {
  try {
    return localStorage.getItem(KEY_TALADRO(name));
  } catch {
    return null;
  }
}

/** ¿Existe caché del taladro? */
export function hasCachedTaladro(name: string): boolean {
  return getCachedTaladroRaw(name) !== null;
}

/** Escribe el caché de un taladro de forma segura (protege el activo). */
export function setCachedTaladroRaw(name: string, value: string): StorageResult {
  return safeSetItem(KEY_TALADRO(name), value, { activeTaladro: name });
}

/** Escribe el objeto de un taladro en caché de forma segura. */
export function setCachedTaladro(name: string, data: any): StorageResult {
  return safeSetItem(KEY_TALADRO(name), JSON.stringify(data), { activeTaladro: name });
}

/** Guarda el snapshot de base de datos para auditoría y dirty tracking. */
export function setCachedSnapshotData(name: string, data: any): StorageResult {
  return safeSetItem(KEY_SNAPSHOT(name), JSON.stringify(data));
}

/** Guarda el hash del snapshot de base de datos. */
export function setCachedSnapshotHash(name: string, hash: string | number): StorageResult {
  return safeSetItem(KEY_HASH(name), String(hash));
}

// ---------------------------------------------------------------------------
// Evicción
// ---------------------------------------------------------------------------

/** Elimina las 3 claves asociadas a un taladro del localStorage. */
export function evictTaladro(name: string): void {
  const keys = [KEY_TALADRO(name), KEY_SNAPSHOT(name), KEY_HASH(name)];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignorar: la evicción nunca debe romper el flujo principal
    }
  }
}

/**
 * Barrido total: elimina el caché de TODOS los taladros no protegidos.
 * Idempotente y sin estado externo: solo lee localStorage + geolog_unsaved_taladros.
 * Devuelve cuántos taladros se evictaron.
 */
export function evictSincronizados(ctx: EvictionContext = {}): number {
  let evicted = 0;
  for (const name of getCachedTaladros()) {
    if (isTaladroProtegido(name, ctx)) continue;
    evictTaladro(name);
    evicted++;
  }
  return evicted;
}

/** Regla: si el número de taladros cacheados supera el tope, evicta sincronizados. */
export function enforceTaladroCacheLimit(ctx: EvictionContext = {}): number {
  if (getCachedTaladrosCount() < STORAGE_CONFIG.MAX_CACHED_TALADROS) return 0;
  return evictSincronizados(ctx);
}

// ---------------------------------------------------------------------------
// Escritura segura
// ---------------------------------------------------------------------------

/**
 * Escritura segura: si localStorage lanza (QuotaExceededError), libera espacio
 * evictando taladros sincronizados y reintenta. Si no se puede liberar nada,
 * devuelve TOO_MANY_PENDING (todo pendiente); si aún así falla, QUOTA_FULL.
 */
export function safeSetItem(key: string, value: string, ctx: EvictionContext = {}): StorageResult {
  if (taladroFromKey(key)) {
    enforceTaladroCacheLimit(ctx);
  }

  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch {
    const freed = evictSincronizados(ctx);
    if (freed === 0) {
      return { ok: false, code: 'TOO_MANY_PENDING' };
    }
    try {
      localStorage.setItem(key, value);
      return { ok: true };
    } catch {
      return { ok: false, code: 'QUOTA_FULL' };
    }
  }
}

// ---------------------------------------------------------------------------
// Estimación de espacio para importaciones (middleware)
// ---------------------------------------------------------------------------

/**
 * ¿Caben `count` taladros nuevos en localStorage?
 * Usa el espacio usado real + una estimación por taladro (configurable).
 */
export function canImport(count: number, perTaladroChars?: number): StorageResult {
  const perTaladro = perTaladroChars ?? STORAGE_CONFIG.ESTIMATE_PER_TALADRO_CHARS;
  const { usedChars, quotaChars } = getStorageUsage();
  const availableChars = Math.floor(quotaChars * STORAGE_CONFIG.SAFETY_RATIO) - usedChars;

  if (availableChars <= 0) {
    return { ok: false, code: 'QUOTA_FULL', usedChars, availableChars };
  }

  const estimated = count * perTaladro;
  if (estimated <= availableChars) {
    return { ok: true, usedChars, availableChars };
  }

  const maxTaladros = Math.floor(availableChars / perTaladro);
  if (maxTaladros >= 1) {
    return { ok: false, code: 'IMPORT_LIMITED', maxTaladros, usedChars, availableChars };
  }
  return { ok: false, code: 'QUOTA_FULL', usedChars, availableChars };
}
