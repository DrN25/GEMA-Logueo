import { useMemo } from 'react';
import BaseEditableGrid, { type GridColumn } from '../../../components/common/BaseEditableGrid';
import { FormulaTooltipTrigger } from '../../../components/common/FormulaTooltip';

interface RmrGridProps {
  calculatedRows?: any[];
  activeTaladroName: string;
  geologo: string;
  fecha: string;
  showAllColumns: boolean;
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
  calculatedRows = [],
  activeTaladroName,
  geologo,
  fecha,
  showAllColumns
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

  // --- CONFIGURACIÓN DE COLUMNAS DE ANÁLISIS DE RMR ---
  const columns = useMemo<GridColumn<any>[]>(() => {
    const list: GridColumn<any>[] = [
      {
        key: 'id',
        label: '#',
        width: 'w-12',
        type: 'readonly',
        isSticky: true,
        stickyLeft: 0,
        cellClassName: 'text-center font-bold text-slate-400'
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
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Número de Corrida", val: row.corrida }} position="bottom">
            <div className="font-black text-cyan-400 text-center py-1.5">{row.corrida}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'lito1',
        label: 'Lito 1',
        width: 'w-20',
        type: 'readonly',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_lito_heredada" params={{ corrida: row.corrida, lito1: row.lito1, lito2: row.lito2, lito3: row.lito3 }} position="bottom">
            <div className="font-bold text-slate-400 text-center py-1.5">{row.lito1}</div>
          </FormulaTooltipTrigger>
        )
      }
    ];

    if (showAllColumns) {
      list.push(
        {
          key: 'lito2', label: 'Lito 2', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_lito_heredada" params={{ corrida: row.corrida, lito1: row.lito1, lito2: row.lito2, lito3: row.lito3 }} position="bottom">
              <div className="text-center py-1.5">{row.lito2 === "-1" ? "-" : row.lito2}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'lito3', label: 'Lito 3', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_lito_heredada" params={{ corrida: row.corrida, lito1: row.lito1, lito2: row.lito2, lito3: row.lito3 }} position="bottom">
              <div className="text-center py-1.5">{row.lito3 === "-1" ? "-" : row.lito3}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'de', label: 'Desde (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_de_a" params={{ corrida: row.corrida, de: row.de, a: row.a }} position="bottom">
              <div className="text-center font-mono py-1.5">{typeof row.de === 'number' ? row.de.toFixed(2) : row.de}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'a', label: 'Hasta (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_de_a" params={{ corrida: row.corrida, de: row.de, a: row.a }} position="bottom">
              <div className="text-center font-mono py-1.5">{typeof row.a === 'number' ? row.a.toFixed(2) : row.a}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'perf', label: 'Perf (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="lgg_perf" params={{ de: row.de, a: row.a, val: row.perf }} position="bottom">
              <div className="text-center font-bold py-1.5">{row.perf}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'rec_m', label: 'Rec (m)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Longitud Recuperada (m)", val: row.rec_m }} position="bottom">
              <div className="text-center py-1.5">{row.rec_m}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'rec_pct', label: 'Rec (%)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_rec_pct" params={{ rec: row.rec_m, perf: row.perf, val: row.rec_pct }} position="bottom">
              <div className="text-center py-1.5">{row.rec_pct}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'rqd_m', label: 'RQD (m)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Metraje RQD ≥ 10cm (m)", val: row.rqd_m }} position="bottom">
              <div className="text-center py-1.5">{row.rqd_m}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'rqd_pct', label: 'RQD (%)', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold text-slate-300',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_rqd_pct" params={{ rqd: row.rqd_m, perf: row.perf, val: row.rqd_pct }} position="bottom">
              <div className="text-center font-bold py-1.5">{row.rqd_pct}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'lrf_m', label: 'LRF (m)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Long. Roca Fracturada LRF (m)", val: row.lrf_m }} position="bottom">
              <div className="text-center py-1.5">{row.lrf_m}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'frf', label: 'FRF', width: 'w-16', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="lgg_frf" params={{ lrf: row.lrf_m, val: row.frf }} position="bottom">
              <div className="text-center font-bold py-1.5">{row.frf}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'frac_nat', label: 'Frac Nat', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "N° Fracturas Naturales", val: row.frac_nat }} position="bottom">
              <div className="text-center py-1.5">{row.frac_nat}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'total_frac', label: 'Total Frac', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_total_frac" params={{ frf: row.frf, fracNat: row.frac_nat, val: row.total_frac }} position="bottom">
              <div className="text-center font-bold py-1.5">{row.total_frac}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'ff_1_m', label: 'FF/1m', width: 'w-16', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_ff_1_m" params={{ totalFrac: row.total_frac, perf: row.perf, val: row.ff_1_m }} position="bottom">
              <div className="text-center py-1.5">{row.ff_1_m}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'spacing_mm', label: 'Espac (mm)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_spacing_calc" params={{ perf: row.perf, totalFrac: row.total_frac, val: row.spacing_mm }} position="bottom">
              <div className="text-center py-1.5">{row.spacing_mm}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'resistencia', label: 'Resistencia', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold font-semibold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Resistencia Estimada ISRM", val: row.resistencia }} position="bottom">
              <div className="text-center py-1.5">{row.resistencia}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'tipo_est1', label: 'Estructura', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold uppercase',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Tipo de Estructura Principal", val: row.tipo_est1 }} position="bottom">
              <div className="text-center py-1.5 uppercase">{row.tipo_est1}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'abertura', label: 'Abert (mm)', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Abertura de Junta (mm)", val: row.abertura }} position="bottom">
              <div className="text-center py-1.5">{row.abertura}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'rugosidad', label: 'Rugosidad', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Perfil Rugosidad ISRM", val: row.rugosidad }} position="bottom">
              <div className="text-center py-1.5">{row.rugosidad}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'relleno1', label: 'Relleno', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold uppercase',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Tipo de Relleno 1", val: row.relleno1 }} position="bottom">
              <div className="text-center py-1.5 uppercase">{row.relleno1}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'clasif_relleno', label: 'Clasif Rell', width: 'w-24', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_clasif_relleno" params={{ code: row.relleno1, val: row.clasif_relleno }} position="bottom">
              <div className="text-center py-1.5">{row.clasif_relleno}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'intemperismo', label: 'Intemp', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Grado Intemperismo ISRM", val: row.intemperismo }} position="bottom">
              <div className="text-center py-1.5">{row.intemperismo}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'jrc10', label: 'JRC10', width: 'w-16', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Rugosidad JRC10", val: row.jrc10 }} position="bottom">
              <div className="text-center py-1.5">{row.jrc10}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'espesor', label: 'Espesor', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Espesor de Relleno (mm)", val: row.espesor }} position="bottom">
              <div className="text-center py-1.5">{row.espesor}</div>
            </FormulaTooltipTrigger>
          )
        },
        {
          key: 'agua_obs', label: 'Agua', width: 'w-20', type: 'readonly', headerBgClass: 'bg-purple-950/20 text-purple-300 font-bold',
          renderCell: (row) => (
            <FormulaTooltipTrigger formulaId="rmr_field_lgg_import" params={{ campo: "Condición de Agua Subterránea", val: row.agua_obs }} position="bottom">
              <div className="text-center py-1.5">{row.agua_obs}</div>
            </FormulaTooltipTrigger>
          )
        }
      );
    }

    // RMR'76 Columnas de Evaluación
    list.push(
      {
        key: 's_76', label: '[76] Res.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_strength" params={{ code: row.resistencia, val: row.s_76 }} position="bottom">
            <div className="text-center py-1.5">{row.s_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'rqd_76', label: '[76] RQD', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_rqd" params={{ rqd: row.rqd_pct, val: row.rqd_76 }} position="bottom">
            <div className="text-center py-1.5">{row.rqd_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'sp_76', label: '[76] Espac.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_spacing_76" params={{ spacing: row.spacing_mm, val: row.sp_76 }} position="bottom">
            <div className="text-center py-1.5">{row.sp_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'ab_76', label: '[76] Abert.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_aperture_76" params={{ aperture: row.abertura, val: row.ab_76 }} position="bottom">
            <div className="text-center py-1.5">{row.ab_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'rg_76', label: '[76] Rug.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_roughness_76" params={{ roughness: row.rugosidad, val: row.rg_76 }} position="bottom">
            <div className="text-center py-1.5">{row.rg_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'fl_76', label: '[76] Rell.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_filling_76" params={{ code: row.relleno1, thickness: row.espesor, val: row.fl_76 }} position="bottom">
            <div className="text-center py-1.5">{row.fl_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'wt_76', label: '[76] Intemp.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_weathering_76" params={{ code: row.intemperismo, val: row.wt_76 }} position="bottom">
            <div className="text-center py-1.5">{row.wt_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'p_76', label: '[76] Pers.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_persistence_76" params={{ ab: row.ab_76, rg: row.rg_76, fl: row.fl_76, wt: row.wt_76, val: row.p_76 }} position="bottom">
            <div className="text-center py-1.5">{row.p_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'j_76', label: '[76] Juntas', width: 'w-18', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-400 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_joints_76" params={{ ab: row.ab_76, rg: row.rg_76, fl: row.fl_76, wt: row.wt_76, pe: row.p_76, val: row.j_76 }} position="bottom">
            <div className="text-center font-bold text-cyan-400 py-1.5">{row.j_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'w_76', label: '[76] Agua', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-cyan-950/20 text-cyan-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_water" params={{ depth: row.a, wt: 97, code: row.agua_obs, val76: row.w_76, val89: row.w_89 }} position="bottom">
            <div className="text-center py-1.5">{row.w_76}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'rmr_76',
        label: "RMR'76",
        width: 'w-20',
        type: 'readonly',
        headerBgClass: 'bg-cyan-950/30 text-cyan-400 font-black',
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
            <FormulaTooltipTrigger formulaId="rmr_total_76" params={{ s: row.s_76, rqd: row.rqd_76, sp: row.sp_76, j: row.j_76, w: row.w_76 }} position="top">
              <div className="flex justify-center items-center h-full w-full py-0.5">
                <span className={`inline-flex items-center justify-center w-12 py-0.5 rounded font-black text-[11px] border ${getQualityColor(score)}`}>
                  {score}
                </span>
              </div>
            </FormulaTooltipTrigger>
          );
        }
      },
      {
        key: 'class_76',
        label: 'Calidad 76',
        width: 'w-24',
        type: 'readonly',
        headerBgClass: 'bg-cyan-950/30 text-cyan-400 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_class" params={{ rmr: row.rmr_76 === 'ERR' ? 0 : row.rmr_76, val: row.class_76 }} position="top">
            <div className="flex justify-center items-center h-full w-full py-0.5">
              <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getQualityColor(row.rmr_76 === 'ERR' ? 0 : row.rmr_76)}`}>
                {row.class_76}
              </span>
            </div>
          </FormulaTooltipTrigger>
        )
      }
    );

    // RMR'89 Columnas de Evaluación
    list.push(
      {
        key: 's_89', label: '[89] Res.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_strength" params={{ code: row.resistencia, val: row.s_89 }} position="bottom">
            <div className="text-center py-1.5">{row.s_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'rqd_89', label: '[89] RQD', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_rqd" params={{ rqd: row.rqd_pct, val: row.rqd_89 }} position="bottom">
            <div className="text-center py-1.5">{row.rqd_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'sp_89', label: '[89] Espac.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_spacing_89" params={{ spacing: row.spacing_mm, val: row.sp_89 }} position="bottom">
            <div className="text-center py-1.5">{row.sp_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'ab_89', label: '[89] Abert.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_aperture_89" params={{ aperture: row.abertura, val: row.ab_89 }} position="bottom">
            <div className="text-center py-1.5">{row.ab_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'rg_89', label: '[89] Rug.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_roughness_89" params={{ roughness: row.rugosidad, val: row.rg_89 }} position="bottom">
            <div className="text-center py-1.5">{row.rg_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'fl_89', label: '[89] Rell.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_filling_89" params={{ code: row.relleno1, thickness: row.espesor, val: row.fl_89 }} position="bottom">
            <div className="text-center py-1.5">{row.fl_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'wt_89', label: '[89] Intemp.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_weathering_89" params={{ code: row.intemperismo, val: row.wt_89 }} position="bottom">
            <div className="text-center py-1.5">{row.wt_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'p_89', label: '[89] Pers.', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_persistence_89" params={{ ab: row.ab_89, rg: row.rg_89, fl: row.fl_89, wt: row.wt_89, val: row.p_89 }} position="bottom">
            <div className="text-center py-1.5">{row.p_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'j_89', label: '[89] Juntas', width: 'w-18', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-400 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_joints_89" params={{ ab: row.ab_89, rg: row.rg_89, fl: row.fl_89, wt: row.wt_89, pe: row.p_89, val: row.j_89 }} position="bottom">
            <div className="text-center font-bold text-emerald-400 py-1.5">{row.j_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'w_89', label: '[89] Agua', width: 'w-16', type: 'readonly',
        headerBgClass: 'bg-emerald-950/20 text-emerald-300 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_water" params={{ depth: row.a, wt: 97, code: row.agua_obs, val76: row.w_76, val89: row.w_89 }} position="bottom">
            <div className="text-center py-1.5">{row.w_89}</div>
          </FormulaTooltipTrigger>
        )
      },
      {
        key: 'rmr_89',
        label: "RMR'89",
        width: 'w-24',
        type: 'readonly',
        headerBgClass: 'bg-emerald-950/30 text-emerald-400 font-black',
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
            <FormulaTooltipTrigger formulaId="rmr_total_89" params={{ s: row.s_89, rqd: row.rqd_89, sp: row.sp_89, j: row.j_89, w: row.w_89 }} position="top">
              <div className="flex justify-center items-center h-full w-full py-0.5">
                <span className={`inline-flex items-center justify-center w-12 py-0.5 rounded font-black text-[11px] border ${getQualityColor(score)}`}>
                  {score}
                </span>
              </div>
            </FormulaTooltipTrigger>
          );
        }
      },
      {
        key: 'class_89',
        label: 'Calidad 89',
        width: 'w-28',
        type: 'readonly',
        headerBgClass: 'bg-emerald-950/30 text-emerald-400 font-bold',
        renderCell: (row) => (
          <FormulaTooltipTrigger formulaId="rmr_class" params={{ rmr: row.rmr_89 === 'ERR' ? 0 : row.rmr_89, val: row.class_89 }} position="top">
            <div className="flex justify-center items-center h-full w-full py-0.5">
              <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getQualityColor(row.rmr_89 === 'ERR' ? 0 : row.rmr_89)}`}>
                {row.class_89}
              </span>
            </div>
          </FormulaTooltipTrigger>
        )
      }
    );

    return list;
  }, [showAllColumns, activeTaladroName, geologo, fecha]);

  return (
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
  );
}