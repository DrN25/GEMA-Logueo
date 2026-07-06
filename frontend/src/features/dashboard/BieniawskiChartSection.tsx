import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, ZAxis, CartesianGrid,
  ResponsiveContainer, Label, Cell, ReferenceArea
} from 'recharts';
import {
  type DashPoint,
  LITHOLOGY_COLORS,
  getDrillColor,
  getRqdColorClass,
  interpolateY,
  bandStatus,
  BIENIAWSKI_CTRL_MIN,
  BIENIAWSKI_CTRL_MAX,
  BIENIAWSKI_CTRL_MID
} from './rqdDashboardHelpers';
import { getLithologyClass } from './RqdPorLitologiaTab';

const BienTooltip = ({ hoveredPoint }: { hoveredPoint: any }) => {
  if (!hoveredPoint) return null;
  const d = hoveredPoint;

  const minRqd = interpolateY(BIENIAWSKI_CTRL_MIN, d.spacing_mm, true);
  const maxRqd = interpolateY(BIENIAWSKI_CTRL_MAX, d.spacing_mm, true);

  const l1 = d.lito1 && d.lito1 !== '-1' && d.lito1 !== '-' ? d.lito1.trim().toUpperCase() : '';
  const l2 = d.lito2 && d.lito2 !== '-1' && d.lito2 !== '-' ? d.lito2.trim().toUpperCase() : '';
  const l3 = d.lito3 && d.lito3 !== '-1' && d.lito3 !== '-' ? d.lito3.trim().toUpperCase() : '';
  const mainLito = l3 || l1 || 'S/D';
  const litoClass = getLithologyClass(mainLito);
  const litoCombo = [l1, l2, l3].filter(Boolean).join('\t');

  return (
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-sm space-y-1.5 w-[340px] text-left pointer-events-none whitespace-pre-line">
      <p className="font-extrabold border-b border-navy-800 pb-1.5 mb-1 text-[11px] tracking-wide flex flex-wrap gap-x-1 items-center">
        <span className="text-cyan-400">📍 {d.taladro}</span>
        <span className="text-slate-500">-</span>
        <span className="text-orange-400">Corrida de {d.corrida}</span>
        <span className="text-slate-500">-</span>
        <span className="text-fuchsia-400">{litoCombo} (<span style={{ color: LITHOLOGY_COLORS[litoClass]?.solid }}>{litoClass}</span>)</span>
      </p>
      <p className="text-slate-100 font-extrabold text-xs">
        Espaciamiento: <span className="text-cyan-300 font-black">{d.spacing_mm} mm</span>
      </p>
      <p className="text-blue-400 text-xs">
        Curva RQD mínimo: <span className="font-bold">{minRqd > 0 ? `${minRqd.toFixed(1)}%` : '0.0%'}</span>
      </p>
      <p className="text-orange-400 text-xs">
        Curva RQD máximo: <span className="font-bold">{maxRqd > 0 ? `${maxRqd.toFixed(1)}%` : '100.0%'}</span>
      </p>
      <p className="text-slate-300 text-xs">
        RQD Medido: <span className={`${getRqdColorClass(d.rqd_pct)} font-bold`}>{d.rqd_pct}%</span>
      </p>
      <p className="text-slate-300 text-xs">
        Estado de Banda: <span className={`font-semibold ${bandStatus(d.rqd_pct, d.spacing_mm) === 'dentro' ? 'text-emerald-400' : 'text-red-500'}`}>
          {bandStatus(d.rqd_pct, d.spacing_mm) === 'dentro' ? '✓ Dentro de Banda' : '▲ Fuera de Banda'}
        </span>
      </p>
    </div>
  );
};

interface BieniawskiChartSectionProps {
  scatterBien: DashPoint[];
  lithologyZones: { y1: number; y2: number; litoClass: string }[];
  rqdBinsData: { binIdx: number; dominantClass: string; dominantColor: string; counts: Record<string, number> }[];
  showBgBands: boolean;
  showDensityRibbon: boolean;
  colorByLithology: boolean;
}

const BieniawskiChartSection = React.memo(({
  scatterBien,
  lithologyZones,
  rqdBinsData,
  showBgBands,
  showDensityRibbon,
  colorByLithology
}: BieniawskiChartSectionProps) => {
  const [hoveredPointBien, setHoveredPointBien] = useState<any | null>(null);
  const [hoveredBin, setHoveredBin] = useState<{ bin: any; x: number; y: number } | null>(null);

  return (
    <div className="w-full overflow-auto scrollbar-thin rounded-lg border border-navy-900/60 p-2 bg-navy-950/40 mt-2 relative" onMouseLeave={() => setHoveredPointBien(null)}>
      <div style={{ minWidth: 600, height: 380 }} className="flex gap-4 items-stretch p-1">
        <div className="flex-1 h-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }} onMouseLeave={() => setHoveredPointBien(null)}>
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

              {/* Zonas de Predominancia Litológica de Fondo */}
              {showBgBands && lithologyZones.map((zone, idx) => {
                const cfg = LITHOLOGY_COLORS[zone.litoClass] || LITHOLOGY_COLORS.DESCONOCIDO;
                return (
                  <ReferenceArea
                    key={`bg-band-bien-${idx}`}
                    y1={zone.y1}
                    y2={zone.y2}
                    fill={cfg.fill}
                    fillOpacity={0.22}
                    stroke="none"
                    pointerEvents="none"
                  />
                );
              })}

              {/* Resaltado de la Banda de RQD al hacer Hover (Exacta al 10%) */}
              {showBgBands && hoveredBin && (
                <ReferenceArea
                  y1={hoveredBin.bin.binIdx * 10}
                  y2={(hoveredBin.bin.binIdx + 1) * 10}
                  fill={hoveredBin.bin.dominantColor}
                  fillOpacity={0.26}
                  stroke="none"
                  pointerEvents="none"
                />
              )}

              <Line data={BIENIAWSKI_CTRL_MIN} dataKey="y" type="monotone" dot={false} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" name="Banda Mínima" />
              <Line data={BIENIAWSKI_CTRL_MAX} dataKey="y" type="monotone" dot={false} stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" name="Banda Máxima" />
              <Line data={BIENIAWSKI_CTRL_MID} dataKey="y" type="monotone" dot={false} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 3" name="Media" />

              <Scatter data={scatterBien} onMouseLeave={() => setHoveredPointBien(null)}>
                {scatterBien.map((entry, index) => {
                  const mainLito = entry.lito3 && entry.lito3 !== '-1' && entry.lito3 !== '-' ? entry.lito3 : (entry.lito1 || 'S/D');
                  const litoClass = getLithologyClass(mainLito);
                  const cellColor = colorByLithology
                    ? (LITHOLOGY_COLORS[litoClass]?.solid || LITHOLOGY_COLORS.DESCONOCIDO.solid)
                    : getDrillColor(entry.taladro);
                  return (
                    <Cell
                      key={`cell-bien-${index}`}
                      fill={cellColor}
                      onMouseEnter={(e: any) => {
                        setHoveredPointBien({ data: entry, x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e: any) => {
                        setHoveredPointBien({ data: entry, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => {
                        setHoveredPointBien((prev: any) => (prev && prev.data === entry ? null : prev));
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Columna Vertical de Densidad Litológica */}
        {showDensityRibbon && (
          <div className="w-[18px] flex flex-col-reverse bg-navy-950/80 border border-navy-800/80 rounded-md p-[2px] relative h-[300px] mt-[10px] mb-[70px] select-none">
            {rqdBinsData.map((bin) => {
              const hasData = bin.dominantClass !== 'Ninguno';
              const isHovered = hoveredBin !== null && hoveredBin.bin.binIdx === bin.binIdx;
              return (
                <div
                  key={bin.binIdx}
                  className="flex-1 w-full rounded-sm transition-all duration-150 hover:scale-x-125 cursor-pointer relative"
                  style={{
                    backgroundColor: hasData ? bin.dominantColor : 'transparent',
                    border: hasData ? 'none' : '1px dashed #334155',
                    marginBottom: bin.binIdx < 9 ? '2px' : '0px',
                    opacity: isHovered ? 1.0 : 0.75
                  }}
                  onMouseEnter={(e) => {
                    setHoveredBin({ bin, x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    setHoveredBin({ bin, x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => {
                    setHoveredBin(null);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {hoveredPointBien && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-fade-in"
          style={{
            left: hoveredPointBien.x,
            top: hoveredPointBien.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-12px',
          }}
        >
          <BienTooltip hoveredPoint={hoveredPointBien.data} />
        </div>,
        document.body
      )}

      {hoveredBin && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-fade-in bg-[#090f1d] border border-navy-700 rounded-xl p-3 text-xs shadow-2xl w-[220px] text-left text-slate-200 space-y-1.5"
          style={{
            left: hoveredBin.x,
            top: hoveredBin.y,
            transform: 'translate(10%, -50%)',
            marginLeft: '12px',
          }}
        >
          <p className="font-extrabold border-b border-navy-800 pb-1.5 mb-1 text-[11px] tracking-wide flex items-center justify-between">
            <span className="text-cyan-400">📊 RQD {hoveredBin.bin.binIdx * 10}-{(hoveredBin.bin.binIdx + 1) * 10}%</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Densidad</span>
          </p>
          <p className="text-slate-300 font-bold text-[11px]">
            Predominante:{' '}
            <span className="font-black animate-pulse" style={{ color: hoveredBin.bin.dominantColor }}>
              {LITHOLOGY_COLORS[hoveredBin.bin.dominantClass]?.label || hoveredBin.bin.dominantClass}
            </span>
          </p>
          <div className="mt-1.5 space-y-1.5 border-t border-navy-800 pt-1.5">
            {Object.entries(hoveredBin.bin.counts as Record<string, number>).map(([clase, count]) => {
              if (count === 0) return null;
              const col = LITHOLOGY_COLORS[clase]?.solid || LITHOLOGY_COLORS.DESCONOCIDO.solid;
              const label = LITHOLOGY_COLORS[clase]?.label || clase;
              return (
                <p key={clase} className="flex justify-between font-bold text-[11px]">
                  <span className="flex items-center gap-1.5" style={{ color: col }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} />
                    {label}
                  </span>
                  <span className="text-slate-100 font-extrabold">{count}</span>
                </p>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

BieniawskiChartSection.displayName = 'BieniawskiChartSection';

export default BieniawskiChartSection;
