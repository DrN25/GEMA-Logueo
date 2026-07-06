import { calculateRowRmr } from '../../utils/formulaEngine';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';

// ─── Control Points & Envelopes (Bieniawski Chart D) ───
export const BIENIAWSKI_CTRL_MIN = [
  { x: 90, y: 0 }, { x: 100, y: 8.35 }, { x: 200, y: 59.11 }, { x: 600, y: 95.36 }, { x: 1650, y: 100 }, { x: 2000, y: 100 }
];
export const BIENIAWSKI_CTRL_MAX = [
  { x: 14, y: 0 }, { x: 20, y: 6.57 }, { x: 30, y: 16.87 }, { x: 40, y: 27.17 }, { x: 70, y: 56.66 }, { x: 100, y: 74.17 }, { x: 200, y: 92.59 }, { x: 600, y: 99.78 }, { x: 1000, y: 100 }, { x: 2000, y: 100 }
];
export const BIENIAWSKI_CTRL_MID = [
  { x: 35.5, y: 0 }, { x: 40, y: 3.4 }, { x: 50, y: 11.0 }, { x: 70, y: 26.25 }, { x: 100, y: 47.9 }, { x: 150, y: 69.1 }, { x: 200, y: 80.76 }, { x: 300, y: 91.38 }, { x: 500, y: 98.0 }, { x: 1000, y: 100 }, { x: 2000, y: 100 }
];

export const LAMBDA_CTRL_MIN = [
  { x: 0, y: 57.14 }, { x: 1.25, y: 56.75 }, { x: 2.5, y: 55.58 }, { x: 5, y: 51.98 }, { x: 10, y: 42.08 }, { x: 15, y: 31.92 }, { x: 20, y: 23.09 }, { x: 25, y: 16.48 }, { x: 30, y: 11.34 }, { x: 35, y: 7.66 }, { x: 40, y: 5.23 }
];
export const LAMBDA_CTRL_MAX = [
  { x: 7.5, y: 95.24 }, { x: 10, y: 84.43 }, { x: 15, y: 63.58 }, { x: 20, y: 46.42 }, { x: 25, y: 33.06 }, { x: 30, y: 22.91 }, { x: 35, y: 15.60 }, { x: 40, y: 10.37 }
];

export const DRILL_COLORS = [
  '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#60a5fa', '#facc15', '#2dd4bf', '#f87171', '#fb7185'
];

export interface Corrida {
  corrida: number;
  de: number;
  a: number;
  rec_m: number;
  rqd_m: number;
  lrf_m: number;
  frac_nat: number;
  [key: string]: any;
}

export interface DashPoint {
  taladro: string;
  corrida: string;
  prof_m: number;
  rqd_pct: number;
  spacing_mm: number;
  ff_per_m: number;
  ph_teorico: number;
  lito1?: string;
  lito2?: string;
  lito3?: string;
  rmr89?: number;
  elev_m?: number;
}

export interface TaladroSummary {
  name: string;
  corridas_count: number;
  [key: string]: any;
}

export function getDrillColor(name: string): string {
  if (!name) return '#38bdf8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DRILL_COLORS.length;
  return DRILL_COLORS[index];
}

export function getLitoColor(lito: string): string {
  const clean = (lito || '').trim().toUpperCase();
  if (LITHOLOGY_CATALOG && LITHOLOGY_CATALOG[clean] && LITHOLOGY_CATALOG[clean].bg) {
    return LITHOLOGY_CATALOG[clean].bg;
  }
  return getDrillColor(clean);
}

export function phTeoricoFn(ff: number): number {
  if (ff <= 0) return 100;
  return Math.min(100, 100 * Math.exp(-0.1 * ff) * (0.1 * ff + 1));
}

export function interpolateY(ctrlPoints: { x: number; y: number }[], targetX: number, isLog: boolean = false): number {
  if (targetX <= ctrlPoints[0].x) return ctrlPoints[0].y;
  if (targetX >= ctrlPoints[ctrlPoints.length - 1].x) return ctrlPoints[ctrlPoints.length - 1].y;

  for (let i = 0; i < ctrlPoints.length - 1; i++) {
    const p1 = ctrlPoints[i];
    const p2 = ctrlPoints[i + 1];
    if (targetX >= p1.x && targetX <= p2.x) {
      if (isLog) {
        const logX1 = Math.log10(p1.x);
        const logX2 = Math.log10(p2.x);
        const logTarget = Math.log10(targetX);
        const t = (logTarget - logX1) / (logX2 - logX1);
        return p1.y + t * (p2.y - p1.y);
      } else {
        const t = (targetX - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    }
  }
  return 0;
}

export function bandStatus(rqd: number, spacingMm: number): 'dentro' | 'sobre' | 'bajo' {
  if (!spacingMm || spacingMm <= 0 || !isFinite(spacingMm)) return 'dentro';
  if (spacingMm < 14) return 'sobre';

  const rMin = interpolateY(BIENIAWSKI_CTRL_MIN, spacingMm, true);
  const rMax = interpolateY(BIENIAWSKI_CTRL_MAX, spacingMm, true);

  if (rqd > rMax) return 'sobre';
  if (rqd < rMin) return 'bajo';
  return 'dentro';
}

export function bandStatusPh(rqd: number, ff: number): 'dentro' | 'sobre' | 'bajo' {
  if (ff < 0 || !isFinite(ff)) return 'dentro';
  if (ff > 40) return 'bajo';

  const rMin = interpolateY(LAMBDA_CTRL_MIN, ff, false);
  const rMax = interpolateY(LAMBDA_CTRL_MAX, ff, false);

  if (rqd > rMax) return 'sobre';
  if (rqd < rMin) return 'bajo';
  return 'dentro';
}

export function downsampleScatterData(points: DashPoint[], xKey: string, yKey: string): any[] {
  const totalPoints = points.length;
  if (totalPoints < 600) {
    return points.map(p => ({ ...p, x: p[xKey as keyof DashPoint], y: p[yKey as keyof DashPoint] }));
  }

  const binScale = xKey === 'spacing_mm' ? 40 : (xKey === 'rmr89' ? 1.5 : 1.2);
  const seen = new Set<string>();
  const downsampled: any[] = [];

  for (const p of points) {
    const yVal = parseFloat(String(p[yKey as keyof DashPoint] || 0));
    const xVal = parseFloat(String(p[xKey as keyof DashPoint] || 0));

    const yBin = Math.round(yVal / 2.5);
    let xBin = 0;

    if (xKey === 'spacing_mm') {
      xBin = xVal > 0 ? Math.round(Math.log10(xVal) * binScale) : 0;
    } else {
      xBin = Math.round(xVal * binScale);
    }

    const key = `${xBin}_${yBin}`;

    if (!seen.has(key)) {
      seen.add(key);
      downsampled.push({
        ...p,
        x: xVal,
        y: yVal
      });
    }
  }
  return downsampled;
}

export function rqdClass(rqd: number): { label: string; color: string } {
  if (rqd >= 90) return { label: 'Excelente (I)', color: '#10b981' };
  if (rqd >= 75) return { label: 'Buena (II)', color: '#3b82f6' };
  if (rqd >= 50) return { label: 'Regular (III)', color: '#eab308' };
  if (rqd >= 25) return { label: 'Mala (IV)', color: '#f97316' };
  return { label: 'Muy Mala (V)', color: '#ef4444' };
}

export function spacingClass(s: number): { label: string; color: string } {
  if (s > 500) return { label: 'Muy Amplio', color: '#10b981' };
  if (s > 200) return { label: 'Amplio', color: '#3b82f6' };
  if (s > 60) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Muy Cerrado', color: '#ef4444' };
}

export const LITHOLOGY_COLORS: Record<string, { fill: string; solid: string; label: string }> = {
  INTRUSIVOS: { fill: 'rgba(244, 114, 182, 0.22)', solid: '#f472b6', label: 'Intrusivos' },
  SEDIMENTARIOS: { fill: 'rgba(56, 189, 248, 0.22)', solid: '#38bdf8', label: 'Sedimentarios' },
  METAMORFICAS: { fill: 'rgba(52, 211, 153, 0.22)', solid: '#34d399', label: 'Metamórficas' },
  BRECHAS: { fill: 'rgba(253, 224, 71, 0.22)', solid: '#fde047', label: 'Brechas' },
  ENDOSKARN: { fill: 'rgba(167, 139, 250, 0.22)', solid: '#a78bfa', label: 'Endoskarn' },
  DESCONOCIDO: { fill: 'rgba(148, 163, 184, 0.10)', solid: '#94a3b8', label: 'Otros/Desconocido' }
};

export const getRqdColorClass = (pct: number): string => {
  if (pct <= 40) return 'text-red-500';
  if (pct <= 70) return 'text-amber-400';
  return 'text-emerald-400';
};

export function computePointsFromCorridas(corridas: Corrida[], taladroName: string): DashPoint[] {
  const points: DashPoint[] = [];
  for (const row of corridas) {
    try {
      const res = calculateRowRmr(row, 97.0);
      if ('error' in res) continue;
      if (!isFinite(res.rqd_pct) || !isFinite(res.spacing_mm) || res.spacing_mm <= 0) continue;
      const ff = res.total_frac > 0 ? res.total_frac / res.perf : 0;
      if (!isFinite(ff)) continue;
      points.push({
        taladro: taladroName,
        corrida: `${row.de}-${row.a}`,
        prof_m: parseFloat(((row.de + row.a) / 2).toFixed(2)),
        rqd_pct: res.rqd_pct,
        spacing_mm: res.spacing_mm,
        ff_per_m: parseFloat(ff.toFixed(4)),
        ph_teorico: parseFloat(phTeoricoFn(ff).toFixed(2)),
        lito1: row.lito1 || 'S/D',
        lito2: row.lito2 || '',
        lito3: row.lito3 || 'S/D',
        rmr89: res.rmr_89,
        elev_m: 4000.0 - parseFloat(((row.de + row.a) / 2).toFixed(2))
      });
    } catch {
      // Ignorar errores
    }
  }
  return points;
}

export function getHeatmapBg(val: number): string {
  if (val >= 80) return "bg-[#16a34a] text-white";
  if (val >= 65) return "bg-[#22c55e] text-slate-900";
  if (val >= 50) return "bg-[#eab308] text-slate-950";
  if (val >= 40) return "bg-[#ea580c] text-white";
  if (val >= 25) return "bg-[#b91c1c] text-white";
  return "bg-[#4c1d95] text-purple-200";
}
