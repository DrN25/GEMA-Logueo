import { useState, useMemo, useCallback } from 'react';
import { calculateRowRmr } from '../../utils/formulaEngine';

// ─── Puntos de Control y Envolventes (Bieniawski Chart D) ───────────────────
export const BIENIAWSKI_CTRL_MIN = [
  { x: 90, y: 0 },
  { x: 100, y: 8.35 },
  { x: 200, y: 59.11 },
  { x: 600, y: 95.36 },
  { x: 1650, y: 100 },
  { x: 2000, y: 100 }
];

export const BIENIAWSKI_CTRL_MAX = [
  { x: 14, y: 0 },
  { x: 20, y: 6.57 },
  { x: 30, y: 16.87 },
  { x: 40, y: 27.17 },
  { x: 70, y: 56.66 },
  { x: 100, y: 74.17 },
  { x: 200, y: 92.59 },
  { x: 600, y: 99.78 },
  { x: 1000, y: 100 },
  { x: 2000, y: 100 }
];

export const BIENIAWSKI_CTRL_MID = [
  { x: 35.5, y: 0 },
  { x: 40, y: 3.4 },
  { x: 50, y: 11.0 },
  { x: 70, y: 26.25 },
  { x: 100, y: 47.9 },
  { x: 150, y: 69.1 },
  { x: 200, y: 80.76 },
  { x: 300, y: 91.38 },
  { x: 500, y: 98.0 },
  { x: 1000, y: 100 },
  { x: 2000, y: 100 }
];

// ─── Puntos de Control (Priest & Hudson / FF) ───────────────────────────────
export const LAMBDA_CTRL_MIN = [
  { x: 0, y: 57.14 },
  { x: 1.25, y: 56.75 },
  { x: 2.5, y: 55.58 },
  { x: 5, y: 51.98 },
  { x: 10, y: 42.08 },
  { x: 15, y: 31.92 },
  { x: 20, y: 23.09 },
  { x: 25, y: 16.48 },
  { x: 30, y: 11.34 },
  { x: 35, y: 7.66 },
  { x: 40, y: 5.23 }
];

export const LAMBDA_CTRL_MAX = [
  { x: 7.5, y: 95.24 },
  { x: 10, y: 84.43 },
  { x: 15, y: 63.58 },
  { x: 20, y: 46.42 },
  { x: 25, y: 33.06 },
  { x: 30, y: 22.91 },
  { x: 35, y: 15.60 },
  { x: 40, y: 10.37 }
];

export function phTeoricoFn(ff: number): number {
  if (ff <= 0) return 100;
  return Math.min(100, 100 * Math.exp(-0.1 * ff) * (0.1 * ff + 1));
}

export function interpolateY(ctrlPoints: { x: number; y: number }[], targetX: number, isLog: boolean = false): number {
  if (!ctrlPoints || ctrlPoints.length === 0) return 0;
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

export function getDrillColor(name: string): string {
  if (!name) return '#38bdf8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const DRILL_COLORS = [
    '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80',
    '#60a5fa', '#facc15', '#2dd4bf', '#f87171', '#fb7185'
  ];
  return DRILL_COLORS[Math.abs(hash) % DRILL_COLORS.length];
}

interface UseRmrStateProps {
  corridas: any[];
  waterTableM: number;
}

export function useRmrState({
  corridas = [],
  waterTableM
}: UseRmrStateProps) {
  // Filtros locales
  const [filterLito, setFilterLito] = useState<string>('');
  const [filterMaxDepth, setFilterMaxDepth] = useState<string>('');

  // Filtros aplicados reactivos
  const [appliedLito, setAppliedLito] = useState<string>('');
  const [appliedMaxDepth, setAppliedMaxDepth] = useState<string>('');

  // Toggler de columnas
  const [showAllColumns, setShowAllColumns] = useState<boolean>(true);

  // Tooltips gráficos
  const [hoveredPointBien, setHoveredPointBien] = useState<any>(null);
  const [hoveredPointPh, setHoveredPointPh] = useState<any>(null);

  const handleApplyFilters = useCallback(() => {
    setAppliedLito(filterLito);
    setAppliedMaxDepth(filterMaxDepth);
  }, [filterLito, filterMaxDepth]);

  const handleClearFilters = useCallback(() => {
    setFilterLito('');
    setFilterMaxDepth('');
    setAppliedLito('');
    setAppliedMaxDepth('');
  }, []);

  // Filtrado de corridas reactivo
  const filteredCorridas = useMemo(() => {
    const safeCorridas = Array.isArray(corridas) ? corridas : [];
    return safeCorridas.filter(row => {
      if (appliedLito) {
        const rowLitoClean = (row.lito1 || '').trim().toUpperCase();
        const filterLitoClean = appliedLito.trim().toUpperCase();
        if (rowLitoClean !== filterLitoClean) {
          return false;
        }
      }
      const maxD = appliedMaxDepth ? parseFloat(appliedMaxDepth) : Infinity;
      if (row.a > maxD) {
        return false;
      }
      return true;
    });
  }, [corridas, appliedLito, appliedMaxDepth]);

  // Calcular RMR para todas las corridas filtradas
  const calculatedRows = useMemo(() => {
    return filteredCorridas.map((row, idx) => {
      const rmrRes = calculateRowRmr(row, waterTableM);
      return {
        row,
        idx,
        rmrRes
      };
    });
  }, [filteredCorridas, waterTableM]);

  const validRows = useMemo(() => {
    return calculatedRows.filter(r => !r.rmrRes.error);
  }, [calculatedRows]);

  // Promedios generales
  const avgRmr89 = useMemo(() => {
    return validRows.length > 0
      ? (validRows.reduce((sum, r) => sum + (r.rmrRes.rmr_89 || 0), 0) / validRows.length).toFixed(1)
      : "0.0";
  }, [validRows]);

  const avgRmr76 = useMemo(() => {
    return validRows.length > 0
      ? (validRows.reduce((sum, r) => sum + (r.rmrRes.rmr_76 || 0), 0) / validRows.length).toFixed(1)
      : "0.0";
  }, [validRows]);

  const avgRqd = useMemo(() => {
    return validRows.length > 0
      ? (validRows.reduce((sum, r) => sum + (r.rmrRes.rqd_pct || 0), 0) / validRows.length).toFixed(1)
      : "0.0";
  }, [validRows]);

  // Puntos de datos para las gráficas
  const chartPoints = useMemo(() => {
    return validRows.map(r => {
      const res = r.rmrRes;
      const total_frac = res.total_frac ?? 0;
      const perf = res.perf ?? 1;
      const ff = total_frac > 0 ? total_frac / perf : 0;
      return {
        corrida: r.row.corrida,
        prof_m: parseFloat(((r.row.de + r.row.a) / 2).toFixed(2)),
        rqd_pct: res.rqd_pct ?? 0,
        spacing_mm: res.spacing_mm ?? 0,
        ff_per_m: parseFloat(ff.toFixed(4)),
        ph_teorico: parseFloat(phTeoricoFn(ff).toFixed(2)),
      };
    });
  }, [validRows]);

  const scatterBien = useMemo(() => {
    return chartPoints.map(p => ({ ...p, x: p.spacing_mm, y: p.rqd_pct }));
  }, [chartPoints]);

  const scatterPh = useMemo(() => {
    return chartPoints.map(p => ({ ...p, x: p.ff_per_m, y: p.rqd_pct }));
  }, [chartPoints]);

  return {
    filterLito,
    setFilterLito,
    filterMaxDepth,
    setFilterMaxDepth,
    showAllColumns,
    setShowAllColumns,
    hoveredPointBien,
    setHoveredPointBien,
    hoveredPointPh,
    setHoveredPointPh,
    handleApplyFilters,
    handleClearFilters,
    filteredCorridas,
    calculatedRows,
    avgRmr89,
    avgRmr76,
    avgRqd,
    scatterBien,
    scatterPh
  };
}