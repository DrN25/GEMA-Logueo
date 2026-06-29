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
  Filter,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff
} from 'lucide-react';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import { LITHOLOGY_CATALOG, LITO1_OPTIONS, LITO2_OPTIONS, LITO3_OPTIONS, STRENGTH_CATALOG } from '../../utils/catalogData';
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
  activeTaladroGeologo?: string;
  activeTaladroFecha?: string;
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
  activeTaladroGeologo = "RD/RB",
  activeTaladroFecha,
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

  // --- NUEVO ESTADO DE MODO ENFOQUE PARA OPTIMIZAR ESPACIO VERTICAL ---
  const [showKpis, setShowKpis] = useState(true);

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

  const lastRowTaladroName = useCallback((_idx: number) => {
    return activeTaladroName || "FEGT25-001";
  }, [activeTaladroName]);

  const lastRowGeologo = useCallback((_idx: number) => {
    return activeTaladroGeologo || "RD/RB";
  }, [activeTaladroGeologo]);

  const lastRowFecha = useCallback((_idx: number) => {
    return activeTaladroFecha || new Date().toISOString().split('T')[0];
  }, [activeTaladroFecha]);

  const cellChangeRef = useRef(handleCellChange);
  const deleteRowRef = useRef(deleteCorridaRow);
  const insertRowRef = useRef(insertCorridaRow);
  cellChangeRef.current = handleCellChange;
  deleteRowRef.current = deleteCorridaRow;
  insertRowRef.current = insertCorridaRow;

  const stableHandleCellChange = useCallback(
    (index: number, field: keyof Corrida, value: any) => cellChangeRef.current(index, field, value),
    []
  );
  const stableDeleteRow = useCallback(
    (index: number) => deleteRowRef.current(index),
    []
  );
  const stableInsertRow = useCallback(
    (index: number) => insertRowRef.current(index),
    []
  );

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
  }, [
    darkMode,
    lastRowGeologo,
    lastRowFecha,
    lastRowTaladroName,
    stableHandleCellChange,
    stableDeleteRow,
    stableInsertRow
  ]);

  const handleInternalFocus = useCallback((fieldId: string) => {
    const match = fieldId.match(/^([a-z0-9_]+)-(\d+)$/);
    if (!match) return;
    const [, colKey, indexStr] = match;
    const alertRowIndex = parseInt(indexStr);

    const displayIdx = filteredCorridas.findIndex(r => r.originalIndex === alertRowIndex);
    if (displayIdx < 0) return;

    const colIdx = EDITABLE_COLS.indexOf(colKey as keyof Corrida);
    if (colIdx < 0) return;

    onSelectRow(filteredCorridas[displayIdx].originalIndex);

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
    <div className="h-full flex flex-col select-none min-h-0 overflow-hidden">
      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0 mb-4 justify-between items-center">
        <div className="flex">
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

        {/* BOTÓN DE TOGGLE PARA MODO ENFOQUE */}
        {activeSubTab === 'lgg' && (
          <button
            onClick={() => setShowKpis(!showKpis)}
            className={`mr-4 flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xxs font-black uppercase tracking-wider transition-all active:scale-95 ${showKpis
                ? 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200 hover:bg-navy-850'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
              }`}
            title={showKpis ? "Ocultar panel de control para maximizar registros" : "Mostrar panel de control y KPIs"}
          >
            {showKpis ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{showKpis ? "Modo Enfoque (Ocultar KPIs)" : "Mostrar KPIs"}</span>
          </button>
        )}
      </div>

      {activeSubTab === 'lgg' ? (
        <div className="flex-1 flex flex-col p-1 space-y-3 min-h-0 overflow-hidden relative">

          {/* SECCIÓN SUPERIOR ESTÁTICA - KPIs & Header (Ocultable dinámicamente con animación) */}
          <div className={`shrink-0 space-y-3 transition-all duration-300 ease-in-out ${showKpis ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
            }`}>
            <div
              style={panelWidthStyle}
              className="glass-panel p-3.5 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 transition-[width,max-width] duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Logueo Geotécnico General (LGG)
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Registro sistemático de corridas, recuperación de testigos, RQD y parámetros del macizo rocoso
                  </p>
                </div>
              </div>

              {/* Botones de acción principales (visibles aquí solo en modo normal) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 border active:scale-95 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm ${showFilters
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                    : 'bg-navy-900 border-navy-800 text-slate-400 hover:bg-navy-850'
                    }`}
                >
                  <Filter size={12} />
                  <span>{showFilters ? "Ocultar Filtros" : "Filtros"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 text-emerald-500 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm"
                >
                  <Upload size={12} />
                  <span>Importar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={!corridas || corridas.length === 0}
                  className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 text-blue-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={12} />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* Fila de KPIs Geomecánicos */}
            <div
              style={panelWidthStyle}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 transition-[width,max-width] duration-300"
            >
              <div className="glass-panel p-3 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Taladro Activo</span>
                  <span className="text-base font-extrabold text-cyan-400 tracking-wider block">{lastRowTaladroName(0)}</span>
                  <span className="text-[9px] text-slate-500 block font-bold">Responsable: {lastRowGeologo(0)}</span>
                </div>
                <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                  <Database size={16} />
                </div>
              </div>

              <div className="glass-panel p-3 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Metraje Perforado</span>
                  <span className="text-base font-extrabold text-emerald-400 tracking-wide block">{totalPerfKpi.toFixed(2)} <span className="text-[10px] text-slate-400 normal-case font-bold">m</span></span>
                  <span className="text-[9px] text-slate-500 block font-bold">Intervalo: {firstDeKpi.toFixed(2)}m - {lastAKpi.toFixed(2)}m</span>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                  <Ruler size={16} />
                </div>
              </div>

              <div className="glass-panel p-3 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cantidad de Corridas</span>
                  <span className="text-base font-extrabold text-purple-400 tracking-wide block">{totalCorridasKpi} <span className="text-[10px] text-slate-400 lowercase font-bold">corridas</span></span>
                  <span className="text-[9px] text-slate-500 block font-bold">Longitud Promedio: {avgRunLengthKpi.toFixed(2)}m</span>
                </div>
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
                  <Layers size={16} />
                </div>
              </div>

              <div className="glass-panel p-3 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Resistencia ISRM Promedio</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-extrabold text-amber-400 tracking-wide block">{avgRClassKpi}</span>
                    <span className="text-[9px] text-slate-400 font-bold">({avgStrengthScoreKpi} pts RMR)</span>
                  </div>
                  <span className="text-[9px] text-slate-500 block font-bold truncate max-w-[190px]">{getISRMClassDescription(avgRClassKpi)}</span>
                </div>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                  <Shield size={16} />
                </div>
              </div>
            </div>

            {/* Panel de Filtros Dinámicos */}
            {showFilters && (
              <div
                style={panelWidthStyle}
                className="glass-panel p-3 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-3 shadow-lg transition-[width,max-width] duration-300"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Litología 1</label>
                    <select
                      value={filterLito}
                      onChange={(e) => setFilterLito(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">TODAS</option>
                      {LITO_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt} - {LITHOLOGY_CATALOG[opt]?.name || opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resistencia Máxima (ISRM)</label>
                    <select
                      value={filterResistencia}
                      onChange={(e) => setFilterResistencia(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clasificación RMR'89</label>
                    <select
                      value={filterRmrClass}
                      onChange={(e) => setFilterRmrClass(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logueador / Geólogo</label>
                    <input
                      type="text"
                      placeholder="ej. RD/RB"
                      value={filterGeotecnico}
                      onChange={(e) => setFilterGeotecnico(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1.5 border-t border-navy-850 dark:border-navy-800/40">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xxs font-black uppercase tracking-wider transition-colors"
                  >
                    <RotateCcw size={11} />
                    <span>Limpiar Filtros</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="flex items-center gap-1.5 bg-navy-850 hover:bg-navy-800 border border-navy-800 text-slate-200 px-3 py-1 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                  >
                    <Search size={11} />
                    <span>Aplicar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* BARRA DE HERRAMIENTAS AUTOADAPTABLE (FUSIONA HEADER CUANDO KPIS SE OCULTAN) */}
          <div
            style={panelWidthStyle}
            className="shrink-0 flex justify-between items-center bg-navy-900/50 p-2.5 rounded-xl border border-navy-800/35 backdrop-blur-md transition-[width,max-width] duration-300 shadow-md"
          >
            <div className="flex items-center gap-2">
              {/* Información heredada de forma compacta si los KPIs están colapsados */}
              {!showKpis && (
                <div className="flex items-center gap-2 border-r border-navy-800 pr-3 mr-1">
                  <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md tracking-wider">
                    {lastRowTaladroName(0)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {totalPerfKpi.toFixed(2)}m
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">
                    {lastRowGeologo(0)}
                  </span>
                </div>
              )}

              <button
                onClick={addCorridaRow}
                className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
              >
                <Plus size={13} />
                <span>Agregar</span>
              </button>
              <button
                type="button"
                onClick={handleRenameClick}
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
              >
                <Edit size={12} className="text-cyan-400" />
                <span>Renombrar</span>
              </button>

              {/* Botones de Importación/Exportación mudados dinámicamente si KPIs están colapsados */}
              {!showKpis && (
                <div className="flex items-center gap-1.5 pl-1.5 border-l border-navy-800">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xxs font-black uppercase tracking-wider transition-all border border-emerald-500/10 active:scale-95"
                    title="Importar Excel"
                  >
                    <Upload size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    disabled={!corridas || corridas.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xxs font-black uppercase tracking-wider transition-all border border-blue-500/10 active:scale-95 disabled:opacity-30"
                    title="Exportar Excel"
                  >
                    <Download size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-navy-950/80 border border-navy-850 rounded-lg px-2.5 py-1.5 text-xxs text-slate-400 shadow-sm">
                <span className="text-slate-300 font-bold">{filteredCorridas.length}</span>
                <span className="text-slate-500">{filteredCorridas.length === 1 ? 'reg.' : 'regs.'}</span>
              </div>
            </div>

            {/* Texto de ayuda compacto */}
            <div className="text-[10px] text-slate-500 font-medium hidden md:block">
              Foco en celdas con <span className="font-bold text-slate-400">Teclas de Dirección</span> • <span className="font-bold text-slate-400">ENTER</span> para avanzar.
            </div>
          </div>

          {/* SECCIÓN INFERIOR FLEXIBLE (La grilla se adapta dinámicamente ocupando todo el espacio libre) */}
          <div className="flex-1 min-h-0 flex flex-col">
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
          </div>

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
        </div>
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

      <LggExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        corridas={corridas}
        waterTableM={waterTableM}
        activeTaladroName={activeTaladroName}
        activeTaladroGeologo={activeTaladroGeologo}
        activeTaladroFecha={activeTaladroFecha}
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