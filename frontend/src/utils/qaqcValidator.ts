export interface ValidationAlert {
  type: 'CRITICAL' | 'WARNING' | 'VACIO' | 'CRITICA' | 'ADVERTENCIA'; // <--- NIVELES DE GRAVEDAD
  field?: string;      // Formato legado (ej. "rec_m-0")
  fieldId?: string;    // Formato SSOT (ej. "lgg-cell-rec_m-0") — coincide con el id del input
  message: string;
  corridaIndex?: number;
  surveyIndex?: number;
}

const WEATHERING_COMPATIBILITY: Record<string, string[]> = {
  'R0': ['RS', 'CWC'],
  'R1': ['HWA', 'CWC'],
  'R2': ['SWD', 'MWM', 'HWA'],
  'R3': ['MWM', 'SWD', 'UWF'],
  'R4': ['SWD', 'MWM', 'UWF'],
  'R5': ['UWF', 'SWD'],
  'R6': ['UWF']
};

export function validateCollarAndSurvey(_collar: any, surveys: any[]): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];
  const eoh = parseFloat(_collar?.prof_final_eoh);
  if (eoh !== undefined && eoh !== null && eoh !== -1 && !isNaN(eoh)) {
    for (let i = 0; i < surveys.length; i++) {
      const sDepth = parseFloat(surveys[i].depth);
      if (!isNaN(sDepth) && sDepth > eoh) {
        alerts.push({
          type: 'CRITICAL',
          field: `survey-depth-${i}`,
          message: `Lectura de Survey #${i + 1} (${sDepth}m) excede la profundidad final EOH oficial (${eoh}m).`,
          surveyIndex: i
        });
      }
    }
  }

  for (let i = 1; i < surveys.length; i++) {
    const prevDip = parseFloat(surveys[i - 1].dip) || 0;
    const currDip = parseFloat(surveys[i].dip) || 0;
    const prevDepth = parseFloat(surveys[i - 1].depth) || 0;
    const currDepth = parseFloat(surveys[i].depth) || 0;

    if (Math.abs(currDip - prevDip) > 2) {
      alerts.push({
        type: 'WARNING',
        field: `survey-dip-${i}`,
        message: `Cambio brusco de Dip (>2°) detectado entre profundidad ${prevDepth.toFixed(2)}m (${prevDip}°) y ${currDepth.toFixed(2)}m (${currDip}°).`,
        surveyIndex: i
      });
    }
  }

  return alerts;
}

export function validateRowQAQC(row: any, index: number, corridas?: any[]): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  try {
    const de = parseFloat(row.de) || 0.0;
    const a = parseFloat(row.a) || 0.0;
    const perf = parseFloat((a - de).toFixed(2));

    const parsedRec = parseFloat(row.rec_m);
    const rec_m = isNaN(parsedRec) || parsedRec < 0 ? 0.0 : parsedRec;

    const parsedRqd = parseFloat(row.rqd_m);
    const rqd_m = isNaN(parsedRqd) || parsedRqd < 0 ? 0.0 : parsedRqd;

    const parsedLrf = parseFloat(row.lrf_m);
    const lrf_m = isNaN(parsedLrf) || parsedLrf < 0 ? 0.0 : parsedLrf;

    const parsedSmall = parseFloat(row.small_frag_m);
    const small_frag_m = isNaN(parsedSmall) || parsedSmall < 0 ? 0.0 : parsedSmall;

    const parsedFracNat = parseInt(row.frac_nat);
    const frac_nat = isNaN(parsedFracNat) || parsedFracNat < 0 ? 0 : parsedFracNat;

    const parsedBuz30 = parseInt(row.frac_buz30);
    const buz30 = isNaN(parsedBuz30) || parsedBuz30 < 0 ? 0 : parsedBuz30;

    const parsedBuz60 = parseInt(row.frac_buz60);
    const buz60 = isNaN(parsedBuz60) || parsedBuz60 < 0 ? 0 : parsedBuz60;

    const parsedBuz90 = parseInt(row.frac_buz90);
    const buz90 = isNaN(parsedBuz90) || parsedBuz90 < 0 ? 0 : parsedBuz90;

    const resistencia = row.resistencia || 'R4';
    const weathering = row.intemperismo || 'UWF';

    const aperture = parseFloat(row.abertura) || 0.0;
    const thickness = parseFloat(row.espesor) || 0.0;

    // --- DETECCIÓN DE CAMPOS VACÍOS (Reglas_Tablas.md) ---
    const mandatoryLggFields = [
      { key: 'de', label: 'de: (m)' },
      { key: 'a', label: 'a: (m)' },
      { key: 'rec_m', label: 'Rec. (m)' },
      { key: 'rqd_m', label: 'RQD (m)' },
      { key: 'lrf_m', label: 'LRF (m)' },
      { key: 'small_frag_m', label: 'Frag <10cm' },
      { key: 'frac_nat', label: 'Frac Nat' },
      { key: 'lito1', label: 'Lito 1' },
      { key: 'resistencia', label: 'Resist ISRM' },
      { key: 'tipo_est1', label: 'Tipo Est 1' },
      { key: 'frac_buz30', label: 'Buz <30°' },
      { key: 'frac_buz60', label: '30°-60°' },
      { key: 'frac_buz90', label: 'Buz >60°' },
      { key: 'abertura', label: 'Abertura' },
      { key: 'rugosidad', label: 'Rugosidad' },
      { key: 'jrc10', label: 'Jrc10' },
      { key: 'intemperismo', label: 'Intemp' },
      { key: 'relleno1', label: 'Relleno 1' },
      { key: 'espesor', label: 'Espesor' },
      { key: 'agua_obs', label: 'Agua' }
    ];

    mandatoryLggFields.forEach(f => {
      const val = row[f.key];
      if (val === undefined || val === null || String(val).trim() === "" || String(val) === "-1" || val === -1) {
        alerts.push({
          type: 'VACIO', // <-- Categorizado como VACIO (Discreto en UI)
          field: `${f.key}-${index}`,
          message: `Fila ${row.corrida}: El campo obligatorio '${f.label}' se encuentra vacío o es -1 (Sin Dato).`,
          corridaIndex: index
        });
      }
    });

    if (corridas && index > 0) {
      const prevA = parseFloat(corridas[index - 1].a) || 0.0;
      if (Math.abs(de - prevA) > 0.001) {
        alerts.push({
          type: 'CRITICAL',
          field: `de-${index}`,
          message: `Fila ${row.corrida}: Ruptura de continuidad espacial detectada: el valor de 'de:' (${de}m) debe ser igual al 'a:' del tramo anterior (${prevA}m).`,
          corridaIndex: index
        });
      }
    }

    if (perf <= 0) {
      alerts.push({
        type: 'CRITICAL',
        field: `a-${index}`,
        message: `Fila ${row.corrida}: Profundidad 'a' (${a}m) debe ser mayor que 'de' (${de}m).`,
        corridaIndex: index
      });
    } else if (perf > 1.6) {
      alerts.push({
        type: 'CRITICAL',
        field: `a-${index}`,
        message: `Fila ${row.corrida}: Longitud de corrida (${perf}m) excede el límite crítico de 1.6m.`,
        corridaIndex: index
      });
    }

    if (rec_m > perf) {
      alerts.push({
        type: 'CRITICAL',
        field: `rec_m-${index}`,
        message: `Fila ${row.corrida}: Longitud recuperada (${rec_m}m) es mayor que el avance perforado (${perf}m).`,
        corridaIndex: index
      });
    }

    if (rqd_m > rec_m) {
      alerts.push({
        type: 'CRITICAL',
        field: `rqd_m-${index}`,
        message: `Fila ${row.corrida}: RQD (${rqd_m}m) es mayor que la longitud recuperada (${rec_m}m).`,
        corridaIndex: index
      });
    }

    if (lrf_m > rec_m) {
      alerts.push({
        type: 'CRITICAL',
        field: `lrf_m-${index}`,
        message: `Fila ${row.corrida}: Longitud de roca fracturada LRF (${lrf_m}m) es mayor que la longitud recuperada (${rec_m}m).`,
        corridaIndex: index
      });
    }

    const rqd_val = rqd_m < 0 ? 0.0 : rqd_m;
    const lrf_val = lrf_m < 0 ? 0.0 : lrf_m;
    const small_val = small_frag_m < 0 ? 0.0 : small_frag_m;
    const sumFrags = parseFloat((rqd_val + lrf_val + small_val).toFixed(2));
    if (sumFrags > perf) {
      alerts.push({
        type: 'CRITICAL',
        field: `rqd_m-${index}`,
        message: `Fila ${row.corrida}: La suma de fragmentos (${sumFrags}m) supera el avance perforado (${perf}m).`,
        corridaIndex: index
      });
    }

    const b30_val = buz30 < 0 ? 0 : buz30;
    const b60_val = buz60 < 0 ? 0 : buz60;
    const b90_val = buz90 < 0 ? 0 : buz90;
    const fn_val = frac_nat < 0 ? 0 : frac_nat;
    const sumBins = b30_val + b60_val + b90_val;
    if (sumBins !== fn_val) {
      alerts.push({
        type: 'WARNING',
        field: `frac_nat-${index}`,
        message: `Fila ${row.corrida}: La suma de fracturas por buzamiento (${sumBins}) no coincide con el conteo general (${fn_val}).`,
        corridaIndex: index
      });
    }

    const exceptions = ["F", "RF", "VN", "SZ", "F+10", "BED"];
    const tipo_est1 = row.tipo_est1 || "";
    const tipo_est2 = row.tipo_est2 || "";
    if (thickness > aperture && !exceptions.includes(tipo_est1) && !exceptions.includes(tipo_est2)) {
      alerts.push({
        type: 'CRITICAL',
        field: `espesor-${index}`,
        message: `Fila ${row.corrida}: El espesor de relleno (${thickness}mm) no puede ser mayor que la abertura (${aperture}mm), excepto para estructuras F, RF, VN, SZ, F+10, BED.`,
        corridaIndex: index
      });
    }

    if (thickness > 0 && aperture <= 0) {
      alerts.push({
        type: 'WARNING',
        field: `abertura-${index}`,
        message: `Fila ${row.corrida}: Se declaró espesor de relleno de ${thickness}mm, pero la abertura es 0mm.`,
        corridaIndex: index
      });
    } else if (thickness === 0 && aperture > 0) {
      alerts.push({
        type: 'WARNING',
        field: `espesor-${index}`,
        message: `Fila ${row.corrida}: La abertura es de ${aperture}mm, pero no se ha registrado espesor de relleno.`,
        corridaIndex: index
      });
    }

    const validWeatherings = WEATHERING_COMPATIBILITY[resistencia];
    if (validWeatherings && !validWeatherings.includes(weathering)) {
      alerts.push({
        type: 'WARNING',
        field: `intemperismo-${index}`,
        message: `Fila ${row.corrida}: Incompatibilidad geológica (Resistencia ${resistencia} con Intemperismo ${weathering}). Permitidos: ${validWeatherings.join(', ')}.`,
        corridaIndex: index
      });
    }
  } catch (e) {
    alerts.push({
      type: 'CRITICAL',
      field: `global-${index}`,
      message: `Fila ${row.corrida}: Error al validar corrida.`,
      corridaIndex: index
    });
  }

  return alerts;
}

export function validateStructuralQAQC(discontinuidades: any[], corridas: any[]): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  discontinuidades.forEach((d, idx) => {
    try {
      const depth = parseFloat(d.profundidad);
      const idStr = d.id || (idx + 1);

      // --- DETECCIÓN DE CAMPOS VACÍOS (Reglas_Tablas.md) ---
      const mandatoryStructFields = [
        { key: 'profundidad', label: 'Profundidad' },
        { key: 'tipo_estructura', label: 'Tipo Estructura' },
        { key: 'alfa', label: 'Alfa' },
        { key: 'beta', label: 'Beta' },
        { key: 'forma', label: 'Forma' },
        { key: 'rugosidad', label: 'Rugosidad' },
        { key: 'jrc10', label: 'JRC10' },
        { key: 'abertura', label: 'Abertura' },
        { key: 'weathering', label: 'Grado Intemp.' },
        { key: 'espesor', label: 'Espesor' },
        { key: 'relleno1', label: 'Relleno 1' },
        { key: 'dureza_pared', label: 'Dureza pared' },
        { key: 'agua', label: 'Presen. Agua' },
        { key: 'geotecnico', label: 'Geotécnico' },
        { key: 'tipo', label: 'Tipo' }
      ];

      mandatoryStructFields.forEach(f => {
        const val = d[f.key];
        if (val === undefined || val === null || String(val).trim() === "" || String(val) === "-1" || val === -1) {
          alerts.push({
            type: 'VACIO', // <-- Categorizado como VACIO
            field: `struct-${f.key}-${idx}`,
            message: `Fila ${idStr}: El campo obligatorio '${f.label}' se encuentra vacío o es -1 (Sin Dato).`
          });
        }
      });

      if (isNaN(depth)) {
        alerts.push({
          type: 'CRITICAL',
          field: `struct-profundidad-${idx}`,
          message: `Fila ${idStr}: La profundidad no es un número válido.`
        });
        return;
      }

      const hasRunMatch = corridas.some(c => (depth >= c.de && depth < c.a) || depth === c.a);
      if (!hasRunMatch) {
        alerts.push({
          type: 'CRITICAL',
          field: `struct-profundidad-${idx}`,
          message: `Fila ${idStr}: Profundidad huérfana (${depth.toFixed(2)}m) no corresponde a ningún tramo de corrida en LGG.`,
        });
      }

      const estDe = parseFloat(d.de);
      const estA = parseFloat(d.a);
      if (!isNaN(estDe) && !isNaN(estA)) {
        const hasExactRun = corridas.some(c => Math.abs(c.de - estDe) < 0.001 && Math.abs(c.a - estA) < 0.001);
        if (!hasExactRun) {
          alerts.push({
            type: 'CRITICAL',
            field: `struct-de-${idx}`,
            message: `Fila ${idStr}: La corrida asociada de: ${estDe}m y a: ${estA}m no coincide exactamente con ninguna corrida registrada en LGG.`
          });
        }
        if (depth < estDe || depth > estA) {
          alerts.push({
            type: 'CRITICAL',
            field: `struct-profundidad-${idx}`,
            message: `Fila ${idStr}: La profundidad (${depth}m) está fuera del intervalo especificado para la corrida (de: ${estDe}m, a: ${estA}m).`
          });
        }
      }

      const alfa = parseFloat(d.alfa);
      if (!isNaN(alfa)) {
        if (alfa !== -1 && (alfa < 0 || alfa > 90)) {
          alerts.push({
            type: 'CRITICAL',
            field: `struct-alfa-${idx}`,
            message: `Fila ${idStr}: El ángulo Alfa (${alfa}°) es inválido. Debe estar entre 0° y 90°, o ser -1.`
          });
        }
      }

      const beta = parseFloat(d.beta);
      if (!isNaN(beta)) {
        if (beta !== -1 && (beta < 0 || beta > 360)) {
          alerts.push({
            type: 'CRITICAL',
            field: `struct-beta-${idx}`,
            message: `Fila ${idStr}: El ángulo Beta (${beta}°) es inválido. Debe estar entre 0° y 360°, o ser -1.`
          });
        }
      }

      const jrc10 = parseInt(d.jrc10);
      if (!isNaN(jrc10)) {
        if (jrc10 > 20) {
          alerts.push({
            type: 'CRITICAL',
            field: `struct-jrc10-${idx}`,
            message: `Fila ${idStr}: El valor de JRC10 (${jrc10}) es inválido. No se permiten valores mayores a 20.`
          });
        } else if (jrc10 < 0) {
          alerts.push({
            type: 'CRITICAL',
            field: `struct-jrc10-${idx}`,
            message: `Fila ${idStr}: El valor de JRC10 (${jrc10}) no puede ser negativo.`
          });
        }
      }

      const abertura = parseFloat(d.abertura) || 0.0;
      const espesor = parseFloat(d.espesor) || 0.0;
      const relleno1 = d.relleno1 || 'cwf';
      const tipo_est = d.tipo_estructura || "";

      const exceptions = ["F", "RF", "VN", "SZ", "F+10", "BED"];
      if (espesor > abertura && !exceptions.includes(tipo_est)) {
        alerts.push({
          type: 'CRITICAL',
          field: `struct-espesor-${idx}`,
          message: `Fila ${idStr}: El espesor de relleno (${espesor}mm) no puede ser mayor que la abertura de junta (${abertura}mm), excepto en estructuras F, RF, VN, SZ, F+10, BED.`
        });
      }

      if (espesor > 0 && (relleno1 === 'cwf' || relleno1 === '-1')) {
        alerts.push({
          type: 'WARNING',
          field: `struct-relleno1-${idx}`,
          message: `Fila ${idStr}: Se declaró espesor de relleno de ${espesor}mm, pero el tipo de relleno está limpio/sin definir.`,
        });
      } else if (relleno1 !== 'cwf' && relleno1 !== '-1') {
        if (abertura === 0) {
          alerts.push({
            type: 'WARNING',
            field: `struct-abertura-${idx}`,
            message: `Fila ${idStr}: Se declaró tipo de relleno (${relleno1}), pero la abertura es 0mm.`,
          });
        }
        if (espesor === 0) {
          alerts.push({
            type: 'WARNING',
            field: `struct-espesor-${idx}`,
            message: `Fila ${idStr}: Se declaró tipo de relleno (${relleno1}), pero el espesor es 0mm.`,
          });
        }
      }

      const forma = parseInt(d.forma);
      let validJrcValues: number[] = [];

      switch (forma) {
        case 1: validJrcValues = [6]; break;
        case 2: validJrcValues = [5, 6]; break;
        case 3: validJrcValues = [4, 5]; break;
        case 4: validJrcValues = [3, 4]; break;
        case 5: validJrcValues = [2, 3]; break;
        case 6: validJrcValues = [2, 7]; break;
        case 7: validJrcValues = [1, 2]; break;
        case 8: validJrcValues = [1]; break;
        case 9: validJrcValues = [1]; break;
        case -1: validJrcValues = [-1]; break;
      }

      if (validJrcValues.length > 0 && !validJrcValues.includes(jrc10)) {
        alerts.push({
          type: 'WARNING',
          field: `struct-jrc10-${idx}`,
          message: `Fila ${idStr}: Inconsistencia Forma vs JRC10 (Forma ${forma} con JRC10 ${jrc10}). Valores permitidos: ${validJrcValues.join(' o ')}.`
        });
      }

    } catch (e) {
      alerts.push({
        type: 'CRITICAL',
        field: `struct-global-${idx}`,
        message: `Fila ${idx + 1}: Error al evaluar validaciones QA/QC.`
      });
    }
  });

  return alerts;
}

export function validatePltQAQC(plts: any[], corridas: any[], collar: any): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];
  const collarEste = parseFloat(collar.collar_este) || 0;
  const collarNorte = parseFloat(collar.collar_norte) || 0;
  const collarCota = parseFloat(collar.collar_cota) || 0;

  plts.forEach((plt, idx) => {
    const idStr = plt.nro_muestra || `Muestra #${idx + 1}`;

    try {
      const from = parseFloat(plt.from_m) || 0.0;
      const to = parseFloat(plt.to_m) || 0.0;
      const d = parseFloat(plt.d_mm) || 0.0;
      const p_instr = parseFloat(plt.p_instr_kn) || 0.0;
      const long_muestra = parseFloat(plt.long_de_muestra_mm) || 0.0;
      const is_50_mpa = parseFloat(plt.is_50_mpa) || 0.0;
      const ucs = parseFloat(plt.ucs) || 0.0;
      const tipo_rotura = String(plt.tipo_rotura_code || '').trim().toUpperCase();

      // --- DETECCIÓN DE CAMPOS VACÍOS (Reglas_Tablas.md) ---
      const mandatoryPltFields = [
        { key: 'fecha', label: 'Fecha' },
        { key: 'nro_muestra', label: 'Nro Muestra' },
        { key: 'nro_caja', label: 'Nro Caja' },
        { key: 'corrida_desde', label: 'Corrida Desde' },
        { key: 'corrida_hasta', label: 'Corrida Hasta' },
        { key: 'from_m', label: 'From' },
        { key: 'to_m', label: 'To' },
        { key: 'este_m', label: 'Este' },
        { key: 'norte_m', label: 'Norte' },
        { key: 'elevacion_msnm', label: 'Elevación' },
        { key: 'tipo_de_ensayo', label: 'Tipo de Ensayo' },
        { key: 'diametro_taladro_nominacion', label: 'Diám. Taladro' },
        { key: 'litologia_1', label: 'Litología 1' },
        { key: 'd_mm', label: 'D (mm)' },
        { key: 'p_instr_kn', label: 'P instr (kN)' },
        { key: 'tipo_rotura_code', label: 'Tipo de Rotura' },
        { key: 'direccion_rotura_code', label: 'Dirección Rotura' },
        { key: 'ejecutadoPor', label: 'Ejecutado por' }
      ];

      mandatoryPltFields.forEach(f => {
        const val = plt[f.key];
        if (val === undefined || val === null || String(val).trim() === "" || String(val) === "-1" || val === -1) {
          alerts.push({
            type: 'VACIO', // <-- Categorizado como VACIO
            field: `plt-${f.key}-${idx}`,
            message: `PLT ${idStr}: El campo obligatorio '${f.label}' se encuentra vacío o es -1 (Sin Dato).`
          });
        }
      });

      if (from > to) {
        alerts.push({
          type: 'CRITICAL',
          field: `plt-from_m-${idx}`,
          message: `PLT ${idStr}: Profundidad inicial (From: ${from}m) es mayor que la final (To: ${to}m).`,
        });
      }

      if (is_50_mpa > 25) {
        alerts.push({
          type: 'WARNING',
          field: `plt-is_50_mpa-${idx}`,
          message: `PLT ${idStr}: Is(50) anómalo detectado (${is_50_mpa.toFixed(2)} MPa > 25 MPa). Verifique los datos de carga e ingresos.`,
        });
      }

      if (ucs < 0 || ucs > 500) {
        alerts.push({
          type: 'CRITICAL',
          field: `plt-ucs-${idx}`,
          message: `PLT ${idStr}: UCS fuera de rango físico (${ucs.toFixed(1)} MPa). Verifique las dimensiones o la carga aplicada.`,
        });
      }

      const validRoturas = ['M', 'E', 'C'];
      if (tipo_rotura && !validRoturas.includes(tipo_rotura)) {
        alerts.push({
          type: 'WARNING',
          field: `plt-tipo_rotura_code-${idx}`,
          message: `PLT ${idStr}: Código de tipo de rotura no reconocido ("${tipo_rotura}"). Debe ser M (Matriz), E (Estructura) o C (Combinada).`,
        });
      }

      const matchingCorrida = corridas.find(c => c.de <= from && to <= c.a);
      const de_limite = matchingCorrida ? matchingCorrida.de : (parseFloat(plt.corrida_desde) || 0.0);
      const a_limite = matchingCorrida ? matchingCorrida.a : (parseFloat(plt.corrida_hasta) || 0.0);

      if (!matchingCorrida) {
        alerts.push({
          type: 'CRITICAL',
          field: `plt-from_m-${idx}`,
          message: `PLT ${idStr}: El intervalo [${from}m - ${to}m] es huérfano (no coincide con ninguna corrida registrada en LGG).`,
        });
      } else if (from < de_limite || to > a_limite) {
        alerts.push({
          type: 'CRITICAL',
          field: `plt-from_m-${idx}`,
          message: `PLT ${idStr}: El intervalo [${from}m - ${to}m] se encuentra fuera de los límites de la corrida [${de_limite}m - ${a_limite}m].`,
        });
      } else {
        const pltLito1 = String(plt.litologia_1 || '').trim().toUpperCase();
        const lggLito1 = String(matchingCorrida.lito1 || '').trim().toUpperCase();
        if (pltLito1 && pltLito1 !== '-' && lggLito1 && lggLito1 !== '-' && pltLito1 !== lggLito1) {
          alerts.push({
            type: 'WARNING',
            field: `plt-litologia_1-${idx}`,
            message: `PLT ${idStr}: Discrepancia de Litología. El ensayo registra "${pltLito1}", pero la corrida correspondiente en LGG registra "${lggLito1}".`,
          });
        }

        const pltRes = plt.isrm_indice_r;
        const lggRes = matchingCorrida.resistencia;

        if (pltRes && lggRes && lggRes !== '-1' && pltRes !== 'Suelo') {
          const pltNum = parseInt(pltRes.replace('R', '')) || 0;
          const lggNum = parseInt(lggRes.replace('R', '')) || 0;

          if (Math.abs(pltNum - lggNum) > 1) {
            alerts.push({
              type: 'WARNING',
              field: `plt-ucs-${idx}`,
              message: `PLT ${idStr}: Discrepancia Geomecánica. El UCS calculado de ${ucs.toFixed(1)} MPa clasifica como "${pltRes}", pero el geólogo estimó visualmente "${lggRes}" en LGG.`,
            });
          }
        }
      }

      if (long_muestra < d) {
        alerts.push({
          type: 'CRITICAL',
          field: `plt-long_de_muestra_mm-${idx}`,
          message: `PLT ${idStr}: La longitud de la muestra (${long_muestra} mm) es menor que el diámetro D (${d} mm). Condición L < D inválida.`,
        });
      }

      if (p_instr <= 0) {
        alerts.push({
          type: 'WARNING',
          field: `plt-p_instr_kn-${idx}`,
          message: `PLT ${idStr}: Carga instrumental P instr (${p_instr} kN) debe ser mayor que 0.`,
        });
      }

      const este = parseFloat(plt.este_m) || 0.0;
      const norte = parseFloat(plt.norte_m) || 0.0;
      const elev = parseFloat(plt.elevacion_msnm) || 0.0;

      if (este !== 0 && Math.abs(este - collarEste) > 1000) {
        alerts.push({
          type: 'WARNING',
          field: `plt-este_m-${idx}`,
          message: `PLT ${idStr}: Coordenada Este (${este}m) difiere en más de 1 km del collar (${collarEste}m).`,
        });
      }
      if (norte !== 0 && Math.abs(norte - collarNorte) > 1000) {
        alerts.push({
          type: 'WARNING',
          field: `plt-norte_m-${idx}`,
          message: `PLT ${idStr}: Coordenada Norte (${norte}m) difiere en más de 1 km del collar (${collarNorte}m).`,
        });
      }
      if (elev !== 0 && Math.abs(elev - collarCota) > 500) {
        alerts.push({
          type: 'WARNING',
          field: `plt-elevacion_msnm-${idx}`,
          message: `PLT ${idStr}: Elevación (${elev} msnm) difiere significativamente de la cota del collar (${collarCota} msnm).`,
        });
      }

    } catch (e) {
      alerts.push({
        type: 'CRITICAL',
        field: `plt-global-${idx}`,
        message: `PLT ${idStr}: Error al evaluar validaciones QA/QC.`,
      });
    }
  });

  return alerts;
}