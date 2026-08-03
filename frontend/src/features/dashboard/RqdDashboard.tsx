import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { BarChart2, ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import RqdPorLitologiaTab, { getLithologyClass } from './RqdPorLitologiaTab';
import RqdPorNivelTab from './RqdPorNivelTab';
import {
  type Corrida, type DashPoint, type TaladroSummary, LITHOLOGY_COLORS, getDrillColor,
  rqdClass, spacingClass, computePointsFromCorridas, bandStatus,
  downsampleScatterData, phTeoricoFn
} from './rqdDashboardHelpers';
import BieniawskiChartSection from './BieniawskiChartSection';
import PriestHudsonChartSection from './PriestHudsonChartSection';
import RqdSixChartsTab from './RqdSixChartsTab';

interface Props {
  activeTaladro: { name: string; corridas: Corrida[]; nivel_freatico?: number; [key: string]: any } | null;
  taladros: TaladroSummary[];
  onSelectTaladro: (name: string) => void;
}

export default function RqdDashboard({ activeTaladro, taladros: _taladros }: Props) {
  // Pestaña activa por defecto: correlaciones (Priest & Bieniawski)
  const [activeTab, setActiveTab] = useState<'correlaciones' | 'propuesta' | 'lito_rqd' | 'nivel_rqd'>('correlaciones');

  const [selectedDrills, setSelectedDrills] = useState<Set<string>>(new Set());
  const deferredSelected = useDeferredValue(selectedDrills);
  const isPending = selectedDrills !== deferredSelected;

  const [showBgBands, setShowBgBands] = useState<boolean>(true);
  const [showDensityRibbon, setShowDensityRibbon] = useState<boolean>(true);
  const [colorByLithology, setColorByLithology] = useState<boolean>(false);

  const [allPoints, setAllPoints] = useState<DashPoint[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allTaladrosInfo, setAllTaladrosInfo] = useState<any[]>([]);
  const hasInitialized = React.useRef(false);

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
            const first10 = new Set<string>(list.slice(0, 10).map((t: any) => t.name));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const isSingleDrillActive = deferredSelected.size === 1;

  const lithologyZones = useMemo(() => {
    if (deferredSelected.size !== 1) return [];

    const binsCount: Record<number, Record<string, number>> = {};
    for (let i = 0; i < 10; i++) {
      binsCount[i] = {
        INTRUSIVOS: 0,
        SEDIMENTARIOS: 0,
        METAMORFICAS: 0,
        BRECHAS: 0,
        ENDOSKARN: 0,
        DESCONOCIDO: 0
      };
    }

    visiblePoints.forEach(p => {
      let binIdx = Math.floor(p.rqd_pct / 10);
      if (binIdx < 0) binIdx = 0;
      if (binIdx > 9) binIdx = 9;

      const mainLito = p.lito3 && p.lito3 !== '-1' && p.lito3 !== '-' ? p.lito3 : (p.lito1 || 'S/D');
      const clase = getLithologyClass(mainLito);

      if (binsCount[binIdx] && binsCount[binIdx][clase] !== undefined) {
        binsCount[binIdx][clase]++;
      }
    });

    const binDominant: { bin: number; clase: string; count: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const counts = binsCount[i];
      let maxClass = '';
      let maxVal = 0;
      Object.entries(counts).forEach(([clase, count]) => {
        if (count > maxVal) {
          maxVal = count;
          maxClass = clase;
        }
      });

      if (maxVal > 0) {
        binDominant.push({ bin: i, clase: maxClass, count: maxVal });
      }
    }

    const mergedZones: { y1: number; y2: number; litoClass: string }[] = [];
    let currentZone: { y1: number; y2: number; litoClass: string } | null = null;

    for (let i = 0; i < 10; i++) {
      const dominant = binDominant.find(d => d.bin === i);
      if (dominant) {
        const y1 = i * 10;
        const y2 = (i + 1) * 10;
        if (currentZone && currentZone.litoClass === dominant.clase) {
          currentZone.y2 = y2;
        } else {
          if (currentZone) {
            mergedZones.push(currentZone);
          }
          currentZone = { y1, y2, litoClass: dominant.clase };
        }
      } else {
        if (currentZone) {
          mergedZones.push(currentZone);
          currentZone = null;
        }
      }
    }
    if (currentZone) {
      mergedZones.push(currentZone);
    }

    return mergedZones;
  }, [visiblePoints, deferredSelected]);

  const rqdBinsData = useMemo(() => {
    if (deferredSelected.size !== 1) return [];

    const bins = [];
    for (let i = 0; i < 10; i++) {
      const counts: Record<string, number> = {
        INTRUSIVOS: 0,
        SEDIMENTARIOS: 0,
        METAMORFICAS: 0,
        BRECHAS: 0,
        ENDOSKARN: 0,
        DESCONOCIDO: 0
      };

      const binPoints = visiblePoints.filter(p => {
        let binIdx = Math.floor(p.rqd_pct / 10);
        if (binIdx < 0) binIdx = 0;
        if (binIdx > 9) binIdx = 9;
        return binIdx === i;
      });

      binPoints.forEach(p => {
        const mainLito = p.lito3 && p.lito3 !== '-1' && p.lito3 !== '-' ? p.lito3 : (p.lito1 || 'S/D');
        const clase = getLithologyClass(mainLito);
        if (counts[clase] !== undefined) {
          counts[clase]++;
        }
      });

      let dominantClass = 'Ninguno';
      let dominantColor = '#1e293b';
      let maxVal = 0;
      Object.entries(counts).forEach(([clase, count]) => {
        if (count > maxVal) {
          maxVal = count;
          dominantClass = clase;
        }
      });

      if (maxVal > 0) {
        dominantColor = LITHOLOGY_COLORS[dominantClass]?.solid || LITHOLOGY_COLORS.DESCONOCIDO.solid;
      }

      bins.push({
        binIdx: i,
        dominantClass,
        dominantColor,
        counts
      });
    }

    return bins;
  }, [visiblePoints, deferredSelected]);

  const stats = useMemo(() => {
    const pts = visiblePoints;
    if (pts.length === 0) return null;
    const n = pts.length;
    const rqdAvg = pts.reduce((a, b) => a + b.rqd_pct, 0) / n;
    const espAvg = pts.reduce((a, b) => a + b.spacing_mm, 0) / n;
    const dentro = pts.filter(p => bandStatus(p.rqd_pct, p.spacing_mm) === 'dentro').length;
    return { n, rqdAvg, espAvg, dentro };
  }, [visiblePoints]);

  const lithologySummaryStats = useMemo(() => {
    const statsObj: Record<string, {
      name: string;
      color: string;
      n: number;
      rqdSum: number;
      espSum: number;
      ffSum: number;
      dentroCount: number;
    }> = {};

    Object.keys(LITHOLOGY_COLORS).forEach(clase => {
      statsObj[clase] = {
        name: LITHOLOGY_COLORS[clase].label,
        color: LITHOLOGY_COLORS[clase].solid,
        n: 0,
        rqdSum: 0,
        espSum: 0,
        ffSum: 0,
        dentroCount: 0
      };
    });

    visiblePoints.forEach(p => {
      const mainLito = p.lito3 && p.lito3 !== '-1' && p.lito3 !== '-' ? p.lito3 : (p.lito1 || 'S/D');
      const clase = getLithologyClass(mainLito);
      const isDentro = bandStatus(p.rqd_pct, p.spacing_mm) === 'dentro';

      if (statsObj[clase]) {
        statsObj[clase].n++;
        statsObj[clase].rqdSum += p.rqd_pct;
        statsObj[clase].espSum += p.spacing_mm;
        statsObj[clase].ffSum += p.ff_per_m;
        if (isDentro) {
          statsObj[clase].dentroCount++;
        }
      }
    });

    return Object.entries(statsObj)
      .map(([key, value]) => {
        if (value.n === 0) return null;
        const rqdAvg = value.rqdSum / value.n;
        const espAvg = value.espSum / value.n;
        const ffAvg = value.ffSum / value.n;
        const pctDentro = (value.dentroCount / value.n) * 100;

        let calidad = 'Muy Mala';
        let calidadColor = 'text-red-500';
        if (rqdAvg >= 90) {
          calidad = 'Excelente';
          calidadColor = 'text-emerald-400';
        } else if (rqdAvg >= 75) {
          calidad = 'Buena';
          calidadColor = 'text-emerald-300';
        } else if (rqdAvg >= 50) {
          calidad = 'Regular';
          calidadColor = 'text-amber-400';
        } else if (rqdAvg >= 25) {
          calidad = 'Mala';
          calidadColor = 'text-orange-500';
        }

        let recomendacion = '';
        if (rqdAvg <= 40) {
          recomendacion = '⚠️ Zona de alta debilidad. Monitorear e incrementar fortificación/soporte.';
        } else if (pctDentro < 60) {
          recomendacion = '🔍 Dispersión alta. Posible presencia de meteorización selectiva o fracturas mecánicas.';
        } else {
          recomendacion = '✅ Comportamiento estructural estable y predecible. Roca competente.';
        }

        return {
          key,
          ...value,
          rqdAvg,
          espAvg,
          ffAvg,
          pctDentro,
          calidad,
          calidadColor,
          recomendacion
        };
      })
      .filter(Boolean) as any[];
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
          <button
            onClick={() => setActiveTab('nivel_rqd')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'nivel_rqd' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            RQD por Nivel / Sector
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

            {/* Control Panel for Lithology Zones */}
            <div className="glass-panel rounded-xl border border-navy-800 p-4 bg-[#090f1d]/85 flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider">
                    Análisis de Distribución Litológica{isSingleDrillActive && ` — ${singleSelected}`}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {isSingleDrillActive
                      ? 'Predominancia de clases litológicas en base a densidades reales de RQD'
                      : '💡 Selecciona exactamente 1 taladro en el listado para activar el análisis de densidad y bandas de fondo'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {/* Toggles */}
                <div className="flex items-center gap-3 border-r border-navy-800/80 pr-4">
                  {isSingleDrillActive && (
                    <>
                      <button
                        onClick={() => setShowBgBands(prev => !prev)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${showBgBands
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/10'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-navy-700 hover:text-slate-200'
                          }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${showBgBands ? 'bg-cyan-400 animate-pulse' : 'bg-slate-550'}`} />
                        Franjas de Fondo
                      </button>
                      <button
                        onClick={() => setShowDensityRibbon(prev => !prev)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${showDensityRibbon
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/10'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-navy-700 hover:text-slate-200'
                          }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${showDensityRibbon ? 'bg-cyan-400 animate-pulse' : 'bg-slate-550'}`} />
                        Columna de Densidad
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setColorByLithology(prev => !prev)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${colorByLithology
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/10'
                        : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-navy-700 hover:text-slate-200'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${colorByLithology ? 'bg-cyan-400 animate-pulse' : 'bg-slate-550'}`} />
                    Color por Litología
                  </button>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold">
                  {Object.entries(LITHOLOGY_COLORS).map(([key, cfg]) => {
                    return (
                      <div key={key} className="flex items-center gap-1.5 bg-navy-950/60 px-2 py-1 rounded border border-navy-900/40">
                        <span className="w-2 h-2 rounded" style={{ backgroundColor: cfg.solid }} />
                        <span className="text-slate-400">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Scatter Plots Principales */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Bieniawski */}
              <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90">
                <div className="mb-4">
                  <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">Bieniawski (1989) — RQD vs Espaciamiento</h2>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">Diagrama logarítmico para comprobar la correspondencia empírica de calidad.</p>
                </div>

                <BieniawskiChartSection
                  scatterBien={scatterBien}
                  lithologyZones={lithologyZones}
                  rqdBinsData={rqdBinsData}
                  showBgBands={showBgBands}
                  showDensityRibbon={showDensityRibbon}
                  colorByLithology={colorByLithology}
                />
              </section>

              {/* Priest & Hudson */}
              <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90">
                <div className="mb-4">
                  <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">Priest &amp; Hudson (1976) — RQD vs FF/m</h2>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">Densidad lineal de fracturación empírica en matriz geomecánica.</p>
                </div>

                <PriestHudsonChartSection
                  scatterPh={scatterPh}
                  phSuaveLine={phSuaveLine}
                  lithologyZones={lithologyZones}
                  rqdBinsData={rqdBinsData}
                  showBgBands={showBgBands}
                  showDensityRibbon={showDensityRibbon}
                  colorByLithology={colorByLithology}
                />
              </section>
            </div>

            {/* Matriz de Síntesis Geomecánica por Clase Litológica */}
            {lithologySummaryStats.length > 0 && (
              <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-navy-950/40">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">📊 Matriz de Síntesis Geomecánica por Clase Litológica</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Análisis cuantitativo por tipo de roca y concordancia con las bandas empíricas de control.</p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-navy-850">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-navy-900/60 border-b border-navy-850 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-3">Clase Litológica</th>
                        <th className="p-3 text-center">Nº Muestras</th>
                        <th className="p-3 text-center">RQD Promedio</th>
                        <th className="p-3 text-center">Calidad RQD</th>
                        <th className="p-3 text-center">Espaciamiento Prom.</th>
                        <th className="p-3 text-center">FF Medio (fract/m)</th>
                        <th className="p-3 text-center">Concordancia Banda</th>
                        <th className="p-3">Interpretación y Recomendación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-900/50">
                      {lithologySummaryStats.map((row: any) => (
                        <tr key={row.key} className="hover:bg-navy-900/25 transition-colors font-semibold">
                          <td className="p-3 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                            <span style={{ color: row.color }} className="font-extrabold">{row.name}</span>
                          </td>
                          <td className="p-3 text-center text-slate-300 font-bold">{row.n}</td>
                          <td className="p-3 text-center text-slate-100 font-extrabold">{row.rqdAvg.toFixed(1)}%</td>
                          <td className="p-3 text-center">
                            <span className={`font-black ${row.calidadColor}`}>{row.calidad}</span>
                          </td>
                          <td className="p-3 text-center text-slate-100 font-extrabold">{Math.round(row.espAvg)} mm</td>
                          <td className="p-3 text-center text-slate-100 font-extrabold">{row.ffAvg.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <span className={`font-black ${row.pctDentro >= 75 ? 'text-emerald-400' : row.pctDentro >= 50 ? 'text-amber-400' : 'text-red-500'}`}>
                              {row.pctDentro.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 italic text-xxs font-normal">{row.recomendacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

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

        {/* ── PESTAÑA B: DASHBOARD DE 6 GRÁFICOS ── */}
        {activeTab === 'propuesta' && (
          <RqdSixChartsTab visiblePoints={visiblePoints} />
        )}

        {/* ── PESTAÑA C: NUEVO DASHBOARD INDEPENDIENTE "RQD POR LITOLOGÍA" ── */}
        {activeTab === 'lito_rqd' && (
          <RqdPorLitologiaTab visiblePoints={visiblePoints} />
        )}

        {/* ── PESTAÑA D: NUEVO DASHBOARD INDEPENDIENTE "RQD POR NIVEL / SECTOR" ── */}
        {activeTab === 'nivel_rqd' && (
          <RqdPorNivelTab visiblePoints={visiblePoints} />
        )}

      </div>

      <footer className="text-center text-[10px] text-slate-500 mt-2 font-bold no-print uppercase tracking-widest">
        Sistema de Mapeo Geomecánico Integrado • Geolog Pro 2.0
      </footer>
    </div>
  );
}