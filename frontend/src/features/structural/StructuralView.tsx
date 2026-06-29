import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Share2,
  Search,
  RotateCcw,
  Database,
  Upload,
  Download,
  Layers,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import {
  ESTRUCTURA_OPTIONS,
  INTEMPERISMO_OPTIONS
} from '../../utils/catalogData';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import BaseEditableGrid from '../../components/common/BaseEditableGrid';
import { useStructuralState } from './useStructuralState';
import { getStructuralColumns, type Discontinuidad, type Corrida } from './structuralColumns';
import StructuralQaqcPanel from './components/StructuralQaqcPanel';

interface StructuralViewProps {
  discontinuidades: Discontinuidad[];
  corridas: Corrida[];
  onDiscontinuidadesChange: (discontinuidades: Discontinuidad[]) => void;
  geologo: string;
  activeTaladroName: string;
  alerts: ValidationAlert[];
  onImportExcel?: (rawRows: any[]) => void;
  darkMode?: boolean;
  sidebarCollapsed?: boolean;
  onFocusField?: (fieldId: string) => void;
}

const EDITABLE_COLS: (keyof Discontinuidad)[] = [
  'profundidad', 'tipo_estructura', 'alfa', 'beta', 'forma', 'rugosidad',
  'jrc10', 'abertura', 'weathering', 'espesor', 'relleno1', 'relleno2',
  'dureza_pared', 'agua', 'geotecnico', 'comentario', 'tipo'
];

export default function StructuralView({
  discontinuidades,
  corridas,
  onDiscontinuidadesChange,
  geologo,
  activeTaladroName,
  alerts,
  onImportExcel,
  darkMode = true,
  sidebarCollapsed = false,
  onFocusField
}: StructuralViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'lgest' | 'qaqc'>('lgest');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showKpis, setShowKpis] = useState(true);

  const panelWidthStyle = {
    position: 'sticky' as const,
    left: 0,
    width: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
    maxWidth: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
  };

  const {
    filteredDiscontinuidades,
    filterTipoEst,
    setFilterTipoEst,
    filterWeathering,
    setFilterWeathering,
    handleApplyFilters,
    handleClearFilters,
    handleCellChange,
    addDiscontinuidadRow,
    insertDiscontinuidadRow,
    deleteRow,
    handleKeyDown,
    selectedRowIndex,
    setSelectedRowIndex
  } = useStructuralState({
    discontinuidades,
    corridas,
    onDiscontinuidadesChange,
    geologo
  });

  // --- PATRÓN DE CALLBACKS ESTABLES CON REF ---
  const cellChangeRef = useRef(handleCellChange);
  const deleteRowRef = useRef(deleteRow);
  const insertRowRef = useRef(insertDiscontinuidadRow);
  const keyDownRef = useRef(handleKeyDown);

  cellChangeRef.current = handleCellChange;
  deleteRowRef.current = deleteRow;
  insertRowRef.current = insertDiscontinuidadRow;
  keyDownRef.current = handleKeyDown;

  const stableHandleCellChange = useCallback(
    (idx: number, field: any, val: any) => cellChangeRef.current(idx, field, val),
    []
  );
  const stableDeleteRow = useCallback(
    (idx: number) => deleteRowRef.current(idx),
    []
  );
  const stableInsertRow = useCallback(
    (idx: number) => insertRowRef.current(idx),
    []
  );
  const stableKeyDown = useCallback(
    (e: any, idx: number, col: any) => keyDownRef.current(e, idx, col),
    []
  );

  // --- CONFIGURACIÓN DE COLUMNAS PARA EL GRID BASE ---
  const structuralColumns = useMemo(() => {
    return getStructuralColumns({
      darkMode,
      activeTaladroName,
      corridas,
      handleCellChange: stableHandleCellChange,
      deleteRow: stableDeleteRow,
      insertDiscontinuidadRow: stableInsertRow,
      handleKeyDown: stableKeyDown
    });
  }, [darkMode, activeTaladroName, corridas, stableHandleCellChange, stableDeleteRow, stableInsertRow, stableKeyDown]);

  const handleExportExcel = () => {
    try {
      const exportRows = discontinuidades.map((disc) => {
        const matchingCorrida = corridas.find(c => disc.profundidad >= c.de && disc.profundidad < c.a) || corridas.find(c => disc.profundidad === c.a);
        const lito1 = matchingCorrida ? matchingCorrida.lito1 : (disc as any).lito1 || disc.litologia || '';
        const lito2 = matchingCorrida ? (matchingCorrida.lito2 || '-1') : (disc as any).lito2 || '-1';
        const lito3 = matchingCorrida ? (matchingCorrida.lito3 || '-1') : (disc as any).lito3 || '-1';

        return {
          'Nro': disc.id,
          'Taladro': activeTaladroName,
          'de:': disc.de,
          'a:': disc.a,
          'Profundidad (m)': disc.profundidad,
          'Lito 1': lito1,
          'Lito 2': lito2 === "-1" ? "" : lito2,
          'Lito 3': lito3 === "-1" ? "" : lito3,
          'Tipo de Estructura': disc.tipo_estructura,
          'Alfa (°)': disc.alfa,
          'Beta (°)': disc.beta,
          'Forma': disc.forma,
          'Rugosidad (ISRM)': disc.rugosidad,
          'JNRC10': disc.jrc10,
          'Abertura (mm)': disc.abertura,
          'Grado Intemperismo': disc.weathering,
          'Espesor Relleno (mm)': disc.espesor,
          'Tipo de Relleno 1': disc.relleno1,
          'Tipo de Relleno 2': disc.relleno2 || '',
          'Dureza de la pared de Estructura': disc.dureza_pared,
          'Presen. Agua (ISRM)': disc.agua,
          'Geotécnico': disc.geotecnico,
          'Comentario': disc.comentario || '',
          'Corrida': disc.corrida,
          'Tipo': disc.tipo
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'LG EST.');
      XLSX.writeFile(wb, `${activeTaladroName}_Logueo_Estructural.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar los datos a Excel.');
    }
  };

  return (
    <div className="h-full flex flex-col select-none min-h-0 overflow-hidden">
      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0 mb-4 justify-between items-center">
        <div className="flex">
          <button
            onClick={() => setActiveSubTab('lgest')}
            className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'lgest'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
          >
            Logueo Estructural (LG EST)
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

        {/* BOTÓN DE MODO ENFOQUE PARA MAXIMIZAR FILAS EN PANTALLA */}
        {activeSubTab === 'lgest' && (
          <button
            onClick={() => setShowKpis(!showKpis)}
            className={`mr-4 flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xxs font-black uppercase tracking-wider transition-all active:scale-95 ${showKpis
                ? 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200 hover:bg-navy-850'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
              }`}
          >
            {showKpis ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{showKpis ? "Modo Enfoque (Ocultar Cabecera)" : "Mostrar Cabecera"}</span>
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-1 space-y-3 min-h-0 overflow-hidden relative">
        {activeSubTab === 'lgest' ? (
          <>
            {/* CABECERA ESTÁTICA OCULTABLE DINÁMICAMENTE */}
            <div className={`shrink-0 space-y-3 transition-all duration-300 ease-in-out ${showKpis ? 'opacity-100 max-h-[250px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
              }`}>
              <div
                style={panelWidthStyle}
                className="glass-panel p-3.5 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 transition-[width,max-width] duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                    <Share2 size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                      Logueo Estructural Orientado (LG EST)
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Registro individual de discontinuidades orientadas y parámetros de juntas
                    </p>
                  </div>
                </div>

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
                    onClick={handleExportExcel}
                    disabled={!discontinuidades || discontinuidades.length === 0}
                    className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 text-blue-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={12} />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              </div>

              {/* Panel de Filtros */}
              {showFilters && (
                <div
                  style={panelWidthStyle}
                  className="glass-panel p-3.5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-3 shadow-lg transition-[width,max-width] duration-300"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo Estructura</label>
                      <select
                        value={filterTipoEst}
                        onChange={(e) => setFilterTipoEst(e.target.value)}
                        className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">TODAS</option>
                        {ESTRUCTURA_OPTIONS.filter(o => o !== "-1").map(opt => (
                          <option key={opt} value={opt}>{opt === "-1" ? "Sin dato" : opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Meteorización (Weathering)</label>
                      <select
                        value={filterWeathering}
                        onChange={(e) => setFilterWeathering(e.target.value)}
                        className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">TODAS</option>
                        {INTEMPERISMO_OPTIONS.filter(o => o !== "-1").map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1.5 border-t border-navy-850 dark:border-navy-800/40">
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xxs font-black uppercase tracking-wider transition-colors"
                    >
                      <RotateCcw size={11} />
                      <span>Limpiar Filtros</span>
                    </button>
                    <button
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

            {/* BARRA DE ACCIONES DE GRILLA AUTOADAPTABLE */}
            <div
              style={panelWidthStyle}
              className="shrink-0 flex justify-between items-center bg-navy-900/50 p-2.5 rounded-xl border border-navy-800/35 backdrop-blur-md transition-[width,max-width] duration-300 shadow-md animate-none"
            >
              <div className="flex items-center gap-2">
                {/* Indicador de Taladro Compacto en Modo Enfoque */}
                {!showKpis && (
                  <div className="flex items-center gap-2 border-r border-navy-800 pr-3 mr-1">
                    <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md tracking-wider">
                      {activeTaladroName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">
                      {geologo}
                    </span>
                  </div>
                )}

                <button
                  onClick={addDiscontinuidadRow}
                  className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                >
                  <Plus size={13} />
                  <span>Agregar</span>
                </button>
                {selectedRowIndex !== null && (
                  <button
                    onClick={() => insertDiscontinuidadRow(selectedRowIndex)}
                    className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                    title="Insertar y clonar fila seleccionada"
                  >
                    <Layers size={12} className="text-cyan-400" />
                    <span>Clonar</span>
                  </button>
                )}

                {/* Import/Export integrados dinámicamente en Modo Enfoque */}
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
                      onClick={handleExportExcel}
                      disabled={!discontinuidades || discontinuidades.length === 0}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xxs font-black uppercase tracking-wider transition-all border border-blue-500/10 active:scale-95 disabled:opacity-30"
                      title="Exportar Excel"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-navy-950/80 border border-navy-850 rounded-lg px-2.5 py-1.5 text-xxs text-slate-400 shadow-sm">
                  <span className="text-slate-300 font-bold">{filteredDiscontinuidades.length}</span>
                  <span className="text-slate-500">{filteredDiscontinuidades.length === 1 ? 'estruc.' : 'estrucs.'}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-medium hidden md:block">
                Foco en celdas con <span className="font-bold text-slate-400">Teclas de Dirección</span> • <span className="font-bold text-slate-400">ENTER</span> para avanzar.
              </div>
            </div>

            {/* SECCIÓN INFERIOR FLEXIBLE CON SCROLLBARS INTERNAS VISIBLES EN VIEWPORT */}
            <div className="flex-1 min-h-0 flex flex-col">
              <BaseEditableGrid<{ disc: Discontinuidad, originalIndex: number }>
                data={filteredDiscontinuidades}
                columns={structuralColumns}
                selectedRowIndex={selectedRowIndex !== null ? filteredDiscontinuidades.findIndex(fd => fd.originalIndex === selectedRowIndex) : null}
                onSelectRow={(idx) => {
                  if (filteredDiscontinuidades[idx]) {
                    setSelectedRowIndex(filteredDiscontinuidades[idx].originalIndex);
                  } else {
                    setSelectedRowIndex(null);
                  }
                }}
                onCellChange={() => { }}
                alerts={alerts}
                idPrefix="struct-cell"
                getRowKey={(row, idx) => row.disc.id || idx}
                getAlertRowIndex={(row) => row.originalIndex}
                editableFields={EDITABLE_COLS as any}
                darkMode={darkMode}
                minWidth="3000px"
              />
            </div>
          </>
        ) : (
          <div style={panelWidthStyle} className="transition-[width,max-width] duration-300">
            <StructuralQaqcPanel
              discontinuidades={discontinuidades}
              alerts={alerts}
              onFocusField={onFocusField}
              onSwitchTab={setActiveSubTab}
              darkMode={darkMode}
            />
          </div>
        )}
      </div>

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={activeTaladroName}
        importType="STRUCT"
        onImport={(importedRows) => {
          if (onImportExcel) {
            onImportExcel(importedRows);
          }
        }}
      />
    </div>
  );
}