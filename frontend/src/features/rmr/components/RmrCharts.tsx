import { useMemo } from 'react';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, ZAxis, CartesianGrid,
  ResponsiveContainer, Label, Cell
} from 'recharts';
import {
  BIENIAWSKI_CTRL_MIN,
  BIENIAWSKI_CTRL_MAX,
  BIENIAWSKI_CTRL_MID,
  LAMBDA_CTRL_MIN,
  LAMBDA_CTRL_MAX,
  phTeoricoFn,
  interpolateY,
  getDrillColor
} from '../useRmrState';

interface RmrChartsProps {
  activeTaladroName: string;
  scatterBien?: any[];
  scatterPh?: any[];
  hoveredPointBien: any;
  setHoveredPointBien: (val: any) => void;
  hoveredPointPh: any;
  setHoveredPointPh: (val: any) => void;
}

// ─── Tooltips de Seguimiento Localizados (Un Solo Taladro) ───────────────────
const MiniBienTooltip = ({ hoveredPoint }: any) => {
  if (!hoveredPoint) return null;
  const d = hoveredPoint;
  const minRqd = interpolateY(BIENIAWSKI_CTRL_MIN, d.spacing_mm, true);
  const maxRqd = interpolateY(BIENIAWSKI_CTRL_MAX, d.spacing_mm, true);

  return (
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-2 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left pointer-events-none">
      <p className="font-extrabold text-cyan-400 border-b border-navy-800 pb-1 mb-1">
        Corrida {d.corrida} ({d.prof_m} m)
      </p>
      <p className="text-slate-100">
        Espaciamiento: <span className="text-cyan-300 font-bold">{d.spacing_mm} mm</span>
      </p>
      <p className="text-slate-300">
        RQD Medido: <span className="text-emerald-400 font-bold">{d.rqd_pct}%</span>
      </p>
      <p className="text-slate-300">
        Banda: <span className="text-slate-400">{minRqd.toFixed(0)}% - {maxRqd.toFixed(0)}%</span>
      </p>
      <p className="text-slate-300 font-semibold">
        Estado: <span className="text-emerald-400">
          {d.rqd_pct > maxRqd ? 'Sobre la banda' : d.rqd_pct < minRqd ? 'Bajo la banda' : 'Dentro de la banda'}
        </span>
      </p>
    </div>
  );
};

const MiniPhTooltip = ({ hoveredPoint }: any) => {
  if (!hoveredPoint) return null;
  const d = hoveredPoint;
  const minRqd = interpolateY(LAMBDA_CTRL_MIN, d.ff_per_m, false);
  const maxRqd = interpolateY(LAMBDA_CTRL_MAX, d.ff_per_m, false);

  return (
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-2 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left pointer-events-none">
      <p className="font-extrabold text-cyan-400 border-b border-navy-800 pb-1 mb-1">
        Corrida {d.corrida} ({d.prof_m} m)
      </p>
      <p className="text-slate-100">
        FF/1m: <span className="text-cyan-300 font-bold">{d.ff_per_m} fract/m</span>
      </p>
      <p className="text-slate-300">
        RQD Medido: <span className="text-emerald-400 font-bold">{d.rqd_pct}%</span>
      </p>
      <p className="text-slate-300">
        Banda: <span className="text-slate-400">{minRqd.toFixed(0)}% - {maxRqd.toFixed(0)}%</span>
      </p>
      <p className="text-slate-300 font-semibold">
        Estado: <span className="text-emerald-400">
          {d.rqd_pct > maxRqd ? 'Sobre la banda' : d.rqd_pct < minRqd ? 'Bajo la banda' : 'Dentro de la banda'}
        </span>
      </p>
    </div>
  );
};

export default function RmrCharts({
  activeTaladroName,
  scatterBien = [],
  scatterPh = [],
  hoveredPointBien,
  setHoveredPointBien,
  hoveredPointPh,
  setHoveredPointPh
}: RmrChartsProps) {
  const bienMinLine = useMemo(() => BIENIAWSKI_CTRL_MIN, []);
  const bienMaxLine = useMemo(() => BIENIAWSKI_CTRL_MAX, []);
  const bienMidLine = useMemo(() => BIENIAWSKI_CTRL_MID, []);

  const lambdaMinLine = useMemo(() => LAMBDA_CTRL_MIN, []);
  const lambdaMaxLine = useMemo(() => LAMBDA_CTRL_MAX, []);

  const phSuaveLine = useMemo(() => {
    const pts = [];
    for (let ff = 0; ff <= 40; ff += 1) {
      pts.push({ x: ff, y: parseFloat(phTeoricoFn(ff).toFixed(2)) });
    }
    return pts;
  }, []);

  return (
    <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 shadow-2xl relative overflow-hidden animate-fade-in flex flex-col min-h-[300px]">
      <div className="flex justify-between items-center border-b border-navy-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            Gráficos de Consistencia y Control de Calidad
            <span className="text-[10px] font-normal text-slate-400 lowercase italic">({activeTaladroName})</span>
          </h3>
        </div>
        <span className="text-[9px] bg-navy-900 border border-navy-800 rounded px-1.5 py-0.5 text-slate-400 uppercase font-semibold">QA/QC</span>
      </div>

      {/* Grid de gráficos lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* Gráfico 1: Espaciamiento vs RQD */}
        <div className="relative flex flex-col justify-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">RQD / Espaciamiento (Bieniawski '89)</span>
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart
              margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
              onMouseLeave={() => setHoveredPointBien(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f15" style={{ pointerEvents: 'none' }} />
              <XAxis
                dataKey="x"
                type="number"
                scale="log"
                domain={[0.8, 2200]}
                ticks={[1, 10, 100, 1000, 2000]}
                interval={0}
                allowDataOverflow={true}
                tick={{ fill: '#64748b', fontSize: 8 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
              >
                <Label value="Espaciamiento (mm)" position="insideBottom" offset={-12} fill="#64748b" fontSize={8} />
              </XAxis>

              <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 50, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                <Label value="RQD (%)" angle={-90} position="insideLeft" offset={3} fill="#64748b" fontSize={8} />
              </YAxis>

              {/* Control de radio absoluto del Scatter vía ZAxis de Recharts */}
              <ZAxis type="number" range={[10, 10]} />

              <Line data={bienMinLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} />
              <Line data={bienMaxLine} dataKey="y" type="monotone" dot={false} stroke="#ff7f0e" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} />
              <Line data={bienMidLine} dataKey="y" type="monotone" dot={false} stroke="#2ca02c" strokeWidth={1.2} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />

              <Scatter data={scatterBien}>
                {scatterBien.map((entry, index) => (
                  <Cell
                    key={`cell-bien-mini-${index}`}
                    fill={getDrillColor(activeTaladroName)}
                    onMouseEnter={(e: any) => {
                      const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (chartRect) {
                        const x = e.clientX - chartRect.left;
                        const y = e.clientY - chartRect.top;
                        setHoveredPointBien({ data: entry, x, y });
                      }
                    }}
                    onMouseMove={(e: any) => {
                      const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (chartRect) {
                        const x = e.clientX - chartRect.left;
                        const y = e.clientY - chartRect.top;
                        setHoveredPointBien({ data: entry, x, y });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredPointBien((prev: any) => (prev && prev.data.corrida === entry.corrida ? null : prev));
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>

          {hoveredPointBien && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: hoveredPointBien.x,
                top: hoveredPointBien.y,
                transform: 'translate(-50%, -100%)',
                marginTop: '-8px',
              }}
            >
              <MiniBienTooltip hoveredPoint={hoveredPointBien.data} />
            </div>
          )}
        </div>

        {/* Gráfico 2: FF/m vs RQD */}
        <div className="relative flex flex-col justify-center border-t md:border-t-0 md:border-l border-navy-800 md:pl-4 pt-4 md:pt-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">RQD / Frecuencia de Fracturas FF/1m</span>
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart
              margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
              onMouseLeave={() => setHoveredPointPh(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f15" style={{ pointerEvents: 'none' }} />
              <XAxis dataKey="x" type="number" domain={[-0.8, 40.8]} ticks={[0, 10, 20, 30, 40]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                <Label value="Frecuencia FF (fract/m)" position="insideBottom" offset={-12} fill="#64748b" fontSize={8} />
              </XAxis>

              <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 50, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                <Label value="RQD (%)" angle={-90} position="insideLeft" offset={3} fill="#64748b" fontSize={8} />
              </YAxis>

              {/* Control de radio absoluto del Scatter vía ZAxis de Recharts */}
              <ZAxis type="number" range={[10, 10]} />

              <Line data={phSuaveLine} dataKey="y" type="monotone" dot={false} stroke="#e2e8f0" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} />
              <Line data={lambdaMinLine} dataKey="y" type="monotone" dot={false} stroke="#d62728" strokeWidth={1.2} legendType="none" style={{ pointerEvents: 'none' }} />
              <Line data={lambdaMaxLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={1.2} legendType="none" style={{ pointerEvents: 'none' }} />

              <Scatter data={scatterPh}>
                {scatterPh.map((entry, index) => (
                  <Cell
                    key={`cell-ph-mini-${index}`}
                    fill={getDrillColor(activeTaladroName)}
                    onMouseEnter={(e: any) => {
                      const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (chartRect) {
                        const x = e.clientX - chartRect.left;
                        const y = e.clientY - chartRect.top;
                        setHoveredPointPh({ data: entry, x, y });
                      }
                    }}
                    onMouseMove={(e: any) => {
                      const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (chartRect) {
                        const x = e.clientX - chartRect.left;
                        const y = e.clientY - chartRect.top;
                        setHoveredPointPh({ data: entry, x, y });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredPointPh((prev: any) => (prev && prev.data.corrida === entry.corrida ? null : prev));
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>

          {hoveredPointPh && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: hoveredPointPh.x,
                top: hoveredPointPh.y,
                transform: 'translate(-50%, -100%)',
                marginTop: '-8px',
              }}
            >
              <MiniPhTooltip hoveredPoint={hoveredPointPh.data} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}