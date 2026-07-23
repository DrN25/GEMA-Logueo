/**
 * Reusable utility for parsing, mapping, and filtering geotech Excel sheets.
 * Handles large volume sheets by pre-filtering in memory and prevents collisions.
 */

export interface RawExcelData {
  headers: string[];
  rows: any[][];
  headerRowIndex: number;
}

export interface MappingField {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const EXPECTED_FIELDS: MappingField[] = [
  { key: 'taladro', label: 'Taladro / Sondaje', required: true, synonyms: ['taladro', 'sondaje', 'drillhole', 'holeid', 'taladroid'] },
  { key: 'de', label: 'Desde (de:)', required: true, synonyms: ['de', 'desde', 'de(m)', 'desde(m)', 'from', 'depthfrom'] },
  { key: 'a', label: 'Hasta (a:)', required: true, synonyms: ['a', 'hasta', 'a(m)', 'hasta(m)', 'to', 'depthto'] },
  { key: 'rec_m', label: 'Long. Recuperada (m)', required: true, synonyms: ['longitudrecuperadam', 'recuperacionm', 'recm', 'recupm', 'recuperacion', 'recuperada', 'longitudrecuperada', 'longitudrecuperdadam', 'longitudrecuperdada'] },
  { key: 'rqd_m', label: 'RQD (m)', required: true, synonyms: ['rqdm', 'rqd', 'rqdmfragmentos10cm', 'frag10cmm', 'sumfrags10cm', 'rqdsumfrags10cmm', 'fragmentos10cmm', 'frags10cmm'] },
  { key: 'lrf_m', label: 'Roca Fracturada (m)', required: false, synonyms: ['longitudrocafracturadam', 'lrfm', 'lrf', 'longitudrocafracturada', 'rocafracturadam', 'rocafracturada'] },
  { key: 'small_frag_m', label: 'Frag. < 10cm (m)', required: false, synonyms: ['sumfrags10cmm', 'smallfragm', 'smallfrag', 'sumfrags10cmquenoentranalrqd', 'sumfrags10cmquenoentranalrqdm', 'frags10cmquenoentranalrqdm', 'frags10cmm', 'sumfrags10cm'] },
  { key: 'mec_frac', label: 'N° Fracturas Mecán.', required: false, synonyms: ['nfracmecan', 'nfracmecanic', 'nfracmecanicas', 'mecfrac', 'fracturasmecanicas', 'fracmecanicas', 'mecanicas'] },
  { key: 'frac_nat', label: 'N° Fracturas Natural.', required: false, synonyms: ['ndefracnaturales', 'nfracnatur', 'nfracnaturales', 'fracnat', 'fracturasnaturales', 'naturales'] },
  { key: 'lito1', label: 'Litología 1', required: true, synonyms: ['lito1', 'lito12023', 'litologia1', 'litologia12023', 'litologia'] },
  { key: 'lito2', label: 'Litología 2', required: false, synonyms: ['lito2', 'lito22023', 'litologia2', 'litologia22023'] },
  { key: 'lito3', label: 'Litología 3', required: false, synonyms: ['lito3', 'lito32023', 'litologia3', 'litologia32023'] },
  { key: 'resistencia', label: 'Resist. Estimada (ISRM)', required: true, synonyms: ['resistencia', 'resistestimadaisrm', 'resistmaxestimadaisrm', 'resistestimada', 'resistmax', 'resist', 'dureza', 'isrm', 'durezamaterial'] },
  { key: 'orientacion', label: 'Línea de Orientac.', required: false, synonyms: ['lineadeorientacion', 'lineadeorientac', 'orientacion', 'orientacionlinea'] },
  { key: 'offset', label: 'Offset / Desfase', required: false, synonyms: ['desplazamiento0360offsetoffset', 'offset', 'desfase'] },
  { key: 'tipo_est1', label: 'Estructura Tipo 1', required: false, synonyms: ['tipodeestruct', 'tipoestructura1', 'tipoest1', 'estructura1'] },
  { key: 'tipo_est2', label: 'Estructura Tipo 2', required: false, synonyms: ['tipodeestruct2', 'tipoestructura2', 'tipoest2', 'estructura2'] },
  { key: 'frac_buz30', label: 'Buz < 30°', required: false, synonyms: ['nfracnatbuz30', 'nfracnaturalbuz30', 'buz30', 'naturalesbuz30'] },
  { key: 'frac_buz60', label: '30° < Buz < 60°', required: false, synonyms: ['nfracn30buz60', 'nfracnatural30buz60', 'buz3060', 'buz30a60'] },
  { key: 'frac_buz90', label: 'Buz > 60°', required: false, synonyms: ['nfracnatbuz60', 'nfracnaturalbuz60', 'buz60', 'nfracnatbuz90', 'nfracnaturalbuz90', 'buz90'] },
  { key: 'abertura', label: 'Abertura (mm)', required: false, synonyms: ['aberturamm', 'aberturamm', 'abertura', 'abert'] },
  { key: 'rugosidad', label: 'Rugosidad (ISRM)', required: false, synonyms: ['rugosidadisrm', 'rugosidad', 'rugos'] },
  { key: 'jrc10', label: 'JRC10', required: false, synonyms: ['jrc10', 'jrc', 'jrc10rugosidad'] },
  { key: 'intemperismo', label: 'Grado Intemp. (ISRM)', required: false, synonyms: ['gradointempisrm', 'gradointemp', 'intemperismo', 'alteracion', 'weathering'] },
  { key: 'relleno1', label: 'Tipo Relleno 1', required: false, synonyms: ['tipoderelleno1', 'relleno1', 'tiporelleno1'] },
  { key: 'relleno2', label: 'Tipo Relleno 2', required: false, synonyms: ['tipoderelleno2', 'relleno2', 'tiporelleno2'] },
  { key: 'espesor', label: 'Espesor Relleno (mm)', required: false, synonyms: ['espesorrellenomm', 'espesorrelleno', 'espesor', 'espesormm'] },
  { key: 'agua_obs', label: 'Presencia Agua (ISRM)', required: false, synonyms: ['presenciadeaguaisrm', 'presenaguaisrm', 'presenciaagua', 'aguaobs', 'agua'] },
  { key: 'turno', label: 'Turno', required: false, synonyms: ['turno', 'shift'] },
  { key: 'comentarios', label: 'Comentarios', required: false, synonyms: ['comentarios', 'comentario', 'observaciones', 'observacion', 'comments'] },
  { key: 'campana', label: 'Campaña / Año', required: false, synonyms: ['campana', 'anio', 'campan', 'campaign', 'year'] }
];

export function normalizeHeader(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, "")      // Keep only letters/numbers
    .trim();
}

/**
 * Scans the first 15 rows of the parsed sheet grid to identify which row behaves like headers.
 * Selects the row containing the maximum number of matched geotech column names.
 */
export function findHeaderRow(rows: any[][]): number {
  let bestRowIndex = 0;
  let maxMatches = -1;

  // Scan top 15 rows
  const maxScanRows = Math.min(15, rows.length);
  for (let r = 0; r < maxScanRows; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let matches = 0;
    const normalizedCells = row.map(cell => normalizeHeader(cell));

    // Count how many expected fields match at least one cell in this row
    EXPECTED_FIELDS.forEach(field => {
      const hasMatch = field.synonyms.some(synonym =>
        normalizedCells.some(cellVal => cellVal === synonym)
      );
      if (hasMatch) matches++;
    });

    if (matches > maxMatches) {
      maxMatches = matches;
      bestRowIndex = r;
    }
  }

  return bestRowIndex;
}

/**
 * Suggests an initial mapping from EXPECTED_FIELDS keys to index of headers in the sheet.
 * Prevents multiple keys from mapping to the same index by priorizing exact matches first.
 */
export function suggestMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  const usedIndices = new Set<number>();

  // Helper to match fields
  const matchField = (field: MappingField, prioritizeExact: boolean) => {
    // Try exact matches first
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedIndices.has(i)) continue;
      const normHeader = normalizedHeaders[i];
      if (normHeader === field.key) {
        mapping[field.key] = i;
        usedIndices.add(i);
        return true;
      }
    }

    if (prioritizeExact) return false;

    // Try synonym matches
    for (const synonym of field.synonyms) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (usedIndices.has(i)) continue;
        const normHeader = normalizedHeaders[i];
        if (normHeader === synonym) {
          mapping[field.key] = i;
          usedIndices.add(i);
          return true;
        }
      }
    }

    // Try substring matching as fallback
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedIndices.has(i)) continue;
      const normHeader = normalizedHeaders[i];
      const hasSubstring = field.synonyms.some(syn => normHeader.includes(syn) || syn.includes(normHeader));
      if (hasSubstring && normHeader.length > 2) {
        mapping[field.key] = i;
        usedIndices.add(i);
        return true;
      }
    }

    return false;
  };

  // Step 1: Prioritize exact key name matches (e.g. "de", "a", "rqd_m")
  EXPECTED_FIELDS.forEach(field => {
    matchField(field, true);
  });

  // Step 2: Try synonym and substring matches
  EXPECTED_FIELDS.forEach(field => {
    if (mapping[field.key] === undefined) {
      matchField(field, false);
    }
  });

  return mapping;
}

export interface ImportSummary {
  totalRows: number;
  uniqueTaladros: string[];
  uniqueCampanas: string[];
  rowsByTaladro: Record<string, any[]>;
}

/**
 * Parses and filters a massive sheet data grid, returning unique groups and counts.
 */
export function processExcelData(
  rows: any[][],
  headerRowIndex: number,
  mappings: Record<string, number>
): ImportSummary {
  const rowsByTaladro: Record<string, any[]> = {};
  const taladrosSet = new Set<string>();
  const campanasSet = new Set<string>();
  let validRowsCount = 0;

  // Start parsing from row after headers
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Extract basic fields
    const getVal = (key: string) => {
      const idx = mappings[key];
      return idx !== undefined ? row[idx] : undefined;
    };

    // Skip row if it doesn't have start/end depths
    const deVal = getVal('de');
    const aVal = getVal('a');
    if (deVal === undefined || deVal === null || deVal === '' ||
      aVal === undefined || aVal === null || aVal === '') {
      continue;
    }

    // Extract Taladro and Campana names (use default if missing)
    let taladroName = String(getVal('taladro') || '').trim();
    if (!taladroName || taladroName === 'Comentarios' || taladroName === 'None') {
      // Look for a fallback or default
      taladroName = 'FEGT-SIN-NOMBRE';
    }

    let campanaName = String(getVal('campana') || '').trim();
    if (!campanaName || campanaName === 'None') {
      campanaName = 'SIN-CAMPANA';
    }

    taladrosSet.add(taladroName);
    if (campanaName) campanasSet.add(campanaName);

    // Build the raw mapped object
    const rawRecord: Record<string, any> = {};
    EXPECTED_FIELDS.forEach(field => {
      const idx = mappings[field.key];
      rawRecord[field.key] = idx !== undefined ? row[idx] : undefined;
    });

    if (!rowsByTaladro[taladroName]) {
      rowsByTaladro[taladroName] = [];
    }
    rowsByTaladro[taladroName].push(rawRecord);
    validRowsCount++;
  }

  return {
    totalRows: validRowsCount,
    uniqueTaladros: Array.from(taladrosSet).sort(),
    uniqueCampanas: Array.from(campanasSet).sort(),
    rowsByTaladro
  };
}

export const EXPECTED_STRUCT_FIELDS: MappingField[] = [
  { key: 'taladro', label: 'Taladro / Sondaje', required: true, synonyms: ['taladro', 'sondaje', 'drillhole', 'holeid', 'taladroid'] },
  { key: 'profundidad', label: 'Profundidad (m)', required: true, synonyms: ['profundidad', 'profundidadm', 'depth', 'depthm', 'prof'] },
  { key: 'tipo_estructura', label: 'Tipo Estructura', required: true, synonyms: ['tipodeestructura', 'tipoestructura', 'tipoest', 'estructura', 'structuretype', 'structtype'] },
  { key: 'alfa', label: 'Alfa (deg)', required: true, synonyms: ['alfa', 'alpha', 'buzamientoalfa', 'alfao', 'alfae'] },
  { key: 'beta', label: 'Beta (deg)', required: false, synonyms: ['beta', 'buzamientobeta', 'betao', 'betae'] },
  { key: 'forma', label: 'Forma', required: true, synonyms: ['forma', 'shape'] },
  { key: 'rugosidad', label: 'Rugosidad (ISRM)', required: true, synonyms: ['rugosidadisrm', 'rugosidad', 'roughness'] },
  { key: 'jrc10', label: 'JNRC10 / JRC', required: false, synonyms: ['jrc10', 'jnrc10', 'jrc', 'jrc10rugosidad'] },
  { key: 'abertura', label: 'Abertura (mm)', required: false, synonyms: ['abertura', 'aberturamm', 'aperture', 'aperturemm'] },
  { key: 'weathering', label: 'Grado Intemp. (ISRM)', required: false, synonyms: ['weathering', 'gradointempisrm', 'gradointemp', 'intemperismo', 'meteorizacion'] },
  { key: 'espesor', label: 'Espesor Relleno (mm)', required: false, synonyms: ['espesorrellenomm', 'espesorrelleno', 'espesor', 'espesormm', 'thickness'] },
  { key: 'relleno1', label: 'Relleno 1', required: false, synonyms: ['relleno1', 'relleno_1', 'tipoderelleno1', 'tiporelleno1'] },
  { key: 'relleno2', label: 'Relleno 2', required: false, synonyms: ['relleno2', 'relleno_2', 'tipoderelleno2', 'tiporelleno2'] },
  { key: 'dureza_pared', label: 'Dureza Pared (ISRM)', required: false, synonyms: ['durezadepared', 'durezadepareddeestructura', 'durezapared', 'wallstrength', 'dureza'] },
  { key: 'agua', label: 'Presen. Agua (ISRM)', required: false, synonyms: ['presenaguaisrm', 'presenciadeaguaisrm', 'agua', 'aguaobs', 'water'] },
  { key: 'geotecnico', label: 'Geotécnico', required: false, synonyms: ['geotecnico', 'geologo', 'loggedby', 'geotechnician'] },
  { key: 'comentario', label: 'Comentario / Intervalo', required: false, synonyms: ['comentarios', 'comentario', 'intervalocomentario', 'observacion', 'observaciones', 'remarks'] },
  { key: 'tipo', label: 'Tipo (Nat/Mec)', required: false, synonyms: ['tipo', 'type', 'tipodejunta', 'juntatipo'] }
];

export const EXPECTED_RMR_FIELDS: MappingField[] = [
  { key: 'sondaje', label: 'Taladro / Sondaje', required: true, synonyms: ['sondaje', 'taladro', 'drillhole', 'holeid', 'taladroid'] },
  { key: 'corrida', label: 'N° Corrida', required: true, synonyms: ['corrida', 'run', 'nrocorrida', 'numcorrida'] },
  { key: 'lito1', label: 'Litho 1', required: true, synonyms: ['litho1', 'lito1', 'litologia1'] },
  { key: 'lito2', label: 'Litho 2', required: false, synonyms: ['litho2', 'lito2', 'litologia2'] },
  { key: 'lito3', label: 'Litho 3', required: false, synonyms: ['litho3', 'lito3', 'litologia3'] },
  { key: 'de', label: 'Desde (m)', required: true, synonyms: ['desde', 'desdem', 'de', 'from'] },
  { key: 'a', label: 'Hasta (m)', required: true, synonyms: ['hasta', 'hastam', 'a', 'to'] },
  { key: 'long_corrida', label: 'Long. Corrida (m)', required: true, synonyms: ['longcorrida', 'longcorridam', 'longitudcorrida', 'longitudcorridam'] },
  { key: 'rec_m', label: 'Rec (m)', required: true, synonyms: ['recm', 'rec', 'recuperada', 'recuperacionm'] },
  { key: 'rec_pct', label: 'Rec (%)', required: true, synonyms: ['recpct', 'rec%', 'recuperacion%'] },
  { key: 'rqd_m', label: 'RQD (m)', required: true, synonyms: ['rqdm', 'rqd'] },
  { key: 'rqd_pct', label: 'RQD (%)', required: true, synonyms: ['rqdpct', 'rqd%'] },
  { key: 'lrf_m', label: 'Long. Tramo fracturado (m)', required: true, synonyms: ['longtramofracturadom', 'lrfm', 'lrf'] },
  { key: 'frf', label: 'FRF (zonas trituradas)', required: true, synonyms: ['frf', 'frfzonastrituradas'] },
  { key: 'frac_nat', label: 'Fracturas naturales', required: true, synonyms: ['fracturasnaturales', 'fracnat', 'fn'] },
  { key: 'total_frac', label: 'Total de Fracturas', required: true, synonyms: ['totaldefracturas', 'totalfracturas'] },
  { key: 'ff_1m', label: 'FF/1m', required: true, synonyms: ['ff1m', 'ff/1m'] },
  { key: 'espaciamiento_mm', label: 'Espaciamiento (mm)', required: true, synonyms: ['espaciamientomm', 'espaciamiento'] },
  { key: 'resistencia', label: 'Resistencia', required: true, synonyms: ['resistencia', 'resistisrm'] },
  { key: 'tipo_estructura', label: 'Tipo de Estructura', required: true, synonyms: ['tipodeestructura', 'tipoestructura'] },
  { key: 'abertura_mm', label: 'Abertura (mm)', required: true, synonyms: ['aberturamm', 'abertura'] },
  { key: 'rugosidad', label: 'Rugosidad', required: true, synonyms: ['rugosidad', 'rugosidadisrm'] },
  { key: 'relleno', label: 'Relleno', required: true, synonyms: ['relleno', 'tiporelleno'] },
  { key: 'clasificacion_relleno', label: 'Clasificación Relleno', required: true, synonyms: ['clasificacionrelleno', 'clasifrelleno'] },
  { key: 'intemperismo', label: 'Intemperismo', required: true, synonyms: ['intemperismo', 'alteracion', 'weathering'] },
  { key: 'jrc10', label: 'JRC10', required: true, synonyms: ['jrc10', 'jrc'] },
  { key: 'espesor_relleno', label: 'Espesor de relleno', required: true, synonyms: ['espesorderelleno', 'espesorrellenomm', 'espesorrelleno'] },
  { key: 'presencia_agua', label: 'Presencia de Agua', required: false, synonyms: ['presenciadeagua', 'presenciaagua', 'agua'] },
  { key: 'rmr76', label: "RMR'76 Total", required: false, synonyms: ['rmr76', 'rmr76total', "rmr'76"] },
  { key: 'rmr89', label: "RMR'89 Total", required: false, synonyms: ['rmr89', 'rmr89total', "rmr'89"] }
];

export const EXPECTED_PLT_FIELDS: MappingField[] = [
  { key: 'taladro', label: 'Taladro / Sondaje', required: true, synonyms: ['taladro', 'sondaje', 'drillhole', 'holeid', 'taladroid'] },
  { key: 'campana', label: 'Campaña / Año', required: false, synonyms: ['campana', 'campaña', 'campaign', 'year', 'anio'] },
  { key: 'fecha', label: 'Fecha', required: false, synonyms: ['fecha', 'date'] },
  { key: 'nro_muestra', label: 'Nro Muestra', required: true, synonyms: ['nromuestra', 'nro_muestra', 'nromuest', 'muestra', 'sample', 'sampleno'] },
  { key: 'nro_caja', label: 'Nro Caja', required: true, synonyms: ['nrocaja', 'nro_caja', 'caja', 'box', 'boxno'] },
  { key: 'corrida_desde', label: 'Corrida Desde (m)', required: false, synonyms: ['corridadesde', 'corrida_desde', 'run_from', 'c_desde', 'corridadesdem'] },
  { key: 'corrida_hasta', label: 'Corrida Hasta (m)', required: false, synonyms: ['corridahasta', 'corrida_hasta', 'run_to', 'c_hasta', 'corridahastam'] },
  { key: 'from_m', label: 'From (de: m)', required: true, synonyms: ['from', 'desde', 'de', 'from_m', 'de_m', 'fromm', 'dem'] },
  { key: 'to_m', label: 'To (a: m)', required: true, synonyms: ['to', 'hasta', 'a', 'to_m', 'a_m', 'tom', 'am'] },
  { key: 'este_m', label: 'Este (m)', required: false, synonyms: ['este_m', 'estem', 'este', 'east', 'east_m', 'eastings', 'easting'] },
  { key: 'norte_m', label: 'Norte (m)', required: false, synonyms: ['norte_m', 'nortem', 'norte', 'north', 'north_m', 'northings', 'northing'] },
  { key: 'elevacion_msnm', label: 'Elevación (msnm)', required: false, synonyms: ['elevacion_msnm', 'elevacionmsnm', 'elevacion', 'elevation', 'cota', 'msnm', 'z'] },
  { key: 'tipo_de_ensayo', label: 'Tipo de Ensayo', required: true, synonyms: ['tipo_de_ensayo', 'tipodeensayo', 'tipo_ensayo', 'tipoensayo', 'test_type', 'testtype'] },
  { key: 'diametro_taladro_nominacion', label: 'Diám. Taladro (Nom)', required: false, synonyms: ['diametro_taladro_nominacion', 'diametrotaladronominacion', 'diametro_nominacion', 'diametro_taladro', 'diametrotaladro', 'size', 'diametrodetaladro', 'diametro_de_taladro'] },
  { key: 'd_mm', label: 'D (mm)', required: true, synonyms: ['d_mm', 'dmm', 'd', 'diametro_mm', 'diametromm', 'caliper_mm'] },
  { key: 'p_instr_kn', label: 'P instr (kN)', required: true, synonyms: ['p_instr_kn', 'pinstrkn', 'p_instr', 'pinstr', 'p_kn', 'load_kn', 'load', 'carga_kn', 'carga'] },
  { key: 'tipo_rotura_code', label: 'Tipo de Rotura', required: false, synonyms: ['tipo_rotura_code', 'tiporoturacode', 'tipo_rotura', 'rotura_tipo', 'failure_type', 'failurecode', 'tipoderotura', 'tiporotura'] },
  { key: 'direccion_rotura_code', label: 'Dirección Rotura', required: false, synonyms: ['direccion_rotura_code', 'direccionroturacode', 'direccion_rotura', 'rotura_direccion', 'failure_dir', 'direccionderotura', 'direccionrotura'] },
  { key: 'ejecutadoPor', label: 'Ejecutado por', required: false, synonyms: ['ejecutadopor', 'ejecutado', 'usuario', 'tested_by', 'testedby'] },
  { key: 'observaciones', label: 'Observaciones', required: false, synonyms: ['observaciones', 'observacion', 'comentarios', 'comentario', 'comments', 'remarks'] }
];

export const EXPECTED_SURVEY_FIELDS: MappingField[] = [
  { key: 'taladro', label: 'Taladro / HOLEID', required: true, synonyms: ['taladro', 'sondaje', 'drillhole', 'holeid', 'taladroid', 'hole_id', 'hole'] },
  { key: 'depth', label: 'Profundidad (m)', required: true, synonyms: ['profundidad', 'depth', 'depthm', 'profundidadm', 'prof'] },
  { key: 'dip', label: 'Dip / Inclinación (°)', required: true, synonyms: ['dip', 'inclinacion', 'dipdeg', 'inclinaciondeg', 'inc'] },
  { key: 'azimuth', label: 'Azimut UTM (°)', required: true, synonyms: ['azimuth', 'azimut', 'azimutm', 'azim_utm', 'azimut_utm', 'azi', 'azm'] }
];

export const EXPECTED_COLLAR_FIELDS: MappingField[] = [
  { key: 'taladro', label: 'Taladro / HOLEID', required: true, synonyms: ['taladro', 'sondaje', 'drillhole', 'holeid', 'taladroid', 'hole_id', 'hole'] },
  { key: 'este', label: 'Este (EAST)', required: true, synonyms: ['este', 'east', 'x', 'este_m', 'east_m'] },
  { key: 'norte', label: 'Norte (NORTH)', required: true, synonyms: ['norte', 'north', 'y', 'norte_m', 'north_m'] },
  { key: 'cota', label: 'Cota (RL)', required: true, synonyms: ['cota', 'rl', 'z', 'elevacion', 'elevation', 'msnm'] },
  { key: 'eoh', label: 'Prof. Final (EOH)', required: true, synonyms: ['eoh', 'profundidad_final', 'prof_final', 'max_depth', 'total_depth'] },
];

export function findHeaderRowGeneric(rows: any[][], expectedFields: MappingField[]): number {
  let bestRowIndex = 0;
  let maxMatches = -1;

  const maxScanRows = Math.min(15, rows.length);
  for (let r = 0; r < maxScanRows; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let matches = 0;
    const normalizedCells = row.map(cell => normalizeHeader(cell));

    expectedFields.forEach(field => {
      const hasMatch = field.synonyms.some(synonym =>
        normalizedCells.some(cellVal => cellVal === synonym)
      );
      if (hasMatch) matches++;
    });

    if (matches > maxMatches) {
      maxMatches = matches;
      bestRowIndex = r;
    }
  }

  return bestRowIndex;
}

export function suggestMappingGeneric(headers: string[], expectedFields: MappingField[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  const usedIndices = new Set<number>();

  const matchField = (field: MappingField, prioritizeExact: boolean) => {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedIndices.has(i)) continue;
      const normHeader = normalizedHeaders[i];
      if (normHeader === field.key) {
        mapping[field.key] = i;
        usedIndices.add(i);
        return true;
      }
    }

    if (prioritizeExact) return false;

    for (const synonym of field.synonyms) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (usedIndices.has(i)) continue;
        const normHeader = normalizedHeaders[i];
        if (normHeader === synonym) {
          mapping[field.key] = i;
          usedIndices.add(i);
          return true;
        }
      }
    }

    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedIndices.has(i)) continue;
      const normHeader = normalizedHeaders[i];
      const hasSubstring = field.synonyms.some(syn => normHeader.includes(syn) || syn.includes(normHeader));
      if (hasSubstring && normHeader.length > 2) {
        mapping[field.key] = i;
        usedIndices.add(i);
        return true;
      }
    }

    return false;
  };

  expectedFields.forEach(field => {
    matchField(field, true);
  });

  expectedFields.forEach(field => {
    if (mapping[field.key] === undefined) {
      matchField(field, false);
    }
  });

  return mapping;
}

export function processExcelDataGeneric(
  rows: any[][],
  headerRowIndex: number,
  mappings: Record<string, number>,
  expectedFields: MappingField[],
  requiredRowCheckKeys: string[]
): ImportSummary {
  const rowsByTaladro: Record<string, any[]> = {};
  const taladrosSet = new Set<string>();
  const campanasSet = new Set<string>();
  let validRowsCount = 0;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const getVal = (key: string) => {
      const idx = mappings[key];
      return idx !== undefined ? row[idx] : undefined;
    };

    let hasRequiredCheck = true;
    for (const chkKey of requiredRowCheckKeys) {
      const chkVal = getVal(chkKey);
      if (chkVal === undefined || chkVal === null || String(chkVal).trim() === '') {
        hasRequiredCheck = false;
        break;
      }
    }
    if (!hasRequiredCheck) {
      continue;
    }

    let taladroName = String(getVal('taladro') || '').trim();
    if (!taladroName || taladroName === 'Comentarios' || taladroName === 'None') {
      taladroName = 'FEGT-SIN-NOMBRE';
    }

    let campanaName = String(getVal('campana') || '').trim();
    if (!campanaName || campanaName === 'None') {
      campanaName = 'SIN-CAMPANA';
    }

    taladrosSet.add(taladroName);
    if (campanaName) campanasSet.add(campanaName);

    const rawRecord: Record<string, any> = {};
    expectedFields.forEach(field => {
      const idx = mappings[field.key];
      rawRecord[field.key] = idx !== undefined ? row[idx] : undefined;
    });

    if (!rowsByTaladro[taladroName]) {
      rowsByTaladro[taladroName] = [];
    }
    rowsByTaladro[taladroName].push(rawRecord);
    validRowsCount++;
  }

  return {
    totalRows: validRowsCount,
    uniqueTaladros: Array.from(taladrosSet).sort(),
    uniqueCampanas: Array.from(campanasSet).sort(),
    rowsByTaladro
  };
}

