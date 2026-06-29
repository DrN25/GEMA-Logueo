import React from 'react';
import { Database, Settings } from 'lucide-react';

interface RmrGridProps {
  calculatedRows: any[];
  filteredCorridas: any[];
  activeTaladroName: string;
  geologo: string;
  fecha: string;
  waterTableM: number;
  showAllColumns: boolean;
  setShowAllColumns: (val: boolean) => void;
}

export default function RmrGrid({
  calculatedRows,
  filteredCorridas,
  activeTaladroName,
  geologo,
  fecha,
  waterTableM,
  showAllColumns,
  setShowAllColumns
}: RmrGridProps) {

  const getQualityColor = (rmr: number) => {
    if (rmr >= 81) return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
    if (rmr >= 61) return "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
    if (rmr >= 41) return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    return "text-red-400 border-red-500/20 bg-red-500/5";
  };

  const getClasificacionRelleno = (relleno: string) => {
    if (!relleno || relleno === "cwf") return 3; // Sin relleno
    if (["FBX", "QZ", "SIO", "SU", "OX", "ep"].includes(relleno)) return 2; // Relleno duro
    return 1; // Relleno blando
  };

  return (
    <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 shadow-2xl relative overflow-hidden animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-navy-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Rejilla Detallada de Ratings RMR
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Auditoría y puntuación geomecánica por corrida (Nivel Freático configurado: {waterTableM} m)
          </p>
        </div>

        {/* Toggler Badge Premium */}
        <button
          onClick={() => setShowAllColumns(!showAllColumns)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-md active:scale-95 ${!showAllColumns
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
            : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200 hover:border-navy-700'
            }`}
        >
          <Settings size={14} className={!showAllColumns ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
          <span>{showAllColumns ? 'Solo mostrar las 2 últimas secciones' : 'Mostrar Todas las Columnas (Excel)'}</span>
        </button>
      </div>

      {/* Tabla scrollable */}
      <div className="overflow-x-auto w-full rounded-lg border border-navy-850 bg-navy-950/80 max-h-[550px] shadow-inner">
        <table
          className="w-full border-separate text-xs text-left"
          style={{ borderSpacing: 0, minWidth: 'max-content' }}
        >
          <thead>
            {/* Group Header Row */}
            <tr className="bg-navy-900 text-[10px] uppercase font-bold text-slate-500 select-none">
              <th colSpan={5} className="py-2.5 px-3 text-center border-r border-b border-navy-800 sticky top-0 bg-navy-900 z-30">Identificación</th>
              {showAllColumns && (
                <th colSpan={25} className="py-2.5 px-3 text-center border-r border-b border-navy-800 th-rmr-purple sticky top-0 z-30">
                  Registro de Parámetros
                </th>
              )}
              <th colSpan={12} className="py-2.5 px-3 text-center border-r border-b border-navy-800 th-rmr-cyan sticky top-0 z-30">
                Ratings RMR '76
              </th>
              <th colSpan={12} className="py-2.5 px-3 text-center border-b border-navy-800 th-rmr-emerald sticky top-0 z-30">
                Ratings RMR '89
              </th>
            </tr>
            {/* Main Headers Row */}
            <tr className="bg-navy-900 border-b border-navy-800 font-bold uppercase text-slate-400 select-none text-[10px] tracking-wider sticky top-[30px] z-30">
              <th className="py-3 px-3 text-center sticky left-0 bg-navy-950 dark:bg-navy-900 z-40 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Sondaje</th>
              <th className="py-3 px-3 text-center sticky left-[80px] bg-navy-950 dark:bg-navy-900 z-40 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Fecha</th>
              <th className="py-3 px-3 text-center border-b border-navy-800 bg-navy-900">Logueador</th>
              <th className="py-3 px-3.5 text-center border-b border-navy-800 bg-navy-900">Corrida</th>
              <th className="py-3 px-3.5 text-center border-r border-b border-navy-800 bg-navy-900">Lito 1</th>

              {/* Columnas Intermedias */}
              {showAllColumns && (
                <>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Lito 2</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Lito 3</th>
                  <th className="py-3 px-3.5 text-center border-b border-navy-800 th-rmr-purple">Desde (m)</th>
                  <th className="py-3 px-3.5 text-center border-b border-navy-800 th-rmr-purple">Hasta (m)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Long. Corrida (m)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Rec (m)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Rec (%)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">RQD (m)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">RQD (%)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Long. Tramo fracturado (m)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">FRF (zonas trituradas)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Fracturas naturales</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Total de Fracturas</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">FF/1m</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Espaciamiento (mm)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Resistencia</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Tipo de Estructura</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Abertura (mm)</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Rugosidad</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Relleno</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Clasificación Relleno</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Intemperismo</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">JRC10</th>
                  <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Espesor de relleno</th>
                  <th className="py-3 px-3 text-center border-r border-b border-navy-800 th-rmr-purple">Presencia de Agua</th>
                </>
              )}

              {/* RMR 76 Columns */}
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Resistencia</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">RQD</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Espaciamiento</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Abertura</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Rugosidad</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Relleno</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Intemperismo</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Persistencia</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan font-extrabold">Condición de Juntas</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Presencia de Agua</th>
              <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-cyan font-black">RMR'76</th>
              <th className="py-3 px-3 text-center border-r border-b border-navy-800 th-rmr-cyan">CALIDAD DE ROCA</th>

              {/* RMR 89 Columns */}
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Resistencia</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">RQD</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Espaciamiento</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Abertura</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Rugosidad</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Relleno</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Intemperismo</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Persistencia</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald font-extrabold">Condición de Juntas</th>
              <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Presencia de Agua</th>
              <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-emerald font-black">RMR'89</th>
              <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-emerald">CALIDAD DE ROCA</th>
            </tr>
          </thead>
          <tbody>
            {calculatedRows.map(({ row, rmrRes }, index) => {
              const isOdd = index % 2 === 1;
              const rowBg = isOdd
                ? 'bg-navy-900/10 hover:bg-blue-500/5'
                : 'bg-navy-950/10 hover:bg-blue-500/5';

              return (
                <tr key={index} className={`transition-all ${rowBg} text-slate-300 font-medium`}>
                  {/* Frozen identifiers */}
                  <td className="py-2.5 px-3 text-center sticky left-0 bg-navy-950 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.35)] w-20 truncate">{activeTaladroName}</td>
                  <td className="py-2.5 px-3 text-center sticky left-[80px] bg-navy-950 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.35)] w-[85px] truncate">{fecha}</td>
                  <td className="py-2.5 px-3 text-center border-b border-navy-850 truncate max-w-[90px]">{geologo}</td>
                  <td className="py-2.5 px-3 text-center border-b border-navy-850 font-black text-cyan-400">{row.corrida}</td>
                  <td className="py-2.5 px-3 text-center border-r border-b border-navy-800 font-bold text-slate-400">{row.lito1}</td>

                  {/* Intermediate parameters */}
                  {showAllColumns && (
                    <>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.lito2 || "-1"}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.lito3 || "-1"}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.de.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.a.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-semibold">{rmrRes.error ? "-" : rmrRes.perf}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.rec_m.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : `${rmrRes.rec_pct}%`}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.rqd_m.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 font-bold text-slate-300 bg-purple-950/5">{rmrRes.error ? "-" : `${rmrRes.rqd_pct}%`}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.lrf_m.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-bold">{rmrRes.frf || 0}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.frac_nat}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-bold">{rmrRes.total_frac || 0}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : Math.round((rmrRes.total_frac || 0) / (rmrRes.perf || 1))}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : `${rmrRes.spacing_mm}`}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-semibold">{row.resistencia}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 uppercase">{row.tipo_est1 || "JN"}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.abertura}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.rugosidad}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 uppercase">{row.relleno1}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : getClasificacionRelleno(row.relleno1)}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.intemperismo}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.jrc10}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.espesor}</td>
                      <td className="py-2.5 px-3 text-center border-r border-b border-navy-800 text-slate-400 bg-purple-950/5">{row.agua_obs}</td>
                    </>
                  )}

                  {/* RMR 76 columns */}
                  {rmrRes.error || !rmrRes.scores ? (
                    <td colSpan={12} className="py-2.5 px-3 text-center border-r border-b border-navy-800 bg-cyan-950/5 text-red-400 font-bold uppercase text-[10px] tracking-widest">{rmrRes.error || "ERROR"}</td>
                  ) : (
                    <>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.resistencia}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.rqd}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.spacing_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.abertura_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.rugosidad_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.relleno_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.weathering_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.persistencia_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5 font-bold text-cyan-400">{rmrRes.scores.juntas_76}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.agua_76}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 bg-cyan-950/10 font-black text-cyan-400">{rmrRes.rmr_76}</td>
                      <td className="py-2.5 px-3 text-center border-r border-b border-navy-800 bg-cyan-950/10 font-bold uppercase">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${getQualityColor(rmrRes.rmr_76 || 0)}`}>
                          {rmrRes.class_76}
                        </span>
                      </td>
                    </>
                  )}

                  {/* RMR 89 columns */}
                  {rmrRes.error || !rmrRes.scores ? (
                    <td colSpan={12} className="py-2.5 px-3 text-center border-b border-navy-800 bg-emerald-950/5 text-red-400 font-bold uppercase text-[10px] tracking-widest">{rmrRes.error || "ERROR"}</td>
                  ) : (
                    <>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.resistencia}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.rqd}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.spacing_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.abertura_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.rugosidad_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.relleno_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.weathering_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.persistencia_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5 font-bold text-emerald-400">{rmrRes.scores.juntas_89}</td>
                      <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.agua_89}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 bg-emerald-950/10 font-black text-emerald-400">{rmrRes.rmr_89}</td>
                      <td className="py-2.5 px-3 text-center border-b border-navy-850 bg-emerald-950/10 font-bold uppercase">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${getQualityColor(rmrRes.rmr_89 || 0)}`}>
                          {rmrRes.class_89}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filteredCorridas.length === 0 && (
              <tr>
                <td colSpan={showAllColumns ? 54 : 29} className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Database size={24} className="opacity-20 animate-pulse" />
                    <span>No se encontraron corridas en este taladro que coincidan con los filtros aplicados.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-navy-800/40">
        <span>* Todos los cálculos siguen los estándares geomecánicos de Bieniawski 1976 y 1989.</span>
        <span>Mostrando {filteredCorridas.length} de {calculatedRows.length} corridas totales.</span>
      </div>
    </div>
  );
}
