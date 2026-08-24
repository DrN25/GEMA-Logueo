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

import {
  evictTaladro,
  getCachedTaladroRaw,
  getCachedTaladros,
  getTaladroValidationMap,
  getUnsavedTaladros,
  removePendingTaladro as removeFromPendingList,
  setTaladroValidation as persistValidation,
  clearTaladroValidation as clearValidation,
  type TaladroValidationRecord,
} from './storageManager.ts';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TaladroSource = 'bd' | 'local' | 'excel';

export interface KnownTaladro {
  name: string;
  source: TaladroSource;
}

/** Resumen de un borrador local, compatible con el render del Dashboard. */
export interface PendingTaladroSummary {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  fecha_registro: string;
  corridas_count: number;
  surveys_count: number;
  perf_total?: number;
}

/** Etiquetas de UI por estado. La UI solo las renderiza, nunca las decide. */
export const TALADRO_SOURCE_LABELS: Record<TaladroSource, string | null> = {
  bd: null,
  local: 'BORRADOR',
  excel: 'IMPORTADO',
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** ¿El taladro tiene cambios locales pendientes de guardar? */
export function isTaladroPending(name: string): boolean {
  const up = name.trim().toUpperCase();
  return getUnsavedTaladros().some(n => n.trim().toUpperCase() === up);
}

/** Estado de un taladro ('bd' si existe en el listado, 'local' si es borrador). */
export function getTaladroSource(name: string, knownFromDb: string[]): TaladroSource {
  const up = name.trim().toUpperCase();
  if ((knownFromDb || []).some(n => n.trim().toUpperCase() === up)) return 'bd';
  if (isTaladroPending(name)) return 'local';
  return 'bd';
}

/** Catálogo unificado: taladros de BD (listado actual) + borradores locales. */
export function getAllKnownTaladros(knownFromDb: string[]): KnownTaladro[] {
  const map = new Map<string, TaladroSource>();
  for (const n of knownFromDb || []) {
    const up = n.trim().toUpperCase();
    if (up) map.set(up, 'bd');
  }
  for (const n of getUnsavedTaladros()) {
    const up = n.trim().toUpperCase();
    if (up && !map.has(up)) map.set(up, 'local');
  }
  return [...map.entries()].map(([name, source]) => ({ name, source }));
}

/** Solo los nombres (para validación de duplicados o modales). */
export function getAllKnownTaladroNames(knownFromDb: string[]): string[] {
  return getAllKnownTaladros(knownFromDb).map(c => c.name);
}

/** Nombres de TODOS los taladros pendientes para marcar sus filas en el Dashboard. */
export function getPendingTaladroNames(): string[] {
  return getUnsavedTaladros();
}

/**
 * Resúmenes de los borradores locales que NO existen en BD.
 * Los taladros pendientes que YA existen en la base (modificaciones a existentes)
 * se muestran sobre su fila normal, NO como una fila BORRADOR aparte.
 */
export function getLocalOnlyPendingSummaries(knownFromDb: string[]): PendingTaladroSummary[] {
  const dbSet = new Set((knownFromDb || []).map(n => n.trim().toUpperCase()));
  return getPendingTaladroSummaries().filter(pt => !dbSet.has(pt.name.trim().toUpperCase()));
}

/** Resúmenes de los borradores locales para el Dashboard. */
export function getPendingTaladroSummaries(): PendingTaladroSummary[] {
  const summaries: PendingTaladroSummary[] = [];
  for (const name of getUnsavedTaladros()) {
    try {
      const raw = getCachedTaladroRaw(name);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (!data?.name) continue;

      const corridas = Array.isArray(data.corridas) ? data.corridas : [];
      const surveys = Array.isArray(data.surveys) ? data.surveys : [];

      let perf_total = 0;
      if (corridas.length > 0) {
        perf_total = corridas.reduce((acc: number, c: any) => {
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
    } catch {
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
export function discardLocalTaladro(name: string): void {
  removeFromPendingList(name);
  evictTaladro(name);
  clearValidation(name);
}

// ---------------------------------------------------------------------------
// Estado de validación QA/QC por taladro (persistido)
// ---------------------------------------------------------------------------

export interface PendingTaladroValidation {
  taladro: string;
  ok: boolean;
  count: number;
  issues: string[];
}

/** Persiste el resultado de validación de un taladro. */
export function setTaladroValidation(taladro: string, issueMessages: string[]): void {
  const clean = issueMessages.filter(Boolean);
  persistValidation(taladro, {
    ok: clean.length === 0,
    count: clean.length,
    issues: clean,
  });
}

/** Registro de validación de un taladro (o null si nunca se evaluó). */
export function getTaladroValidation(taladro: string): TaladroValidationRecord | null {
  const map = getTaladroValidationMap();
  return map[taladro.trim().toUpperCase()] ?? null;
}

/** ¿El taladro tiene un registro de validación persistido? */
export function hasTaladroValidation(taladro: string): boolean {
  return getTaladroValidation(taladro) !== null;
}

/** Taladros pendientes cuyo estado persistido es INVÁLIDO (bloquean el guardado). */
export function getInvalidPendingTaladros(): PendingTaladroValidation[] {
  const pending = new Set(getUnsavedTaladros().map(n => n.trim().toUpperCase()));
  const map = getTaladroValidationMap();
  const result: PendingTaladroValidation[] = [];
  for (const [taladro, record] of Object.entries(map)) {
    if (!record.ok && pending.has(taladro.trim().toUpperCase())) {
      result.push({ taladro, ok: false, count: record.count, issues: record.issues });
    }
  }
  return result;
}

/** Taladros pendientes que solo existen localmente (sin snapshot en BD). */
export function getLocalOnlyPendingTaladros(): string[] {
  return getUnsavedTaladros().filter(taladro => !localStorage.getItem(`geolog_snapshot_data_${taladro}`));
}

/** Limpia el registro de validación de un taladro (al guardar exitosamente). */
export function clearTaladroValidation(taladro: string): void {
  clearValidation(taladro);
}

// ---------------------------------------------------------------------------
// Verificación de colisiones previa al guardado
// ---------------------------------------------------------------------------

export interface NameCollisionCheck {
  ok: boolean;
  collisions: string[];
}

/**
 * Verifica que los nombres de taladros NUEVOS (sin snapshot) no hayan sido
 * creados en BD por otra persona después de crear el borrador local.
 * Utiliza el endpoint /api/taladros/existe?name=... del backend.
 */
export async function verifyTaladroNameCollisions(
  names: string[],
  apiBase: string,
  knownFromDb: string[] = []
): Promise<NameCollisionCheck> {
  const dbSet = new Set((knownFromDb || []).map(n => n.trim().toUpperCase()));
  const unique = [...new Set(names.map(n => n.trim().toUpperCase()).filter(Boolean))];
  const collisions: string[] = [];

  const results = await Promise.all(
    unique.map(async (name) => {
      if (dbSet.has(name)) return { name, collision: true };
      try {
        const res = await fetch(`${apiBase}/api/taladros/existe?name=${encodeURIComponent(name)}`);
        if (!res.ok) return { name, collision: true };
        const data = await res.json();
        return { name, collision: Boolean(data?.exists) };
      } catch {
        return { name, collision: true };
      }
    })
  );

  for (const r of results) {
    if (r.collision) collisions.push(r.name);
  }
  return { ok: collisions.length === 0, collisions };
}

/** Taladros cuyo caché existe en localStorage. */
export function getCachedTaladroNames(): string[] {
  return getCachedTaladros();
}
