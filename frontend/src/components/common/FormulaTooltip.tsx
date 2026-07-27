import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

// ─── DEFINICIÓN DE FÓRMULA ──────────────────────────────────────────────────
export interface FormulaDef {
  title: string;
  equation: string;
  description: string;
  inputs: string[];
  calcExplanation?: (params?: Record<string, any>) => string;
}

// ─── DICCIONARIO MAESTRO DE FÓRMULAS ────────────────────────────────────────
export const FORMULA_DEFS: Record<string, FormulaDef> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // █  LGG — Fórmulas de Corridas Geotécnicas
  // ═══════════════════════════════════════════════════════════════════════════

  lgg_perf: {
    title: "Perforación (m)",
    equation: "Perf. = A − De",
    description: "Longitud total perforada en el tramo. Se calcula como la diferencia entre la profundidad final (A) y la profundidad inicial (De) de la corrida.",
    inputs: ["Profundidad De (m)", "Profundidad A (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.a ?? '—'} − ${p.de ?? '—'} = ${p.val ?? '—'} m`;
    }
  },

  lgg_rec_check: {
    title: "QA/QC — Perf./LR",
    equation: 'Validez = (LR ≤ Perf.) → ✓ / ✗',
    description: "Si la Longitud Recuperada supera la Perforación, se genera una alerta de inconsistencia física. Condición: LR no puede ser mayor que Perf.",
    inputs: ["Long. Recuperada (m)", "Perforación (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `LR: ${p.rec ?? '—'} m ≤ Perf: ${p.perf ?? '—'} m → ${p.valid ? '✓ OK' : '✗ ERROR'}`;
    }
  },

  lgg_frf: {
    title: "FRF — Fracturas de Roca Fracturada",
    equation: "FRF = FLOOR((LRF × 100) / 5) + 1",
    description: "Cálculo del número de fracturas estimadas a partir de la longitud de roca fracturada. Si LRF = 0, FRF = 0.",
    inputs: ["Long. Roca Fracturada (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      const lrf = p.lrf ?? 0;
      return `FLOOR((${lrf} × 100) / 5) + 1 = ${p.val ?? '—'}`;
    }
  },

  lgg_sum_control: {
    title: "∑ RQD + LRF + Frag's<10",
    equation: "∑ = RQD(m) + LRF(m) + Frag<10(m)",
    description: "Sumatoria de control del balance físico del testigo. La suma de los tres componentes debe ser igual o menor a la longitud recuperada.",
    inputs: ["∑ Frag's ≥ 10 cm (m)", "Long. Roca Fracturada (m)", "∑ Frag's < 10 cm (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.rqd ?? 0} + ${p.lrf ?? 0} + ${p.small ?? 0} = ${p.val ?? '—'} m`;
    }
  },

  lgg_sum_control_check: {
    title: "QA/QC — Balance Físico LR/(RQD+LRF)",
    equation: "Validez = (∑ ≤ Perf.) ∧ (RQD ≤ LR)",
    description: "Verifica que la sumatoria reconstruida del testigo no supere la perforación, y que el metraje de fragmentos de RQD no supere la longitud recuperada.",
    inputs: ["∑ RQD+LRF+Frag<10", "Perforación (m)", "RQD (m)", "Long. Recuperada (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `∑: ${p.sum ?? '—'} ≤ Perf: ${p.perf ?? '—'} ∧ RQD: ${p.rqd ?? '—'} ≤ LR: ${p.rec ?? '—'} → ${p.valid ? '✓ OK' : '✗ ERROR'}`;
    }
  },

  lgg_sum_frac: {
    title: "∑ Fracturas Naturales por Buzamiento",
    equation: "∑ = Buz<30° + 30°<Buz<60° + Buz>60°",
    description: "Sumatoria de fracturas naturales clasificadas por ángulo de buzamiento. Debe coincidir exactamente con el N° de Fracturas Naturales declared.",
    inputs: ["Frac Buz<30°", "Frac 30°-60°", "Frac Buz>60°"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.buz30 ?? 0} + ${p.buz60 ?? 0} + ${p.buz90 ?? 0} = ${p.val ?? '—'}`;
    }
  },

  lgg_alert_fn: {
    title: "QA/QC — Conteo de Fracturas Naturales",
    equation: "Validez = (∑Buz = Frac.Nat.Total)",
    description: "Lanza advertencia si la sumatoria de fracturas por buzamiento no coincide exactamente con el total de fracturas naturales declarado.",
    inputs: ["∑ Fracturas por Buzamiento", "N° Fracturas Naturales"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `∑Buz: ${p.sumBuz ?? '—'} = Frac.Nat: ${p.fracNat ?? '—'} → ${p.valid ? '✓ Coincide' : '✗ No coincide'}`;
    }
  },

  lgg_alert_abert_rell: {
    title: "QA/QC — Abertura vs Relleno",
    equation: "Validez = ¬(Espesor>0 ∧ Abertura=0) ∧ ¬(Espesor=0 ∧ Abertura>0)",
    description: "Lanza advertencia si se declara un espesor de relleno mayor a 0 mm pero la abertura de junta es 0 mm, o viceversa.",
    inputs: ["Abertura (mm)", "Espesor Relleno (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Abertura: ${p.abertura ?? '—'} mm | Espesor: ${p.espesor ?? '—'} mm → ${p.valid ? '✓ Consistente' : '✗ Inconsistente'}`;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // █  RMR — Rating del Macizo Rocoso (compartido LGG + RMR Grid)
  // ═══════════════════════════════════════════════════════════════════════════

  rmr_field_lgg_import: {
    title: "Dato Importado de LGG",
    equation: "Valor = LGG[Corrida]." + "Campo",
    description: "Valor heredado directamente del registro geotécnico de corridas LGG para la corrida actual.",
    inputs: ["Hoja LGG", "N° Corrida"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Campo "${p.campo ?? 'Dato'}": ${p.val ?? '—'} (Heredado de LGG)`;
    }
  },

  rmr_lito_heredada: {
    title: "Litología Heredada de LGG",
    equation: "Litología = LGG[Corrida].Lito",
    description: "Combinación litológica registrada en la corrida correspondiente de LGG.",
    inputs: ["Lito 1", "Lito 2", "Lito 3"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Corrida #${p.corrida ?? '—'} → Lito1: "${p.lito1 || '—'}" | Lito2: "${p.lito2 || '-'}" | Lito3: "${p.lito3 || '-'}"`;
    }
  },

  rmr_de_a: {
    title: "Profundidades Desde / Hasta",
    equation: "Tramo = [Desde(m), Hasta(m)]",
    description: "Intervalo de profundidad en metros correspondiente a la corrida de LGG.",
    inputs: ["Profundidad De (m)", "Profundidad A (m)"],
    calcExplanation: (p) => `Corrida #${p?.corrida ?? '—'}: [${p?.de ?? '—'}m , ${p?.a ?? '—'}m]`
  },

  rmr_rec_pct: {
    title: "Porcentaje de Recuperación Rec(%)",
    equation: "Rec(%) = ROUND((Rec(m) / Perf(m)) × 100, 0)",
    description: "Porcentaje de recuperación del testigo de roca respecto a la longitud perforada del tramo.",
    inputs: ["Long. Recuperada (m)", "Perforación (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `ROUND((${p.rec ?? 0} / ${p.perf ?? 1}) × 100) = ${p.val ?? '—'}%`;
    }
  },

  rmr_rqd_pct: {
    title: "Rock Quality Designation RQD(%)",
    equation: "RQD(%) = ROUND((RQD(m) / Perf(m)) × 100, 0)",
    description: "Porcentaje de calidad del macizo rocoso calculado como el cociente de fragmentos ≥ 10 cm respecto al avance perforado.",
    inputs: ["Metraje RQD ≥ 10cm (m)", "Perforación (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `ROUND((${p.rqd ?? 0} / ${p.perf ?? 1}) × 100) = ${p.val ?? '—'}%`;
    }
  },

  rmr_total_frac: {
    title: "Total de Fracturas",
    equation: "Total Fracturas = FRF + Frac. Naturales",
    description: "Sumatoria del número de fracturas en zonas trituradas (FRF) y las fracturas naturales observadas.",
    inputs: ["FRF (Zonas trituradas)", "N° Fracturas Naturales"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.frf ?? 0} (FRF) + ${p.fracNat ?? 0} (FracNat) = ${p.val ?? '—'}`;
    }
  },

  rmr_ff_1_m: {
    title: "Frecuencia de Fracturas FF/1m",
    equation: "FF/1m = ROUND(Total Fracturas / Perf(m), 0)",
    description: "Frecuencia de fracturamiento por metro lineal redondeada a número entero según Reglas.md.",
    inputs: ["Total de Fracturas", "Perforación (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `ROUND(${p.totalFrac ?? 0} / ${p.perf ?? 1}, 0) = ${p.val ?? '—'} frac/m`;
    }
  },

  rmr_spacing_calc: {
    title: "Espaciamiento Medio Calculado (mm)",
    equation: "TotalFrac > 0 → ROUND((Perf(m) / TotalFrac) × 1000, 0)\nTotalFrac = 0 → ROUND(Perf(m) × 1000, 0)",
    description: "Espaciamiento medio entre discontinuidades en milímetros. Si Total Fracturas es 0, el espaciamiento es la longitud total perforada en mm.",
    inputs: ["Perforación (m)", "Total de Fracturas"],
    calcExplanation: (p) => {
      if (!p) return "";
      const tf = p.totalFrac ?? 0;
      return tf > 0
        ? `ROUND((${p.perf ?? 0} / ${tf}) × 1000) = ${p.val ?? '—'} mm`
        : `ROUND(${p.perf ?? 0} × 1000) = ${p.val ?? '—'} mm`;
    }
  },

  rmr_clasif_relleno: {
    title: "Clasificación de Relleno (Categoría)",
    equation: "1 = Relleno Blando | 2 = Relleno Duro | 3 = Sin Relleno",
    description: "Categorización del mineral de relleno para la tabla de valoración. Blando: ca, sand, ch, cl, gy, RXF, GOU, PAT. Duro: FBX, SIO, QZ, SU, OX, ep. Sin Relleno: cwf.",
    inputs: ["Código de Relleno 1"],
    calcExplanation: (p) => `Código: "${p?.code || '—'}" → Categoría: ${p?.val ?? '—'}`
  },

  rmr_strength: {
    title: "Rating de Resistencia (ISRM)",
    equation: "Rating = Lookup(R0→0, R1→1, R2→2, R3→4, R4→7, R5→12, R6→15)",
    description: "Puntaje de resistencia según la escala ISRM del martillo de campo. Aplica idéntico a RMR'76 y RMR'89.",
    inputs: ["Resistencia estimada ISRM"],
    calcExplanation: (p) => `Grado: "${p?.code || '—'}" → Rating: ${p?.val ?? '—'}`
  },

  rmr_rqd: {
    title: "Rating RQD (Polinómica Cúbica)",
    equation: "R = ROUND(−0.000006×RQD³ + 0.0015×RQD² + 0.0806×RQD + 3.0282, 0)",
    description: "Puntuación de RQD mediante la ecuación polinómica cúbica continua. Se aplica idéntico a RMR'76 y RMR'89.",
    inputs: ["RQD (%)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `RQD: ${p.rqd ?? '—'}% → Rating: ${p.val ?? '—'}`;
    }
  },

  rmr_spacing_76: {
    title: "Rating Espaciamiento (RMR'76)",
    equation: "R = ROUND(6.038 × ln(S) − 19.63, 0)",
    description: "Ecuación logarítmica para espaciamientos entre 50 y 3000 mm. Menor a 50mm = 5pts; mayor a 3000mm = 30pts.",
    inputs: ["Espaciamiento (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `S: ${p.spacing ?? '—'} mm → ROUND(6.038 × ln(${p.spacing ?? 0}) − 19.63) = ${p.val ?? '—'}`;
    }
  },

  rmr_spacing_89: {
    title: "Rating Espaciamiento (RMR'89)",
    equation: "S<850: R = ROUND(−0.000005×S² + 0.0136×S + 5.2849)\n850≤S≤2000: R = ROUND(0.0056×S + 8.8775)\nS>2000: R = 20",
    description: "Ecuación cuadrática/lineal por tramos según Bieniawski 1989. Capado a 20 pts máximo.",
    inputs: ["Espaciamiento (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      const s = p.spacing ?? 0;
      const tramo = s < 850 ? "cuadrático (<850mm)" : s <= 2000 ? "lineal (850-2000mm)" : "cap máx (>2000mm)";
      return `S: ${s} mm (${tramo}) → Rating: ${p.val ?? '—'}`;
    }
  },

  rmr_aperture_76: {
    title: "Rating Abertura (RMR'76)",
    equation: "0mm→5 | <0.1mm→4 | 0.1-1.0mm→3 | 1-5mm→1 | >5mm→0",
    description: "Puntaje de abertura de junta por rangos según Bieniawski 1976.",
    inputs: ["Abertura (mm)"],
    calcExplanation: (p) => `Abertura: ${p?.aperture ?? '—'} mm → Rating: ${p?.val ?? '—'}`
  },

  rmr_aperture_89: {
    title: "Rating Abertura (RMR'89)",
    equation: "0mm→6 | <0.1mm→5 | 0.1-1.0mm→3 | 1-5mm→1 | >5mm→0",
    description: "Puntaje de abertura de junta por rangos según Bieniawski 1989.",
    inputs: ["Abertura (mm)"],
    calcExplanation: (p) => `Abertura: ${p?.aperture ?? '—'} mm → Rating: ${p?.val ?? '—'}`
  },

  rmr_roughness_76: {
    title: "Rating Rugosidad (RMR'76)",
    equation: "Rating = Catálogo(Perfil 1-9) → (5,4,3,4,3,1,3,1,0)",
    description: "Puntaje correspondiente al perfil de rugosidad ISRM (1 = Plana Escalonada → 9 = Rugosa Suave).",
    inputs: ["Rugosidad (ISRM)"],
    calcExplanation: (p) => `Perfil: ${p?.roughness ?? '—'} → Rating: ${p?.val ?? '—'}`
  },

  rmr_roughness_89: {
    title: "Rating Rugosidad (RMR'89)",
    equation: "Rating = Catálogo(Perfil 1-9) → (6,5,3,5,3,1,3,1,0)",
    description: "Puntaje correspondiente al perfil de rugosidad para RMR'89.",
    inputs: ["Rugosidad (ISRM)"],
    calcExplanation: (p) => `Perfil: ${p?.roughness ?? '—'} → Rating: ${p?.val ?? '—'}`
  },

  rmr_filling_76: {
    title: "Rating Relleno (RMR'76)",
    equation: "Sin relleno → 5 | Duro ≤5mm → 4 | Duro >5mm → 2 | Blando ≤5mm → 2 | Blando >5mm → 0",
    description: "Valoración según dureza y espesor. Espesores ≤ 5.0 mm se evalúan en la categoría <=5mm.",
    inputs: ["Tipo de Relleno", "Espesor (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Código: "${p.code || '—'}" | Espesor: ${p.thickness ?? '—'} mm → Rating: ${p.val ?? '—'}`;
    }
  },

  rmr_filling_89: {
    title: "Rating Relleno (RMR'89)",
    equation: "Sin relleno → 6 | Duro ≤5mm → 4 | Duro >5mm → 2 | Blando ≤5mm → 2 | Blando >5mm → 0",
    description: "Valoración según dureza y espesor para RMR'89. Espesores ≤ 5.0 mm se evalúan en la categoría <=5mm.",
    inputs: ["Tipo de Relleno", "Espesor (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Código: "${p.code || '—'}" | Espesor: ${p.thickness ?? '—'} mm → Rating: ${p.val ?? '—'}`;
    }
  },

  rmr_weathering_76: {
    title: "Rating Intemperismo (RMR'76)",
    equation: "UWF→5 | SWD→4 | MWM→3 | HWA→1 | CWC/RS→0",
    description: "Puntaje de meteorización/intemperismo de las paredes de la discontinuidad según Bieniawski 1976.",
    inputs: ["Grado Intemperismo (ISRM)"],
    calcExplanation: (p) => `Grado: "${p?.code || '—'}" → Rating: ${p?.val ?? '—'}`
  },

  rmr_weathering_89: {
    title: "Rating Intemperismo (RMR'89)",
    equation: "UWF→6 | SWD→5 | MWM→3 | HWA→1 | CWC/RS→0",
    description: "Puntaje de meteorización/intemperismo para RMR'89.",
    inputs: ["Grado Intemperismo (ISRM)"],
    calcExplanation: (p) => `Grado: "${p?.code || '—'}" → Rating: ${p?.val ?? '—'}`
  },

  rmr_persistence_76: {
    title: "Persistencia Estimada (RMR'76)",
    equation: "P = ROUND((Abert + Rug + Rell + Intemp) / 4)",
    description: "Estimada como el promedio aritmético redondeado de los 4 sub-ratings de condición de juntas.",
    inputs: ["Rating Abertura", "Rating Rugosidad", "Rating Relleno", "Rating Intemperismo"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `ROUND((${p.ab ?? 0} + ${p.rg ?? 0} + ${p.fl ?? 0} + ${p.wt ?? 0}) / 4) = ${p.val ?? '—'}`;
    }
  },

  rmr_persistence_89: {
    title: "Persistencia Estimada (RMR'89)",
    equation: "P = ROUND((Abert + Rug + Rell + Intemp) / 4)",
    description: "Estimada como el promedio aritmético redondeado de los 4 sub-ratings de condición de juntas (RMR'89).",
    inputs: ["Rating Abertura", "Rating Rugosidad", "Rating Relleno", "Rating Intemperismo"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `ROUND((${p.ab ?? 0} + ${p.rg ?? 0} + ${p.fl ?? 0} + ${p.wt ?? 0}) / 4) = ${p.val ?? '—'}`;
    }
  },

  rmr_joints_76: {
    title: "Condición de Juntas Total (RMR'76)",
    equation: "J = Abert + Rug + Rell + Intemp + Pers",
    description: "Suma de los 5 sub-ratings de condición de discontinuidades según Bieniawski 1976.",
    inputs: ["Abertura", "Rugosidad", "Relleno", "Intemperismo", "Persistencia"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.ab ?? 0} + ${p.rg ?? 0} + ${p.fl ?? 0} + ${p.wt ?? 0} + ${p.pe ?? 0} = ${p.val ?? '—'}`;
    }
  },

  rmr_joints_89: {
    title: "Condición de Juntas Total (RMR'89)",
    equation: "J = Abert + Rug + Rell + Intemp + Pers",
    description: "Suma de los 5 sub-ratings de condición de discontinuidades según Bieniawski 1989.",
    inputs: ["Abertura", "Rugosidad", "Relleno", "Intemperismo", "Persistencia"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.ab ?? 0} + ${p.rg ?? 0} + ${p.fl ?? 0} + ${p.wt ?? 0} + ${p.pe ?? 0} = ${p.val ?? '—'}`;
    }
  },

  rmr_water: {
    title: "Clasificación de Agua Subterránea Automática",
    equation: "Prof < NF−5m → CDC(Seco) | NF−5m ≤ Prof < NF → DPH(Húmedo) | Prof ≥ NF → WTM(Mojado)",
    description: "Clasificación automática de la condición de agua según la profundidad relativa al nivel freático (NF). CDC: R76=10, R89=15 | DPH: R76=7, R89=10 | WTM: R76=7, R89=7.",
    inputs: ["Profundidad (m)", "Nivel Freático (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Prof: ${p.depth ?? '—'} m | NF: ${p.wt ?? '—'} m → ${p.code || '—'} → R76: ${p.val76 ?? '—'} | R89: ${p.val89 ?? '—'}`;
    }
  },

  rmr_total_76: {
    title: "RMR FINAL (Bieniawski 1976)",
    equation: "RMR'76 = Resist + RQD + Espac + Juntas + Agua",
    description: "Suma total de la valoración del macizo según Bieniawski (1976). Determina la clase de calidad del macizo rocoso.",
    inputs: ["Rating Resistencia", "Rating RQD", "Rating Espaciamiento", "Condición Juntas", "Rating Agua"],
    calcExplanation: (p) => {
      if (!p) return "";
      const { s, rqd, sp, j, w } = p;
      const sum = (s || 0) + (rqd || 0) + (sp || 0) + (j || 0) + (w || 0);
      return `${s || 0} (Res) + ${rqd || 0} (RQD) + ${sp || 0} (Espac) + ${j || 0} (Juntas) + ${w || 0} (Agua) = ${sum}`;
    }
  },

  rmr_total_89: {
    title: "RMR FINAL (Bieniawski 1989)",
    equation: "RMR'89 = Resist + RQD + Espac + Juntas + Agua",
    description: "Suma total de la valoración del macizo según Bieniawski (1989).",
    inputs: ["Rating Resistencia", "Rating RQD", "Rating Espaciamiento", "Condición Juntas", "Rating Agua"],
    calcExplanation: (p) => {
      if (!p) return "";
      const { s, rqd, sp, j, w } = p;
      const sum = (s || 0) + (rqd || 0) + (sp || 0) + (j || 0) + (w || 0);
      return `${s || 0} (Res) + ${rqd || 0} (RQD) + ${sp || 0} (Espac) + ${j || 0} (Juntas) + ${w || 0} (Agua) = ${sum}`;
    }
  },

  rmr_class: {
    title: "Clasificación Cualitativa del Macizo",
    equation: "≥81→Muy Buena | ≥61→Buena | ≥41→Regular | ≥21→Mala | <21→Muy Mala",
    description: "Mapeo del puntaje RMR Total a la clase verbal de calidad del macizo rocoso.",
    inputs: ["RMR Total"],
    calcExplanation: (p) => `RMR: ${p?.rmr ?? '—'} → Clase: ${p?.val ?? '—'}`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // █  ESTRUCTURAL — Campos Heredados y Fórmulas
  // ═══════════════════════════════════════════════════════════════════════════

  struct_corrida_match: {
    title: "Corrida Asignada (Match Espacial)",
    equation: "Corrida.De ≤ Profundidad ≤ Corrida.A",
    description: "La discontinuidad se asigna a la corrida cuyo intervalo [De, A] contiene la profundidad registrada. Hereda litología y resistencia de ese tramo.",
    inputs: ["Profundidad (m)", "De (m)", "A (m)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Prof: ${p.depth ?? '—'} m → Corrida [${p.de ?? '—'}, ${p.a ?? '—'}] = Corrida #${p.corrida ?? '—'}`;
    }
  },

  struct_de_a_heredada: {
    title: "Metraje [De, A] Heredado de LGG",
    equation: "Intervalo = [Corrida.De, Corrida.A]",
    description: "Rango de profundidad inicial (De) y final (A) de la corrida que contiene esta discontinuidad.",
    inputs: ["Profundidad (m)", "Corrida LGG"],
    calcExplanation: (p) => `Corrida #${p?.corrida ?? '—'}: [${p?.de ?? '—'}m , ${p?.a ?? '—'}m]`
  },

  struct_lito_heredada: {
    title: "Litología Heredada de Corrida",
    equation: "Litología = Corrida.lito3 ?? Corrida.lito1",
    description: "La litología se hereda automáticamente de la corrida asignada. Si existe lito3, se usa; si no, se usa lito1.",
    inputs: ["Corrida Asignada", "Lito3 Corrida", "Lito1 Corrida"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Corrida #${p.corrida ?? '—'} → Lito3: "${p.lito3 || '—'}" ?? Lito1: "${p.lito1 || '—'}" = "${p.val || '—'}"`;
    }
  },

  struct_dureza_heredada: {
    title: "Resistencia Heredada de Corrida",
    equation: "Resist = Corrida.resistencia",
    description: "La resistencia de pared se hereda automáticamente de la corrida asignada cuando no se especifica manualmente.",
    inputs: ["Corrida Asignada", "Resistencia de Corrida"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Corrida #${p.corrida ?? '—'} → Resistencia: "${p.val || '—'}"`;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // █  PLT — Ensayos de Carga Puntual
  // ═══════════════════════════════════════════════════════════════════════════

  plt_long_corrida: {
    title: "Longitud de Corrida (m)",
    equation: "Long. Corrida = Corrida.A − Corrida.De",
    description: "Longitud del tramo de corrida en LGG que contiene a la muestra del ensayo PLT.",
    inputs: ["Corrida.De (m)", "Corrida.A (m)"],
    calcExplanation: (p) => `Corrida #${p?.corrida ?? '—'}: ${p?.a ?? '—'} − ${p?.de ?? '—'} = ${p?.val ?? '—'} m`
  },

  plt_long_muestra: {
    title: "Longitud de Muestra (mm)",
    equation: "Long. Muestra = (To − From) × 1000",
    description: "Longitud física de la muestra ensayada convertida a milímetros.",
    inputs: ["From (m)", "To (m)"],
    calcExplanation: (p) => `(${p?.to ?? '—'} − ${p?.from ?? '—'}) × 1000 = ${p?.val ?? '—'} mm`
  },

  plt_tipo_litologico: {
    title: "Tipo Litológico (Cascada Geomecánica)",
    equation: "Clase = ResolveCascade(Lito 1, Lito 2, Lito 3)",
    description: "Clasificación de la familia litológica (Ígnea, Sedimentaria, Metamórfica) resuelta por la cascada geomecánica de las tres litologías.",
    inputs: ["Litología 1", "Litología 2", "Litología 3"],
    calcExplanation: (p) => `Cascada: "${p?.lito1 || '—'}" → "${p?.lito2 || '-'}" → "${p?.lito3 || '-'}" = ${p?.val || '—'}`
  },

  plt_is_mpa: {
    title: "Índice de Carga Puntual Is (MPa)",
    equation: "Is = P × 1000 / D²",
    description: "Índice de carga puntual no corregido en MPa calculado a partir de la fuerza de ruptura P (kN) y el diámetro D (mm).",
    inputs: ["Fuerza P (kN)", "Diámetro D (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.p ?? '0'} × 1000 / ${p.d ?? '0'}² = ${p.val ?? '—'} MPa`;
    }
  },

  plt_fact_corr: {
    title: "Factor de Corrección por Tamaño (f)",
    equation: "f = (D / 50)^0.45",
    description: "Factor de corrección de escala estándar ISRM para normalizar el diámetro equivalente a la referencia de 50 mm.",
    inputs: ["Diámetro D (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `(${p.d ?? '0'} / 50)^0.45 = ${p.val ?? '—'}`;
    }
  },

  plt_is50: {
    title: "Índice Corregido Is(50) (MPa)",
    equation: "Is(50) = Is × f",
    description: "Índice de resistencia corregido a la escala estándar de 50 mm mediante el factor f.",
    inputs: ["Is (MPa)", "Factor f"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.is ?? '0'} × ${p.f ?? '0'} = ${p.val ?? '—'} MPa`;
    }
  },

  plt_factor_k: {
    title: "Factor de Conversión K (Litológico)",
    equation: "K = Lookup(Cascada Litológica)",
    description: "Factor de correlación Is(50) → UCS determinado por la cascada litológica del tramo (lito1 → lito2 → lito3). Varía según tipo de roca.",
    inputs: ["Litología 1", "Litología 2", "Litología 3"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `Cascada: ${p.lito1 || '—'} → ${p.lito2 || '—'} → ${p.lito3 || '—'} → K = ${p.val ?? '—'}`;
    }
  },

  plt_ucs: {
    title: "UCS Estimado (MPa)",
    equation: "UCS = Is(50) × K",
    description: "Estima la resistencia a compresión uniaxial simple de la roca intacta multiplicando el índice corregido Is(50) por el factor litológico K.",
    inputs: ["Is(50) (MPa)", "Factor K"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `${p.is50 ?? '0'} × ${p.k ?? '0'} = ${p.val ?? '—'} MPa`;
    }
  },

  plt_isrm: {
    title: "Clasificación de Resistencia ISRM",
    equation: "Lookup(UCS → R0-R6)",
    description: "Clasifica la resistencia de la roca intacta en grados normalizados: Suelo (≤0.25), R0 (≤1), R1 (≤5), R2 (≤25), R3 (≤50), R4 (≤100), R5 (≤250), R6 (>250).",
    inputs: ["UCS (MPa)"],
    calcExplanation: (p) => `UCS: ${p?.ucs !== undefined ? Number(p.ucs).toFixed(2) : '—'} MPa → ISRM: ${p?.val ?? '—'}`
  },

  plt_verif_corrida: {
    title: "Verificación de Corrida PLT",
    equation: "Validez = ∃ Corrida: Corrida.De ≤ from ∧ to ≤ Corrida.A",
    description: "Verifica que el intervalo de la muestra PLT [from, to] esté completamente contenido dentro de una corrida registrada en LGG.",
    inputs: ["from (m)", "to (m)", "Corridas LGG"],
    calcExplanation: (p) => {
      if (!p) return "";
      return `[${p.from ?? '—'}, ${p.to ?? '—'}] m → ${p.valid ? '✓ OK' : '✗ Sin corrida'}`;
    }
  },

  plt_verif_longitud: {
    title: "Verificación de Longitud PLT",
    equation: "Validez = ((to − from) × 1000) > D",
    description: "Verifica que la longitud de la muestra en milímetros sea mayor que el diámetro D para garantizar un ensayo válido.",
    inputs: ["from (m)", "to (m)", "D (mm)"],
    calcExplanation: (p) => {
      if (!p) return "";
      const longMm = ((p.to ?? 0) - (p.from ?? 0)) * 1000;
      return `(${p.to ?? '—'} − ${p.from ?? '—'}) × 1000 = ${longMm.toFixed(1)} mm > D: ${p.d ?? '—'} mm → ${p.valid ? '✓ OK' : '✗ Error'}`;
    }
  }
};

// ─── COMPONENTE TRIGGER ─────────────────────────────────────────────────────
interface FormulaTooltipTriggerProps {
  children: React.ReactNode;
  formulaId: string;
  params?: Record<string, any>;
  position?: 'top' | 'bottom';
  className?: string;
  enabled?: boolean;
}

export const FormulaTooltipTrigger: React.FC<FormulaTooltipTriggerProps> = ({
  children,
  formulaId,
  params,
  position = 'top',
  className = "",
  enabled = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!enabled) return;
    if (triggerRef.current) {
      setCoords(triggerRef.current.getBoundingClientRect());
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  useEffect(() => {
    if (!isHovered || !enabled) return;

    const updatePosition = () => {
      if (triggerRef.current) {
        setCoords(triggerRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isHovered, enabled]);

  const def = FORMULA_DEFS[formulaId];

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`inline-block w-full ${className}`}
    >
      {children}
      {isHovered && coords && def && enabled && (
        <PortalTooltip coords={coords} def={def} params={params} position={position} />
      )}
    </span>
  );
};

// ─── PORTAL TOOLTIP ─────────────────────────────────────────────────────────
interface PortalTooltipProps {
  coords: DOMRect;
  def: FormulaDef;
  params?: Record<string, any>;
  position: 'top' | 'bottom';
}

const PortalTooltip: React.FC<PortalTooltipProps> = ({ coords, def, params, position }) => {
  const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 210 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({
        width: rect.width || 320,
        height: rect.height || 210
      });
    }
  }, [def, params]);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 16;

  let left = coords.left + coords.width / 2;

  const halfW = tooltipSize.width / 2;
  if (left - halfW < margin) {
    left = halfW + margin;
  } else if (left + halfW > viewportWidth - margin) {
    left = viewportWidth - halfW - margin;
  }

  let finalPosition = position;
  if (finalPosition === 'top' && coords.top - tooltipSize.height - margin < 0) {
    finalPosition = 'bottom';
  } else if (finalPosition === 'bottom' && coords.bottom + tooltipSize.height + margin > viewportHeight) {
    finalPosition = 'top';
  }

  const top = finalPosition === 'top'
    ? coords.top - 6
    : coords.bottom + 6;

  const transformVal = finalPosition === 'top'
    ? 'translate(-50%, -100%)'
    : 'translate(-50%, 0)';

  return ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        transform: transformVal,
        zIndex: 9999,
        width: '320px'
      }}
      className="p-4 bg-slate-950/95 border border-indigo-500/40 rounded-xl shadow-2xl backdrop-blur-md text-left select-none animate-fade-in text-xs space-y-3 pointer-events-none"
    >
      <div className="flex items-center justify-between border-b border-navy-850 pb-1.5">
        <span className="font-black text-indigo-400 uppercase tracking-widest text-[9px]">
          Ecuación Geomecánica
        </span>
        <span className="text-[9px] font-extrabold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
          Auto
        </span>
      </div>

      <h4 className="text-slate-100 font-bold text-xs uppercase tracking-wide leading-tight">
        {def.title}
      </h4>

      <div className="bg-navy-900/60 border border-navy-800/80 rounded-lg p-2 font-mono text-[10px] text-cyan-400 font-semibold break-words whitespace-pre-wrap">
        {def.equation}
      </div>

      <p className="text-slate-400 text-[11px] leading-relaxed">
        {def.description}
      </p>

      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-slate-500 font-extrabold uppercase text-[8px]">Depende de:</span>
        {def.inputs.map((inp, idx) => (
          <span key={idx} className="bg-navy-900 border border-navy-800/80 px-1.5 py-0.5 rounded text-[9px] text-slate-300 font-semibold">
            {inp}
          </span>
        ))}
      </div>

      {def.calcExplanation && params && (
        <div className="border-t border-navy-900 pt-2 space-y-1">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Reemplazo en fórmula:</span>
          <div className="font-mono text-[10px] text-indigo-300 font-bold break-words bg-indigo-500/5 border border-indigo-500/10 rounded px-2 py-1">
            {def.calcExplanation(params)}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
