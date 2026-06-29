import { useState, useMemo, useRef, useCallback } from 'react';
import { Share2 } from 'lucide-react';
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
import GeotechModuleLayout from '../../components/layout/GeotechModuleLayout';

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
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}

const EDITABLE_COLS: (keyof Discontinuidad)[] = [
  'profundidad', 'tipo_estructura', 'alfa', 'beta', 'forma', 'rugosidad',
  'jrc10', 'abertura', 'weathering', 'espesor', 'relleno1', 'relleno2',
  'dureza_pared', 'agua', 'geotecnico', 'comentario', 'tipo'
];

const SUB_TABS = [
  { id: 'lgest', label: 'Logueo Estructural (LG EST)' },
  { id: 'qaqc', label: 'Análisis QA/QC' }
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
  onFocusField,
  selectedRowIndex,
  onSelectRow
}: StructuralViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'lgest' | 'qaqc'>('lgest');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showKpis, setShowKpis] = useState(true);

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
  } = useStructuralState({
    discontinuidades,
    corridas,
    onDiscontinuidadesChange,
    geologo,
    selectedRowIndex,
    onSelectRow
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

  const filterPanelContent = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-navy-950/40 p-4 border border-navy-800/40 rounded-xl">
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
  );

  return (
    <>
      <GeotechModuleLayout
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        subTabs={SUB_TABS}
        title="Logueo Estructural Orientado (LG EST)"
        subtitle="Registro individual de discontinuidades orientadas y parámetros de juntas"
        icon={<Share2 size={18} />}
        showKpis={showKpis}
        setShowKpis={setShowKpis}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onImportClick={() => setIsImportModalOpen(true)}
        onExportClick={handleExportExcel}
        isExportDisabled={!discontinuidades || discontinuidades.length === 0}
        filterContent={filterPanelContent}
        activeTaladroName={activeTaladroName}
        geologo={geologo}
        onAddRow={addDiscontinuidadRow}
        onCloneRow={selectedRowIndex !== null ? () => insertDiscontinuidadRow(selectedRowIndex) : undefined}
        isCloneDisabled={selectedRowIndex === null}
        recordCount={filteredDiscontinuidades.length}
        recordLabel={filteredDiscontinuidades.length === 1 ? 'estruc.' : 'estrucs.'}
        sidebarCollapsed={sidebarCollapsed}
      >
        {activeSubTab === 'lgest' ? (
          <BaseEditableGrid<{ disc: Discontinuidad, originalIndex: number }>
            data={filteredDiscontinuidades}
            columns={structuralColumns}
            selectedRowIndex={selectedRowIndex !== null ? filteredDiscontinuidades.findIndex(fd => fd.originalIndex === selectedRowIndex) : null}
            onSelectRow={(idx) => {
              if (filteredDiscontinuidades[idx]) {
                onSelectRow(filteredDiscontinuidades[idx].originalIndex);
              } else {
                onSelectRow(null);
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
        ) : (
          <StructuralQaqcPanel
            discontinuidades={discontinuidades}
            alerts={alerts}
            onFocusField={onFocusField}
            onSwitchTab={setActiveSubTab}
            darkMode={darkMode}
          />
        )}
      </GeotechModuleLayout>

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
    </>
  );
}