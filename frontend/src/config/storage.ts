/**
 * Configuración central del almacenamiento local (localStorage) para Geolog Logueo.
 * SSOT: si necesitas ajustar límites, este es el ÚNICO lugar.
 */

export const STORAGE_CONFIG = {
  /** Límite conservador del navegador, medido en caracteres UTF-16
   *  (la misma unidad con la que Chrome/Edge/Firefox/Safari cuentan la cuota ~5 MB). */
  QUOTA_CHARS: 5_000_000,

  /** Fracción de la cuota que se considera utilizable. Nunca se usa el 100%:
   *  se reserva margen para el taladro activo, claves globales y el resto de la app. */
  SAFETY_RATIO: 0.8,

  /** Tope de taladros cacheados (geolog_taladro_*). 100 taladros ≈ 0.8 MB reales,
   *  muy por debajo del límite del navegador. */
  MAX_CACHED_TALADROS: 100,

  /** Estimación conservadora por taladro cacheado (en chars UTF-16):
   *  taladro (~8000) + snapshot (~8000) + hash (~30) + margen. */
  ESTIMATE_PER_TALADRO_CHARS: 16030,
} as const;
