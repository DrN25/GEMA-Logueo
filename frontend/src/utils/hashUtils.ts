/**
 * hashUtils.ts — Utilidades de hashing para detección de dirty state
 *
 * Usa cyrb53, un hash no criptográfico de 53 bits optimizado para JavaScript.
 * Colisión despreciable para JSON de taladros (< 1 en 9 cuatrillones).
 * Performance: ~2ms para 300KB de JSON (300 corridas típicas).
 */

/**
 * cyrb53 — Hash rápido de 53 bits para strings arbitrarios.
 * Fuente: https://github.com/bryc/code (dominio público).
 */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Helpers de normalización de tipos para evitar discrepancias
 * entre number (de API JSON) y string (de inputs HTML).
 */
function toNum(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function toStr(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

/**
 * Extrae solo los campos persistibles de un taladro para comparación.
 * Normaliza tipos (string/number) estrictamente para que "1.5" (de input HTML)
 * y 1.5 (de API JSON) generen exactamente la misma estructura de Hash.
 */
function extractPersistible(taladro: any): object {
  return {
    name: toStr(taladro.name).toUpperCase(),
    proyecto: toStr(taladro.proyecto),
    geologo: toStr(taladro.geologo),
    diametro: toStr(taladro.diametro),
    inclinacion: toNum(taladro.inclinacion, -60.0),
    campana: toStr(taladro.campana),
    fecha_registro: toStr(taladro.fecha_registro),
    collar_este_proyectado: toNum(taladro.collar_este_proyectado),
    collar_norte_proyectado: toNum(taladro.collar_norte_proyectado),
    collar_cota_proyectado: toNum(taladro.collar_cota_proyectado),
    prof_final_eoh_proyectada: toNum(taladro.prof_final_eoh_proyectada),
    comentarios_proyectado: toStr(taladro.comentarios_proyectado),
    collar_este: toNum(taladro.collar_este),
    collar_norte: toNum(taladro.collar_norte),
    collar_cota: toNum(taladro.collar_cota),
    prof_final_eoh: toNum(taladro.prof_final_eoh),
    comentarios: toStr(taladro.comentarios),
    turno: toStr(taladro.turno, 'D'),
    surveys: (taladro.surveys || []).map((s: any) => ({
      depth: toNum(s.depth),
      dip: toNum(s.dip),
      azimuth: toNum(s.azimuth),
    })),
    corridas: (taladro.corridas || []).map((c: any) => ({
      corrida: toNum(c.corrida),
      de: toNum(c.de),
      a: toNum(c.a),
      rec_m: toNum(c.rec_m),
      rqd_m: toNum(c.rqd_m),
      lrf_m: toNum(c.lrf_m),
      frf: toNum(c.frf !== undefined && c.frf !== null ? c.frf : (toNum(c.lrf_m) > 0 ? Math.floor(Math.round(toNum(c.lrf_m) * 100) / 5) + 1 : 0)),
      small_frag_m: toNum(c.small_frag_m),
      lito1: toStr(c.lito1),
      lito2: toStr(c.lito2, '-1'),
      lito3: toStr(c.lito3, '-1'),
      resistencia: toStr(c.resistencia),
      orientacion: toStr(c.orientacion, 'X'),
      offset: toNum(c.offset),
      tipo_est1: toStr(c.tipo_est1),
      tipo_est2: toStr(c.tipo_est2, '-1'),
      frac_nat: toNum(c.frac_nat),
      frac_buz30: toNum(c.frac_buz30),
      frac_buz60: toNum(c.frac_buz60),
      frac_buz90: toNum(c.frac_buz90),
      abertura: toNum(c.abertura),
      rugosidad: toNum(c.rugosidad),
      jrc10: toNum(c.jrc10),
      intemperismo: toStr(c.intemperismo),
      relleno1: toStr(c.relleno1),
      relleno2: toStr(c.relleno2, '-1'),
      espesor: toNum(c.espesor),
      agua_obs: toStr(c.agua_obs),
      turno: toStr(c.turno, 'D'),
      comentarios: toStr(c.comentarios),
    })),
    discontinuidades: (taladro.discontinuidades || []).map((d: any) => ({
      id: toNum(d.id),
      de: toNum(d.de),
      a: toNum(d.a),
      profundidad: toNum(d.profundidad),
      litologia: toStr(d.litologia),
      tipo_estructura: toStr(d.tipo_estructura),
      alfa: toNum(d.alfa),
      beta: toNum(d.beta),
      forma: toNum(d.forma),
      rugosidad: toNum(d.rugosidad),
      jrc10: toNum(d.jrc10),
      abertura: toNum(d.abertura),
      weathering: toStr(d.weathering),
      espesor: toNum(d.espesor),
      relleno1: toStr(d.relleno1),
      relleno2: toStr(d.relleno2, '-1'),
      dureza_pared: toStr(d.dureza_pared),
      agua: toStr(d.agua),
      geotecnico: toStr(d.geotecnico),
      comentario: toStr(d.comentario),
      corrida: toNum(d.corrida),
      tipo: toStr(d.tipo, 'Natural'),
    })),
    ensayos_plt: (taladro.ensayos_plt || []).map((p: any) => ({
      fecha: toStr(p.fecha),
      nro_muestra: toStr(p.nro_muestra),
      nro_caja: toNum(p.nro_caja),
      from_m: toNum(p.from_m),
      to_m: toNum(p.to_m),
      verif_corrida: toStr(p.verif_corrida),
      long_de_corrida_m: toNum(p.long_de_corrida_m),
      este_m: toNum(p.este_m),
      norte_m: toNum(p.norte_m),
      elevacion_msnm: toNum(p.elevacion_msnm),
      long_de_muestra_mm: toNum(p.long_de_muestra_mm),
      tipo_de_ensayo: toStr(p.tipo_de_ensayo),
      diametro_taladro_nominacion: toStr(p.diametro_taladro_nominacion),
      litologia_1: toStr(p.litologia_1),
      litologia_2: toStr(p.litologia_2),
      litologia_3: toStr(p.litologia_3),
      tipo_litologico: toStr(p.tipo_litologico),
      d_mm: toNum(p.d_mm),
      verif_de_longitud: toStr(p.verif_de_longitud),
      p_instr_kn: toNum(p.p_instr_kn),
      tipo_rotura_code: toStr(p.tipo_rotura_code),
      direccion_rotura_code: toStr(p.direccion_rotura_code),
      ejecutadoPor: toStr(p.ejecutadoPor),
      is_mpa: toNum(p.is_mpa),
      fact_corr: toNum(p.fact_corr),
      is_50_mpa: toNum(p.is_50_mpa),
      factor_k: toNum(p.factor_k),
      ucs: toNum(p.ucs),
      isrm_indice_r: toStr(p.isrm_indice_r),
      observaciones: toStr(p.observaciones),
    })),
  };
}

/**
 * Computa el hash de un taladro completo para detección de dirty state.
 * Solo incluye campos persistibles — los campos enriquecidos/calculados
 * (como originalIndex, rmr_76, class_89) se excluyen automáticamente.
 */
export function computeTaladroHash(taladro: any): number {
  const persistible = extractPersistible(taladro);
  return cyrb53(JSON.stringify(persistible));
}
