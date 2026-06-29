import React, { useMemo } from 'react';
import { Settings } from 'lucide-react';
import BaseEditableGrid, { type GridColumn } from '../../../components/common/BaseEditableGrid';

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

  // --- MAPEO DE FILAS A UN ESQUEMA PLANO COMPATIBLE CON BASEEDITABLEGRID ---
  const gridData = useMemo(() => {
    return calculatedRows.map((item, index) => {
      const { row, rmrRes } = item;
      const isErr = !!rmrRes.error;
      const sc = rmrRes.scores || {};

      return {
        id: index + 1,
        corrida: row.corrida,
        de: row.de,
        a: row.a,
        perf: isErr ? '-' : rmrRes.perf,
        rec_m: row.rec_m,
        rec_pct: isErr ? '-' : `${rmrRes.rec_pct}%`,
        rqd_m: row.rqd_m,
        rqd_pct: isErr ? '-' : `${rmrRes.rqd_pct}%`,
        lrf_m: row.lrf_m,
        frf: rmrRes.frf || 0,
        frac_nat: row.frac_nat,
        total_frac: rmrRes.total_frac || 0,
        ff_1_m: isErr ? '-' : Math.round((rmrRes.total_frac || 0) / (rmrRes.perf || 1)),
        spacing_mm: isErr ? '-' : rmrRes.spacing_mm,
        resistencia: row.resistencia,
        tipo_est1: row.tipo_est1,
        abertura: row.abertura,
        rugosidad: row.rugosidad,
        relleno1: row.relleno1,
        clasif_relleno: isErr ? '-' : getClasificacionRelleno(row.relleno1),
        intemperismo: row.intemperismo,
        jrc10: row.jrc10,
        espesor: row.espesor,
        agua_obs: row.agua_obs,
        lito2: row.lito2 || '-1',
        lito3: row.lito3 || '-1',
        lito1: row.lito1,

        // RMR76 scores
        s_76: isErr ? '-' : sc.resistencia,
        rqd_76: isErr ? '-' : sc.rqd,
        sp_76: isErr ? '-' : sc.spacing_76,
        ab_76: isErr ? '-' : sc.abertura_76,
        rg_76: isErr ? '-' : sc.rugosidad_76,
        fl_76: isErr ? '-' : sc.relleno_76,
        wt_76: isErr ? '-' : sc.weathering_76,
        p_76: isErr ? '-' : sc.persistencia_76,
        j_76: isErr ? '-' : sc.juntas_76,
        w_76: isErr ? '-' : sc.agua_76,
        rmr_76: isErr ? 'ERR' : rmrRes.rmr_76,
        class_76: isErr ? 'ERROR' : rmrRes.class_76,

        // RMR89 scores
        s_89: isErr ? '-' : sc.resistencia,
        rqd_89: isErr ? '-' : sc.rqd,
        sp_89: isErr ? '-' : sc.spacing_89,
        ab_89: isErr ? '-' : sc.abertura_89,
        rg_89: isErr ? '-' : sc.rugosidad_89,
        fl_89: isErr ? '-' : sc.relleno_89,
        wt_89: isErr ? '-' : sc.weathering_89,
        p_89: isErr ? '-' : sc.persistencia_89,
        j_89: isErr ? '-' : sc.juntas_89,
        w_89: isErr ? '-' : sc.agua_89,
        rmr_89: isErr ? 'ERR' : rmrRes.rmr_89,
        class_89: isErr ? 'ERROR' : rmrRes.class_89
      };
    });
  }, [calculatedRows]);

  // --- CONFIGURACIÓN DE COLUMNAS DE ANÁLISIS DE RMR (MÉTODO RE-ESCRITO CON ESTILO DE GRUPO) ---
  const columns = useMemo<GridColumn<any>[]>(() => {
    const list: GridColumn<any>[] = [
      {
        key: 'id',
        label: '#',
        width: 'w-12',
        type: 'readonly',
        isSticky: true,
        stickyLeft: 0,
        cellClassName: 'text-center font-bold'
      },
      {
        key: 'taladro',
        label: 'Sondaje',
        width: 'w-24',
        type: 'readonly',
        isSticky: true,
        stickyLeft: 48,
        renderCell: () => <span className="text-slate-400 block text-center truncate font-bold">{activeTaladroName}</span>
      },
      {
        key: 'fecha',
        label: 'Fecha',
        width: 'w-28',
        type: 'readonly',
        isSticky: true,
        stickyLeft: 144,
        renderCell: () => <span className="text-slate-400 block text-center truncate font-bold">{fecha}</span>
      },
      {
        key: 'geologo',
        label: 'Logueador',
        width: 'w-28',
        type: 'readonly',
        renderCell: () => <span className="text-slate-400 block text-center truncate font-semibold">{geologo}</span>
      },
      {
        key: 'corrida',
        label: 'Corrida',
        width: 'w-16',
        type: 'readonly',
        cellClassName: 'font-black text-cyan-400 text-center'
      },
      {
        key: 'lito1',
        label: 'Lito 1',
        width: 'w-20',
        type: 'readonly',
        cellClassName: 'font-bold text-slate-400 text-center'
      }
    ];

    if (showAllColumns) {
      list.push(
        { key: 'lito2', label: 'Lito 2', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'lito3', label: 'Lito 3', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'de', label: 'Desde (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center font-mono' },
        { key: 'a', label: 'Hasta (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center font-mono' },
        { key: 'perf', label: 'Perf (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center font-bold' },
        { key: 'rec_m', label: 'Rec (m)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'rec_pct', label: 'Rec (%)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'rqd_m', label: 'RQD (m)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'rqd_pct', label: 'RQD (%)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold text-slate-300', cellClassName: 'text-center font-bold' },
        { key: 'lrf_m', label: 'LRF (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'frf', label: 'FRF', width: 'w-16', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center font-bold' },
        { key: 'frac_nat', label: 'Frac Nat', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'total_frac', label: 'Total Frac', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center font-bold' },
        { key: 'ff_1_m', label: 'FF/1m', width: 'w-16', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'spacing_mm', label: 'Espac (mm)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'resistencia', label: 'Resistencia', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold font-semibold', cellClassName: 'text-center' },
        { key: 'tipo_est1', label: 'Estructura', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold uppercase', cellClassName: 'text-center' },
        { key: 'abertura', label: 'Abert (mm)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'rugosidad', label: 'Rugosidad', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'relleno1', label: 'Relleno', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold uppercase', cellClassName: 'text-center' },
        { key: 'clasif_relleno', label: 'Clasif Rell', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'intemperismo', label: 'Intemp', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'jrc10', label: 'JRC10', width: 'w-16', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'espesor', label: 'Espesor', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' },
        { key: 'agua_obs', label: 'Agua', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold', cellClassName: 'text-center' }
      );
    }

    // RMR'76 Columnas de Evaluación
    list.push(
      { key: 's_76', label: '[76] Res.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'rqd_76', label: '[76] RQD', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'sp_76', label: '[76] Espac.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'ab_76', label: '[76] Abert.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'rg_76', label: '[76] Rug.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'fl_76', label: '[76] Rell.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'wt_76', label: '[76] Intemp.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'p_76', label: '[76] Pers.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      { key: 'j_76', label: '[76] Juntas', width: 'w-18', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-400 font-bold', cellClassName: 'text-center font-bold text-cyan-400' },
      { key: 'w_76', label: '[76] Agua', width: 'w-16', type: 'readonly', headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold', cellClassName: 'text-center' },
      {
        key: 'rmr_76',
        label: "RMR'76",
        width: 'w-20',
        type: 'readonly',
        headerBgClass: 'bg-cyan-950/30 text-cyan-400 font-black',
        // MEJORA: Centrado perfecto vertical y horizontal de los Badges mediante flexbox
        renderCell: (row) => {
          const score = row.rmr_76;
          if (score === 'ERR') {
            return (
              <div className="flex justify-center items-center h-full w-full py-0.5">
                <span className="text-red-500 font-black text-center block">ERR</span>
              </div>
            );
          }
          return (
            <div className="flex justify-center items-center h-full w-full py-0.5">
              <span className={`inline-flex items-center justify-center w-12 py-0.5 rounded font-black text-[11px] border ${getQualityColor(score)}`}>
                {score}
              </span>
            </div>
          );
        }
      },
      {
        key: 'class_76',
        label: 'Calidad 76',
        width: 'w-24',
        type: 'readonly',
        headerBgClass: 'bg-cyan-950/30 text-cyan-400 font-bold',
        // MEJORA: Centrado perfecto vertical y horizontal de las etiquetas mediante flexbox
        renderCell: (row) => (
          <div className="flex justify-center items-center h-full w-full py-0.5">
            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getQualityColor(row.rmr_76 === 'ERR' ? 0 : row.rmr_76)}`}>
              {row.class_76}
            </span>
          </div>
        )
      }
    );

    // RMR'89 Columnas de Evaluación
    list.push(
      { key: 's_89', label: '[89] Res.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'rqd_89', label: '[89] RQD', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'sp_89', label: '[89] Espac.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'ab_89', label: '[89] Abert.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'rg_89', label: '[89] Rug.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'fl_89', label: '[89] Rell.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'wt_89', label: '[89] Intemp.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'p_89', label: '[89] Pers.', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      { key: 'j_89', label: '[89] Juntas', width: 'w-18', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-400 font-bold', cellClassName: 'text-center font-bold text-emerald-400' },
      { key: 'w_89', label: '[89] Agua', width: 'w-16', type: 'readonly', headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold', cellClassName: 'text-center' },
      {
        key: 'rmr_89',
        label: "RMR'89",
        width: 'w-24',
        type: 'readonly',
        headerBgClass: 'bg-emerald-950/30 text-emerald-400 font-black',
        // MEJORA: Centrado perfecto vertical y horizontal de los Badges mediante flexbox
        renderCell: (row) => {
          const score = row.rmr_89;
          if (score === 'ERR') {
            return (
              <div className="flex justify-center items-center h-full w-full py-0.5">
                <span className="text-red-500 font-black text-center block">ERR</span>
              </div>
            );
          }
          return (
            <div className="flex justify-center items-center h-full w-full py-0.5">
              <span className={`inline-flex items-center justify-center w-12 py-0.5 rounded font-black text-[11px] border ${getQualityColor(score)}`}>
                {score}
              </span>
            </div>
          );
        }
      },
      {
        key: 'class_89',
        label: 'Calidad 89',
        width: 'w-28',
        type: 'readonly',
        headerBgClass: 'bg-emerald-950/30 text-emerald-400 font-bold',
        // MEJORA: Centrado perfecto vertical y horizontal de las etiquetas mediante flexbox
        renderCell: (row) => (
          <div className="flex justify-center items-center h-full w-full py-0.5">
            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getQualityColor(row.rmr_89 === 'ERR' ? 0 : row.rmr_89)}`}>
              {row.class_89}
            </span>
          </div>
        )
      }
    );

    return list;
  }, [showAllColumns, activeTaladroName, geologo, fecha]);

  return (
    <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 shadow-2xl relative overflow-hidden animate-fade-in flex flex-col h-[550px] min-h-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-navy-800 pb-3 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Rejilla Detallada de Ratings RMR
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Auditoría y puntuación geomecánica por corrida (Nivel Freático configurado: {waterTableM} m)
          </p>
        </div>

        {/* Toggler de columnas */}
        <button
          onClick={() => setShowAllColumns(!showAllColumns)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all border shadow-md active:scale-95 ${!showAllColumns
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
            : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200 hover:border-navy-700'
            }`}
        >
          <Settings size={13} className={!showAllColumns ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
          <span>{showAllColumns ? 'Solo RMR' : 'Mostrar Todo'}</span>
        </button>
      </div>

      {/* SECCIÓN FLEXIBLE CON INDEPENDENT VIEWPORT SCROLL (ESTILO EXCEL) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <BaseEditableGrid<any>
          data={gridData}
          columns={columns}
          selectedRowIndex={null}
          onSelectRow={() => { }}
          onCellChange={() => { }}
          alerts={[]}
          idPrefix="rmr-grid"
          getRowKey={(row) => row.id}
          editableFields={[]}
          darkMode={true}
          minWidth={showAllColumns ? "4400px" : "2100px"}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-navy-800/40 shrink-0">
        <span>* Todos los cálculos siguen los estándares geomecánicos de Bieniawski 1976 y 1989.</span>
        <span>Mostrando {filteredCorridas.length} de {calculatedRows.length} corridas totales.</span>
      </div>
    </div>
  );
}