export const STRENGTH_RATINGS: Record<string, number> = {
  'R0': 0, 'R1': 1, 'R2': 2, 'R3': 4, 'R4': 7, 'R5': 12, 'R6': 15,
  '0': 0, '1': 1, '2': 2, '3': 4, '4': 7, '5': 12, '6': 15, '-1': 0
};

export const WEATHERING_RATINGS_76: Record<string, number> = {
  'UWF': 5, 'SWD': 4, 'MWM': 3, 'HWA': 1, 'CWC': 0, 'RS': 0, '-1': 0
};

export const WEATHERING_RATINGS_89: Record<string, number> = {
  'UWF': 6, 'SWD': 5, 'MWM': 3, 'HWA': 1, 'CWC': 0, 'RS': 0, '-1': 0
};

export const ROUGHNESS_RATINGS_76: Record<number, number> = {
  1: 5, 2: 4, 3: 3, 4: 4, 5: 3, 6: 1, 7: 3, 8: 1, 9: 0, [-1]: 0
};

export const ROUGHNESS_RATINGS_89: Record<number, number> = {
  1: 6, 2: 5, 3: 3, 4: 5, 5: 3, 6: 1, 7: 3, 8: 1, 9: 0, [-1]: 0
};

export const FILLING_CLASSES: Record<string, number> = {
  'ca': 1, 'sand': 1, 'ch': 1, 'cl': 1, 'gy': 1, 'rxf': 1, 'gou': 1, 'pat': 1,
  'CA': 1, 'SAND': 1, 'CH': 1, 'CL': 1, 'GY': 1, 'RXF': 1, 'GOU': 1, 'PAT': 1,
  'fbx': 2, 'sio': 2, 'qz': 2, 'su': 2, 'ox': 2, 'ep': 2,
  'FBX': 2, 'SIO': 2, 'QZ': 2, 'SU': 2, 'OX': 2, 'EP': 2,
  'cwf': 3, 'CWF': 3
};

// Normalización case-insensitive para códigos de catálogo (ca/CA, cwf/CWF...)
const normCode = (v: any): string => String(v ?? '').trim().toUpperCase();

export function calculateRqdRating(rqdPct: number): number {
  if (rqdPct < 0) return 3;
  if (rqdPct > 100) return 20;
  const val = -0.000006 * Math.pow(rqdPct, 3) + 0.0015 * Math.pow(rqdPct, 2) + 0.0806 * rqdPct + 3.0282;
  return Math.round(val);
}

export function calculateSpacingRating76(spacingMm: number): number {
  if (spacingMm <= 50) return 5;
  if (spacingMm >= 3000) return 30;
  return Math.round(6.038 * Math.log(spacingMm) - 19.63);
}

export function calculateSpacingRating89(spacingMm: number): number {
  if (spacingMm <= 0) return 5;
  if (spacingMm < 850) {
    return Math.round(-0.000005 * Math.pow(spacingMm, 2) + 0.0136 * spacingMm + 5.2849);
  } else if (spacingMm <= 2000) {
    return Math.round(0.0056 * spacingMm + 8.8775);
  } else {
    return 20;
  }
}

export function calculateApertureRating76(apertureMm: number): number {
  if (apertureMm === 0) return 5;
  if (apertureMm < 0.1) return 4;
  if (apertureMm <= 1.0) return 3;
  if (apertureMm <= 5.0) return 1;
  return 0;
}

export function calculateApertureRating89(apertureMm: number): number {
  if (apertureMm === 0) return 6;
  if (apertureMm < 0.1) return 5;
  if (apertureMm <= 1.0) return 3;
  if (apertureMm <= 5.0) return 1;
  return 0;
}

export function calculateFillingRating76(fillingCode: string, thicknessMm: number): number {
  const fClass = FILLING_CLASSES[normCode(fillingCode)] || 1;
  if (thicknessMm === 0 || fClass === 3) return 5;
  if (fClass === 2) {
    return thicknessMm <= 5 ? 4 : 2;
  } else {
    return thicknessMm <= 5 ? 2 : 0;
  }
}

export function calculateFillingRating89(fillingCode: string, thicknessMm: number): number {
  const fClass = FILLING_CLASSES[normCode(fillingCode)] || 1;
  if (thicknessMm === 0 || fClass === 3) return 6;
  if (fClass === 2) {
    return thicknessMm <= 5 ? 4 : 2;
  } else {
    return thicknessMm <= 5 ? 2 : 0;
  }
}

export function calculateWaterRating(depthM: number, waterTableM: number = 97.0) {
  const dryThreshold = waterTableM - 5.0; // 92m
  if (depthM < dryThreshold) {
    return { code: 'CDC', score_76: 10, score_89: 15 };
  } else if (depthM < waterTableM) {
    return { code: 'DPH', score_76: 7, score_89: 10 };
  } else {
    return { code: 'WTM', score_76: 7, score_89: 7 };
  }
}

export function getRockClass(rmrScore: number): string {
  if (rmrScore >= 81) return "Muy Buena";
  if (rmrScore >= 61) return "Buena";
  if (rmrScore >= 41) return "Regular";
  if (rmrScore >= 21) return "Mala";
  return "Muy Mala";
}

export function calculateRowRmr(row: any, waterTableM: number = 97.0) {
  try {
    // --- DETECCIÓN DE DATOS INCOMPLETOS O VACÍOS ---
    const numericFields = ['de', 'a', 'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'frac_nat', 'abertura', 'rugosidad', 'jrc10', 'espesor'];
    for (const key of numericFields) {
      const val = parseFloat(row[key]);
      if (val === undefined || val === null || isNaN(val) || val === -1) {
        return { error: "Datos incompletos" }; // Retorno controlado sin lanzar excepciones
      }
    }

    const stringFields = ['lito1', 'resistencia', 'tipo_est1', 'intemperismo', 'relleno1', 'agua_obs'];
    for (const key of stringFields) {
      const val = row[key];
      if (val === undefined || val === null || val === "" || val === "-1") {
        return { error: "Datos incompletos" };
      }
    }

    const de = parseFloat(row.de);
    const a = parseFloat(row.a);
    const perf = parseFloat((a - de).toFixed(2));

    if (perf <= 0 || perf > 1.6) {
      return { error: "Corrida inválida" };
    }

    const rec_m = parseFloat(row.rec_m);
    const rqd_m = parseFloat(row.rqd_m);

    if (rec_m > perf || rqd_m > rec_m) {
      return { error: "Inconsistencia física" };
    }

    const rec_pct = Math.round(Number(((rec_m / perf) * 100).toFixed(6)));
    const rqd_pct = Math.round(Number(((rqd_m / perf) * 100).toFixed(6)));

    const lrf_m = parseFloat(row.lrf_m);
    const frf = lrf_m > 0 ? Math.floor(Math.round(lrf_m * 100) / 5) + 1 : 0;
    const frac_nat = parseInt(row.frac_nat);
    const total_frac = frac_nat + frf;
    const spacing_mm = Math.round(total_frac > 0 ? (perf / total_frac) * 1000 : perf * 1000);

    const strength = normCode(row.resistencia);
    const aperture = parseFloat(row.abertura);
    const roughness = parseInt(row.rugosidad);
    const filling = row.relleno1;
    const thickness = parseFloat(row.espesor);
    const weathering = normCode(row.intemperismo);

    const s_score = STRENGTH_RATINGS[strength] || 0;
    const rqd_score = calculateRqdRating(rqd_pct);
    const sp_score_76 = calculateSpacingRating76(spacing_mm);
    const sp_score_89 = calculateSpacingRating89(spacing_mm);

    const ab_score_76 = calculateApertureRating76(aperture);
    const ab_score_89 = calculateApertureRating89(aperture);

    const rg_score_76 = ROUGHNESS_RATINGS_76[roughness] || 0;
    const rg_score_89 = ROUGHNESS_RATINGS_89[roughness] || 0;

    const fl_score_76 = calculateFillingRating76(filling, thickness);
    const fl_score_89 = calculateFillingRating89(filling, thickness);

    const wt_score_76 = WEATHERING_RATINGS_76[weathering] || 0;
    const wt_score_89 = WEATHERING_RATINGS_89[weathering] || 0;

    const p_score_76 = Math.round((ab_score_76 + rg_score_76 + fl_score_76 + wt_score_76) / 4);
    const p_score_89 = Math.round((ab_score_89 + rg_score_89 + fl_score_89 + wt_score_89) / 4);

    const j_score_76 = ab_score_76 + rg_score_76 + fl_score_76 + wt_score_76 + p_score_76;
    const j_score_89 = ab_score_89 + rg_score_89 + fl_score_89 + wt_score_89 + p_score_89;

    const water = calculateWaterRating(a, waterTableM);

    const rmr_76 = s_score + rqd_score + sp_score_76 + j_score_76 + water.score_76;
    const rmr_89 = s_score + rqd_score + sp_score_89 + j_score_89 + water.score_89;

    return {
      perf,
      rec_pct,
      rqd_pct,
      spacing_mm,
      frf,
      total_frac,
      ff_1_m: perf > 0 ? Math.round(total_frac / perf) : 0,
      scores: {
        resistencia: s_score,
        rqd: rqd_score,
        spacing_76: sp_score_76,
        spacing_89: sp_score_89,
        juntas_76: j_score_76,
        juntas_89: j_score_89,
        agua_76: water.score_76,
        agua_89: water.score_89,
        abertura_76: ab_score_76,
        abertura_89: ab_score_89,
        rugosidad_76: rg_score_76,
        rugosidad_89: rg_score_89,
        relleno_76: fl_score_76,
        relleno_89: fl_score_89,
        weathering_76: wt_score_76,
        weathering_89: wt_score_89,
        persistencia_76: p_score_76,
        persistencia_89: p_score_89
      },
      rmr_76,
      rmr_89,
      class_76: getRockClass(rmr_76),
      class_89: getRockClass(rmr_89),
      water_code: water.code
    };
  } catch (e) {
    return { error: "Error de cálculo" };
  }
}
