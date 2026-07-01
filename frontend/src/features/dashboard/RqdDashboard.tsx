import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, ZAxis, CartesianGrid,
  ResponsiveContainer, Label, Cell, BarChart, Bar, Tooltip, Legend, LabelList
} from 'recharts';
import { BarChart2, ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { calculateRowRmr } from '../../utils/formulaEngine';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';
import RqdPorLitologiaTab from './RqdPorLitologiaTab';

// ─── Control Points & Envelopes (Bieniawski Chart D) ───
const BIENIAWSKI_CTRL_MIN = [
  { x: 90, y: 0 }, { x: 100, y: 8.35 }, { x: 200, y: 59.11 }, { x: 600, y: 95.36 }, { x: 1650, y: 100 }, { x: 2000, y: 100 }
];
const BIENIAWSKI_CTRL_MAX = [
  { x: 14, y: 0 }, { x: 20, y: 6.57 }, { x: 30, y: 16.87 }, { x: 40, y: 27.17 }, { x: 70, y: 56.66 }, { x: 100, y: 74.17 }, { x: 200, y: 92.59 }, { x: 600, y: 99.78 }, { x: 1000, y: 100 }, { x: 2000, y: 100 }
];
const BIENIAWSKI_CTRL_MID = [
  { x: 35.5, y: 0 }, { x: 40, y: 3.4 }, { x: 50, y: 11.0 }, { x: 70, y: 26.25 }, { x: 100, y: 47.9 }, { x: 150, y: 69.1 }, { x: 200, y: 80.76 }, { x: 300, y: 91.38 }, { x: 500, y: 98.0 }, { x: 1000, y: 100 }, { x: 2000, y: 100 }
];

const LAMBDA_CTRL_MIN = [
  { x: 0, y: 57.14 }, { x: 1.25, y: 56.75 }, { x: 2.5, y: 55.58 }, { x: 5, y: 51.98 }, { x: 10, y: 42.08 }, { x: 15, y: 31.92 }, { x: 20, y: 23.09 }, { x: 25, y: 16.48 }, { x: 30, y: 11.34 }, { x: 35, y: 7.66 }, { x: 40, y: 5.23 }
];
const LAMBDA_CTRL_MAX = [
  { x: 7.5, y: 95.24 }, { x: 10, y: 84.43 }, { x: 15, y: 63.58 }, { x: 20, y: 46.42 }, { x: 25, y: 33.06 }, { x: 30, y: 22.91 }, { x: 35, y: 15.60 }, { x: 40, y: 10.37 }
];

const DRILL_COLORS = [
  '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#60a5fa', '#facc15', '#2dd4bf', '#f87171', '#fb7185'
];

function getDrillColor(name: string): string {
  if (!name) return '#38bdf8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DRILL_COLORS.length;
  return DRILL_COLORS[index];
}

function getLitoColor(lito: string): string {
  const clean = (lito || '').trim().toUpperCase();
  if (LITHOLOGY_CATALOG && LITHOLOGY_CATALOG[clean] && LITHOLOGY_CATALOG[clean].bg) {
    return LITHOLOGY_CATALOG[clean].bg;
  }
  return getDrillColor(clean);
}

interface Corrida {
  corrida: number;
  de: number;
  a: number;
  rec_m: number;
  rqd_m: number;
  lrf_m: number;
  frac_nat: number;
  [key: string]: any;
}

interface DashPoint {
  taladro: string;
  corrida: string;
  prof_m: number;
  rqd_pct: number;
  spacing_mm: number;
  ff_per_m: number;
  ph_teorico: number;
  lito1?: string;
  lito3?: string;
  rmr89?: number;
  elev_m?: number;
}

interface TaladroSummary {
  name: string;
  corridas_count: number;
  [key: string]: any;
}

interface Props {
  activeTaladro: { name: string; corridas: Corrida[]; nivel_freatico?: number;[key: string]: any } | null;
  taladros: TaladroSummary[];
  onSelectTaladro: (name: string) => void;
}

function phTeoricoFn(ff: number): number {
  if (ff <= 0) return 100;
  return Math.min(100, 100 * Math.exp(-0.1 * ff) * (0.1 * ff + 1));
}

function interpolateY(ctrlPoints: { x: number; y: number }[], targetX: number, isLog: boolean = false): number {
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

function bandStatus(rqd: number, spacingMm: number): 'dentro' | 'sobre' | 'bajo' {
  if (!spacingMm || spacingMm <= 0 || !isFinite(spacingMm)) return 'dentro';
  if (spacingMm < 14) return 'sobre';

  const rMin = interpolateY(BIENIAWSKI_CTRL_MIN, spacingMm, true);
  const rMax = interpolateY(BIENIAWSKI_CTRL_MAX, spacingMm, true);

  if (rqd > rMax) return 'sobre';
  if (rqd < rMin) return 'bajo';
  return 'dentro';
}

function downsampleScatterData(points: DashPoint[], xKey: string, yKey: string): any[] {
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

function rqdClass(rqd: number): { label: string; color: string } {
  if (rqd >= 90) return { label: 'Excelente (I)', color: '#10b981' };
  if (rqd >= 75) return { label: 'Buena (II)', color: '#3b82f6' };
  if (rqd >= 50) return { label: 'Regular (III)', color: '#eab308' };
  if (rqd >= 25) return { label: 'Mala (IV)', color: '#f97316' };
  return { label: 'Muy Mala (V)', color: '#ef4444' };
}

function spacingClass(s: number): { label: string; color: string } {
  if (s > 500) return { label: 'Muy Amplio', color: '#10b981' };
  if (s > 200) return { label: 'Amplio', color: '#3b82f6' };
  if (s > 60) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Muy Cerrado', color: '#ef4444' };
}

function computePointsFromCorridas(corridas: Corrida[], taladroName: string): DashPoint[] {
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
        lito3: row.lito3 || 'S/D',
        rmr89: res.rmr_89,
        elev_m: 4000.0 - parseFloat(((row.de + row.a) / 2).toFixed(2))
      });
    } catch {
      // Ignorar errores puntuales
    }
  }
  return points;
}

function getHeatmapBg(val: number): string {
  if (val >= 80) return "bg-[#16a34a] text-white";
  if (val >= 65) return "bg-[#22c55e] text-slate-900";
  if (val >= 50) return "bg-[#eab308] text-slate-950";
  if (val >= 40) return "bg-[#ea580c] text-white";
  if (val >= 25) return "bg-[#b91c1c] text-white";
  return "bg-[#4c1d95] text-purple-200";
}

export default function RqdDashboard({ activeTaladro, taladros }: Props) {
  // Pestaña activa por defecto: correlaciones (Priest & Bieniawski)
  const [activeTab, setActiveTab] = useState<'correlaciones' | 'propuesta' | 'lito_rqd'>('correlaciones');

  const [selectedDrills, setSelectedDrills] = useState<Set<string>>(new Set());
  const deferredSelected = useDeferredValue(selectedDrills);
  const isPending = selectedDrills !== deferredSelected;

  const [allPoints, setAllPoints] = useState<DashPoint[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allTaladrosInfo, setAllTaladrosInfo] = useState<any[]>([]);
  const hasInitialized = React.useRef(false);

  // Mapeos constantes
  const bienMinLine = BIENIAWSKI_CTRL_MIN;
  const bienMaxLine = BIENIAWSKI_CTRL_MAX;
  const bienMidLine = BIENIAWSKI_CTRL_MID;
  const lambdaMinLine = LAMBDA_CTRL_MIN;
  const lambdaMaxLine = LAMBDA_CTRL_MAX;

  const phSuaveLine = useMemo(() => {
    const pts = [];
    for (let ff = 0; ff <= 40; ff += 0.5) {
      pts.push({ x: ff, y: parseFloat(phTeoricoFn(ff).toFixed(2)) });
    }
    return pts;
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";
      setLoadingAll(true);
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/rqd-summary`);
        if (res.ok) {
          const data = await res.json();
          const pts = data.points_rqd_esp || [];
          const list = data.taladros || [];
          setAllPoints(pts);
          setAllTaladrosInfo(list);

          if (list.length > 0 && !hasInitialized.current) {
            const first10 = new Set(list.slice(0, 10).map((t: any) => t.name));
            setSelectedDrills(first10);
            hasInitialized.current = true;
          }
        } else {
          throw new Error();
        }
      } catch {
        const summaries: TaladroSummary[] = JSON.parse(localStorage.getItem('geolog_taladros_summaries') || '[]');
        const pts: DashPoint[] = [];
        const infos: any[] = [];
        for (const s of summaries) {
          const cached = localStorage.getItem(`geolog_taladro_${s.name}`);
          if (!cached) continue;
          const parsed = JSON.parse(cached);
          const p = computePointsFromCorridas(parsed.corridas || [], s.name);
          pts.push(...p);
          const n = p.length;
          if (n > 0) {
            infos.push({
              name: s.name,
              count_rqd_esp: n,
              rqd_avg: parseFloat((p.reduce((a, b) => a + b.rqd_pct, 0) / n).toFixed(1)),
              spacing_avg: parseFloat((p.reduce((a, b) => a + b.spacing_mm, 0) / n).toFixed(0)),
              ff_avg: parseFloat((p.reduce((a, b) => a + b.ff_per_m, 0) / n).toFixed(2)),
            });
          }
        }
        setAllPoints(pts);
        setAllTaladrosInfo(infos);

        if (infos.length > 0 && !hasInitialized.current) {
          const first10 = new Set(infos.slice(0, 10).map((t: any) => t.name));
          setSelectedDrills(first10);
          hasInitialized.current = true;
        }
      } finally {
        setLoadingAll(false);
      }
    };
    fetchAllData();
  }, [taladros]);

  const toggleDrill = useCallback((name: string) => {
    setSelectedDrills(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedDrills(new Set());
  }, []);

  const selectOnly = useCallback((name: string) => {
    setSelectedDrills(new Set([name]));
  }, []);

  const activePoints = useMemo(() => {
    return activeTaladro ? computePointsFromCorridas(activeTaladro.corridas, activeTaladro.name) : [];
  }, [activeTaladro]);

  const visiblePoints = useMemo(() => {
    const merged = activeTaladro
      ? [...allPoints.filter(p => p.taladro !== activeTaladro.name), ...activePoints]
      : allPoints;

    return deferredSelected.size === 0
      ? merged
      : merged.filter(p => deferredSelected.has(p.taladro));
  }, [allPoints, activePoints, deferredSelected, activeTaladro]);

  const stats = useMemo(() => {
    const pts = visiblePoints;
    if (pts.length === 0) return null;
    const n = pts.length;
    const rqdAvg = pts.reduce((a, b) => a + b.rqd_pct, 0) / n;
    const espAvg = pts.reduce((a, b) => a + b.spacing_mm, 0) / n;
    const dentro = pts.filter(p => bandStatus(p.rqd_pct, p.spacing_mm) === 'dentro').length;
    return { n, rqdAvg, espAvg, dentro };
  }, [visiblePoints]);

  const drillNames = useMemo(() => {
    return Array.from(new Set([...allPoints.map(p => p.taladro), ...(activeTaladro ? [activeTaladro.name] : [])])).sort();
  }, [allPoints, activeTaladro]);

  const isAllSelected = deferredSelected.size === 0;

  const singleSelected = useMemo(() => {
    return deferredSelected.size === 1 ? Array.from(deferredSelected)[0] : null;
  }, [deferredSelected]);

  const drillIndex = useMemo(() => {
    return singleSelected ? drillNames.indexOf(singleSelected) : -1;
  }, [singleSelected, drillNames]);

  const goPrev = useCallback(() => {
    if (isAllSelected || !singleSelected) {
      selectOnly(drillNames[drillNames.length - 1]);
      return;
    }
    const idx = drillNames.indexOf(singleSelected);
    if (idx <= 0) selectAll();
    else selectOnly(drillNames[idx - 1]);
  }, [isAllSelected, singleSelected, drillNames, selectOnly, selectAll]);

  const goNext = useCallback(() => {
    if (isAllSelected || !singleSelected) {
      selectOnly(drillNames[0]);
      return;
    }
    const idx = drillNames.indexOf(singleSelected);
    if (idx >= drillNames.length - 1 || idx === -1) selectAll();
    else selectOnly(drillNames[idx + 1]);
  }, [isAllSelected, singleSelected, drillNames, selectOnly, selectAll]);

  // ─── 6 GRÁFICOS RECOMENDADOS ───

  // [Gráfico 1] Boxplot de RQD por Litología 3
  const lito3BoxPlotData = useMemo(() => {
    const groups: Record<string, number[]> = {};
    visiblePoints.forEach(p => {
      const lito = (p.lito3 || 'S/D').trim().toUpperCase();
      if (lito === '-1' || lito === '-' || lito === 'S/D') return;
      if (!groups[lito]) groups[lito] = [];
      groups[lito].push(p.rqd_pct);
    });

    return Object.entries(groups).map(([lito, vals]) => {
      vals.sort((a, b) => a - b);
      const n = vals.length;
      const min = vals[0];
      const max = vals[n - 1];
      const q1 = vals[Math.floor(n * 0.25)];
      const median = vals[Math.floor(n * 0.5)];
      const q3 = vals[Math.floor(n * 0.75)];
      const iqr = q3 - q1;

      const lowerBound = q1 - (1.5 * iqr);
      const upperBound = q3 + (1.5 * iqr);
      const outliers = vals.filter(v => v < lowerBound || v > upperBound);

      return {
        name: lito,
        box: [q1, q3],
        whiskerMin: min,
        whiskerMax: max,
        median,
        count: n,
        outliers,
        color: getLitoColor(lito)
      };
    }).sort((a, b) => b.count - a.count);
  }, [visiblePoints]);

  // [Gráfico 2] Violin Plot Vertical de RQD por Nivel
  const levelViolinData = useMemo(() => {
    const elevs = visiblePoints.map(p => p.elev_m || 4000).filter(e => !isNaN(e));
    if (elevs.length === 0) return [];

    const binSize = 50;
    const bins: Record<number, number[]> = {};

    visiblePoints.forEach(p => {
      const elev = p.elev_m || 4000;
      const bin = Math.round(elev / binSize) * binSize;
      if (!bins[bin]) bins[bin] = [];
      bins[bin].push(p.rqd_pct);
    });

    return Object.keys(bins)
      .map(Number)
      .sort((a, b) => a - b)
      .map(bench => {
        const rqdList = bins[bench];
        const total = rqdList.length;

        const density = [0, 0, 0, 0, 0];
        rqdList.forEach(r => {
          const idx = Math.min(4, Math.floor(r / 20));
          density[idx]++;
        });

        rqdList.sort((a, b) => a - b);
        const min = rqdList[0];
        const max = rqdList[total - 1];
        const q1 = rqdList[Math.floor(total * 0.25)];
        const median = rqdList[Math.floor(total * 0.5)];
        const q3 = rqdList[Math.floor(total * 0.75)];

        const stepWidths = density.map(d => total > 0 ? (d / total) * 16 : 0);

        return {
          bench,
          name: `Nivel ${bench}`,
          count: total,
          min, max, q1, median, q3,
          density: stepWidths
        };
      }).filter(item => item.count >= 2);
  }, [visiblePoints]);

  // [Gráfico 3] Scatter Plot RMR vs RQD con Colores por Litología
  const scatterRmrRqd = useMemo(() => {
    const valid = visiblePoints.filter(p => p.rmr89 !== undefined && p.rmr89 !== null);
    return downsampleScatterData(valid, 'rqd_pct', 'rmr89');
  }, [visiblePoints]);

  const trendlineRmrRqd = useMemo(() => {
    const pts = visiblePoints.filter(p => p.rmr89 !== undefined && p.rmr89 !== null);
    if (pts.length < 2) return [];

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = pts.length;
    pts.forEach(p => {
      const x = p.rqd_pct;
      const y = p.rmr89!;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const num = (n * sumXY) - (sumX * sumY);
    const den = (n * sumXX) - (sumX * sumX);
    if (den === 0) return [];

    const slope = num / den;
    const intercept = (sumY - slope * sumX) / n;

    return [
      { x: 0, y: Math.max(0, Math.min(120, intercept)) },
      { x: 100, y: Math.max(0, Math.min(120, slope * 100 + intercept)) }
    ];
  }, [visiblePoints]);

  // [Gráfico 4] Heatmap Matrix de Taladro - Nivel (Cota de 25m)
  const heatmapMatrix = useMemo(() => {
    const elevs = visiblePoints.map(p => p.elev_m || 4000).filter(e => !isNaN(e));
    if (elevs.length === 0) return { benches: [], taladros: [], grid: {} };

    const binSize = 25;
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);

    const benchesList: number[] = [];
    const startBench = Math.floor(minE / binSize) * binSize;
    const endBench = Math.ceil(maxE / binSize) * binSize;
    for (let b = startBench; b <= endBench; b += binSize) {
      benchesList.push(b);
    }

    const taladroCounts: Record<string, number> = {};
    visiblePoints.forEach(p => {
      taladroCounts[p.taladro] = (taladroCounts[p.taladro] || 0) + 1;
    });
    const sortedTaladros = Object.entries(taladroCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Mostrar top 10 taladros en Heatmap
      .map(x => x[0]);

    const gridAccum: Record<string, Record<number, { sum: number; count: number }>> = {};
    sortedTaladros.forEach(t => { gridAccum[t] = {}; });

    visiblePoints.forEach(p => {
      const t = p.taladro;
      if (!gridAccum[t]) return;
      const b = Math.round((p.elev_m || 4000) / binSize) * binSize;
      if (benchesList.includes(b)) {
        if (!gridAccum[t][b]) gridAccum[t][b] = { sum: 0, count: 0 };
        gridAccum[t][b].sum += p.rqd_pct;
        gridAccum[t][b].count++;
      }
    });

    const grid: Record<string, Record<number, number>> = {};
    sortedTaladros.forEach(t => {
      grid[t] = {};
      benchesList.forEach(b => {
        const cell = gridAccum[t][b];
        if (cell && cell.count > 0) {
          grid[t][b] = Math.round(cell.sum / cell.count);
        }
      });
    });

    const activeBenches = benchesList.filter(b => {
      return sortedTaladros.some(t => grid[t][b] !== undefined);
    });

    return {
      benches: activeBenches.sort((a, b) => a - b),
      taladros: sortedTaladros,
      grid
    };
  }, [visiblePoints]);

  // [Gráfico 5] Histograma con Curva de Densidad
  const rqdDistributionData = useMemo(() => {
    const bins = Array(10).fill(0);
    visiblePoints.forEach(p => {
      const pct = p.rqd_pct;
      const binIdx = Math.min(9, Math.floor(pct / 10));
      bins[binIdx]++;
    });

    const labels = ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100"];

    const densityCurve = bins.map((qty, idx) => {
      const start = Math.max(0, idx - 1);
      const end = Math.min(9, idx + 1);
      let sum = 0;
      for (let i = start; i <= end; i++) sum += bins[i];
      const avg = sum / (end - start + 1);
      return visiblePoints.length > 0 ? parseFloat(avg.toFixed(1)) : 0;
    });

    return bins.map((qty, idx) => ({
      name: labels[idx],
      cantidad: qty,
      densidad: densityCurve[idx]
    }));
  }, [visiblePoints]);

  // [Gráfico 6] Categorías RMR por Litología 3 (USANDO LITO3)
  const rmrLitoStackedData = useMemo(() => {
    const groups: Record<string, { muyBuena: number; buena: number; regular: number; mala: number; muyMala: number }> = {};

    visiblePoints.forEach(p => {
      const lito = (p.lito3 || 'S/D').trim().toUpperCase(); // Cambiado a lito3
      if (lito === '-1' || lito === '-' || lito === 'S/D') return;
      const rmr = p.rmr89;
      if (rmr === undefined || rmr === null) return;

      if (!groups[lito]) {
        groups[lito] = { muyBuena: 0, buena: 0, regular: 0, mala: 0, muyMala: 0 };
      }

      if (rmr >= 81) groups[lito].muyBuena++;
      else if (rmr >= 61) groups[lito].buena++;
      else if (rmr >= 41) groups[lito].regular++;
      else if (rmr >= 21) groups[lito].mala++;
      else groups[lito].muyMala++;
    });

    return Object.entries(groups).map(([lito, counts]) => ({
      name: lito,
      "Muy buena": counts.muyBuena,
      "Buena": counts.buena,
      "Regular": counts.regular,
      "Mala": counts.mala,
      "Muy mala": counts.muyMala,
      total: counts.muyBuena + counts.buena + counts.regular + counts.mala + counts.muyMala
    })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [visiblePoints]);

  const scatterBien = useMemo(() => downsampleScatterData(visiblePoints, 'spacing_mm', 'rqd_pct'), [visiblePoints]);
  const scatterPh = useMemo(() => downsampleScatterData(visiblePoints, 'ff_per_m', 'rqd_pct'), [visiblePoints]);

  return (
    <div className="flex flex-col gap-5 pb-8 select-none">

      {/* ── Topbar / Filtros Resumidos ── */}
      <div className="glass-panel rounded-xl border border-navy-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-navy-950/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <BarChart2 size={20} />
          </div>
          <div>
            <h1 className="text-md font-black text-slate-100 tracking-wide uppercase">Dashboard de Análisis RQD &amp; RMR</h1>
            <p className="text-[10px] text-slate-400 font-semibold">Visualizaciones geomecánicas interactivas para validación de datos espaciales y clasificaciones.</p>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex bg-navy-900/60 p-1 rounded-lg border border-navy-800 self-start md:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('correlaciones')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'correlaciones' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Correlaciones de Banda (Principal)
          </button>
          <button
            onClick={() => setActiveTab('propuesta')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'propuesta' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Dashboard de 6 Gráficos
          </button>
          {/* NUEVA OPCIÓN ADAPTADA A NUESTROS ESTILOS Y DATA */}
          <button
            onClick={() => setActiveTab('lito_rqd')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'lito_rqd' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            RQD por Litología
          </button>
        </div>
      </div>

      {/* ── Multi-select de Taladros ── */}
      <div className="glass-panel rounded-xl border border-navy-800 p-4 bg-navy-950/20 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <ListFilter size={13} className="text-cyan-400" /> Filtrado por Taladro
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={goPrev} className="p-1.5 rounded bg-navy-900 border border-navy-800 text-slate-400 hover:text-cyan-400 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <div className="px-3 py-1 rounded bg-navy-900 border border-navy-800 text-xs font-bold text-center min-w-[150px] truncate max-w-[220px]">
              {isAllSelected ? (
                "Todos los Taladros"
              ) : singleSelected ? (
                `📍 ${singleSelected} (${drillIndex + 1}/${drillNames.length})`
              ) : (
                `${deferredSelected.size} Seleccionados`
              )}
            </div>
            <button onClick={goNext} className="p-1.5 rounded bg-navy-900 border border-navy-800 text-slate-400 hover:text-cyan-400 transition-colors">
              <ChevronRight size={14} />
            </button>
            <button
              onClick={selectAll}
              className={`px-3 py-1 rounded text-xxs font-black uppercase tracking-wider border transition-all ${isAllSelected ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-400 animate-pulse'}`}
            >
              Mostrar Todos
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {drillNames.map(name => {
            const active = selectedDrills.has(name);
            const isCurrent = name === activeTaladro?.name;
            return (
              <div
                key={name}
                className={`flex items-center rounded-full text-[10px] font-bold border transition-all h-7 ${active ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/35' : 'bg-navy-900/60 text-slate-400 border-navy-800 hover:text-slate-200'}`}
              >
                <button
                  onClick={() => selectOnly(name)}
                  className="pl-3 pr-1.5 py-0.5 flex items-center gap-1 hover:text-cyan-300 h-full rounded-l-full"
                >
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />}
                  <span>{name}</span>
                </button>
                <button
                  onClick={() => toggleDrill(name)}
                  className="pr-2.5 pl-1.5 h-full flex items-center hover:text-red-400 border-l border-navy-800 rounded-r-full hover:bg-red-500/10"
                >
                  {active ? "✕" : "＋"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[400px]">
        {isPending && (
          <div className="absolute inset-0 bg-navy-950/20 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-2xl">
            <div className="bg-navy-950/90 border border-navy-800 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-400 font-extrabold text-xxs tracking-wider uppercase animate-pulse">Procesando correlación geomecánica...</span>
            </div>
          </div>
        )}

        {/* ── PESTAÑA A: CORRELACIONES DE BANDA (PRINCIPAL) ── */}
        {activeTab === 'correlaciones' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* KPI Stats Grid */}
            {loadingAll && visiblePoints.length === 0 ? (
              <div className="glass-panel rounded-xl border border-navy-800 p-6 text-center text-slate-500 text-sm bg-navy-950">
                <span className="animate-pulse text-cyan-400">⏳ Cargando datos geomecánicos de todos los taladros…</span>
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Muestras', value: stats.n, unit: '', sub: `${drillNames.length} taladros disponibles`, isDynamic: false },
                  { label: 'RQD Promedio', value: stats.rqdAvg.toFixed(1), unit: '%', sub: rqdClass(stats.rqdAvg).label, color: rqdClass(stats.rqdAvg).color, isDynamic: true },
                  { label: 'Espaciamiento Medio', value: Math.round(stats.espAvg), unit: 'mm', sub: spacingClass(stats.espAvg).label, color: spacingClass(stats.espAvg).color, isDynamic: true },
                  { label: 'Dentro de Banda', value: stats.dentro, unit: '', sub: `${Math.round(stats.dentro / stats.n * 100)}% del total`, isDynamic: false },
                  { label: 'Sobre Banda', value: stats.n - stats.dentro, unit: '', sub: 'Valores atípicos', isDynamic: false },
                  { label: 'Metraje Calculado', value: (stats.n * 1.5).toFixed(1), unit: 'm', sub: 'Longitud equivalente', isDynamic: false },
                ].map((card, i) => (
                  <div key={i} className="glass-panel rounded-xl border border-navy-800 p-4 flex flex-col gap-1 bg-navy-950/40">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{card.label}</span>
                    <span
                      className="text-2xl font-black"
                      style={{ color: card.isDynamic ? (card.color as string) : undefined }}
                    >
                      {card.value}{card.unit}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{(card as any).sub}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Scatter Plots Principales */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Bieniawski */}
              <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90">
                <div className="mb-4">
                  <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">Bieniawski (1989) — RQD vs Espaciamiento</h2>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">Diagrama logarítmico para comprobar la correspondencia empírica de calidad.</p>
                </div>

                {/* WRAPPER FIJO PARA RECHARTS (Soluciona tooltips, hover y escalas) */}
                <div className="w-full overflow-auto scrollbar-thin rounded-lg border border-navy-900/60 p-2 bg-navy-950/40 mt-2">
                  <div style={{ minWidth: 600, height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b/30" />
                        <XAxis
                          dataKey="x"
                          type="number"
                          scale="log"
                          domain={[0.8, 2200]}
                          ticks={[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]}
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                        >
                          <Label value="Espaciamiento (mm)" position="insideBottom" offset={-15} fill="#64748b" fontSize={11} fontWeight="bold" />
                        </XAxis>
                        <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fill: '#64748b', fontSize: 10 }}>
                          <Label value="RQD (%)" angle={-90} position="insideLeft" offset={15} fill="#64748b" fontSize={11} fontWeight="bold" />
                        </YAxis>
                        <ZAxis type="number" range={[16, 16]} />
                        <Tooltip contentStyle={{ background: '#090f1d', borderColor: '#1e293b', fontSize: 11 }} />

                        <Line data={bienMinLine} dataKey="y" type="monotone" dot={false} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" name="Banda Mínima" />
                        <Line data={bienMaxLine} dataKey="y" type="monotone" dot={false} stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" name="Banda Máxima" />
                        <Line data={bienMidLine} dataKey="y" type="monotone" dot={false} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 3" name="Media" />

                        <Scatter data={scatterBien}>
                          {scatterBien.map((entry, index) => (
                            <Cell key={`cell-bien-${index}`} fill={getDrillColor(entry.taladro)} />
                          ))}
                        </Scatter>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* Priest & Hudson */}
              <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90">
                <div className="mb-4">
                  <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">Priest &amp; Hudson (1976) — RQD vs FF/m</h2>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">Densidad lineal de fracturación empírica en matriz geomecánica.</p>
                </div>

                <div className="w-full overflow-auto scrollbar-thin rounded-lg border border-navy-900/60 p-2 bg-navy-950/40 mt-2">
                  <div style={{ minWidth: 600, height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b/30" />
                        <XAxis type="number" dataKey="x" domain={[-0.5, 40.5]} ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40]} tick={{ fill: '#64748b', fontSize: 10 }}>
                          <Label value="Frecuencia de Fracturas (fract/m)" position="insideBottom" offset={-15} fill="#64748b" fontSize={11} fontWeight="bold" />
                        </XAxis>
                        <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fill: '#64748b', fontSize: 10 }}>
                          <Label value="RQD (%)" angle={-90} position="insideLeft" offset={15} fill="#64748b" fontSize={11} fontWeight="bold" />
                        </YAxis>
                        <ZAxis type="number" range={[16, 16]} />
                        <Tooltip contentStyle={{ background: '#090f1d', borderColor: '#1e293b', fontSize: 11 }} />

                        <Line data={phSuaveLine} dataKey="y" type="monotone" dot={false} stroke="#64748b" strokeWidth={2} name="P&H Teórico" />
                        <Line data={lambdaMinLine} dataKey="y" type="monotone" dot={false} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" name="Banda Mínima" />
                        <Line data={lambdaMaxLine} dataKey="y" type="monotone" dot={false} stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" name="Banda Máxima" />

                        <Scatter data={scatterPh}>
                          {scatterPh.map((entry, index) => (
                            <Cell key={`cell-ph-${index}`} fill={getDrillColor(entry.taladro)} />
                          ))}
                        </Scatter>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </div>

            {/* Tabla Detallada (Resumen por Taladro) */}
            {allTaladrosInfo.length > 0 && (
              <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-navy-950/40">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Resumen Estadístico por Taladro</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Desglose analítico de registros y correlaciones geotécnicas</p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-900 border border-navy-800 text-slate-300 hover:text-slate-100 hover:bg-navy-850 transition-all shadow-sm"
                  >
                    Imprimir
                  </button>
                </div>

                <div className="overflow-x-auto scrollbar-thin border border-navy-900/60 rounded-lg">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-navy-950/90 sticky top-0 z-10">
                      <tr className="border-b border-navy-800">
                        {['Taladro', 'Muestras', 'RQD Medio (%)', 'Clasificación', 'Espaciamiento Medio', 'FF Medio'].map(h => (
                          <th key={h} className="px-4 py-3 text-slate-400 font-bold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allTaladrosInfo.map(t => {
                        const cls = rqdClass(t.rqd_avg);
                        return (
                          <tr key={t.name} className="border-b border-navy-900/40 hover:bg-navy-900/20 transition-colors">
                            <td className="px-4 py-2 font-bold text-sm" style={{ color: getDrillColor(t.name) }}>{t.name}</td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{t.count_rqd_esp}</td>
                            <td className="px-4 py-2 font-bold font-mono" style={{ color: cls.color }}>{t.rqd_avg}%</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: cls.color + '20', color: cls.color }}>{cls.label}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{t.spacing_avg} mm</td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{t.ff_avg} fract/m</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── PESTAÑA B: DASHBOARD DE 6 GRÁFICOS (CUADRÍCULA 2x3 CON SCROLLBARS FORZADOS) ── */}
        {activeTab === 'propuesta' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch animate-fade-in">

            {/* [Gráfico 1] RQD por Litología 3 */}
            <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
              <div className="mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">1</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">RQD por Litología 3</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Comparativa de dispersión y valores atípicos (outliers) mediante Boxplot.</p>
              </div>

              {/* Scrollbars forzados nativos HTML/CSS */}
              <div className="flex-1 w-full overflow-auto scrollbar-thin mt-2 border border-navy-900/60 rounded-lg p-2 bg-navy-950/40">
                <div className="min-w-[600px] h-[320px] flex items-stretch">
                  <div className="w-8 flex flex-col justify-between text-[10px] font-bold text-slate-500 border-r border-navy-900/60 pr-1 select-none py-2">
                    <span>100</span><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
                  </div>
                  <div className="flex-1 flex justify-around items-end pl-4 relative h-full">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
                      {[1, 2, 3, 4, 5].map(v => <div key={v} className="w-full border-b border-navy-900/40" />)}
                    </div>
                    {lito3BoxPlotData.length === 0 ? (
                      <div className="text-[10px] text-slate-500 italic m-auto">Datos insuficientes</div>
                    ) : (
                      lito3BoxPlotData.map(group => {
                        const toY = (val: number) => 100 - val;
                        const q1 = group.box[0];
                        const q3 = group.box[1];
                        return (
                          <div key={group.name} className="flex flex-col items-center justify-end w-16 z-10 group relative h-full pt-6">
                            <div className="w-8 h-full relative">
                              <div className="absolute left-[15px] w-[2px] bg-slate-500" style={{ top: `${toY(group.whiskerMax)}%`, bottom: `${100 - toY(group.whiskerMin)}%` }} />
                              <div className="absolute left-2 right-2 h-[2px] bg-slate-500" style={{ top: `${toY(group.whiskerMax)}%` }} />
                              <div className="absolute left-2 right-2 h-[2px] bg-slate-500" style={{ top: `${toY(group.whiskerMin)}%` }} />
                              <div
                                className="absolute left-0 right-0 border rounded-sm"
                                style={{
                                  top: `${toY(group.median)}%`,
                                  transform: `translateY(-${(q3 - q1) / 2}%)`,
                                  height: `${q3 - q1}%`,
                                  backgroundColor: `${group.color}30`,
                                  borderColor: group.color,
                                  borderWidth: '2px'
                                }}
                              />
                              <div className="absolute left-0 right-0 h-[3px] bg-white shadow-sm" style={{ top: `${toY(group.median)}%` }} />
                              {group.outliers.map((o, idx) => (
                                <div key={idx} className="absolute w-2 h-2 rounded-full bg-red-500 border border-slate-900 left-[12px]" style={{ top: `${toY(o)}%` }} />
                              ))}
                            </div>
                            <span className="text-[10px] font-black text-slate-300 tracking-wider truncate max-w-full uppercase mt-3">{group.name}</span>
                            <span className="text-[9px] text-slate-500 font-bold leading-none mt-1">n={group.count}</span>

                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#090f1d] border border-navy-700 p-3 rounded-lg text-[10px] text-slate-200 z-50 w-32 text-left shadow-2xl pointer-events-none">
                              <p className="font-extrabold text-cyan-400 mb-1">Roca: {group.name}</p>
                              <p>Máx: {group.whiskerMax}%</p>
                              <p>Q3: {q3}%</p>
                              <p className="font-bold text-white text-xs my-0.5">Med: {group.median}%</p>
                              <p>Q1: {q1}%</p>
                              <p>Mín: {group.whiskerMin}%</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* [Gráfico 2] RQD por Nivel (Violin Plot) */}
            <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
              <div className="mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">2</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">RQD por Nivel</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Variación vertical y densidad geomecánica mapeada en profundidad (Bancos de 50m).</p>
              </div>

              {/* Scrollbars forzados nativos HTML/CSS */}
              <div className="flex-1 w-full overflow-auto scrollbar-thin mt-2 border border-navy-900/60 rounded-lg p-2 bg-navy-950/40">
                <div className="min-w-[600px] h-[320px] flex items-stretch">
                  <div className="w-8 flex flex-col justify-between text-[10px] font-bold text-slate-500 border-r border-navy-900/60 pr-1 select-none py-2">
                    <span>100</span><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
                  </div>
                  <div className="flex-1 flex justify-around items-end pl-4 relative h-full">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2">
                      {[1, 2, 3, 4, 5].map(v => <div key={v} className="w-full border-b border-navy-900/40" />)}
                    </div>
                    {levelViolinData.length === 0 ? (
                      <div className="text-[10px] text-slate-500 italic m-auto">Sin niveles cargados</div>
                    ) : (
                      levelViolinData.map(group => {
                        const toY = (val: number) => 100 - val;
                        const q1 = group.q1;
                        const q3 = group.q3;

                        return (
                          <div key={group.bench} className="flex flex-col items-center justify-end w-16 z-10 group relative h-full pt-6">
                            <div className="w-10 h-full relative flex items-center justify-center">
                              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none">
                                {(() => {
                                  const steps = group.density;
                                  const ptsUpper: string[] = [];
                                  const ptsLower: string[] = [];
                                  steps.forEach((w, idx) => {
                                    const y = 5 + idx * 22.5;
                                    ptsUpper.push(`${20 - w},${y}`);
                                    ptsLower.unshift(`${20 + w},${y}`);
                                  });
                                  const pathString = [...ptsUpper, ...ptsLower].join(' ');
                                  return (
                                    <polygon points={pathString} fill="url(#violinGrad)" stroke="#06b6d4" strokeWidth="0.8" />
                                  );
                                })()}
                                <defs>
                                  <linearGradient id="violinGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#0891b2" stopOpacity="0.1" />
                                    <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <div className="absolute w-1 bg-slate-900 border border-slate-100/50 rounded-full" style={{ top: `${toY(q3)}%`, bottom: `${100 - toY(q1)}%` }} />
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-white border border-slate-950 z-20 shadow-md" style={{ top: `calc(${toY(group.median)}% - 5px)` }} />
                            </div>

                            <span className="text-[10px] font-black text-slate-300 tracking-wider mt-3 uppercase">{group.name.replace('Nivel ', 'N')}</span>
                            <span className="text-[9px] text-slate-500 font-bold leading-none mt-1">n={group.count}</span>

                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#090f1d] border border-navy-700 p-3 rounded-lg text-[10px] text-slate-200 z-50 w-32 text-left shadow-2xl pointer-events-none">
                              <p className="font-extrabold text-cyan-400 mb-1">Cota: {group.bench}m</p>
                              <p>Máx RQD: {group.max}%</p>
                              <p>Q3: {q3}%</p>
                              <p className="font-bold text-white text-xs my-0.5">Mediana: {group.median}%</p>
                              <p>Q1: {q1}%</p>
                              <p>Mín RQD: {group.min}%</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* [Gráfico 3] RMR vs RQD (Scatter en Wrapper Fijo) */}
            <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
              <div className="mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">3</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">RMR vs RQD</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Diagrama de correlación directa con colores segmentados por Litología y línea de tendencia matemática.</p>
              </div>

              {/* Wrapper Estricto para Recharts ResponsiveContainer */}
              <div className="flex-1 w-full overflow-auto scrollbar-thin mt-2 border border-navy-900/60 rounded-lg p-2 bg-navy-950/40">
                <div style={{ minWidth: 600, height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart margin={{ top: 15, right: 15, bottom: 0, left: -15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b/40" />
                      <XAxis type="number" dataKey="x" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }}>
                        <Label value="RQD (%)" offset={-5} position="insideBottom" fill="#64748b" fontSize={11} fontWeight="bold" />
                      </XAxis>
                      <YAxis type="number" dataKey="y" domain={[0, 120]} ticks={[0, 20, 40, 60, 80, 100, 120]} tick={{ fill: '#64748b', fontSize: 10 }}>
                        <Label value="RMR'89" angle={-90} position="insideLeft" offset={15} fill="#64748b" fontSize={11} fontWeight="bold" />
                      </YAxis>
                      <ZAxis type="number" range={[30, 30]} />
                      <Tooltip contentStyle={{ background: '#090f1d', borderColor: '#1e293b', fontSize: 11 }} />

                      <Scatter name="Datos" data={scatterRmrRqd}>
                        {scatterRmrRqd.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={getLitoColor(entry.lito1)} />
                        ))}
                      </Scatter>
                      <Line name="Tendencia" data={trendlineRmrRqd} dataKey="y" xBy="x" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* [Gráfico 4] Heatmap Espacial Taladro - Nivel (Tabla HTML fluida) */}
            <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
              <div className="mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">4</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">Heatmap Taladro - Nivel</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Identificación de zonas críticas espaciales al cruzar pozos vs cota (25m).</p>
              </div>

              {/* Wrapper fluido para la Tabla de Heatmap */}
              <div className="flex-1 w-full overflow-auto scrollbar-thin mt-2 border border-navy-900/60 rounded-lg p-2 bg-navy-950/40">
                <div className="min-w-max h-full flex flex-col min-h-[300px]">
                  {heatmapMatrix.benches.length === 0 ? (
                    <div className="text-xs text-slate-500 italic m-auto">Sin datos espaciales</div>
                  ) : (
                    <table className="w-full min-w-max border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-navy-950 z-20 w-24">Taladro</th>
                          {heatmapMatrix.benches.map(bench => (
                            <th key={bench} className="p-2 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap px-4">{bench}m</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapMatrix.taladros.map(tal => (
                          <tr key={tal}>
                            <td className="p-2 text-[10px] font-black text-slate-200 truncate sticky left-0 bg-navy-950 border-r border-navy-900" title={tal}>{tal.slice(-10)}</td>
                            {heatmapMatrix.benches.map(bench => {
                              const val = heatmapMatrix.grid[tal]?.[bench];
                              return (
                                <td
                                  key={`${tal}-${bench}`}
                                  className={`p-2 text-center font-bold text-xs border border-[#090f1d] rounded-sm transition-all ${val !== undefined ? getHeatmapBg(val) : 'bg-navy-950/20 text-slate-700'}`}
                                  title={`Taladro: ${tal}\nBanco: ${bench}m\nRQD: ${val !== undefined ? `${val}%` : 'S/D'}`}
                                >
                                  {val !== undefined ? val : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 shrink-0">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Escala RQD Promedio (%)</span>
                <div className="flex gap-1 h-3 items-stretch w-40">
                  {['bg-[#4c1d95]', 'bg-[#b91c1c]', 'bg-[#ea580c]', 'bg-[#eab308]', 'bg-[#22c55e]', 'bg-[#16a34a]'].map((bg, idx) => (
                    <div key={idx} className={`flex-1 ${bg} rounded-sm`} title={[`<25%`, `25-40%`, `40-50%`, `50-65%`, `65-80%`, `>80%`][idx]} />
                  ))}
                </div>
              </div>
            </div>

            {/* [Gráfico 5] Distribución de RQD (Histograma en Wrapper Fijo) */}
            <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
              <div className="mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">5</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">Distribución del RQD</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Revisión de frecuencias absolutas y sesgos en el mapeo mediante histograma y curva de densidad.</p>
              </div>

              {/* Wrapper Estricto */}
              <div className="flex-1 w-full overflow-auto scrollbar-thin mt-2 border border-navy-900/60 rounded-lg p-2 bg-navy-950/40">
                <div style={{ minWidth: 600, height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rqdDistributionData} margin={{ top: 20, right: 15, bottom: 0, left: -15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b/40" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#090f1d', borderColor: '#1e293b', fontSize: 11 }} />

                      <Bar dataKey="cantidad" fill="#1e3a8a" radius={[4, 4, 0, 0]} name="Frecuencia">
                        <LabelList dataKey="cantidad" position="top" fill="#94a3b8" fontSize={11} fontWeight="bold" />
                      </Bar>
                      <Line type="monotone" dataKey="densidad" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={false} name="Densidad Promedio" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* [Gráfico 6] Categorías RMR por Litología 3 (Stacked Bar en Wrapper Fijo) */}
            <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
              <div className="mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">6</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">Categorías RMR por Litología 3</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Segmentación en cantidades absolutas de la calidad de macizo rocoso por unidad lito-estratigráfica (Lito 3).</p>
              </div>

              {/* Wrapper Estricto */}
              <div className="flex-1 w-full overflow-auto scrollbar-thin mt-2 border border-navy-900/60 rounded-lg p-2 bg-navy-950/40">
                <div style={{ minWidth: 600, height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rmrLitoStackedData} margin={{ top: 20, right: 15, bottom: 0, left: -15 }} maxBarSize={70}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b/40" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#090f1d', borderColor: '#1e293b', fontSize: 11 }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />

                      <Bar dataKey="Muy buena" stackId="a" fill="#10b981" />
                      <Bar dataKey="Buena" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="Regular" stackId="a" fill="#eab308" />
                      <Bar dataKey="Mala" stackId="a" fill="#f97316" />
                      <Bar dataKey="Muy mala" stackId="a" fill="#ef4444">
                        <LabelList dataKey="total" position="top" fill="#cbd5e1" fontSize={11} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── PESTAÑA C: NUEVO DASHBOARD INDEPENDIENTE "RQD POR LITOLOGÍA" ── */}
        {activeTab === 'lito_rqd' && (
          <RqdPorLitologiaTab visiblePoints={visiblePoints} />
        )}

      </div>

      <footer className="text-center text-[10px] text-slate-500 mt-2 font-bold no-print uppercase tracking-widest">
        Sistema de Mapeo Geomecánico Integrado • Geolog Pro 2.0
      </footer>
    </div>
  );
}