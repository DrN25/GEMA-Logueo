import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Database, Compass, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { LITHOLOGY_COLORS } from './rqdDashboardHelpers';
import { getLithologyClass } from './RqdPorLitologiaTab';

interface DashPoint {
  taladro: string;
  corrida: string;
  prof_m: number;
  rqd_pct: number;
  spacing_mm: number;
  ff_per_m: number;
  lito1?: string;
  lito2?: string;
  lito3?: string;
  rmr89?: number;
  elev_m?: number;
}

interface GroupStats {
  key: string;
  name: string;
  count: number;
  taladrosCount: number;
  min: number;
  max: number;
  q1: number;
  median: number;
  q3: number;
  avg: number;
  density: number[]; // normalizadas (0 a 16 px)
  litoCounts: Record<string, number>;
  dominantClass: string;
  dominantColor: string;
}

export default function RqdPorNivelTab({ visiblePoints }: { visiblePoints: DashPoint[] }) {
  const [groupMode, setGroupMode] = useState<'nivel' | 'sector'>('nivel');
  const [binSize, setBinSize] = useState<number>(50); // 10, 20, 50, 100
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Hover states for floating tooltip
  const [hoveredGroup, setHoveredGroup] = useState<GroupStats | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Guide panel collapse state
  const [showGuide, setShowGuide] = useState<boolean>(true);

  // Grouping and calculations
  const groupedStatsList = useMemo((): GroupStats[] => {
    const rawGroups: Record<string, { points: DashPoint[]; taladros: Set<string> }> = {};

    visiblePoints.forEach(p => {
      if (p.rqd_pct === -1) return;

      let key = 'DESCONOCIDO';

      if (groupMode === 'nivel') {
        const elev = p.elev_m ?? 4000;
        const binIndex = Math.floor(elev / binSize) * binSize;
        key = binIndex.toString();
      } else {
        const prefixMatch = p.taladro.match(/^[A-Za-z_-]+/);
        key = prefixMatch ? prefixMatch[0].toUpperCase() : 'DESCONOCIDO';
      }

      if (!rawGroups[key]) {
        rawGroups[key] = { points: [], taladros: new Set() };
      }
      rawGroups[key].points.push(p);
      rawGroups[key].taladros.add(p.taladro);
    });

    const list = Object.entries(rawGroups).map(([key, group]): GroupStats => {
      const pts = group.points;
      const n = pts.length;
      const sorted = [...pts].map(p => p.rqd_pct).sort((a, b) => a - b);

      let name = '';
      if (groupMode === 'nivel') {
        const binIndex = parseInt(key);
        name = `Nivel ${isNaN(binIndex) ? key : binIndex}m - ${isNaN(binIndex) ? key : binIndex + binSize}m`;
      } else {
        name = `Sector ${key}`;
      }

      const min = sorted[0] ?? 0;
      const max = sorted[n - 1] ?? 0;
      const avg = n > 0 ? sorted.reduce((a, b) => a + b, 0) / n : 0;

      const q1 = sorted[Math.floor(n * 0.25)] ?? 0;
      const median = sorted[Math.floor(n * 0.5)] ?? 0;
      const q3 = sorted[Math.floor(n * 0.75)] ?? 0;

      // Calcular histograma de frecuencias (5 bins de 20%) para densidad de violín
      const rawBins = [0, 0, 0, 0, 0];
      pts.forEach(p => {
        const binIdx = Math.min(4, Math.floor(p.rqd_pct / 20));
        rawBins[binIdx]++;
      });

      const maxBinVal = Math.max(...rawBins);
      const density = rawBins.map(val => (maxBinVal > 0 ? (val / maxBinVal) * 16 : 0));

      // Conteo de Litologías
      const litoCounts: Record<string, number> = {};
      pts.forEach(p => {
        const mainLito = p.lito3 && p.lito3 !== '-1' && p.lito3 !== '-' ? p.lito3 : (p.lito1 || 'S/D');
        const litoClass = getLithologyClass(mainLito);
        litoCounts[litoClass] = (litoCounts[litoClass] || 0) + 1;
      });

      // Clase litológica dominante
      let dominantClass = 'DESCONOCIDO';
      let maxLitoCount = 0;
      Object.entries(litoCounts).forEach(([lito, cnt]) => {
        if (cnt > maxLitoCount) {
          maxLitoCount = cnt;
          dominantClass = lito;
        }
      });
      const dominantColor = LITHOLOGY_COLORS[dominantClass]?.solid || LITHOLOGY_COLORS.DESCONOCIDO.solid;

      return {
        key,
        name,
        count: n,
        taladrosCount: group.taladros.size,
        min,
        max,
        q1,
        median,
        q3,
        avg: parseFloat(avg.toFixed(1)),
        density,
        litoCounts,
        dominantClass,
        dominantColor
      };
    });

    // Ordenar de forma natural: ascendente para niveles, alfabético para sectores
    if (groupMode === 'nivel') {
      return list.sort((a, b) => parseFloat(a.key) - parseFloat(b.key));
    }
    return list.sort((a, b) => a.key.localeCompare(b.key));
  }, [visiblePoints, groupMode, binSize]);

  // Filtrado por búsqueda
  const filteredStatsList = useMemo(() => {
    if (!searchTerm.trim()) return groupedStatsList;
    const lower = searchTerm.toLowerCase();
    return groupedStatsList.filter(s => s.name.toLowerCase().includes(lower) || s.key.toLowerCase().includes(lower));
  }, [groupedStatsList, searchTerm]);

  // Manejo de movimiento de ratón para el tooltip portal
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div 
      className="space-y-6 animate-fade-in text-slate-300 bg-[#090f1d] p-6 rounded-xl border border-navy-800/80 shadow-2xl select-none"
      onMouseMove={handleMouseMove}
    >
      {/* ── PANEL DE CONTROL SUPERIOR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-900/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Compass size={18} />
            </div>
            <h2 className="text-md font-black text-slate-100 tracking-wide uppercase">Análisis RQD por Nivel / Sector</h2>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            Visualización estadística híbrida mediante diagramas de Caja-Violín para el control de calidad de roca en volumen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Selector de Agrupamiento */}
          <div className="flex bg-navy-900/60 p-1 rounded-lg border border-navy-800/60">
            <button
              onClick={() => setGroupMode('nivel')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                groupMode === 'nivel'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏢 Por Nivel (Elevación)
            </button>
            <button
              onClick={() => setGroupMode('sector')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                groupMode === 'sector'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧭 Por Sector Geotécnico
            </button>
          </div>

          {/* Selector de Banco de Cota (solo visible en modo Nivel) */}
          {groupMode === 'nivel' && (
            <div className="flex items-center gap-2 bg-navy-900/40 px-3 py-1.5 rounded-lg border border-navy-800/60">
              <span className="text-[10px] uppercase font-bold text-slate-500">Banco:</span>
              <select
                value={binSize}
                onChange={(e) => setBinSize(Number(e.target.value))}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none font-bold"
              >
                <option value={10}>10 metros</option>
                <option value={20}>20 metros</option>
                <option value={50}>50 metros</option>
                <option value={100}>100 metros</option>
              </select>
            </div>
          )}

          {/* Buscador de Categoría */}
          <input
            type="text"
            placeholder={groupMode === 'nivel' ? "Buscar nivel (cota)..." : "Buscar sector..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-navy-900 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none placeholder-slate-500 w-44 font-semibold"
          />
        </div>
      </div>

      {/* ── ÁREA PRINCIPAL DEL GRÁFICO (SCROLL HORIZONTAL) ── */}
      <div className="relative w-full border border-navy-900/60 rounded-xl bg-navy-950/20 p-5 overflow-x-auto scrollbar-thin">
        {groupMode === 'sector' ? (
          <div className="h-[380px] flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="p-4 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20 animate-pulse">
              <Compass size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-slate-200 text-sm font-black uppercase tracking-wider">Vista por Sector Geotécnico</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Esta funcionalidad requiere la carga previa del modelo de bloques estructural o base de datos de dominios geotécnicos. Actualmente no hay sectores definidos en el collar o base de datos local.
              </p>
            </div>
            <div className="text-[10px] text-amber-500/70 font-mono font-bold bg-amber-500/5 px-2.5 py-1 rounded border border-amber-500/10">
              SCAFFOLD: VERSIÓN 2.1 (A SER IMPLEMENTADO)
            </div>
          </div>
        ) : filteredStatsList.length === 0 ? (
          <div className="h-[380px] flex flex-col items-center justify-center text-slate-500 italic text-xs gap-2">
            <Database size={24} className="text-slate-500 animate-pulse" />
            Sin datos correspondientes a los filtros de selección.
          </div>
        ) : (
          <div className="flex items-start h-[380px] min-w-max select-none relative pr-4">
            {/* Eje Y flotante / guía izquierda */}
            <div className="w-12 flex flex-col justify-between text-[10px] font-extrabold text-slate-500 border-r border-navy-850 h-[300px] pr-3 text-right sticky left-0 bg-[#090f1d]/90 z-20">
              <span>100%</span>
              <span>80%</span>
              <span>60%</span>
              <span>40%</span>
              <span>20%</span>
              <span>0%</span>
              <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-navy-850" />
            </div>

            {/* Columnas del Violin/Boxplot */}
            <div className="flex-1 flex items-start pl-4 relative h-[300px]">
              {/* Guías Horizontales Geomecánicas de Fondo */}
              <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none z-0">
                <div className="w-full border-b border-navy-900/40" />
                <div className="w-full border-b border-emerald-500/10 border-dashed" style={{ top: '20%' }} />
                <div className="w-full border-b border-cyan-500/10 border-dashed" style={{ top: '40%' }} />
                <div className="w-full border-b border-amber-500/10 border-dashed" style={{ top: '60%' }} />
                <div className="w-full border-b border-red-500/10 border-dashed" style={{ top: '80%' }} />
                <div className="w-full border-b border-navy-900/40" style={{ top: '100%' }} />
              </div>

              {/* Mapear Grupos */}
              {filteredStatsList.map(group => {
                const toY = (val: number) => 100 - val;
                const hasData = group.count > 0;

                return (
                  <div
                    key={group.key}
                    className="flex flex-col items-center justify-start w-28 relative group z-10 mx-2"
                    onMouseEnter={() => setHoveredGroup(group)}
                    onMouseLeave={() => setHoveredGroup(null)}
                  >
                    {/* Gráfico Individual */}
                    <div className="w-16 h-[300px] relative rounded-md transition-all hover:bg-navy-900/10">
                      {hasData && (
                        <>
                          {/* Polígono del Violin Plot (SVG Centrado) */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 40 100" preserveAspectRatio="none">
                            {(() => {
                              const minVal = group.min;
                              const maxVal = group.max;
                              const range = maxVal - minVal;

                              if (range <= 0) {
                                // Caso homogéneo: todas las muestras tienen el mismo RQD (ej: 100%)
                                const y = 100 - maxVal;
                                return (
                                  <polygon
                                    points={`20,${y - 2} 22,${y} 20,${y + 2} 18,${y}`}
                                    fill="url(#violinGradTab)"
                                    stroke={group.dominantColor}
                                    strokeWidth="0.8"
                                    className="transition-all duration-300 group-hover:fill-opacity-40 fill-opacity-20"
                                  />
                                );
                              }

                              const binCenters = [10, 30, 50, 70, 90];
                              const polyPoints: { w: number; y: number }[] = [];

                              // Agregar punto mínimo (cierre inferior de la densidad)
                              polyPoints.push({ w: 0, y: 100 - minVal });

                              // Agregar centros de los bins que estén dentro del rango real de datos
                              binCenters.forEach((center, idx) => {
                                const w = group.density[idx];
                                const y = 100 - center;
                                if (center > minVal && center < maxVal) {
                                  polyPoints.push({ w, y });
                                }
                              });

                              // Agregar punto máximo (cierre superior de la densidad)
                              polyPoints.push({ w: 0, y: 100 - maxVal });

                              const ptsUpper: string[] = [];
                              const ptsLower: string[] = [];
                              polyPoints.forEach(pt => {
                                ptsUpper.push(`${20 - pt.w},${pt.y}`);
                                ptsLower.unshift(`${20 + pt.w},${pt.y}`);
                              });
                              const pathString = [...ptsUpper, ...ptsLower].join(' ');

                              return (
                                <polygon
                                  points={pathString}
                                  fill="url(#violinGradTab)"
                                  stroke={group.dominantColor}
                                  strokeWidth="0.8"
                                  className="transition-all duration-300 group-hover:fill-opacity-40 fill-opacity-20"
                                />
                              );
                            })()}
                            <defs>
                              <linearGradient id="violinGradTab" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#0891b2" stopOpacity="0.05" />
                                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.05" />
                              </linearGradient>
                            </defs>
                          </svg>

                          {/* Línea Central (Whiskers) del Boxplot */}
                          <div
                            className="absolute left-[31px] w-[2px] bg-slate-400/60 border-dashed"
                            style={{
                              top: `${toY(group.max)}%`,
                              height: `${group.max - group.min}%`,
                              zIndex: 11
                            }}
                          />

                          {/* Caja del Boxplot (Q1 a Q3) */}
                          <div
                            className="absolute left-[24px] w-4 border rounded-sm shadow-xl"
                            style={{
                              top: `${toY(group.q3)}%`,
                              height: `${Math.max(4, group.q3 - group.q1)}%`,
                              backgroundColor: '#090f1d',
                              borderColor: '#64748b',
                              borderWidth: '1.5px',
                              zIndex: 12
                            }}
                          />

                          {/* Punto Blanco de la Mediana */}
                          <div
                            className="absolute left-[29px] w-2.5 h-2.5 rounded-full bg-white border border-slate-950 z-20 shadow-md"
                            style={{
                              top: `calc(${toY(group.median)}% - 5px)`
                            }}
                            title={`Mediana: ${group.median}%`}
                          />
                        </>
                      )}
                    </div>

                    {/* Leyendas Inferiores */}
                    <div className="mt-4 flex flex-col items-center text-center w-full bg-navy-950/60 py-1.5 px-1 border border-navy-900/60 rounded">
                      <span className="text-[9px] font-black text-slate-200 tracking-wider truncate max-w-full uppercase" title={group.name}>
                        {groupMode === 'nivel' ? `N${group.key}` : group.key}
                      </span>
                      <span className="text-[8px] text-slate-500 font-extrabold mt-0.5 uppercase tracking-wide">
                        {group.count} Corr • {group.taladrosCount} Tal
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── PORTAL PARA TOOLTIP DETALLADO ── */}
      {hoveredGroup && createPortal(
        <div
          className="fixed bg-[#090f1d] border border-navy-700 p-4 rounded-xl shadow-2xl text-slate-200 pointer-events-none z-50 w-64 animate-fade-in"
          style={{
            top: mousePos.y - 120,
            left: mousePos.x + 20,
            transform: 'translateY(-50%)'
          }}
        >
          {/* Header */}
          <div className="border-b border-navy-850 pb-2 mb-2">
            <p className="text-xs font-black text-cyan-400 uppercase tracking-widest">{hoveredGroup.name}</p>
            <div className="flex gap-2 text-[10px] text-slate-500 font-bold mt-0.5">
              <span>📊 {hoveredGroup.count} Corridas</span>
              <span>•</span>
              <span>💎 {hoveredGroup.taladrosCount} Taladros</span>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-semibold">
            <div className="flex justify-between">
              <span className="text-slate-400">Máx:</span>
              <span className="text-slate-200 font-bold">{hoveredGroup.max}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Q3:</span>
              <span className="text-slate-200 font-bold">{hoveredGroup.q3}%</span>
            </div>
            <div className="flex justify-between col-span-2 py-0.5 my-0.5 border-y border-navy-900/60 bg-navy-950/40 px-1 rounded">
              <span className="text-cyan-400 font-extrabold">Mediana:</span>
              <span className="text-white font-black text-xs">{hoveredGroup.median}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Q1:</span>
              <span className="text-slate-200 font-bold">{hoveredGroup.q1}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mín:</span>
              <span className="text-slate-200 font-bold">{hoveredGroup.min}%</span>
            </div>
            <div className="flex justify-between col-span-2 pt-1 border-t border-navy-900/40 text-[10px] text-slate-400 font-bold">
              <span>Promedio:</span>
              <span className="text-cyan-300 font-extrabold">{hoveredGroup.avg}%</span>
            </div>
          </div>

          {/* Desglose Litológico */}
          <div className="mt-3 border-t border-navy-850 pt-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Distribución de Litología</p>
            <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
              {Object.entries(hoveredGroup.litoCounts).map(([litoClass, count]) => {
                const col = LITHOLOGY_COLORS[litoClass]?.solid || LITHOLOGY_COLORS.DESCONOCIDO.solid;
                const label = LITHOLOGY_COLORS[litoClass]?.label || litoClass;
                return (
                  <div key={litoClass} className="flex justify-between items-center text-[10px] font-bold">
                    <span className="flex items-center gap-1.5" style={{ color: col }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} />
                      {label}
                    </span>
                    <span className="text-slate-200 font-mono">{count} ({Math.round((count / hoveredGroup.count) * 100)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── EXPLICACIÓN CONCEPTUAL GEOMECÁNICA DETALLADA ── */}
      <section className="glass-panel rounded-xl border border-navy-800 p-5 bg-navy-950/40">
        <button 
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between w-full text-slate-200 font-bold text-xs uppercase tracking-wider focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-cyan-400" />
            <span>📖 Guía de Interpretación Geotécnica del Gráfico</span>
          </div>
          {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 text-[11px] leading-relaxed text-slate-400 border-t border-navy-900/60 pt-4 animate-fade-in">
            {/* Tarjeta 1 */}
            <div className="space-y-2 bg-navy-950/30 p-3.5 rounded-lg border border-navy-900/50">
              <h4 className="font-extrabold text-cyan-400 uppercase tracking-widest text-[10px]">1. Muestras y Sondajes (n)</h4>
              <p>
                La variable <span className="font-bold text-slate-200">n = X Corr • Y Tal</span> indica el volumen de información física:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="font-bold text-slate-300">Corr (Corridas)</span>: Cantidad total de tramos de perforación geotécnica mapeados en ese nivel/sector.</li>
                <li><span className="font-bold text-slate-300">Tal (Taladros)</span>: Cantidad de pozos de perforación que interceptan esa cota o sector.</li>
              </ul>
              <p className="italic text-[10px] text-slate-500">
                Nota: No se puede graficar por metro exacto de cota ya que cada tramo de corrida tiene un RQD único; se agrupan en bancos para calcular densidades estadísticas.
              </p>
            </div>

            {/* Tarjeta 2 */}
            <div className="space-y-2 bg-navy-950/30 p-3.5 rounded-lg border border-navy-900/50">
              <h4 className="font-extrabold text-cyan-400 uppercase tracking-widest text-[10px]">2. Box Plot (Línea y Caja Central)</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <span className="font-bold text-slate-300">Punto Blanco Central</span>: Representa la <span className="font-bold text-white text-xs">Mediana (Percentil 50)</span>. Es el valor de RQD exacto que parte a la mitad los registros (50% arriba, 50% abajo), resistiendo distorsiones por valores atípicos.
                </li>
                <li>
                  <span className="font-bold text-slate-300">Caja de Caja Gris</span>: Define el Rango Intercuartil (<span className="font-bold text-slate-200">Q1 a Q3</span>), que contiene el 50% de las corridas centrales. Cajas más grandes indican mayor dispersión o variabilidad estructural.
                </li>
                <li>
                  <span className="font-bold text-slate-300">Líneas Externas</span>: Son los bigotes que marcan los límites máximo y mínimo de calidad de roca en ese nivel/sector.
                </li>
              </ul>
            </div>

            {/* Tarjeta 3 */}
            <div className="space-y-2 bg-navy-950/30 p-3.5 rounded-lg border border-navy-900/50">
              <h4 className="font-extrabold text-cyan-400 uppercase tracking-widest text-[10px]">3. Violin Plot (Sombra de Densidad)</h4>
              <p>
                La silueta lateral azul representa la <span className="font-bold text-slate-200">densidad de probabilidad</span> del RQD:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <span className="font-bold text-slate-300">Zonas Anchas</span>: Mayor acumulación de datos. Un abultamiento superior (RQD &gt; 80%) ratifica roca altamente competente.
                </li>
                <li>
                  <span className="font-bold text-slate-300">Zonas Angostas</span>: Valores poco frecuentes.
                </li>
                <li>
                  <span className="font-bold text-slate-300">Formas Bimodaes (Reloj de arena)</span>: Indican zonas de transición estructural crítica donde coexisten macizos sanos con zonas altamente trituradas o de cizalle, requiriendo fortificación reforzada.
                </li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
