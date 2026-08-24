/**
 * utils/mandatoryRules.ts — Módulo centralizado y desacoplado para la validación
 * de campos obligatorios en el guardado (LOGUEO).
 *
 * Estructura tipo "switch" booleana (true = obligatorio, false = opcional).
 * Para activar/desactivar un campo obligatorio basta cambiar el boolean.
 *
 * Lógica copiada de GEMA-Mapeo (mandatoryRules.ts): isBlank unificado, filas
 * "vacantes" (plantilla sin datos) ignoradas, y fieldId exactos para el focus.
 */

export interface MandatoryFieldRules {
  collar: Record<string, boolean>;
  surveys: Record<string, boolean>;
  corridas: Record<string, boolean>;
  discontinuities: Record<string, boolean>;
  pltEnsayos: Record<string, boolean>;
}

export interface MissingFieldIssue {
  section: 'COLLAR' | 'SURVEY' | 'LGG' | 'ESTRUCTURAL' | 'PLT';
  fieldKey: string;
  fieldLabel: string;
  rowIndex?: number;
  message: string;
}

// ---------------------------------------------------------------------------
// SSOT: campos obligatorios por módulo
// ---------------------------------------------------------------------------

export const MANDATORY_FIELD_RULES: MandatoryFieldRules = {
  collar: {
    name: true,
    proyecto: true,
    geologo: true,
    diametro: true,
    inclinacion: true,
    campana: true,
    turno: false,
    fecha_registro: false,
    // Proyectado (opcional por naturaleza)
    collar_este_proyectado: false,
    collar_norte_proyectado: false,
    collar_cota_proyectado: false,
    prof_final_eoh_proyectada: false,
    comentarios_proyectado: false,
    // Oficial (NOT NULL en BD -> se exige; el 0 cuenta como vacío)
    collar_este: true,
    collar_norte: true,
    collar_cota: true,
    prof_final_eoh: true,
    comentarios: false
  },
  surveys: {
    depth: true,
    dip: true,
    azimuth: true
  },
  corridas: {
    de: true,
    a: true,
    rec_m: true,
    rqd_m: true,
    lrf_m: true,
    small_frag_m: false, // Calculado automáticamente
    lito1: true,
    lito2: false,
    lito3: false,
    resistencia: true,
    orientacion: false,
    offset: false,
    tipo_est1: true,
    tipo_est2: false,
    frac_nat: true,
    frac_buz30: true,
    frac_buz60: true,
    frac_buz90: true,
    abertura: true,
    rugosidad: true,
    jrc10: true,
    intemperismo: true,
    relleno1: true,
    relleno2: false,
    espesor: true,
    agua_obs: true,
    turno: false,
    comentarios: false
  },
  discontinuities: {
    id: false,
    de: false,        // Derivado del match con corridas
    a: false,         // Derivado del match con corridas
    corrida: false,   // Derivado
    profundidad: true,
    litologia: true,
    lito1: false,
    lito2: false,
    lito3: false,
    tipo_estructura: true,
    alfa: true,
    beta: true,
    forma: true,
    rugosidad: true,
    jrc10: true,
    abertura: true,
    weathering: true,
    espesor: true,
    relleno1: true,
    relleno2: false,
    dureza_pared: true,
    agua: true,
    geotecnico: true,
    comentario: false
  },
  pltEnsayos: {
    fecha: true,
    nro_muestra: true,
    nro_caja: true,
    corrida_desde: true,
    corrida_hasta: true,
    from_m: true,
    to_m: true,
    long_de_corrida_m: false, // Calculado
    long_de_muestra_mm: true,
    este_m: true,
    norte_m: true,
    elevacion_msnm: true,
    tipo_de_ensayo: true,
    diametro_taladro_nominacion: true,
    litologia_1: true,
    litologia_2: false,
    litologia_3: false,
    tipo_litologico: false, // Calculado por cascada
    d_mm: true,
    p_instr_kn: true,
    tipo_rotura_code: true,
    direccion_rotura_code: true,
    isrm_indice_r: false, // Calculado
    verif_corrida: false, // Calculado
    verif_de_longitud: false, // Calculado
    factor_k: false, // Calculado
    is_mpa: false, // Calculado
    fact_corr: false, // Calculado
    is_50_mpa: false, // Calculado
    ucs: false, // Calculado
    ejecutadoPor: true,
    observaciones: false
  }
};

// ---------------------------------------------------------------------------
// Configuración de detección de filas "vacantes" (plantillas sin datos)
// ---------------------------------------------------------------------------

/** Claves que se excluyen de la detección de vacante (siempre tienen valor o no son datos). */
const VACANCY_IGNORE_KEYS: Record<string, string[]> = {
  corridas: ['de', 'a', 'comentarios', 'orientacion', 'offset', 'small_frag_m'],
  discontinuities: ['id', 'de', 'a', 'corrida', 'litologia', 'lito1', 'lito2', 'lito3', 'comentario'],
};

/** Claves donde el valor 0 también se considera "vacío" (placeholders de fila nueva en collar). */
const VACANCY_ZERO_KEYS: Record<string, string[]> = {
  surveys: [],
  discontinuities: [],
};

// ---------------------------------------------------------------------------
// Labels legibles para los mensajes
// ---------------------------------------------------------------------------

const COLLAR_FIELD_LABELS: Record<string, string> = {
  name: 'Código de Taladro',
  proyecto: 'Proyecto',
  geologo: 'Geólogo',
  diametro: 'Diámetro',
  inclinacion: 'Inclinación (°)',
  campana: 'Campaña',
  turno: 'Turno',
  collar_este_proyectado: 'Este Proyectado',
  collar_norte_proyectado: 'Norte Proyectado',
  collar_cota_proyectado: 'Cota Proyectada',
  prof_final_eoh_proyectada: 'Prof. EOH Proyectada',
  comentarios_proyectado: 'Comentarios Proyectado',
  collar_este: 'Este Oficial',
  collar_norte: 'Norte Oficial',
  collar_cota: 'Cota Oficial',
  prof_final_eoh: 'Prof. Final EOH Oficial',
  comentarios: 'Comentarios'
};

const SURVEY_FIELD_LABELS: Record<string, string> = {
  depth: 'Profundidad (m)',
  dip: 'Dip / Inclinación (°)',
  azimuth: 'Azimut (°)'
};

const CORRIDA_FIELD_LABELS: Record<string, string> = {
  de: 'de (m)',
  a: 'a (m)',
  rec_m: 'Recuperación (m)',
  rqd_m: 'RQD (m)',
  lrf_m: 'Long. Roca Fracturada (m)',
  small_frag_m: 'Frag. <10cm (m)',
  lito1: 'Litología 1',
  lito2: 'Litología 2',
  lito3: 'Litología 3',
  resistencia: 'Resistencia (ISRM)',
  orientacion: 'Orientación',
  offset: 'Offset',
  tipo_est1: 'Tipo de Estructura 1',
  tipo_est2: 'Tipo de Estructura 2',
  frac_nat: 'N° Frac. Naturales',
  frac_buz30: 'Buz. <30°',
  frac_buz60: 'Buz. 30°-60°',
  frac_buz90: 'Buz. >60°',
  abertura: 'Abertura (mm)',
  rugosidad: 'Rugosidad (ISRM)',
  jrc10: 'JRC10',
  intemperismo: 'Intemperismo (ISRM)',
  relleno1: 'Tipo de Relleno 1',
  relleno2: 'Tipo de Relleno 2',
  espesor: 'Espesor de Relleno (mm)',
  agua_obs: 'Presencia de Agua',
  turno: 'Turno',
  comentarios: 'Comentarios'
};

const STRUCT_FIELD_LABELS: Record<string, string> = {
  profundidad: 'Profundidad (m)',
  litologia: 'Litología 1',
  tipo_estructura: 'Tipo de Estructura',
  alfa: 'Alfa (°)',
  beta: 'Beta (°)',
  forma: 'Forma',
  rugosidad: 'Rugosidad',
  jrc10: 'JRC10',
  abertura: 'Abertura (mm)',
  weathering: 'Intemperismo (ISRM)',
  espesor: 'Espesor de Relleno (mm)',
  relleno1: 'Tipo de Relleno 1',
  dureza_pared: 'Dureza de Pared',
  agua: 'Presencia de Agua',
  geotecnico: 'Geotécnico',
  comentario: 'Comentario'
};

const PLT_FIELD_LABELS: Record<string, string> = {
  fecha: 'Fecha',
  nro_muestra: 'Nro Muestra',
  nro_caja: 'Nro Caja',
  corrida_desde: 'Corrida Desde',
  corrida_hasta: 'Corrida Hasta',
  from_m: 'From (m)',
  to_m: 'To (m)',
  long_de_corrida_m: 'Long. Corrida (m)',
  long_de_muestra_mm: 'Long. Muestra (mm)',
  este_m: 'Este (m)',
  norte_m: 'Norte (m)',
  elevacion_msnm: 'Elevación (msnm)',
  tipo_de_ensayo: 'Tipo de Ensayo',
  diametro_taladro_nominacion: 'Diám. Taladro',
  litologia_1: 'Litología 1',
  litologia_2: 'Litología 2',
  litologia_3: 'Litología 3',
  tipo_litologico: 'Tipo Litológico',
  d_mm: 'D (mm)',
  p_instr_kn: 'P instr (kN)',
  tipo_rotura_code: 'Tipo de Rotura',
  direccion_rotura_code: 'Dirección de Rotura',
  isrm_indice_r: 'Índice ISRM',
  verif_corrida: 'Verif. Corrida',
  verif_de_longitud: 'Verif. Longitud',
  factor_k: 'Factor K',
  is_mpa: 'Is (MPa)',
  fact_corr: 'Factor Corr.',
  is_50_mpa: 'Is50 (MPa)',
  ucs: 'UCS (MPa)',
  ejecutadoPor: 'Ejecutado Por',
  observaciones: 'Observaciones'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFieldValue(obj: any, key: string): any {
  if (!obj) return undefined;
  if (obj[key] !== undefined && obj[key] !== null) return obj[key];

  // Mapa de sinónimos entre la vista y el estado
  const synonyms: Record<string, string[]> = {
    geologo: ['mapeador', 'geotecnico'],
    campana: ['campania', 'campana_id', 'campania_id'],
    prof_final_eoh: ['prof_final_eoh_oficial', 'eoh'],
  };

  const altKeys = synonyms[key];
  if (altKeys) {
    for (const altKey of altKeys) {
      if (obj[altKey] !== undefined && obj[altKey] !== null) {
        return obj[altKey];
      }
    }
  }
  return undefined;
}

function isBlank(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' || trimmed === '-1';
  }
  if (typeof val === 'number') {
    return isNaN(val) || val === -1;
  }
  return false;
}

/** Vacío estricto + 0 (placeholder de fila nueva en collar/profundidad/depth). */
function isBlankOrZero(val: any): boolean {
  if (isBlank(val)) return true;
  return typeof val === 'number' && val === 0;
}

function isVacantRow(row: any, sectionKey: 'surveys' | 'corridas' | 'discontinuities'): boolean {
  const rules = MANDATORY_FIELD_RULES[sectionKey];
  const ignore = VACANCY_IGNORE_KEYS[sectionKey] || [];
  const zeroKeys = VACANCY_ZERO_KEYS[sectionKey] || [];

  const fieldsToCheck = Object.keys(rules).filter(k => !ignore.includes(k));
  return fieldsToCheck.every(key => {
    const val = getFieldValue(row, key);
    return zeroKeys.includes(key) ? isBlankOrZero(val) : isBlank(val);
  });
}

// ---------------------------------------------------------------------------
// Validadores
// ---------------------------------------------------------------------------

export function validateLogueoMandatory(taladro: any): MissingFieldIssue[] {
  if (!taladro) return [];
  const issues: MissingFieldIssue[] = [];

  // 1. COLLAR
  const h = taladro.collar && typeof taladro.collar === 'object'
    ? { ...taladro, ...taladro.collar }
    : taladro;
  const zeroEmptyCollarKeys = ['collar_este', 'collar_norte', 'collar_cota', 'prof_final_eoh'];
  for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.collar)) {
    if (!isRequired) continue;
    const val = getFieldValue(h, key);
    const isFieldEmpty = zeroEmptyCollarKeys.includes(key) ? isBlankOrZero(val) : isBlank(val);
    if (isFieldEmpty) {
      issues.push({
        section: 'COLLAR',
        fieldKey: key,
        fieldLabel: COLLAR_FIELD_LABELS[key] || key,
        message: `Collar: El campo '${COLLAR_FIELD_LABELS[key] || key}' es obligatorio.`
      });
    }
  }

  // 2. SURVEY
  const surveys = Array.isArray(taladro.surveys) ? taladro.surveys : [];
  surveys.forEach((row: any, idx: number) => {
    if (isVacantRow(row, 'surveys')) return;
    for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.surveys)) {
      if (!isRequired) continue;
      if (isBlank(getFieldValue(row, key))) {
        issues.push({
          section: 'SURVEY',
          fieldKey: key,
          fieldLabel: SURVEY_FIELD_LABELS[key] || key,
          rowIndex: idx + 1,
          message: `Survey (Fila ${idx + 1}): El campo '${SURVEY_FIELD_LABELS[key] || key}' es obligatorio.`
        });
      }
    }
  });

  // 3. LGG (CORRIDAS)
  const corridas = Array.isArray(taladro.corridas) ? taladro.corridas : [];
  corridas.forEach((row: any, idx: number) => {
    if (isVacantRow(row, 'corridas')) return;
    for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.corridas)) {
      if (!isRequired) continue;
      if (isBlank(getFieldValue(row, key))) {
        issues.push({
          section: 'LGG',
          fieldKey: key,
          fieldLabel: CORRIDA_FIELD_LABELS[key] || key,
          rowIndex: idx + 1,
          message: `LGG (Fila ${idx + 1}): El campo '${CORRIDA_FIELD_LABELS[key] || key}' es obligatorio.`
        });
      }
    }
  });

  // 4. ESTRUCTURAL (DISCONTINUIDADES)
  const discs = Array.isArray(taladro.discontinuidades) ? taladro.discontinuidades : [];
  discs.forEach((row: any, idx: number) => {
    if (isVacantRow(row, 'discontinuities')) return;
    for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.discontinuities)) {
      if (!isRequired) continue;
      if (isBlank(getFieldValue(row, key))) {
        issues.push({
          section: 'ESTRUCTURAL',
          fieldKey: key,
          fieldLabel: STRUCT_FIELD_LABELS[key] || key,
          rowIndex: idx + 1,
          message: `LG EST (Fila ${idx + 1}): El campo '${STRUCT_FIELD_LABELS[key] || key}' es obligatorio.`
        });
      }
    }
  });

  // 5. PLT
  const plts = Array.isArray(taladro.ensayos_plt) ? taladro.ensayos_plt : [];
  plts.forEach((row: any, idx: number) => {
    for (const [key, isRequired] of Object.entries(MANDATORY_FIELD_RULES.pltEnsayos)) {
      if (!isRequired) continue;
      if (isBlank(getFieldValue(row, key))) {
        issues.push({
          section: 'PLT',
          fieldKey: key,
          fieldLabel: PLT_FIELD_LABELS[key] || key,
          rowIndex: idx + 1,
          message: `PLT (Fila ${idx + 1}): El campo '${PLT_FIELD_LABELS[key] || key}' es obligatorio.`
        });
      }
    }
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Conversión a alertas con fieldId exacto para el enfoque de campos
// ---------------------------------------------------------------------------

export function toVacioAlerts(issues: MissingFieldIssue[]): Array<{
  fieldId: string;
  type: 'VACIO';
  message: string;
  ruleId: string;
  section: string;
}> {
  return issues.map(issue => {
    let fieldId: string;
    const idx = issue.rowIndex !== undefined ? issue.rowIndex - 1 : 0;
    switch (issue.section) {
      case 'COLLAR':
        fieldId = `header-${issue.fieldKey}`;
        break;
      case 'SURVEY':
        fieldId = `survey-${issue.fieldKey}-${idx}`;
        break;
      case 'LGG':
        fieldId = `lgg-cell-${issue.fieldKey}-${idx}`;
        break;
      case 'ESTRUCTURAL':
        fieldId = `struct-cell-${issue.fieldKey}-${idx}`;
        break;
      case 'PLT':
        fieldId = `plt-cell-${issue.fieldKey}-${idx}`;
        break;
      default:
        fieldId = `header-${issue.fieldKey}`;
    }
    return {
      fieldId,
      type: 'VACIO' as const,
      message: issue.message,
      ruleId: 'CAMPO_OBLIGATORIO_VACIO',
      section: issue.section,
    };
  });
}
