/**
 * utils/qaQcRules.ts — SSOT (Single Source of Truth) de reglas QA/QC del frontend (LOGUEO).
 *
 * Misma arquitectura que GEMA-Mapeo (qaQcRules.ts):
 *   - id: identificador único (usado para activar/desactivar y para el registry)
 *   - severity: 'CRITICA' (bloquea guardado) | 'ADVERTENCIA' (no bloquea)
 *   - enabled: switch global para activar/desactivar la regla sin tocar el código
 *   - global: si true, la regla se evalúa siempre aunque el campo no haya sido tocado
 *   - fieldId: id BASE del campo (sin índice). Para reglas de fila se genera
 *     el id final como `<fieldId>-<idx>` coincidiendo con el id del input.
 *   - evalua: función pura (ctx, row?) -> mensaje o null
 *
 * Prefijos de fieldId por módulo (coinciden con los id de los inputs):
 *   header-*      -> COLLAR      (input: header-<key>)
 *   survey-*      -> SURVEY      (input: survey-<key>-<idx>)
 *   lgg-cell-*    -> LGG         (input: lgg-cell-<key>-<idx>)
 *   struct-cell-* -> ESTRUCTURAL (input: struct-cell-<key>-<idx>)
 *   plt-cell-*    -> PLT         (input: plt-cell-<key>-<idx>)
 *
 * Reglas de VACÍO: viven en `mandatoryRules.ts` (no se duplican aquí).
 */

import { isFieldTouched, markFieldTouched } from './qaQcTouch';

export type QaQcSeverity = 'CRITICA' | 'ADVERTENCIA';

export interface QaQcAlert {
  fieldId: string;
  type: 'CRITICA' | 'ADVERTENCIA' | 'VACIO';
  message: string;
  ruleId: string;
  section: string;
}

interface RuleCtx {
  collar: any;
  surveys: any[];
  corridas: any[];
  discontinuidades: any[];
  plts: any[];
}

type Evaluator = (ctx: RuleCtx, row?: any) => string | null;

interface QaQcRuleDef {
  id: string;
  severity: QaQcSeverity;
  enabled: boolean;
  /** Si true, la regla se evalúa siempre aunque el campo no haya sido tocado. */
  global?: boolean;
  fieldId: string;
  section: string;
  evalua: Evaluator;
}

// ---------------------------------------------------------------------------
// Helpers numéricos: un campo "vacío" se ignora (lo cubre la categoría VACÍO).
// -1 es el sentinel de vacío; null/undefined/'' también.
// ---------------------------------------------------------------------------

const isBlankVal = (v: any): boolean =>
  v === undefined || v === null || v === '' || v === -1 || v === '-1';

const num = (v: any): number | null => {
  if (isBlankVal(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// Catálogos internos (extraídos del validador anterior)
// ---------------------------------------------------------------------------

const WEATHERING_COMPATIBILITY: Record<string, string[]> = {
  'R0': ['RS', 'CWC'],
  'R1': ['HWA', 'CWC'],
  'R2': ['SWD', 'MWM', 'HWA'],
  'R3': ['MWM', 'SWD', 'UWF'],
  'R4': ['SWD', 'MWM', 'UWF'],
  'R5': ['UWF', 'SWD'],
  'R6': ['UWF'],
};

/** Valores JRC10 válidos por Forma (tabla del catálogo LG EST). */
const FORMA_JRC_VALUES: Record<string, number[]> = {
  '1': [6], '2': [5, 6], '3': [4, 5], '4': [3, 4], '5': [2, 3],
  '6': [2, 7], '7': [1, 2], '8': [1], '9': [1], '-1': [-1],
};

const STRUCT_EXCEPTIONS = ['F', 'RF', 'VN', 'SZ', 'F+10', 'BED'];
const VALID_ROTURAS = ['M', 'E', 'C'];

const SECTION_LGG = 'LOGGEO GEOTÉCNICO (LGG)';
const SECTION_EST = 'LOGUEO ESTRUCTURAL (LG EST)';
const SECTION_PLT = 'ENSAYOS PLT';
const SECTION_COLLAR = 'COLLAR & SURVEY';

// ---------------------------------------------------------------------------
// Helpers de contexto compartidos
// ---------------------------------------------------------------------------

const getRowIndex = (ctx: RuleCtx, row: any, collection: 'surveys' | 'corridas' | 'discontinuidades' | 'plts'): number =>
  ctx[collection].indexOf(row);

const getPerf = (row: any): number | null => {
  const de = num(row?.de);
  const a = num(row?.a);
  if (de === null || a === null) return null;
  return parseFloat((a - de).toFixed(2));
};

const findMatchingCorrida = (ctx: RuleCtx, from: number, to: number) =>
  ctx.corridas.find(c => {
    const de = num(c.de);
    const a = num(c.a);
    return de !== null && a !== null && de <= from && to <= a;
  });

const getCollarCoord = (ctx: RuleCtx, key: string): number => num(ctx.collar?.[key]) ?? 0;

// ---------------------------------------------------------------------------
// Registry SSOT — todas las reglas QA/QC de Logueo
// ---------------------------------------------------------------------------

const RULES: QaQcRuleDef[] = [
  // ============ COLLAR & SURVEY ============
  {
    id: 'SURVEY_DEPTH_EXCEDE_EOH',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'survey-depth',
    section: SECTION_COLLAR,
    evalua: (ctx, row) => {
      const eoh = num(ctx.collar?.prof_final_eoh);
      const d = num(row?.depth);
      if (eoh === null || d === null) return null;
      return d > eoh
        ? `Lectura de Survey (${d}m) excede la profundidad final EOH oficial (${eoh}m).`
        : null;
    },
  },
  {
    id: 'SURVEY_DIP_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'survey-dip',
    section: SECTION_COLLAR,
    evalua: (_ctx, row) => {
      const d = num(row?.dip);
      if (d === null) return null;
      return d < 0 || d > 90 ? `El Dip / Inclinación (${d}°) debe estar entre 0° y 90°.` : null;
    },
  },
  {
    id: 'SURVEY_AZIMUTH_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'survey-azimuth',
    section: SECTION_COLLAR,
    evalua: (_ctx, row) => {
      const a = num(row?.azimuth);
      if (a === null) return null;
      return a < 0 || a > 360 ? `El Azimut (${a}°) debe estar entre 0° y 360°.` : null;
    },
  },
  {
    id: 'SURVEY_DIP_CAMBIO_BRUSCO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'survey-dip',
    section: SECTION_COLLAR,
    evalua: (ctx, row) => {
      const idx = getRowIndex(ctx, row, 'surveys');
      if (idx <= 0) return null;
      const prevDip = num(ctx.surveys[idx - 1]?.dip);
      const currDip = num(row?.dip);
      const prevDepth = num(ctx.surveys[idx - 1]?.depth);
      const currDepth = num(row?.depth);
      if (prevDip === null || currDip === null) return null;
      if (Math.abs(currDip - prevDip) <= 2) return null;
      return `Cambio brusco de Dip (>2°) detectado entre profundidad ${(prevDepth ?? 0).toFixed(2)}m (${prevDip}°) y ${(currDepth ?? 0).toFixed(2)}m (${currDip}°).`;
    },
  },

  // ============ LGG (CORRIDAS) ============
  {
    id: 'LGG_CONTINUIDAD_ESPACIAL',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-de',
    section: SECTION_LGG,
    evalua: (ctx, row) => {
      const idx = getRowIndex(ctx, row, 'corridas');
      if (idx <= 0) return null;
      const de = num(row?.de);
      const prevA = num(ctx.corridas[idx - 1]?.a);
      if (de === null || prevA === null) return null;
      return Math.abs(de - prevA) > 0.001
        ? `Ruptura de continuidad espacial: 'de:' (${de}m) debe ser igual al 'a:' del tramo anterior (${prevA}m).`
        : null;
    },
  },
  {
    id: 'LGG_A_MAYOR_DE',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-a',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const de = num(row?.de);
      const a = num(row?.a);
      if (de === null || a === null) return null;
      return a <= de ? `Profundidad 'a' (${a}m) debe ser mayor que 'de' (${de}m).` : null;
    },
  },
  {
    id: 'LGG_PERF_MAXIMO_1_6',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-a',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const perf = getPerf(row);
      if (perf === null) return null;
      return perf > 1.6 ? `Longitud de corrida (${perf}m) excede el límite crítico de 1.6m.` : null;
    },
  },
  {
    id: 'LGG_REC_EXCEDE_PERF',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-rec_m',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const perf = getPerf(row);
      const rec = num(row?.rec_m);
      if (perf === null || rec === null) return null;
      return rec > perf ? `Longitud recuperada (${rec}m) es mayor que el avance perforado (${perf}m).` : null;
    },
  },
  {
    id: 'LGG_RQD_EXCEDE_REC',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-rqd_m',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const rec = num(row?.rec_m);
      const rqd = num(row?.rqd_m);
      if (rec === null || rqd === null) return null;
      return rqd > rec ? `RQD (${rqd}m) es mayor que la longitud recuperada (${rec}m).` : null;
    },
  },
  {
    id: 'LGG_LRF_EXCEDE_REC',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-lrf_m',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const rec = num(row?.rec_m);
      const lrf = num(row?.lrf_m);
      if (rec === null || lrf === null) return null;
      return lrf > rec ? `Longitud de roca fracturada LRF (${lrf}m) es mayor que la longitud recuperada (${rec}m).` : null;
    },
  },
  {
    id: 'LGG_SUMA_FRAGMENTOS_EXCEDE_PERF',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'lgg-cell-rqd_m',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const perf = getPerf(row);
      if (perf === null) return null;
      const rqd = Math.max(0, num(row?.rqd_m) ?? 0);
      const lrf = Math.max(0, num(row?.lrf_m) ?? 0);
      const small = Math.max(0, num(row?.small_frag_m) ?? 0);
      const sum = parseFloat((rqd + lrf + small).toFixed(2));
      return sum > perf ? `La suma de fragmentos (${sum}m) supera el avance perforado (${perf}m).` : null;
    },
  },
  {
    id: 'LGG_BUZAMIENTOS_NO_COINCIDEN',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'lgg-cell-frac_nat',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const fn = num(row?.frac_nat);
      const b30 = num(row?.frac_buz30);
      const b60 = num(row?.frac_buz60);
      const b90 = num(row?.frac_buz90);
      if (fn === null || b30 === null || b60 === null || b90 === null) return null;
      const sumBins = b30 + b60 + b90;
      return sumBins !== fn
        ? `La suma de fracturas por buzamiento (${sumBins}) no coincide con el conteo general (${fn}).`
        : null;
    },
  },
  {
    id: 'LGG_ESPESOR_SUPERA_ABERTURA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'lgg-cell-espesor',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const abertura = num(row?.abertura);
      const espesor = num(row?.espesor);
      if (abertura === null || espesor === null) return null;
      const tipo = String(row?.tipo_est1 || '').trim().toUpperCase();
      if (STRUCT_EXCEPTIONS.includes(tipo)) return null;
      return espesor > abertura
        ? `El espesor de relleno (${espesor}mm) no puede ser mayor que la abertura (${abertura}mm), excepto para estructuras F, RF, VN, SZ, F+10, BED.`
        : null;
    },
  },
  {
    id: 'LGG_ESPESOR_SIN_ABERTURA',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'lgg-cell-abertura',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const espesor = num(row?.espesor);
      const abertura = num(row?.abertura);
      if (espesor === null || espesor <= 0) return null;
      return abertura === null || abertura <= 0
        ? `Se declaró espesor de relleno de ${espesor}mm, pero la abertura es 0mm.`
        : null;
    },
  },
  {
    id: 'LGG_ABERTURA_SIN_ESPESOR',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'lgg-cell-espesor',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const abertura = num(row?.abertura);
      const espesor = num(row?.espesor);
      if (abertura === null || abertura <= 0) return null;
      return espesor === null || espesor === 0
        ? `La abertura es de ${abertura}mm, pero no se ha registrado espesor de relleno.`
        : null;
    },
  },
  {
    id: 'LGG_RESISTENCIA_INTEMPERISMO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'lgg-cell-intemperismo',
    section: SECTION_LGG,
    evalua: (_ctx, row) => {
      const resistencia = String(row?.resistencia || '').trim().toUpperCase();
      const weathering = String(row?.intemperismo || '').trim().toUpperCase();
      if (!resistencia || !weathering) return null;
      const validWeatherings = WEATHERING_COMPATIBILITY[resistencia];
      if (!validWeatherings) return null;
      return !validWeatherings.includes(weathering)
        ? `Incompatibilidad geológica (Resistencia ${resistencia} con Intemperismo ${weathering}). Permitidos: ${validWeatherings.join(', ')}.`
        : null;
    },
  },

  // ============ ESTRUCTURAL (LG EST) ============
  {
    id: 'STRUCT_PROFUNDIDAD_NUMERICA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-profundidad',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      if (isBlankVal(row?.profundidad)) return null;
      return num(row?.profundidad) === null
        ? 'La profundidad no es un número válido.'
        : null;
    },
  },
  {
    id: 'STRUCT_PROFUNDIDAD_HUERFANA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-profundidad',
    section: SECTION_EST,
    evalua: (ctx, row) => {
      const depth = num(row?.profundidad);
      if (depth === null) return null;
      const hasRunMatch = ctx.corridas.some(c => {
        const de = num(c.de);
        const a = num(c.a);
        if (de === null || a === null) return false;
        return (depth >= de && depth < a) || depth === a;
      });
      return !hasRunMatch
        ? `Profundidad huérfana (${depth.toFixed(2)}m) no corresponde a ningún tramo de corrida en LGG.`
        : null;
    },
  },
  {
    id: 'STRUCT_CORRIDA_NO_COINCIDE',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-de',
    section: SECTION_EST,
    evalua: (ctx, row) => {
      const estDe = num(row?.de);
      const estA = num(row?.a);
      if (estDe === null || estA === null) return null;
      const hasExactRun = ctx.corridas.some(c =>
        Math.abs((num(c.de) ?? -9999) - estDe) < 0.001 &&
        Math.abs((num(c.a) ?? -9999) - estA) < 0.001
      );
      return !hasExactRun
        ? `La corrida asociada de: ${estDe}m y a: ${estA}m no coincide exactamente con ninguna corrida registrada en LGG.`
        : null;
    },
  },
  {
    id: 'STRUCT_PROFUNDIDAD_FUERA_INTERVALO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-profundidad',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const depth = num(row?.profundidad);
      const estDe = num(row?.de);
      const estA = num(row?.a);
      if (depth === null || estDe === null || estA === null) return null;
      return depth < estDe || depth > estA
        ? `La profundidad (${depth}m) está fuera del intervalo especificado para la corrida (de: ${estDe}m, a: ${estA}m).`
        : null;
    },
  },
  {
    id: 'STRUCT_ALFA_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-alfa',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const alfa = num(row?.alfa);
      if (alfa === null) return null;
      return alfa !== -1 && (alfa < 0 || alfa > 90)
        ? `El ángulo Alfa (${alfa}°) es inválido. Debe estar entre 0° y 90°, o ser -1.`
        : null;
    },
  },
  {
    id: 'STRUCT_BETA_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-beta',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const beta = num(row?.beta);
      if (beta === null) return null;
      return beta !== -1 && (beta < 0 || beta > 360)
        ? `El ángulo Beta (${beta}°) es inválido. Debe estar entre 0° y 360°, o ser -1.`
        : null;
    },
  },
  {
    id: 'STRUCT_JRC10_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-jrc10',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const jrc10 = num(row?.jrc10);
      if (jrc10 === null) return null;
      if (jrc10 > 20) return `El valor de JRC10 (${jrc10}) es inválido. No se permiten valores mayores a 20.`;
      if (jrc10 < 0) return `El valor de JRC10 (${jrc10}) no puede ser negativo.`;
      return null;
    },
  },
  {
    id: 'STRUCT_ESPESOR_SUPERA_ABERTURA',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'struct-cell-espesor',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const abertura = num(row?.abertura);
      const espesor = num(row?.espesor);
      if (abertura === null || espesor === null) return null;
      const tipo = String(row?.tipo_estructura || '').trim().toUpperCase();
      if (STRUCT_EXCEPTIONS.includes(tipo)) return null;
      return espesor > abertura
        ? `El espesor de relleno (${espesor}mm) no puede ser mayor que la abertura de junta (${abertura}mm), excepto en estructuras F, RF, VN, SZ, F+10, BED.`
        : null;
    },
  },
  {
    id: 'STRUCT_ESPESOR_RELLENO_LIMPIO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'struct-cell-relleno1',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const espesor = num(row?.espesor);
      if (espesor === null || espesor <= 0) return null;
      const relleno1 = String(row?.relleno1 || '').trim();
      const rellenoLimpio = relleno1 === 'cwf' || relleno1 === '-1' || relleno1 === '';
      return rellenoLimpio
        ? `Se declaró espesor de relleno de ${espesor}mm, pero el tipo de relleno está limpio/sin definir.`
        : null;
    },
  },
  {
    id: 'STRUCT_RELLENO_SIN_ABERTURA',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'struct-cell-abertura',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const abertura = num(row?.abertura);
      const relleno1 = String(row?.relleno1 || '').trim();
      const rellenoLimpio = relleno1 === 'cwf' || relleno1 === '-1' || relleno1 === '';
      if (rellenoLimpio) return null;
      return abertura !== null && abertura === 0
        ? `Se declaró tipo de relleno (${relleno1}), pero la abertura es 0mm.`
        : null;
    },
  },
  {
    id: 'STRUCT_RELLENO_SIN_ESPESOR',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'struct-cell-espesor',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const espesor = num(row?.espesor);
      const relleno1 = String(row?.relleno1 || '').trim();
      const rellenoLimpio = relleno1 === 'cwf' || relleno1 === '-1' || relleno1 === '';
      if (rellenoLimpio) return null;
      return espesor !== null && espesor === 0
        ? `Se declaró tipo de relleno (${relleno1}), pero el espesor es 0mm.`
        : null;
    },
  },
  {
    id: 'STRUCT_FORMA_JRC10',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'struct-cell-jrc10',
    section: SECTION_EST,
    evalua: (_ctx, row) => {
      const forma = num(row?.forma);
      const jrc10 = num(row?.jrc10);
      if (forma === null || jrc10 === null) return null;
      const validJrcValues = FORMA_JRC_VALUES[String(forma)];
      if (!validJrcValues) return null;
      return !validJrcValues.includes(jrc10)
        ? `Inconsistencia Forma vs JRC10 (Forma ${forma} con JRC10 ${jrc10}). Valores permitidos: ${validJrcValues.join(' o ')}.`
        : null;
    },
  },

  // ============ ENSAYOS PLT ============
  {
    id: 'PLT_FROM_MAYOR_TO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'plt-cell-from_m',
    section: SECTION_PLT,
    evalua: (_ctx, row) => {
      const from = num(row?.from_m);
      const to = num(row?.to_m);
      if (from === null || to === null) return null;
      return from > to
        ? `Profundidad inicial (From: ${from}m) es mayor que la final (To: ${to}m).`
        : null;
    },
  },
  {
    id: 'PLT_IS50_ANOMALO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-is_50_mpa',
    section: SECTION_PLT,
    evalua: (_ctx, row) => {
      const is50 = num(row?.is_50_mpa);
      if (is50 === null) return null;
      return is50 > 25
        ? `Is(50) anómalo detectado (${is50.toFixed(2)} MPa > 25 MPa). Verifique los datos de carga e ingresos.`
        : null;
    },
  },
  {
    id: 'PLT_UCS_FUERA_RANGO',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'plt-cell-ucs',
    section: SECTION_PLT,
    evalua: (_ctx, row) => {
      const ucs = num(row?.ucs);
      if (ucs === null) return null;
      return ucs < 0 || ucs > 500
        ? `UCS fuera de rango físico (${ucs.toFixed(1)} MPa). Verifique las dimensiones o la carga aplicada.`
        : null;
    },
  },
  {
    id: 'PLT_TIPO_ROTURA_INVALIDO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-tipo_rotura_code',
    section: SECTION_PLT,
    evalua: (_ctx, row) => {
      const rotura = String(row?.tipo_rotura_code || '').trim().toUpperCase();
      if (!rotura || rotura === '-1') return null;
      return !VALID_ROTURAS.includes(rotura)
        ? `Código de tipo de rotura no reconocido ("${rotura}"). Debe ser M (Matriz), E (Estructura) o C (Combinada).`
        : null;
    },
  },
  {
    id: 'PLT_INTERVALO_HUERFANO',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'plt-cell-from_m',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const from = num(row?.from_m);
      const to = num(row?.to_m);
      if (from === null || to === null) return null;
      const matchingCorrida = findMatchingCorrida(ctx, from, to);
      return !matchingCorrida
        ? `El intervalo [${from}m - ${to}m] es huérfano (no coincide con ninguna corrida registrada en LGG).`
        : null;
    },
  },
  {
    id: 'PLT_INTERVALO_FUERA_CORRIDA',
    severity: 'CRITICA',
    enabled: true,
    global: true,
    fieldId: 'plt-cell-from_m',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const from = num(row?.from_m);
      const to = num(row?.to_m);
      if (from === null || to === null) return null;
      const matchingCorrida = findMatchingCorrida(ctx, from, to);
      if (!matchingCorrida) return null;
      const de = num(matchingCorrida.de) ?? 0;
      const a = num(matchingCorrida.a) ?? 0;
      return from < de || to > a
        ? `El intervalo [${from}m - ${to}m] se encuentra fuera de los límites de la corrida [${de}m - ${a}m].`
        : null;
    },
  },
  {
    id: 'PLT_LITOLOGIA_DISCREPA',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-litologia_1',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const from = num(row?.from_m);
      const to = num(row?.to_m);
      if (from === null || to === null) return null;
      const matchingCorrida = findMatchingCorrida(ctx, from, to);
      if (!matchingCorrida) return null;
      const pltLito1 = String(row?.litologia_1 || '').trim().toUpperCase();
      const lggLito1 = String(matchingCorrida.lito1 || '').trim().toUpperCase();
      if (!pltLito1 || !lggLito1 || pltLito1 === '-' || lggLito1 === '-' || pltLito1 === '-1') return null;
      return pltLito1 !== lggLito1
        ? `Discrepancia de Litología. El ensayo registra "${pltLito1}", pero la corrida correspondiente en LGG registra "${lggLito1}".`
        : null;
    },
  },
  {
    id: 'PLT_DISCREPANCIA_GEOMECANICA',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-ucs',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const from = num(row?.from_m);
      const to = num(row?.to_m);
      const ucs = num(row?.ucs);
      if (from === null || to === null || ucs === null) return null;
      const matchingCorrida = findMatchingCorrida(ctx, from, to);
      if (!matchingCorrida) return null;
      const pltRes = String(row?.isrm_indice_r || '').trim().toUpperCase();
      const lggRes = String(matchingCorrida.resistencia || '').trim().toUpperCase();
      if (!pltRes || !lggRes || lggRes === '-1' || pltRes === 'SUELO') return null;
      const pltNum = parseInt(pltRes.replace('R', ''), 10) || 0;
      const lggNum = parseInt(lggRes.replace('R', ''), 10) || 0;
      if (Math.abs(pltNum - lggNum) <= 1) return null;
      return `Discrepancia Geomecánica. El UCS calculado de ${ucs.toFixed(1)} MPa clasifica como "${pltRes}", pero el geólogo estimó visualmente "${lggRes}" en LGG.`;
    },
  },
  {
    id: 'PLT_LONGITUD_MENOR_D',
    severity: 'CRITICA',
    enabled: true,
    fieldId: 'plt-cell-long_de_muestra_mm',
    section: SECTION_PLT,
    evalua: (_ctx, row) => {
      const longMuestra = num(row?.long_de_muestra_mm);
      const d = num(row?.d_mm);
      if (longMuestra === null || d === null) return null;
      return longMuestra < d
        ? `La longitud de la muestra (${longMuestra} mm) es menor que el diámetro D (${d} mm). Condición L < D inválida.`
        : null;
    },
  },
  {
    id: 'PLT_P_INSTR_INVALIDO',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-p_instr_kn',
    section: SECTION_PLT,
    evalua: (_ctx, row) => {
      const p = num(row?.p_instr_kn);
      if (p === null) return null;
      return p <= 0 ? `Carga instrumental P instr (${p} kN) debe ser mayor que 0.` : null;
    },
  },
  {
    id: 'PLT_ESTE_LEJOS_COLLAR',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-este_m',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const este = num(row?.este_m);
      if (este === null || este === 0) return null;
      const collarEste = getCollarCoord(ctx, 'collar_este');
      return Math.abs(este - collarEste) > 1000
        ? `Coordenada Este (${este}m) difiere en más de 1 km del collar (${collarEste}m).`
        : null;
    },
  },
  {
    id: 'PLT_NORTE_LEJOS_COLLAR',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-norte_m',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const norte = num(row?.norte_m);
      if (norte === null || norte === 0) return null;
      const collarNorte = getCollarCoord(ctx, 'collar_norte');
      return Math.abs(norte - collarNorte) > 1000
        ? `Coordenada Norte (${norte}m) difiere en más de 1 km del collar (${collarNorte}m).`
        : null;
    },
  },
  {
    id: 'PLT_ELEVACION_LEJOS_COLLAR',
    severity: 'ADVERTENCIA',
    enabled: true,
    fieldId: 'plt-cell-elevacion_msnm',
    section: SECTION_PLT,
    evalua: (ctx, row) => {
      const elev = num(row?.elevacion_msnm);
      if (elev === null || elev === 0) return null;
      const collarCota = getCollarCoord(ctx, 'collar_cota');
      return Math.abs(elev - collarCota) > 500
        ? `Elevación (${elev} msnm) difiere significativamente de la cota del collar (${collarCota} msnm).`
        : null;
    },
  },
];

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export const QAQC_RULE_REGISTRY: Record<string, QaQcRuleDef> = Object.fromEntries(
  RULES.map(r => [r.id, r]),
);

export const QAQC_RULE_ENFORCEMENT: Record<string, boolean> = Object.fromEntries(
  RULES.map(r => [r.id, r.enabled]),
);

/** Activa/desactiva una regla por ID (SSOT en runtime). */
export function setQaQcRuleEnabled(ruleId: string, enabled: boolean): void {
  const rule = QAQC_RULE_REGISTRY[ruleId];
  if (rule) rule.enabled = enabled;
}

export function resetQaQcRuleDefaults(): void {
  for (const rule of RULES) rule.enabled = true;
}

// ---------------------------------------------------------------------------
// Motor de validación
// ---------------------------------------------------------------------------

function getCollectionFor(ctx: RuleCtx, baseFieldId: string): any[] {
  if (baseFieldId.startsWith('lgg-cell-')) return ctx.corridas;
  if (baseFieldId.startsWith('struct-cell-')) return ctx.discontinuidades;
  if (baseFieldId.startsWith('survey-')) return ctx.surveys;
  if (baseFieldId.startsWith('plt-cell-')) return ctx.plts;
  return [];
}

function ruleApplies(rule: QaQcRuleDef, fieldId: string): boolean {
  return rule.global || isFieldTouched(fieldId);
}

/**
 * Valida un taladro completo y devuelve las alertas QA/QC (CRITICAS y
 * ADVERTENCIAS). Las reglas de VACÍO viven en mandatoryRules.ts.
 *
 * @param collar cabecera / collar del taladro
 * @param surveys lecturas de trayectoria
 * @param corridas corridas LGG
 * @param discontinuidades estructuras LG EST
 * @param plts ensayos PLT
 * @param evaluateAll si true, ignora el filtro de "campos tocados" (usado en
 *        el modal de guardado, que es la red de seguridad final).
 */
export function validateLogueoQAQC(
  collar: any,
  surveys: any[],
  corridas: any[],
  discontinuidades: any[],
  plts: any[],
  evaluateAll: boolean = false,
): QaQcAlert[] {
  const ctx: RuleCtx = { collar, surveys, corridas, discontinuidades, plts };
  const alerts: QaQcAlert[] = [];

  for (const rule of RULES) {
    if (!rule.enabled) continue;

    const isRowRule = rule.fieldId.startsWith('lgg-cell-') ||
      rule.fieldId.startsWith('struct-cell-') ||
      rule.fieldId.startsWith('survey-') ||
      rule.fieldId.startsWith('plt-cell-');

    if (isRowRule) {
      const collection = getCollectionFor(ctx, rule.fieldId);
      collection.forEach((row, idx) => {
        const fieldId = `${rule.fieldId}-${idx}`;
        if (!evaluateAll && !ruleApplies(rule, fieldId)) return;
        const msg = rule.evalua(ctx, row);
        if (msg) {
          alerts.push({ fieldId, type: rule.severity, message: msg, ruleId: rule.id, section: rule.section });
        }
      });
    } else {
      if (!evaluateAll && !ruleApplies(rule, rule.fieldId)) continue;
      const msg = rule.evalua(ctx, undefined);
      if (msg) {
        alerts.push({ fieldId: rule.fieldId, type: rule.severity, message: msg, ruleId: rule.id, section: rule.section });
      }
    }
  }

  return alerts;
}

export { markFieldTouched };
