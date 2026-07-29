import { useState, useMemo, useCallback, useRef } from 'react';
import { Database } from 'lucide-react';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import LggQaqcPanel from './components/LggQaqcPanel';
import BaseEditableGrid, { type GridColumn } from '../../components/common/BaseEditableGrid';
import { useLggState, type CorridaEnriquecida, type Corrida } from './useLggState';
import { getLggColumns } from './lggColumns';
import LggExportModal from './components/LggExportModal';
import GeotechModuleLayout from '../../components/layout/GeotechModuleLayout';

interface LggViewProps {
  corridas: Corrida[];
  alerts: ValidationAlert[];
  onCorridasChange: (corridas: Corrida[]) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number) => void;
  waterTableM: number;
  darkMode?: boolean;
  activeTaladroName: string;
  existingTaladrosNames?: string[];
  activeTaladroGeologo?: string;
  activeTaladroFecha?: string;
  sidebarCollapsed?: boolean;
  onFocusField?: (fieldId: string) => void;
  onImportExcel?: (importedRows: Corrida[], createNewWithName?: string) => void;
  onImportBatchExcel?: (batchTaladros: { name: string; rows: Corrida[]; isNew: boolean }[]) => void;
  onCreateTaladro?: (newTaladro: any) => void;
  onRenameTaladro?: (newName: string) => void;
  syncStatus?: string;
  defaultTurno?: string;
}

const LITO_OPTIONS = Object.keys(LITHOLOGY_CATALOG);

const EDITABLE_COLS: (keyof Corrida)[] = [
  'de', 'a', 'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m',
  'frac_nat', 'lito1', 'lito2', 'lito3', 'resistencia', 'orientacion', 'offset',
  'tipo_est1', 'tipo_est2', 'frac_buz30', 'frac_buz60', 'frac_buz90',
  'abertura', 'rugosidad', 'jrc10', 'intemperismo', 'relleno1', 'relleno2',
  'espesor', 'agua_obs', 'turno', 'comentarios'
];

const SUB_TABS = [
  { id: 'lgg', label: 'Logueo Geotécnico General (LGG)' },
  { id: 'qaqc', label: 'Análisis QA/QC' }
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
  existingTaladrosNames = [],
  activeTaladroGeologo = "RD/RB",
  activeTaladroFecha,
  sidebarCollapsed = false,
  onFocusField: _onFocusField,
  onImportExcel,
  onImportBatchExcel,
  onCreateTaladro: _onCreateTaladro,
  onRenameTaladro: _onRenameTaladro,
  syncStatus: _syncStatus,
  defaultTurno = 'D'
}: LggViewProps) {

  const [activeSubTab, setActiveSubTab] = useState<'lgg' | 'qaqc'>('lgg');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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

    addCorridaRow,
    deleteCorridaRow,
    insertCorridaRow,
    handleCellChange
  } = useLggState({ corridas, onCorridasChange, waterTableM, defaultTurno });

  const lastRowTaladroName = useCallback(() => activeTaladroName || "FEGT25-001", [activeTaladroName]);
  const lastRowGeologo = useCallback(() => activeTaladroGeologo || "RD/RB", [activeTaladroGeologo]);
  const lastRowFecha = useCallback(() => activeTaladroFecha || new Date().toISOString().split('T')[0], [activeTaladroFecha]);

  const cellChangeRef = useRef(handleCellChange);
  const deleteRowRef = useRef(deleteCorridaRow);
  const insertRowRef = useRef(insertCorridaRow);
  cellChangeRef.current = handleCellChange;
  deleteRowRef.current = deleteCorridaRow;
  insertRowRef.current = insertCorridaRow;

  const stableHandleCellChange = useCallback((idx: number, f: any, val: any) => cellChangeRef.current(idx, f, val), []);
  const stableDeleteRow = useCallback((idx: number) => deleteRowRef.current(idx), []);
  const stableInsertRow = useCallback((idx: number) => insertRowRef.current(idx), []);

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
  }, [darkMode, lastRowGeologo, lastRowFecha, lastRowTaladroName, stableHandleCellChange, stableDeleteRow, stableInsertRow]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Renderizado dinámico de la estructura de filtros
  const filterPanelContent = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-navy-950/40 p-4 border border-navy-800/40 rounded-xl">
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Litología 1</label>
        <select
          value={filterLito}
          onChange={(e) => setFilterLito(e.target.value)}
          className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none"
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
          className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none"
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
          className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none"
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
          className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2 py-1.5 text-slate-200 text-xxs focus:outline-none"
        />
      </div>
    </div>
  );

  return (
    <>
      <GeotechModuleLayout
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        subTabs={SUB_TABS}
        title="Logueo Geotécnico General (LGG)"
        subtitle="Registro sistemático de corridas, recuperación de testigos, RQD y parámetros del macizo rocoso"
        icon={<Database size={18} />}
        showKpis={showKpis}
        setShowKpis={setShowKpis}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onImportClick={() => setIsImportModalOpen(true)}
        onExportClick={() => setIsExportModalOpen(true)}
        isExportDisabled={!corridas || corridas.length === 0}
        filterContent={filterPanelContent}
        activeTaladroName={activeTaladroName}
        geologo={lastRowGeologo()}
        onAddRow={addCorridaRow}
        addBtnLabel="Agregar corrida"
        recordCount={filteredCorridas.length}
        recordLabel={filteredCorridas.length === 1 ? 'reg.' : 'regs.'}
        sidebarCollapsed={sidebarCollapsed}
      >
        {activeSubTab === 'lgg' ? (
          <BaseEditableGrid<CorridaEnriquecida>
            data={filteredCorridas}
            columns={lggColumns}
            selectedRowIndex={selectedRowIndex !== null ? filteredCorridas.findIndex(r => r.originalIndex === selectedRowIndex) : null}
            onSelectRow={(idx) => {
              const origIdx = filteredCorridas[idx]?.originalIndex;
              if (origIdx !== undefined) onSelectRow(origIdx);
            }}
            onCellChange={(idx, field, value) => {
              const origIdx = filteredCorridas[idx]?.originalIndex;
              if (origIdx !== undefined) handleCellChange(origIdx, field as keyof Corrida, value);
            }}
            alerts={alerts}
            idPrefix="lgg-cell"
            onAddRow={addCorridaRow}
            onDeleteRow={(idx) => {
              const origIdx = filteredCorridas[idx]?.originalIndex;
              if (origIdx !== undefined) deleteCorridaRow(origIdx);
            }}
            getRowKey={(row) => row.originalIndex}
            getAlertRowIndex={(row) => row.originalIndex}
            editableFields={EDITABLE_COLS}
            darkMode={darkMode}
            minWidth="3200px"
          />
        ) : (
          <LggQaqcPanel
            corridas={corridas}
            waterTableM={waterTableM}
            alerts={alerts}
            onFocusField={_onFocusField}
            onSwitchTab={setActiveSubTab}
          />
        )}
      </GeotechModuleLayout>

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

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={activeTaladroName}
        existingTaladrosNames={existingTaladrosNames}
        importType="LGG"
        onImport={(importedRows, createNewWithName, batchTaladros) => {
          if (batchTaladros && batchTaladros.length > 0 && onImportBatchExcel) {
            onImportBatchExcel(batchTaladros);
          } else if (onImportExcel) {
            onImportExcel(importedRows, createNewWithName);
          } else {
            onCorridasChange(importedRows);
          }
        }}
      />
    </>
  );
}