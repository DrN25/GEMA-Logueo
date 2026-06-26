export interface LithologyItem {
  name: string;
  bg: string;
  text: string;
}

export const LITHOLOGY_CATALOG: Record<string, LithologyItem> = {
  BX: { name: "Brecha", bg: "#FF0D00", text: "#FFFFFF" },
  EGT: { name: "Exoskarn granate", bg: "#C86432", text: "#FFFFFF" },
  ENDO: { name: "Endo skarn", bg: "#A020F0", text: "#FFFFFF" },
  EPG: { name: "Monzonita epidótica", bg: "#64A050", text: "#FFFFFF" },
  ESK: { name: "Exoskarn", bg: "#BADD5B", text: "#000000" },
  GD: { name: "Granodiorita", bg: "#B4B4B4", text: "#000000" },
  GSK: { name: "Garnet skarn", bg: "#D25028", text: "#FFFFFF" },
  HBX: { name: "Brecha hidrotermal", bg: "#DC5050", text: "#FFFFFF" },
  HFL: { name: "Hornfels", bg: "#A0A0A0", text: "#000000" },
  LMT: { name: "Caliza", bg: "#4E708F", text: "#FFFFFF" },
  LMT_C: { name: "Caliza Carbonosa", bg: "#354A5F", text: "#FFFFFF" },
  LMT_M: { name: "Caliza micrítica", bg: "#4E708F", text: "#FFFFFF" },
  LMT_MG: { name: "Caliza Magnésica", bg: "#8B6914", text: "#FFFFFF" },
  LMT_S1: { name: "Caliza Sucia 1", bg: "#D1C29B", text: "#000000" },
  LMT_S2: { name: "Caliza Sucia 2", bg: "#D1C29B", text: "#000000" },
  LMT_S3: { name: "Caliza Sucia 3", bg: "#D1C29B", text: "#000000" },
  LMT_S4: { name: "Caliza Sucia 4", bg: "#D1C29B", text: "#000000" },
  MARA: { name: "Caliza Mara", bg: "#5C7C99", text: "#FFFFFF" },
  MARA_BX: { name: "Brecha Mara", bg: "#F25555", text: "#FFFFFF" },
  MBC: { name: "Mármol con calcosita", bg: "#2EAEA8", text: "#FFFFFF" },
  MBF: { name: "Monzonita biotítica félsica", bg: "#FEC85A", text: "#000000" },
  MBF_1: { name: "Monzonita biotítica félsica 1", bg: "#FECE65", text: "#000000" },
  MBF_2: { name: "Monzonita biotítica félsica 2", bg: "#FDC178", text: "#000000" },
  MBF_P: { name: "Monzonita biotítica félsica p", bg: "#FFA500", text: "#000000" },
  MBL: { name: "Mármol biotítico", bg: "#66B2FF", text: "#000000" },
  MBX: { name: "Brecha mármol", bg: "#F25555", text: "#FFFFFF" },
  MSK: { name: "Magnetite skarn", bg: "#782828", text: "#FFFFFF" },
  MZB: { name: "Monzonita biotítica", bg: "#FFC896", text: "#000000" },
  MZB_EQ: { name: "Monzonita biotítica equigranular", bg: "#FEE5CE", text: "#000000" },
  MZB_P: { name: "Monzonita biotítica porfírica", bg: "#FFD8B5", text: "#000000" },
  MZD: { name: "Monzonita Diorítico", bg: "#3E9C3E", text: "#FFFFFF" },
  MZH: { name: "Monzonita hornbléndica", bg: "#FF78B4", text: "#000000" },
  MZH_1: { name: "Monzonita hornbléndica 1", bg: "#FF6294", text: "#FFFFFF" },
  MZH_2: { name: "Monzonita hornbléndica 2", bg: "#FF62F1", text: "#000000" },
  MZM: { name: "Monzonita máfica", bg: "#FED2F0", text: "#000000" },
  MZM_M: { name: "Monzonita máfica masiva", bg: "#FEDCFC", text: "#000000" },
  MZQ: { name: "Monzonita cuarzosa", bg: "#D4C848", text: "#000000" },
  NR: { name: "No recuperado", bg: "#DCDCDC", text: "#000000" },
  OVD: { name: "Óxidos y venas", bg: "#B45A00", text: "#FFFFFF" },
  PSK: { name: "Pyroxene skarn", bg: "#A0B43C", text: "#000000" },
  QT: { name: "Cuarcita", bg: "#F5F5F5", text: "#000000" },
  SKARN: { name: "Skarn", bg: "#BADD5B", text: "#000000" },
  TBX: { name: "Brecha tectónica", bg: "#FF6464", text: "#FFFFFF" }
};

export interface GroundwaterItem {
  desc: string;
  rmr76: number;
  rmr89: number;
}

export const GROUNDWATER_CATALOG: Record<string, GroundwaterItem> = {
  CDC: { desc: "Completamente seco", rmr76: 10, rmr89: 15 },
  DPH: { desc: "Apenas Húmedo", rmr76: 7, rmr89: 10 },
  WTM: { desc: "Mojado (Goteo)", rmr76: 7, rmr89: 7 },
  DGE: { desc: "Presión moderada", rmr76: 4, rmr89: 4 },
  FGF: { desc: "Flujo continuo", rmr76: 0, rmr89: 0 }
};

export interface StrengthItem {
  desc: string;
  score: number;
}

export const STRENGTH_CATALOG: Record<string, StrengthItem> = {
  R0: { desc: "Extremadamente débil", score: 0 },
  R1: { desc: "Muy débil", score: 1 },
  R2: { desc: "Débil", score: 2 },
  R3: { desc: "Media / Moderadamente resistente", score: 4 },
  R4: { desc: "Fuerte / Resistente", score: 7 },
  R5: { desc: "Muy fuerte / Muy resistente", score: 12 },
  R6: { desc: "Extremadamente fuerte", score: 15 }
};

export const STRUCTURE_CATALOG: Record<string, string> = {
  JN: "Junta",
  "F-10": "Fallas < 10.0 cm",
  SZ: "Zona de Cizalla",
  BED: "Estratos",
  VN: "Venas",
  CON: "Contacto",
  SE: "Sin estructuras",
  "F+10": "Fallas > 10.0 cm",
  RF: "Roca Fracturada",
  Dq: "Dique"
};

export interface RellenoItem {
  name: string;
  clase: number;
  tipo: string;
  rmr76: number;
  rmr89: number;
  rmr76_gt5: number;
  rmr89_gt5: number;
}

export const RELLENO_CATALOG: Record<string, RellenoItem> = {
  ca: { name: "Calcita", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  sand: { name: "Arena", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  ch: { name: "Clorita", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  cl: { name: "Arcilla", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  gy: { name: "Yeso", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  RXF: { name: "Roca triturada", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  FBX: { name: "Brecha de falla", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  GOU: { name: "Panizo", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  PAT: { name: "Patinas", clase: 1, tipo: "Blando", rmr76: 2, rmr89: 2, rmr76_gt5: 0, rmr89_gt5: 0 },
  SIO: { name: "Silicatos", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  QZ: { name: "Cuarzo", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  SU: { name: "Sulfuros", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  OX: { name: "Óxidos de cobre", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  ep: { name: "Epidota", clase: 2, tipo: "Duro", rmr76: 4, rmr89: 4, rmr76_gt5: 2, rmr89_gt5: 2 },
  cwf: { name: "Limpia, sin relleno", clase: 3, tipo: "Sin relleno", rmr76: 5, rmr89: 6, rmr76_gt5: 5, rmr89_gt5: 6 }
};

// ENSAYOS PLT (Point Load Test)
export interface LithoMapping {
  clase: string;
  lito1: string;
  lito2: string;
  lito3: string;
  k: number;
}

export const PLT_LITHO_TABLE: LithoMapping[] = [
  { clase: "Intrusivas", lito1: "MZB", lito2: "MZB", lito3: "MZB_EQ", k: 8.29 },
  { clase: "Intrusivas", lito1: "MZB", lito2: "MZB", lito3: "MZB_P", k: 8.53 },
  { clase: "Intrusivas", lito1: "MBF1", lito2: "MBF", lito3: "MBF1", k: 9.20 },
  { clase: "Intrusivas", lito1: "MBF2", lito2: "MBF", lito3: "MBF2", k: 10.73 },
  { clase: "Intrusivas", lito1: "MBF2", lito2: "MBF", lito3: "MBF_P", k: 9.31 },
  { clase: "Intrusivas", lito1: "MZM", lito2: "MZM", lito3: "MZM_F", k: 9.31 },
  { clase: "Intrusivas", lito1: "MZM", lito2: "MZM", lito3: "MZM_M", k: 8.61 },
  { clase: "Intrusivas", lito1: "MZH", lito2: "MZH", lito3: "MZH_1", k: 11.62 },
  { clase: "Intrusivas", lito1: "MZH", lito2: "MZH", lito3: "MZH_2", k: 9.31 },
  { clase: "Intrusivas", lito1: "MZD", lito2: "MZD", lito3: "MZD", k: 7.60 },
  { clase: "Intrusivas", lito1: "MZQ", lito2: "MZQ", lito3: "MZQ", k: 12.29 },
  { clase: "Intrusivas", lito1: "AN", lito2: "AN", lito3: "LAM", k: 9.31 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_M", k: 14.74 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_MG", k: 14.25 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_S", k: 14.84 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_C", k: 16.83 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_U", k: 14.84 },
  { clase: "Sedimentarias", lito1: "SHL", lito2: "HFL", lito3: "SHL_MA", k: 14.84 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "GSK", lito3: "Varios", k: 11.15 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "PSK", lito3: "Varios", k: 12.63 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "MSK", lito3: "Varios", k: 12.63 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "ESK", lito3: "Varios", k: 12.63 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "MBC", lito3: "Varios", k: 11.78 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "MBL", lito3: "Varios", k: 13.34 },
  { clase: "Metamórficas", lito1: "SHL", lito2: "HFL", lito3: "-", k: 12.63 },
  { clase: "Metamórficas", lito1: "SND", lito2: "QZT", lito3: "-", k: 12.63 },
  { clase: "Brechas", lito1: "TBX", lito2: "TBX", lito3: "TBX", k: 13.72 },
  { clase: "Brechas", lito1: "HBX", lito2: "HBX", lito3: "HBX", k: 11.41 },
  { clase: "Brechas", lito1: "MBX / varios", lito2: "MBX", lito3: "MBX", k: 11.41 },
  { clase: "Endoskarn", lito1: "MZM", lito2: "EPG", lito3: "-", k: 9.87 },
  { clase: "Endoskarn", lito1: "MZM", lito2: "EGT", lito3: "-", k: 9.87 }
];

export const NOMINAL_DIAMETERS: Record<string, number> = {
  BQ: 36.5,
  NQ: 47.6,
  HQ: 61.1,
  PQ: 85.0
};

export interface LithologyCascadeResult {
  lito1: string;
  lito2: string;
  lito3: string;
  clase: string;
  k: number;
}

export function resolveLithologyCascade(
  lito1: string,
  lito2: string,
  lito3: string,
  changedField: 'lito1' | 'lito2' | 'lito3' | 'litologia_1' | 'litologia_2' | 'litologia_3',
  newValue: string
): LithologyCascadeResult {
  const norm = (s: string) => (s || "").trim().toUpperCase();
  const clean = (s: string) => norm(s).replace(/[\s_/-]/g, ""); // Normalización robusta

  const fieldMap: Record<string, 'lito1' | 'lito2' | 'lito3'> = {
    'lito1': 'lito1', 'litologia_1': 'lito1',
    'lito2': 'lito2', 'litologia_2': 'lito2',
    'lito3': 'lito3', 'litologia_3': 'lito3'
  };
  const stdField = fieldMap[changedField];

  let nextL1 = lito1;
  let nextL2 = lito2;
  let nextL3 = lito3;

  const checkIsValid = (l1Val: string, l2Val: string, l3Val: string) => {
    return PLT_LITHO_TABLE.some(
      item => clean(item.lito1) === clean(l1Val) &&
        clean(item.lito2) === clean(l2Val) &&
        (clean(item.lito3) === clean(l3Val) || clean(item.lito3) === "VARIOS" || clean(item.lito3) === "-")
    );
  };

  const cleanVal = clean(newValue);

  if (stdField === 'lito3') {
    nextL3 = newValue === "-1" ? "-" : newValue;
    const isValid = checkIsValid(nextL1, nextL2, nextL3);
    if (!isValid) {
      const match = PLT_LITHO_TABLE.find(item => clean(item.lito3) === cleanVal);
      if (match) {
        nextL1 = match.lito1;
        nextL2 = match.lito2;
      }
    }
  } else if (stdField === 'lito2') {
    nextL2 = newValue === "-1" ? "-" : newValue;
    const isValid = checkIsValid(nextL1, nextL2, nextL3);
    if (!isValid) {
      let match = PLT_LITHO_TABLE.find(
        item => clean(item.lito2) === cleanVal && (clean(item.lito3) === clean(nextL3) || clean(item.lito3) === "VARIOS")
      );
      if (!match) {
        match = PLT_LITHO_TABLE.find(item => clean(item.lito2) === cleanVal);
      }
      if (match) {
        nextL1 = match.lito1;
        nextL3 = match.lito3 === "Varios" ? "-" : match.lito3;
      }
    }
  } else if (stdField === 'lito1') {
    nextL1 = newValue;
    const isValid = checkIsValid(nextL1, nextL2, nextL3);
    if (!isValid) {
      let match = PLT_LITHO_TABLE.find(
        item => clean(item.lito1) === cleanVal && clean(item.lito2) === clean(nextL2)
      );
      if (!match) {
        match = PLT_LITHO_TABLE.find(item => clean(item.lito1) === cleanVal);
      }
      if (match) {
        nextL2 = match.lito2;
        nextL3 = match.lito3 === "Varios" ? "-" : match.lito3;
      }
    }
  }

  let matchRow = PLT_LITHO_TABLE.find(
    item => clean(item.lito1) === clean(nextL1) && clean(item.lito2) === clean(nextL2) && clean(item.lito3) === clean(nextL3)
  );

  if (!matchRow) {
    matchRow = PLT_LITHO_TABLE.find(
      item => clean(item.lito1) === clean(nextL1) && clean(item.lito2) === clean(nextL2) && (clean(item.lito3) === "VARIOS" || clean(item.lito3) === "-" || clean(item.lito3) === "")
    );
  }

  if (!matchRow) {
    matchRow = PLT_LITHO_TABLE.find(item => clean(item.lito1) === clean(nextL1));
  }

  const finalMatch = matchRow || { clase: "Intrusivas", k: 10.0 };

  return {
    lito1: nextL1,
    lito2: nextL2,
    lito3: nextL3,
    clase: finalMatch.clase,
    k: finalMatch.k
  };
}