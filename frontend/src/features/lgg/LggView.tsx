import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  RotateCcw,
  FileSpreadsheet,
  Database,
  Upload,
  Download,
  Edit,
  Ruler,
  Layers,
  Shield,
  Filter
} from 'lucide-react';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import {
  LITHOLOGY_CATALOG,
  LITO1_OPTIONS,
  LITO2_OPTIONS,
  LITO3_OPTIONS,
  STRENGTH_CATALOG
} from '../../utils/catalogData';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import LggQaqcPanel from './components/LggQaqcPanel';
import BaseEditableGrid, { type GridColumn } from '../../components/common/BaseEditableGrid';
import { useLggState, type CorridaEnriquecida, type Corrida } from './useLggState';
import { getLggColumns } from './lggColumns';
import LggExportModal from './components/LggExportModal';
import { CreateTaladroModal, RenameTaladroModal } from './components/CollarModals';

interface LggViewProps {
  corridas: Corrida[];
  alerts: ValidationAlert[];
  onCorridasChange: (corridas: Corrida[]) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number) => void;
  waterTableM: number;
  darkMode?: boolean;
  activeTaladroName: string;
  sidebarCollapsed?: boolean;
  onFocusField?: (fieldId: string) => void;
  onImportExcel?: (importedRows: Corrida[], createNewWithName?: string) => void;
  onCreateTaladro?: (newTaladro: any) => void;
  onRenameTaladro?: (newName: string) => void;
  syncStatus?: string;
  defaultTurno?: string;
}

const LITO_OPTIONS = Object.keys(LITHOLOGY_CATALOG);

const getLitoOptionLabel = (opt: string) => {
  if (opt === "-1" || opt === "-") return "Ninguna";
  const cleanOpt = opt.toUpperCase().replace(/[_-\s/]/g, "");
  const foundKey = Object.keys(LITHOLOGY_CATALOG).find(k => k.toUpperCase().replace(/[_-\s/]/g, "") === cleanOpt);
  if (foundKey) {
    return `${opt} - ${LITHOLOGY_CATALOG[foundKey].name}`;
  }
  return opt;
};

const EDITABLE_COLS: (keyof Corrida)[] = [
  'de', 'a', 'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'mec_frac',
  'frac_nat', 'lito1', 'lito2', 'lito3', 'resistencia', 'orientacion', 'offset',
  'tipo_est1', 'tipo_est2', 'frac_buz30', 'frac_buz60', 'frac_buz90',
  'abertura', 'rugosidad', 'jrc10', 'intemperismo', 'relleno1', 'relleno2',
  'espesor', 'agua_obs', 'turno', 'comentarios'
];

export default function LggView({
  corridas,
  alerts,
  onCorridasChange,
  selectedRowIndex,
  onSelectRow,
  waterTableM,
  darkMode = true,
  activeTaladroName,
  sidebarCollapsed = false,
  onFocusField: _onFocusField,
  onImportExcel,
  onCreateTaladro,
  onRenameTaladro,
  syncStatus: _syncStatus,
  defaultTurno = 'D'
}: LggViewProps) {


  const panelWidthStyle = {
    position: 'sticky' as const,
    left: 0,
    width: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
    maxWidth: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
  };

  const [activeSubTab, setActiveSubTab] = useState<'lgg' | 'qaqc'>('lgg');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    filteredCorridas,
    filterLito,
    setFilterLito,
    filterResistencia,
    setFilterResistencia,
    filterRmrClass,
    setFilterRmrClass,
    filterGeotecnico,
    setFilterGeotecnico,
    handleApplyFilters,
    handleClearFilters,
    addCorridaRow,
    deleteCorridaRow,
    insertCorridaRow,
    handleCellChange
  } = useLggState({ corridas, onCorridasChange, waterTableM, defaultTurno });

  const lastRowTaladroName = (_idx: number) => activeTaladroName || "FEGT25-001";
  const lastRowGeologo = (_idx: number) => {
    const parentEl = document.getElementById('geologo-header-val');
    return parentEl?.textContent || "RD/RB";
  };
  const lastRowFecha = (_idx: number) => {
    const parentEl = document.getElementById('fecha-header-val');
    return parentEl?.textContent || new Date().toISOString().split('T')[0];
  };

  // --- PATRÓN DE CALLBACKS ESTABLES CON REF ---
  // Problema: handleCellChange/deleteCorridaRow/insertCorridaRow se recrean en cada
  // cambio de estado (porque dependen de `corridas`). Si los pasamos directo a
  // getLggColumns(), lggColumns se recalcula en cada keystroke, invalidando React.memo.
  //
  // Solución: guardar la versión actual en un ref y exponer funciones ESTABLES
  // que siempre llaman a la versión más reciente del ref. Así lggColumns
  // nunca cambia de referencia, y las filas memoizadas permanecen válidas.
  const cellChangeRef = useRef(handleCellChange);
  const deleteRowRef = useRef(deleteCorridaRow);
  const insertRowRef = useRef(insertCorridaRow);
  cellChangeRef.current = handleCellChange;
  deleteRowRef.current = deleteCorridaRow;
  insertRowRef.current = insertCorridaRow;

  const stableHandleCellChange = useCallback(
    (index: number, field: keyof Corrida, value: any) => cellChangeRef.current(index, field, value),
    [] // sin dependencias: siempre llama al ref actual
  );
  const stableDeleteRow = useCallback(
    (index: number) => deleteRowRef.current(index),
    []
  );
  const stableInsertRow = useCallback(
    (index: number) => insertRowRef.current(index),
    []
  );

  // --- CONFIGURACIÓN DE COLUMNAS PARA EL GRID BASE ---
  // Solo se recalcula si darkMode o activeTaladroName cambian— NO en cada keystroke.
  const lggColumns = useMemo<GridColumn<CorridaEnriquecida>[]>(() => {
    return getLggColumns({
      darkMode,
      lastRowGeologo,
      lastRowFecha,
      lastRowTaladroName,
      handleCellChange: stableHandleCellChange,
      deleteCorridaRow: stableDeleteRow,
      insertCorridaRow: stableInsertRow
    });
  }, [darkMode, activeTaladroName, stableHandleCellChange, stableDeleteRow, stableInsertRow]);

  // --- NAVEGACIÓN INTERNA: click en alerta → foco en celda del grid (filter-aware) ---
  const handleInternalFocus = useCallback((fieldId: string) => {
    // Parse LGG field format: "de-3", "rec_m-5", etc.
    const match = fieldId.match(/^([a-z0-9_]+)-(\d+)$/);
    if (!match) return;
    const [, colKey, indexStr] = match;
    const alertRowIndex = parseInt(indexStr);

    // Find display index accounting for active filters
    const displayIdx = filteredCorridas.findIndex(r => r.originalIndex === alertRowIndex);
    if (displayIdx < 0) return;

    // Map column key to editable column index
    const colIdx = EDITABLE_COLS.indexOf(colKey as keyof Corrida);
    if (colIdx < 0) return;

    // Select the row
    onSelectRow(filteredCorridas[displayIdx].originalIndex);

    // Scroll and focus the cell
    setTimeout(() => {
      const el = document.getElementById(`lgg-cell-${displayIdx}-${colIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        el.focus();
        if (el.tagName === 'INPUT') (el as HTMLInputElement).select();
      }
    }, 80);
  }, [filteredCorridas, onSelectRow]);

  const safeRowsKpi = corridas || [];
  const totalCorridasKpi = safeRowsKpi.length;
  const totalPerfKpi = safeRowsKpi.reduce((acc, row) => acc + Math.max(0, (row.a - row.de)), 0);
  const firstDeKpi = safeRowsKpi.length > 0 ? Math.min(...safeRowsKpi.map(r => r.de)) : 0;
  const lastAKpi = safeRowsKpi.length > 0 ? Math.max(...safeRowsKpi.map(r => r.a)) : 0;
  const avgRunLengthKpi = totalCorridasKpi > 0 ? (totalPerfKpi / totalCorridasKpi) : 0;

  // Cálculo Promedio Resistencia Estimada (ISRM R0-R6)
  const validStrengths = safeRowsKpi.filter(r => r.resistencia && r.resistencia !== '-1');
  const strengthIndices = validStrengths.map(r => {
    const num = parseInt(r.resistencia.replace('R', ''), 10);
    return isNaN(num) ? null : num;
  }).filter(n => n !== null) as number[];

  const avgRClassKpi = strengthIndices.length > 0
    ? "R" + (strengthIndices.reduce((acc, v) => acc + v, 0) / strengthIndices.length).toFixed(1)
    : "S/D";

  const validStrengthScores = safeRowsKpi
    .map(r => STRENGTH_CATALOG[r.resistencia]?.score)
    .filter(s => s !== undefined) as number[];
  const avgStrengthScoreKpi = validStrengthScores.length > 0
    ? (validStrengthScores.reduce((acc, v) => acc + v, 0) / validStrengthScores.length).toFixed(1)
    : "0.0";

  // Traducción geomecánica de los rangos de resistencia ISRM
  const getISRMClassDescription = (avgClass: string) => {
    if (avgClass === "S/D") return "Sin datos registrados";
    const num = parseFloat(avgClass.replace("R", ""));
    if (isNaN(num)) return "S/D";
    if (num < 1) return "R0: Extr. Blanda (0.25 - 1 MPa)";
    if (num < 2) return "R1: Muy Blanda (1 - 5 MPa)";
    if (num < 3) return "R2: Blanda (5 - 25 MPa)";
    if (num < 4) return "R3: Moderadamente Fuerte (25 - 50 MPa)";
    if (num < 5) return "R4: Fuerte (50 - 100 MPa)";
    if (num < 6) return "R5: Muy Fuerte (100 - 250 MPa)";
    return "R6: Extremadamente Fuerte (>250 MPa)";
  };

  // --- Modales ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  const handleRenameClick = () => {
    setIsRenameModalOpen(true);
  };

  const handleCreateSubmit = (taladroData: any) => {
    if (onCreateTaladro) {
      onCreateTaladro(taladroData);
    }
  };

  const handleRenameSubmit = (newName: string) => {
    if (onRenameTaladro) {
      onRenameTaladro(newName);
    }
  };

  return (
    <div className="h-full flex flex-col select-none min-h-0">
      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0 mb-4">
        <button
          onClick={() => setActiveSubTab('lgg')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'lgg'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Logueo General (LGG)
        </button>
        <button
          onClick={() => setActiveSubTab('qaqc')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'qaqc'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Análisis QA/QC
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-6 min-h-0 relative">
        {activeSubTab === 'lgg' ? (
          <>
            <div
              style={panelWidthStyle}
              className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 shrink-0 transition-[width,max-width] duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                    Logueo Geotécnico General (LGG)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Registro sistemático de corridas, recuperación de testigos, RQD y parámetros del macizo rocoso
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 border active:scale-95 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${showFilters
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                    : 'bg-navy-900 border-navy-800 text-slate-400 hover:bg-navy-850'
                    }`}
                  title={showFilters ? "Ocultar panel de filtros" : "Mostrar panel de filtros"}
                >
                  <Filter size={14} />
                  <span>{showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 text-emerald-500 dark:text-emerald-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Upload size={14} />
                  <span>Importar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={!corridas || corridas.length === 0}
                  className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 text-blue-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* DASHBOARD DE INDICADORES CLAVE DEL SONDAJE ACTIVO (GEOMECÁNICA) */}
            <div
              style={panelWidthStyle}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 transition-[width,max-width] duration-300"
            >
              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Taladro Activo</span>
                  <span className="text-xl font-extrabold text-cyan-400 tracking-wider block">{lastRowTaladroName(0)}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">Responsable: {lastRowGeologo(0)}</span>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                  <Database size={20} />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Metraje Perforado</span>
                  <span className="text-xl font-extrabold text-emerald-400 tracking-wide block">{totalPerfKpi.toFixed(2)} <span className="text-xs text-slate-400 normal-case font-bold">m</span></span>
                  <span className="text-[10px] text-slate-500 block font-bold">Intervalo: {firstDeKpi.toFixed(2)}m - {lastAKpi.toFixed(2)}m</span>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Ruler size={20} />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cantidad de Corridas</span>
                  <span className="text-xl font-extrabold text-purple-400 tracking-wide block">{totalCorridasKpi} <span className="text-xs text-slate-400 lowercase font-bold">corridas</span></span>
                  <span className="text-[10px] text-slate-500 block font-bold">Longitud Promedio: {avgRunLengthKpi.toFixed(2)}m</span>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
                  <Layers size={20} />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Resistencia ISRM Promedio</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-amber-400 tracking-wide block">{avgRClassKpi}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({avgStrengthScoreKpi} pts RMR)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block font-bold truncate max-w-[210px]">{getISRMClassDescription(avgRClassKpi)}</span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Shield size={20} />
                </div>
              </div>
            </div>

            {showFilters && (
              <div
                style={panelWidthStyle}
                className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-lg shrink-0 transition-[width,max-width] duration-300"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Litología 1</label>
                    <select
                      value={filterLito}
                      onChange={(e) => setFilterLito(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">TODAS</option>
                      {LITO_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt} - {LITHOLOGY_CATALOG[opt]?.name || opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Resistencia Máxima (ISRM)</label>
                    <select
                      value={filterResistencia}
                      onChange={(e) => setFilterResistencia(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">TODAS</option>
                      <option value="R0">R0 (Extremadamente Blanda)</option>
                      <option value="R1">R1 (Muy Blanda)</option>
                      <option value="R2">R2 (Blanda)</option>
                      <option value="R3">R3 (Moderadamente Fuerte)</option>
                      <option value="R4">R4 (Fuerte)</option>
                      <option value="R5">R5 (Muy Fuerte)</option>
                      <option value="R6">R6 (Extremadamente Fuerte)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Clasificación RMR'89</label>
                    <select
                      value={filterRmrClass}
                      onChange={(e) => setFilterRmrClass(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">TODAS</option>
                      <option value="Muy Buena">Muy Buena (81 - 100)</option>
                      <option value="Buena">Buena (61 - 80)</option>
                      <option value="Regular">Regular (41 - 60)</option>
                      <option value="Mala">Mala (21 - 40)</option>
                      <option value="Muy Mala">Muy Mala (0 - 20)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Logueador / Geólogo</label>
                    <input
                      type="text"
                      placeholder="ej. RD/RB"
                      value={filterGeotecnico}
                      onChange={(e) => setFilterGeotecnico(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-navy-850 dark:border-navy-800/40">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs font-bold transition-colors"
                  >
                    <RotateCcw size={13} />
                    <span>Limpiar Filtros</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="flex items-center gap-1.5 bg-navy-850 hover:bg-navy-800 border border-navy-800 text-slate-200 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Search size={13} />
                    <span>Aplicar Filtros</span>
                  </button>
                </div>
              </div>
            )}

            {/* Barra de Herramientas de la Grilla */}
            <div
              style={panelWidthStyle}
              className="flex justify-between items-center bg-navy-900/50 p-3 rounded-xl border border-navy-800/35 backdrop-blur-md transition-[width,max-width] duration-300 shrink-0"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={addCorridaRow}
                  className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <Plus size={16} />
                  <span>Agregar Registro</span>
                </button>
                <button
                  type="button"
                  onClick={handleRenameClick}
                  className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  title="Renombrar taladro activo"
                >
                  <Edit size={15} className="text-cyan-400" />
                  <span>Renombrar Taladro</span>
                </button>
                <div className="flex items-center gap-1.5 bg-navy-950/80 dark:bg-navy-900/40 border border-navy-850 dark:border-navy-800/60 rounded-lg px-3 py-1.5 text-xs text-slate-400 shadow-sm ml-2">
                  <Database size={13} className="text-blue-500 dark:text-cyan-400 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 font-bold">{filteredCorridas.length}</span>
                  <span className="text-slate-500 dark:text-slate-400">{filteredCorridas.length === 1 ? 'registro' : 'registros'}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-medium max-w-md text-right leading-relaxed">
                * Navega con las <span className="font-bold text-slate-400">Teclas de Dirección</span>. Presiona <span className="font-bold text-slate-400">ENTER</span> para avanzar o crear corridas. Arrastra los bordes de cabecera para ajustar columnas.
              </div>
            </div>

            <BaseEditableGrid<CorridaEnriquecida>
              data={filteredCorridas}
              columns={lggColumns}
              selectedRowIndex={selectedRowIndex !== null ? filteredCorridas.findIndex(r => r.originalIndex === selectedRowIndex) : null}
              onSelectRow={(idx) => {
                const origIdx = filteredCorridas[idx]?.originalIndex;
                if (origIdx !== undefined) {
                  onSelectRow(origIdx);
                }
              }}
              onCellChange={(idx, field, value) => {
                const origIdx = filteredCorridas[idx]?.originalIndex;
                if (origIdx !== undefined) {
                  handleCellChange(origIdx, field as keyof Corrida, value);
                }
              }}
              alerts={alerts}
              idPrefix="lgg-cell"
              onAddRow={addCorridaRow}
              onDeleteRow={(idx) => {
                const origIdx = filteredCorridas[idx]?.originalIndex;
                if (origIdx !== undefined) {
                  deleteCorridaRow(origIdx);
                }
              }}
              getRowKey={(row) => row.originalIndex}
              getAlertRowIndex={(row) => row.originalIndex}
              editableFields={EDITABLE_COLS}
              darkMode={darkMode}
              minWidth="3200px"
            />

            <datalist id="lito1-options-list">
              {LITO1_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {getLitoOptionLabel(opt)}
                </option>
              ))}
            </datalist>
            <datalist id="lito2-options-list">
              <option value="-1">Ninguna</option>
              {LITO2_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {getLitoOptionLabel(opt)}
                </option>
              ))}
            </datalist>
            <datalist id="lito3-options-list">
              <option value="-1">Ninguna</option>
              {LITO3_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {getLitoOptionLabel(opt)}
                </option>
              ))}
            </datalist>
          </>
        ) : (
          <div style={panelWidthStyle} className="transition-[width,max-width] duration-300">
            <LggQaqcPanel
              corridas={corridas}
              waterTableM={waterTableM}
              alerts={alerts}
              onFocusField={handleInternalFocus}
              onSwitchTab={setActiveSubTab}
            />
          </div>
        )}
      </div>

      <LggExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        corridas={corridas}
        waterTableM={waterTableM}
        activeTaladroName={activeTaladroName}
        darkMode={darkMode}
      />

      <CreateTaladroModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateSubmit}
        defaultGeologo={lastRowGeologo(0)}
      />

      <RenameTaladroModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        activeTaladroName={activeTaladroName}
        onRename={handleRenameSubmit}
      />

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={activeTaladroName}
        importType="LGG"
        onImport={(importedRows, createNewWithName) => {
          if (onImportExcel) {
            onImportExcel(importedRows, createNewWithName);
          } else {
            onCorridasChange(importedRows);
          }
        }}
      />
    </div>
  );
}