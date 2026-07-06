import { useMemo } from 'react';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, ZAxis,
  ResponsiveContainer, Tooltip, Legend, BarChart, Bar, LabelList, Cell, Label
} from 'recharts';
import {
  type DashPoint, getLitoColor,
  downsampleScatterData, getHeatmapBg
} from './rqdDashboardHelpers';

interface RqdSixChartsTabProps {
  visiblePoints: DashPoint[];
}

export default function RqdSixChartsTab({ visiblePoints }: RqdSixChartsTabProps) {
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

    const densityCurve = bins.map((_, idx) => {
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
      const lito = (p.lito3 || 'S/D').trim().toUpperCase();
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

  return (
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

      {/* [Gráfico 3] RMR vs RQD */}
      <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
        <div className="mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">3</span>
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">RMR vs RQD</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Diagrama de correlación directa con colores segmentados por Litología y línea de tendencia matemática.</p>
        </div>

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
                <Line name="Tendencia" data={trendlineRmrRqd} dataKey="y" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* [Gráfico 4] Heatmap Espacial Taladro - Nivel */}
      <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
        <div className="mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">4</span>
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">Heatmap Taladro - Nivel</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Identificación de zonas críticas espaciales al cruzar pozos vs cota (25m).</p>
        </div>

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

      {/* [Gráfico 5] Distribución de RQD */}
      <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
        <div className="mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">5</span>
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">Distribución del RQD</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Revisión de frecuencias absolutas y sesgos en el mapeo mediante histograma y curva de densidad.</p>
        </div>

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

      {/* [Gráfico 6] Categorías RMR por Litología 3 */}
      <div className="glass-panel rounded-xl border border-navy-800 p-5 bg-[#090f1d]/90 flex flex-col justify-between h-full min-h-[450px]">
        <div className="mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-black">6</span>
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">Categorías RMR por Litología 3</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Segmentación en cantidades absolutas de la calidad de macizo rocoso por unidad lito-estratigráfica (Lito 3).</p>
        </div>

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
  );
}
