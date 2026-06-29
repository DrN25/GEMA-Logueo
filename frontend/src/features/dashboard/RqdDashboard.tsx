import React, { useState, useEffect, useMemo, useCallback, useTransition, Component, type ReactNode } from 'react';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Label, Cell
} from 'recharts';
import { BarChart2, ChevronLeft, ChevronRight, ListFilter, Info } from 'lucide-react';
import { calculateRowRmr } from '../../utils/formulaEngine';

// ─── Control Points & Envelopes (Bieniawski Chart D) ─────────────────────────

const BIENIAWSKI_CTRL_MIN = [
  { x: 90, y: 0 },
  { x: 100, y: 8.35 },
  { x: 200, y: 59.11 },
  { x: 600, y: 95.36 },
  { x: 1650, y: 100 },
  { x: 2000, y: 100 }
];

const BIENIAWSKI_CTRL_MAX = [
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

const BIENIAWSKI_CTRL_MID = [
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

// ─── Puntos de Control (Priest & Hudson / FF) ───────────────────────────────────

const LAMBDA_CTRL_MIN = [
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

const LAMBDA_CTRL_MAX = [
  { x: 7.5, y: 95.24 },
  { x: 10, y: 84.43 },
  { x: 15, y: 63.58 },
  { x: 20, y: 46.42 },
  { x: 25, y: 33.06 },
  { x: 30, y: 22.91 },
  { x: 35, y: 15.60 },
  { x: 40, y: 10.37 }
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

const getGeomechColorClasses = (color: string) => {
  switch (color) {
    case 'emerald': return { border: 'border-emerald-500/25', text: 'text-emerald-400', bg: 'bg-emerald-500/5' };
    case 'blue': return { border: 'border-blue-500/25', text: 'text-blue-400', bg: 'bg-blue-500/5' };
    case 'cyan': return { border: 'border-cyan-500/25', text: 'text-cyan-400', bg: 'bg-cyan-500/5' };
    case 'amber': return { border: 'border-amber-500/25', text: 'text-amber-400', bg: 'bg-amber-500/5' };
    case 'red': return { border: 'border-red-500/25', text: 'text-red-400', bg: 'bg-red-500/5' };
    default: return { border: 'border-slate-800', text: 'text-slate-400', bg: 'bg-slate-900/10' };
  }
};

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

  // Declarar primero las variables de interpolación de curvas
  const rMin = interpolateY(BIENIAWSKI_CTRL_MIN, spacingMm, true);
  const rMax = interpolateY(BIENIAWSKI_CTRL_MAX, spacingMm, true);

  // Ejecutar comparaciones de forma segura con las variables ya declaradas
  if (rqd > rMax) return 'sobre';
  if (rqd < rMin) return 'bajo';
  return 'dentro';
}

function rqdClass(rqd: number): { label: string; color: string } {
  if (rqd >= 90) return { label: 'Excelente', color: '#10b981' };
  if (rqd >= 75) return { label: 'Buena', color: '#3b82f6' };
  if (rqd >= 50) return { label: 'Regular', color: '#f59e0b' };
  if (rqd >= 25) return { label: 'Mala', color: '#f97316' };
  return { label: 'Muy Mala', color: '#ef4444' };
}

function spacingClass(s: number): { label: string; color: string } {
  if (s > 500) return { label: 'Muy Amplio', color: '#10b981' };
  if (s > 200) return { label: 'Amplio', color: '#3b82f6' };
  if (s > 60) return { label: 'Moderado', color: '#f59e0b' };
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
      });
    } catch {
      // Ignorar corridas silenciosamente
    }
  }
  return points;
}

// ─── COMPONENTE MEMOIZADO DE TABLAS DETALLADAS (Omitido al mover el mouse) ───
const DetailedAnalysisSection = React.memo(({
  visiblePoints,
  allTaladrosInfo
}: {
  visiblePoints: DashPoint[];
  allTaladrosInfo: any[];
}) => {
  return (
    <section id="analysis-section" className="glass-panel rounded-xl border border-navy-800 p-5 bg-navy-950/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Análisis Detallado</h2>
          <p className="text-xs text-slate-500 mt-0.5">Desglose analítico de registros y correlaciones geotécnicas</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-900 border border-navy-800 text-slate-300 hover:text-slate-100 hover:bg-navy-850 transition-all shadow-sm"
        >
          Imprimir
        </button>
      </div>

      {/* Resumen por taladro */}
      {allTaladrosInfo.length > 1 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Resumen por Taladro</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-navy-850">
                  {['Taladro', 'N RQD/Esp', 'RQD Medio (%)', 'Clasificación', 'Esp. Medio (mm)', 'FF Medio'].map(h => (
                    <th key={h} className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTaladrosInfo.map(t => {
                  const cls = rqdClass(t.rqd_avg);
                  return (
                    <tr key={t.name} className="border-b border-navy-900/60 hover:bg-navy-900/40 transition-colors">
                      <td className="px-3 py-2 font-bold" style={{ color: getDrillColor(t.name) }}>{t.name}</td>
                      <td className="px-3 py-2 text-slate-300">{t.count_rqd_esp}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: cls.color }}>{t.rqd_avg}%</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: cls.color + '20', color: cls.color }}>{cls.label}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{t.spacing_avg} mm</td>
                      <td className="px-3 py-2 text-slate-300">{t.ff_avg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla detallada Bieniawski */}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Estadísticas — Bieniawski (RQD vs Espaciamiento)</h3>
      <div className="overflow-x-auto mb-6 max-h-[350px]">
        <table className="w-full text-xs text-left">
          <thead className="sticky top-0 bg-navy-900 z-10 border-b border-navy-850">
            <tr>
              {['Corrida', 'Taladro', 'Punto Medio Corrida', 'RQD (%)', 'Esp. (mm)', 'Clasificación', 'Banda', 'P&H Teórico', 'Δ P&H'].map(h => (
                <th key={h} className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiblePoints.map((p, i) => {
              const band = bandStatus(p.rqd_pct, p.spacing_mm);
              const cls = rqdClass(p.rqd_pct);
              const delta = p.rqd_pct - p.ph_teorico;
              return (
                <tr key={i} className={`border-b border-navy-900/60 transition-colors ${Math.abs(delta) > 15 ? 'bg-amber-500/5' : 'hover:bg-navy-900/40'}`}>
                  <td className="px-3 py-2 font-mono text-slate-300">{p.corrida}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: getDrillColor(p.taladro) }}>{p.taladro}</td>
                  <td className="px-3 py-2 text-slate-300">{p.prof_m}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: cls.color }}>{p.rqd_pct}%</td>
                  <td className="px-3 py-2 text-slate-300">{p.spacing_mm}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: cls.color + '20', color: cls.color }}>{cls.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-bold text-xs ${band === 'dentro' ? 'text-emerald-400' : band === 'sobre' ? 'text-violet-400' : 'text-red-400'}`}>
                      {band === 'dentro' ? '✓ Dentro' : band === 'sobre' ? '▲ Sobre' : '▼ Bajo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{p.ph_teorico}%</td>
                  <td className={`px-3 py-2 font-semibold ${Math.abs(delta) > 15 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {visiblePoints.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-600 italic">Sin datos para mostrar.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tabla detallada P&H */}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Estadísticas — Priest &amp; Hudson (FF/m vs RQD)</h3>
      <div className="overflow-x-auto max-h-[350px]">
        <table className="w-full text-xs text-left">
          <thead className="sticky top-0 bg-navy-900 z-10 border-b border-navy-850">
            <tr>
              {['Corrida', 'Taladro', 'Punto Medio Corrida', 'FF (fract/m)', 'RQD medido (%)', 'RQD P&H teórico (%)', 'Δ (med – teórico)', 'Clasificación FF'].map(h => (
                <th key={h} className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiblePoints.map((p, i) => {
              const delta = p.rqd_pct - p.ph_teorico;
              const ffCls = p.ff_per_m < 2 ? { label: 'Muy Amplio', color: '#10b981' }
                : p.ff_per_m < 5 ? { label: 'Amplio', color: '#3b82f6' }
                  : p.ff_per_m < 16 ? { label: 'Moderado', color: '#f59e0b' }
                    : { label: 'Muy Cerrado', color: '#ef4444' };
              return (
                <tr key={i} className={`border-b border-navy-900/60 transition-colors ${Math.abs(delta) > 15 ? 'bg-amber-500/5' : 'hover:bg-navy-900/40'}`}>
                  <td className="px-3 py-2 font-mono text-slate-300">{p.corrida}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: getDrillColor(p.taladro) }}>{p.taladro}</td>
                  <td className="px-3 py-2 text-slate-300">{p.prof_m}</td>
                  <td className="px-3 py-2 font-semibold text-slate-200">{p.ff_per_m.toFixed(2)}</td>
                  <td className="px-3 py-2 font-bold text-slate-100">{p.rqd_pct}%</td>
                  <td className="px-3 py-2 text-cyan-400 font-semibold">{p.ph_teorico}%</td>
                  <td className={`px-3 py-2 font-semibold ${Math.abs(delta) > 15 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: ffCls.color + '20', color: ffCls.color }}>{ffCls.label}</span>
                  </td>
                </tr>
              );
            })}
            {visiblePoints.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-600 italic">Sin datos para mostrar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
});

DetailedAnalysisSection.displayName = 'DetailedAnalysisSection';

// ─── Error Boundary ───

class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, errorMsg: String(err?.message || err) };
  }
  componentDidCatch(err: any, info: any) {
    console.error('[DashboardRQD] Error capturado por boundary:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel rounded-xl border border-red-500/30 p-8 text-center bg-navy-950">
          <p className="text-red-400 text-lg font-bold mb-2">⚠️ Error al renderizar el Dashboard</p>
          <p className="text-slate-400 text-sm mb-4">{this.state.errorMsg}</p>
          <button
            className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all"
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Componente Principal de Datos del Dashboard ───

class DashboardRQDInner extends Component<
  Props,
  {
    selectedDrills: Set<string>;
    allPoints: DashPoint[];
    loadingAll: boolean;
    allTaladrosInfo: { name: string; count_rqd_esp: number; rqd_avg: number; spacing_avg: number; ff_avg: number }[];
  }
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedDrills: new Set(), // MOSTRAR TODOS POR DEFECTO AL CARGAR
      allPoints: [],
      loadingAll: false,
      allTaladrosInfo: []
    };
  }

  componentDidMount() {
    this.fetchAllData();
  }

  // --- NUEVA OPTIMIZACIÓN DE ALTO NIVEL: MANIPULACIÓN DIRECTA DEL DOM PARA HOVER DE TOOLTIPS (0ms REACT OVERHEAD) ---
  showTooltip = (e: any, d: any, type: 'bien' | 'ph') => {
    const tooltipEl = document.getElementById(`${type}-floating-tooltip`);
    if (!tooltipEl) return;

    let html = '';
    if (type === 'bien') {
      const minRqd = interpolateY(BIENIAWSKI_CTRL_MIN, d.spacing_mm, true);
      const maxRqd = interpolateY(BIENIAWSKI_CTRL_MAX, d.spacing_mm, true);
      html = `
        <div class="font-extrabold text-cyan-400 border-b border-navy-800 pb-1.5 mb-1 text-sm tracking-wide">
          📍 ${d.taladro} — Corrida ${d.corrida}
        </div>
        <p class="text-slate-100 font-extrabold text-xs">
          Espaciamiento: <span class="text-cyan-300 font-black">${d.spacing_mm} mm</span>
        </p>
        <p class="text-blue-400 text-xs">
          Curva RQD mínimo: <span class="font-bold">${minRqd > 0 ? `${minRqd.toFixed(1)}%` : '0.0%'}</span>
        </p>
        <p class="text-orange-400 text-xs">
          Curva RQD máximo: <span class="font-bold">${maxRqd > 0 ? `${maxRqd.toFixed(1)}%` : '100.0%'}</span>
        </p>
        <p class="text-slate-300 text-xs">
          RQD Medido: <span class="text-emerald-400 font-bold">${d.rqd_pct}%</span>
        </p>
        <p class="text-slate-300 text-xs">
          Estado de Banda: <span class="font-semibold text-emerald-400">
            ${bandStatus(d.rqd_pct, d.spacing_mm) === 'dentro' ? '✓ Dentro de Banda' : '▲ Fuera de Banda'}
          </span>
        </p>
      `;
    } else {
      const ff = d.ff_per_m;
      const minRqd = interpolateY(LAMBDA_CTRL_MIN, ff, false);
      const maxRqd = interpolateY(LAMBDA_CTRL_MAX, ff, false);
      const delta = d.rqd_pct - d.ph_teorico;
      const deltaColorClass = Math.abs(delta) > 15 ? 'text-amber-400' : 'text-emerald-400';
      html = `
        <div class="font-extrabold text-cyan-400 border-b border-navy-800 pb-1.5 mb-1 text-sm tracking-wide">
          📍 ${d.taladro} — Corrida ${d.corrida}
        </div>
        <p class="text-slate-100 font-extrabold text-xs mb-1">
          FF = <span class="text-cyan-300 font-black">${ff.toFixed(2)} fract/m</span>
        </p>
        <p class="text-red-400 text-xs">
          Curva RQD mínimo: <span class="font-bold">${minRqd > 0 ? `${minRqd.toFixed(1)}%` : '0.0%'}</span>
        </p>
        <p class="text-blue-400 text-xs">
          Curva RQD máximo: <span class="font-bold">${maxRqd > 0 ? `${maxRqd.toFixed(1)}%` : '100.0%'}</span>
        </p>
        <p class="text-slate-300 text-xs">
          Priest &amp; Hudson teórico: <span class="text-slate-100 font-bold">${d.ph_teorico}%</span>
        </p>
        <p class="text-slate-300 text-xs">
          RQD Medido: <span class="text-emerald-400 font-bold">${d.rqd_pct}%</span>
        </p>
        <p class="text-slate-300 text-xs">
          Delta (Med - Teórico): <span class="font-semibold ${deltaColorClass}">
            ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%
          </span>
        </p>
      `;
    }

    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';

    const parentEl = tooltipEl.parentElement;
    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      tooltipEl.style.left = `${x}px`;
      tooltipEl.style.top = `${y}px`;
    }
  };

  moveTooltip = (e: any, type: 'bien' | 'ph') => {
    const tooltipEl = document.getElementById(`${type}-floating-tooltip`);
    if (!tooltipEl) return;
    const parentEl = tooltipEl.parentElement;
    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      tooltipEl.style.left = `${x}px`;
      tooltipEl.style.top = `${y}px`;
    }
  };

  hideTooltip = (type: 'bien' | 'ph') => {
    const tooltipEl = document.getElementById(`${type}-floating-tooltip`);
    if (tooltipEl) {
      tooltipEl.style.display = 'none';
    }
  };

  fetchAllData = async () => {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";
    this.setState({ loadingAll: true });
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/rqd-summary`);
      if (res.ok) {
        const data = await res.json();
        this.setState({
          allPoints: data.points_rqd_esp || [],
          allTaladrosInfo: data.taladros || []
        });
      } else {
        throw new Error('Backend no disponible');
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
      this.setState({
        allPoints: pts,
        allTaladrosInfo: infos
      });
    } finally {
      this.setState({ loadingAll: false });
    }
  };

  toggleDrill = (name: string) => {
    this.setState(prevState => {
      const next = new Set(prevState.selectedDrills);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return { selectedDrills: next };
    });
  };

  selectAll = () => {
    this.setState({
      selectedDrills: new Set()
    });
    this.hideTooltip('bien');
    this.hideTooltip('ph');
  };

  selectOnly = (name: string) => {
    this.setState({
      selectedDrills: new Set([name])
    });
    this.hideTooltip('bien');
    this.hideTooltip('ph');
  };

  render() {
    const { activeTaladro } = this.props;
    const { selectedDrills, allPoints, loadingAll, allTaladrosInfo } = this.state;

    // Procesar puntos de datos de la corrida activa local
    const activePoints = activeTaladro ? computePointsFromCorridas(activeTaladro.corridas, activeTaladro.name) : [];

    // Combinar corridas en memoria
    const mergedPoints = activeTaladro
      ? [...allPoints.filter(p => p.taladro !== activeTaladro.name), ...activePoints]
      : allPoints;

    // Filtrar los puntos según la selección de píldoras
    const visiblePoints = selectedDrills.size === 0
      ? mergedPoints
      : mergedPoints.filter(p => selectedDrills.has(p.taladro));

    // Cuadrícula de promedios para KPIs
    const stats = (() => {
      const pts = visiblePoints;
      if (pts.length === 0) return null;
      const n = pts.length;
      const rqdAvg = pts.reduce((a, b) => a + b.rqd_pct, 0) / n;
      const espAvg = pts.reduce((a, b) => a + b.spacing_mm, 0) / n;
      const dentro = pts.filter(p => bandStatus(p.rqd_pct, p.spacing_mm) === 'dentro').length;
      const sobre = pts.filter(p => bandStatus(p.rqd_pct, p.spacing_mm) === 'sobre').length;
      const bajo = pts.filter(p => bandStatus(p.rqd_pct, p.spacing_mm) === 'bajo').length;
      const rqdStd = Math.sqrt(pts.reduce((a, b) => a + Math.pow(b.rqd_pct - rqdAvg, 2), 0) / n);
      const rqdMin = Math.min(...pts.map(p => p.rqd_pct));
      const rqdMax = Math.max(...pts.map(p => p.rqd_pct));
      return { n, rqdAvg, espAvg, dentro, sobre, bajo, rqdStd, rqdMin, rqdMax };
    })();

    const drillNames = Array.from(new Set([...allPoints.map(p => p.taladro), ...(activeTaladro ? [activeTaladro.name] : [])])).sort();
    const isAllSelected = selectedDrills.size === 0;

    const singleSelected = selectedDrills.size === 1 ? [...selectedDrills][0] : null;
    const drillIndex = singleSelected ? drillNames.indexOf(singleSelected) : -1;

    const goPrev = () => {
      if (isAllSelected || !singleSelected) { this.selectOnly(drillNames[drillNames.length - 1]); return; }
      const idx = drillNames.indexOf(singleSelected);
      if (idx <= 0) this.selectAll();
      else this.selectOnly(drillNames[idx - 1]);
    };

    const goNext = () => {
      if (isAllSelected || !singleSelected) { this.selectOnly(drillNames[0]); return; }
      const idx = drillNames.indexOf(singleSelected);
      if (idx >= drillNames.length - 1) this.selectAll();
      else this.selectOnly(drillNames[idx + 1]);
    };

    const scatterBien = visiblePoints.map(p => ({ ...p, x: p.spacing_mm, y: p.rqd_pct }));
    const scatterPh = visiblePoints.map(p => ({ ...p, x: p.ff_per_m, y: p.rqd_pct }));

    const bienMinLine = BIENIAWSKI_CTRL_MIN;
    const bienMaxLine = BIENIAWSKI_CTRL_MAX;
    const bienMidLine = BIENIAWSKI_CTRL_MID;

    const lambdaMinLine = LAMBDA_CTRL_MIN;
    const lambdaMaxLine = LAMBDA_CTRL_MAX;

    const phSuaveLine = (() => {
      const pts = [];
      for (let ff = 0; ff <= 40; ff += 0.5) {
        pts.push({ x: ff, y: parseFloat(phTeoricoFn(ff).toFixed(2)) });
      }
      return pts;
    })();

    return (
      <div className="flex flex-col gap-6 pb-10">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="glass-panel rounded-xl border border-navy-800 p-5 flex items-center justify-between bg-navy-950/20">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BarChart2 size={22} className="text-cyan-400" />
              <h1 className="text-xl font-black text-slate-100 tracking-wide">Dashboard RQD &amp; Espaciamiento</h1>
            </div>
            <p className="text-xs text-slate-500 ml-9">Correlación según Bieniawski (1989) — Clasificación RMR · Priest &amp; Hudson (1976)</p>
          </div>
        </div>

        {/* ── KPI Stats Grid ───────────────────────────────────────── */}
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
              { label: 'Sobre Banda', value: stats.sobre, unit: '', sub: 'Por encima de RQD máx', isDynamic: false },
              { label: 'Bajo Banda', value: stats.bajo, unit: '', sub: 'Por debajo de RQD mín', isDynamic: false },
            ].map((card, i) => (
              <div key={i} className="glass-panel rounded-xl border border-navy-800 p-4 flex flex-col gap-1 bg-navy-950/40">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{card.label}</span>
                <span
                  className="text-2xl font-black"
                  style={{ color: card.isDynamic ? (card.color as string) : undefined }}
                >
                  {card.value}{card.unit}
                </span>
                <span className="text-xs text-slate-500">{(card as any).sub}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-xl border border-navy-800 p-6 text-center text-slate-500 text-sm bg-navy-950">
            <span>No hay corridas con datos válidos. Registra corridas en LGG primero.</span>
          </div>
        )}

        {/* ── Drill Navigator ────────────────── */}
        <div className="glass-panel rounded-xl border border-navy-800 p-4 flex flex-col gap-3 bg-navy-950/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ListFilter size={14} className="text-cyan-400 animate-pulse" /> Selección de Taladros
            </span>
            <div className="flex items-center gap-2">
              <button onClick={goPrev} className="p-1.5 rounded-lg bg-navy-900 border border-navy-800 text-slate-400 hover:text-cyan-400 transition-colors" title="Anterior">
                <ChevronLeft size={16} />
              </button>
              <div className="px-4 py-1.5 rounded-lg bg-navy-900 border border-navy-800 min-w-[260px] md:min-w-[360px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                {isAllSelected ? (
                  <span className="text-cyan-400 font-bold text-sm">≡ Todos ({drillNames.length} taladros)</span>
                ) : selectedDrills.size === 1 ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-slate-100 font-bold text-sm overflow-hidden text-ellipsis max-w-[160px] md:max-w-[240px]" title={singleSelected || ""}>📍 {singleSelected}</span>
                    <span className="text-slate-500 text-xs shrink-0">{drillIndex + 1}/{drillNames.length}</span>
                  </div>
                ) : (
                  <span className="text-violet-400 font-bold text-sm">
                    {selectedDrills.size} taladros seleccionados
                  </span>
                )}
              </div>
              <button onClick={goNext} className="p-1.5 rounded-lg bg-navy-900 border border-navy-800 text-slate-400 hover:text-cyan-400 transition-colors" title="Siguiente">
                <ChevronRight size={16} />
              </button>
              <button
                onClick={this.selectAll}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all active:scale-95 ${isAllSelected
                  ? 'bg-cyan-500/10 text-cyan-400/90 border-cyan-500/30'
                  : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)] animate-pulse'
                  }`}
                title="Restablecer filtro para ver todos los taladros"
              >
                Mostrar Todos
              </button>
            </div>
          </div>

          {/* Pills multi-select interactivos */}
          <div className="flex flex-wrap gap-2">
            {drillNames.map(name => {
              const active = selectedDrills.has(name);
              const isCurrent = name === activeTaladro?.name;
              return (
                <div
                  key={name}
                  className={`flex items-center rounded-full text-xs font-bold border transition-all h-8 ${active
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/35 shadow-sm'
                    : 'bg-navy-900/60 text-slate-400 border-navy-800 hover:text-slate-200 hover:border-navy-700'
                    }`}
                >
                  <button
                    onClick={() => this.selectOnly(name)}
                    className="pl-3.5 pr-2 py-1 flex items-center gap-1.5 hover:text-cyan-300 transition-colors h-full rounded-l-full"
                    title={`Ver únicamente el taladro ${name}`}
                  >
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0 animate-pulse" title="Taladro activo actual" />
                    )}
                    <span>{name}</span>
                  </button>

                  {active ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        this.toggleDrill(name);
                      }}
                      className="pr-3 pl-2 h-full flex items-center hover:text-red-400 border-l border-cyan-500/20 text-cyan-400/60 transition-colors rounded-r-full hover:bg-red-500/10"
                      title={`Quitar ${name} de la consulta`}
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        this.toggleDrill(name);
                      }}
                      className="pr-3 pl-2 h-full flex items-center hover:text-cyan-300 border-l border-navy-800 text-slate-500 transition-colors rounded-r-full hover:bg-cyan-500/5"
                      title={`Añadir ${name} a la consulta`}
                    >
                      ＋
                    </button>
                  )}
                </div>
              );
            })}
            {drillNames.length === 0 && (
              <span className="text-xs text-slate-600 italic">Sin taladros cargados</span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-semibold mt-1 flex items-center gap-1.5">
            <Info size={14} className="text-cyan-400 shrink-0" />
            <span>Haz clic en el nombre para ver <strong>solo ese</strong> taladro · Haz clic en <strong>[ ＋ ]</strong> para añadir taladros a la consulta · Haz clic en <strong>[ ✕ ]</strong> para removerlos.</span>
          </p>
        </div>

        {/* CONTENEDOR DE GRÁFICOS OPTIMIZADOS (ANIMATIONS DISABLED FOR FLUIDITY) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Gráfico 1: Bieniawski */}
          <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-navy-950/40">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold text-slate-100">Espaciamiento de Discontinuidades vs RQD</h2>
                {!isAllSelected && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    📍 {selectedDrills.size === 1 ? singleSelected : `${selectedDrills.size} taladros`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Espaciamiento de Discontinuidades vs RQD — Bieniawski (1989) Chart D</p>
            </div>

            <div className="relative">
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  margin={{ top: 10, right: 20, bottom: 40, left: 20 }}
                  onMouseLeave={() => this.hideTooltip('bien')}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f22" style={{ pointerEvents: 'none' }} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    scale="log"
                    domain={[0.8, 2200]}
                    ticks={[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]}
                    interval={0}
                    allowDataOverflow={true}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  >
                    <Label value="Espaciamiento (mm)" position="insideBottom" offset={-25} fill="#64748b" fontSize={12} />
                  </XAxis>

                  <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 20, 40, 60, 80, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 11 }}>
                    <Label value="RQD (%)" angle={-90} position="insideLeft" offset={10} fill="#64748b" fontSize={12} />
                  </YAxis>

                  {/* Curvas de control de Bieniawski sin animaciones */}
                  <Line data={bienMinLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={2} strokeDasharray="8 4" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={bienMaxLine} dataKey="y" type="monotone" dot={false} stroke="#ff7f0e" strokeWidth={2} strokeDasharray="8 4" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={bienMidLine} dataKey="y" type="monotone" dot={false} stroke="#2ca02c" strokeWidth={2} strokeDasharray="6 4" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />

                  <Scatter name="Ctrl mínimo" data={bienMinLine} fill="none" stroke="#1f77b4" strokeWidth={1.2} r={3} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Scatter name="Ctrl máximo" data={bienMaxLine} fill="none" stroke="#ff7f0e" strokeWidth={1.2} r={3} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />

                  {/* Scatter de puntos sin animación activa (Previene lag de CPU) */}
                  <Scatter
                    data={scatterBien}
                    r={3.5}
                    isAnimationActive={false}
                    onMouseLeave={() => this.hideTooltip('bien')}
                  >
                    {scatterBien.map((entry, index) => (
                      <Cell
                        key={`cell-bien-${index}`}
                        fill={getDrillColor(entry.taladro)}
                        onMouseEnter={(e: any) => this.showTooltip(e, entry, 'bien')}
                        onMouseMove={(e: any) => this.moveTooltip(e, 'bien')}
                        onMouseLeave={() => this.hideTooltip('bien')}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Contenedor del Tooltip flotante administrado directamente en el DOM */}
              <div
                id="bien-floating-tooltip"
                className="absolute z-50 pointer-events-none bg-navy-950/95 border border-navy-700 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-sm space-y-1.5 w-64 text-left font-sans"
                style={{ display: 'none', transform: 'translate(-50%, -100%)', marginTop: '-12px' }}
              />
            </div>

            {/* KPIs de Clasificación */}
            <div className="flex flex-col xl:flex-row xl:items-stretch gap-3 mt-4 pt-4 border-t border-navy-800/60">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                {[
                  { esp: '> 2.0 m', rating: 'RMR: 20 pts', desc: 'Muy Ancho', color: 'emerald' },
                  { esp: '0.6 – 2.0 m', rating: 'RMR: 15 pts', desc: 'Ancho', color: 'blue' },
                  { esp: '200 – 600 mm', rating: 'RMR: 10 pts', desc: 'Moderado', color: 'cyan' },
                  { esp: '60 – 200 mm', rating: 'RMR: 8 pts', desc: 'Cerrado', color: 'amber' },
                  { esp: '< 60 mm', rating: 'RMR: 5 pts', desc: 'Muy Cerrado', color: 'red' },
                ].map((z, i) => {
                  const cc = getGeomechColorClasses(z.color);
                  return (
                    <div key={i} className={`rounded-xl px-2 py-2.5 bg-navy-950/80 border ${cc.border} flex flex-col justify-center items-center text-center min-h-[82px] h-auto`}>
                      <p className={`font-black text-sm ${cc.text} leading-none`}>{z.esp}</p>
                      <p className="text-slate-400 font-bold text-[11px] mt-1 leading-none">{z.rating}</p>
                      <p className="text-slate-200 font-bold text-xs mt-1.5 leading-tight px-1 break-words">{z.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div className="w-full xl:w-56 shrink-0 flex flex-col justify-center bg-navy-900/35 border border-navy-800 rounded-xl p-3 text-xs shadow-md">
                <p className="font-extrabold text-slate-300 border-b border-navy-800/85 pb-1.5 mb-2 text-center uppercase tracking-wider text-[10px]">LEYENDA</p>
                <div className="flex flex-col gap-2 justify-center h-full">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 flex items-center shrink-0"><span className="w-full border-t-2 border-dashed border-[#1f77b4]" /></span>
                    <span className="text-slate-300 font-medium">RQD Mínimo</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 flex items-center shrink-0"><span className="w-full border-t-2 border-dashed border-[#ff7f0e]" /></span>
                    <span className="text-slate-300 font-medium">RQD Máximo</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 flex items-center shrink-0"><span className="w-full border-t-2 border-dashed border-[#2ca02c]" /></span>
                    <span className="text-slate-300 font-medium">Línea Media</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Gráfico 2: Priest & Hudson */}
          <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-navy-950/40">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold text-slate-100">Frecuencia de Fracturas por Metro vs RQD</h2>
                {!isAllSelected && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    📍 {selectedDrills.size === 1 ? singleSelected : `${selectedDrills.size} taladros`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Priest &amp; Hudson (1976) — Curvas empíricas de Bieniawski (1989)</p>
            </div>

            <div className="relative">
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  margin={{ top: 10, right: 20, bottom: 40, left: 20 }}
                  onMouseLeave={() => this.hideTooltip('ph')}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f22" style={{ pointerEvents: 'none' }} />
                  <XAxis dataKey="x" type="number" domain={[-0.8, 40.8]} ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 11 }}>
                    <Label value="Frecuencia de fracturas (fract/m)" position="insideBottom" offset={-25} fill="#64748b" fontSize={12} />
                  </XAxis>

                  <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 20, 40, 60, 80, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 11 }}>
                    <Label value="RQD (%)" angle={-90} position="insideLeft" offset={10} fill="#64748b" fontSize={12} />
                  </YAxis>

                  {/* Curvas Priest & Hudson sin animaciones síncronas */}
                  <Line data={phSuaveLine} dataKey="y" type="monotone" dot={false} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="8 4" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={lambdaMinLine} dataKey="y" type="monotone" dot={false} stroke="#d62728" strokeWidth={2} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={lambdaMaxLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={2} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />

                  <Scatter name="Ctrl mínimo" data={lambdaMinLine} fill="none" stroke="#d62728" strokeWidth={1.2} r={3} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Scatter name="Ctrl máximo" data={lambdaMaxLine} fill="none" stroke="#1f77b4" strokeWidth={1.2} r={3} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />

                  {/* Scatter de puntos sin animación activa (Previene lag de CPU) */}
                  <Scatter
                    data={scatterPh}
                    r={3.5}
                    isAnimationActive={false}
                    onMouseLeave={() => this.hideTooltip('ph')}
                  >
                    {scatterPh.map((entry, index) => (
                      <Cell
                        key={`cell-ph-${index}`}
                        fill={getDrillColor(entry.taladro)}
                        onMouseEnter={(e: any) => this.showTooltip(e, entry, 'ph')}
                        onMouseMove={(e: any) => this.moveTooltip(e, 'ph')}
                        onMouseLeave={() => this.hideTooltip('ph')}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Contenedor del Tooltip flotante administrado directamente en el DOM */}
              <div
                id="ph-floating-tooltip"
                className="absolute z-50 pointer-events-none bg-navy-950/95 border border-navy-700 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-sm space-y-1.5 w-64 text-left font-sans"
                style={{ display: 'none', transform: 'translate(-50%, -100%)', marginTop: '-12px' }}
              />
            </div>

            {/* Leyenda de zonas */}
            <div className="flex flex-col xl:flex-row xl:items-stretch gap-3 mt-4 pt-4 border-t border-navy-800/60">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { ff: 'FF < 2', esp_ph: '> 500 mm', desc: 'Muy Amplio', rqd: '> 81%', color: 'emerald' },
                  { ff: 'FF 2–5', esp_ph: '200–500 mm', desc: 'Amplio', rqd: '45–81%', color: 'blue' },
                  { ff: 'FF 5–16', esp_ph: '60–200 mm', desc: 'Moderado', rqd: '3–45%', color: 'amber' },
                  { ff: 'FF > 16', esp_ph: '< 60 mm', desc: 'Muy Cerrado', rqd: '< 3%', color: 'red' },
                ].map((z, i) => {
                  const cc = getGeomechColorClasses(z.color);
                  return (
                    <div key={i} className={`rounded-xl px-2 py-2.5 bg-navy-950/80 border ${cc.border} flex flex-col justify-center items-center text-center min-h-[82px] h-auto`}>
                      <p className={`font-black text-sm ${cc.text} leading-none`}>{z.ff}</p>
                      <p className="text-slate-400 font-bold text-[11px] mt-1 leading-none">{z.esp_ph}</p>
                      <p className="text-slate-200 font-bold text-xs mt-1.5 leading-tight px-1 break-words">
                        {z.desc} <span className="opacity-80 text-[10px] font-normal block">({z.rqd})</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="w-full xl:w-56 shrink-0 flex flex-col justify-center bg-navy-900/35 border border-navy-800 rounded-xl p-3 text-xs shadow-md">
                <p className="font-extrabold text-slate-300 border-b border-navy-800/85 pb-1.5 mb-2 text-center uppercase tracking-wider text-[10px]">LEYENDA</p>
                <div className="flex flex-col gap-2 justify-center h-full">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 flex items-center shrink-0"><span className="w-full border-t-2 border-solid border-[#d62728]" /></span>
                    <span className="text-slate-300 font-medium">RQD Mínimo</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 flex items-center shrink-0"><span className="w-full border-t-2 border-solid border-[#1f77b4]" /></span>
                    <span className="text-slate-300 font-medium">RQD Máximo</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 flex items-center shrink-0"><span className="w-full border-t-2 border-dashed border-[#e2e8f0]" /></span>
                    <span className="text-slate-300 font-medium">Teórica P&H</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── SECCIÓN DE ANÁLISIS DETALLADO MEMOIZADO (OPTIMIZACIÓN CLAVE) ── */}
        <DetailedAnalysisSection
          visiblePoints={visiblePoints}
          allTaladrosInfo={allTaladrosInfo}
        />

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-slate-600 pb-2 mt-4 no-print">
          Basado en Bieniawski (1989) — Rock Mechanics Design in Mining and Tunneling · Priest &amp; Hudson (1976)
        </footer>
      </div>
    );
  }
}

// ─── Export con ErrorBoundary ─────────────────────────────────────────

export default function DashboardRQDSafe(props: Props) {
  return (
    <DashboardErrorBoundary>
      <DashboardRQDInner {...props} />
    </DashboardErrorBoundary>
  );
}