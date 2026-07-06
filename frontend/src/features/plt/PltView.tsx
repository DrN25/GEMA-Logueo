import { useMemo, useState, useRef, useCallback } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { EnsayoPlt } from '../../App';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import PltQaqcPanel from './components/PltQaqcPanel';
import PltDashboardPanel from './components/PltDashboardPanel';
import BaseEditableGrid from '../../components/common/BaseEditableGrid';
import { usePltState } from './usePltState';
import { getPltColumns } from './pltColumns';
import GeotechModuleLayout from '../../components/layout/GeotechModuleLayout';

interface PltViewProps {
  ensayos_plt: EnsayoPlt[];
  onEnsayosPltChange: (plts: EnsayoPlt[]) => void;
  corridas: any[];
  collar: any;
  alerts: ValidationAlert[];
  darkMode?: boolean;
  onImportExcel?: (importedRows: any[]) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}

const EDITABLE_FIELDS: (keyof EnsayoPlt)[] = [
  'fecha',
  'nro_muestra',
  'nro_caja',
  'corrida_desde',
  'corrida_hasta',
  'from_m',
  'to_m',
  'este_m',
  'norte_m',
  'elevacion_msnm',
  'tipo_de_ensayo',
  'diametro_taladro_nominacion',
  'litologia_1',
  'litologia_2',
  'litologia_3',
  'd_mm',
  'p_instr_kn',
  'tipo_rotura_code',
  'direccion_rotura_code',
  'ejecutadoPor',
  'observaciones'
];

const SUB_TABS = [
  { id: 'plt', label: 'Registro de Ensayos PLT' },
  { id: 'dashboard', label: 'Dashboard de Resultados' },
  { id: 'qaqc', label: 'Análisis QA/QC PLT' }
];

export default function PltView({
  ensayos_plt,
  onEnsayosPltChange,
  corridas,
  collar,
  alerts,
  darkMode = true,
  onImportExcel,
  selectedRowIndex,
  onSelectRow

}: PltViewProps) {
  const [showKpis, setShowKpis] = useState(true);

  const {
    activeSubTab,
    setActiveSubTab,
    isImportModalOpen,
    setIsImportModalOpen,
    handleCellChange,
    addRow,
    deleteRow,
    handleExportExcel
  } = usePltState({ ensayos_plt, onEnsayosPltChange, corridas, collar, selectedRowIndex, onSelectRow });

  // --- PATRÓN DE CALLBACKS ESTABLES CON REF ---
  const cellChangeRef = useRef(handleCellChange);
  const deleteRowRef = useRef(deleteRow);
  cellChangeRef.current = handleCellChange;
  deleteRowRef.current = deleteRow;

  const stableHandleCellChange = useCallback(
    (idx: number, field: keyof EnsayoPlt, val: any) => cellChangeRef.current(idx, field, val),
    []
  );
  const stableDeleteRow = useCallback(
    (idx: number) => deleteRowRef.current(idx),
    []
  );

  const columns = useMemo(() => {
    return getPltColumns({
      darkMode,
      collar,
      handleCellChange: stableHandleCellChange,
      deleteRow: stableDeleteRow
    });
  }, [darkMode, collar, stableHandleCellChange, stableDeleteRow]);

  const handleAlertFix = (fieldId: string) => {
    setActiveSubTab('plt');

    // Extraer índice y nombre de campo de e.g. "plt-from_m-0"
    const parts = fieldId.split('-');
    let index: number | null = null;
    let fieldName = '';

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const parsedIndex = parseInt(lastPart, 10);
      if (!isNaN(parsedIndex)) {
        index = parsedIndex;
        fieldName = parts[1]; // e.g. "from_m"
      }
    }

    if (index !== null) {
      onSelectRow(index); // Asegurar que la fila se seleccione en App.tsx
    }

    setTimeout(() => {
      let el: HTMLElement | null = null;

      if (index !== null && fieldName) {
        // Campos con renderCell personalizado en pltColumns.tsx
        const customFields = ['fecha', 'nro_muestra', 'litologia_1', 'litologia_2', 'litologia_3'];
        if (customFields.includes(fieldName)) {
          el = document.getElementById(`plt-cell-${index}-${fieldName}`);
        } else {
          // Campos estándar renderizados por BaseEditableGrid
          const pltColMap: Record<string, number> = {
            'fecha': 0, 'nro_muestra': 1, 'nro_caja': 2, 'corrida_desde': 3, 'corrida_hasta': 4,
            'from_m': 5, 'to_m': 6, 'este_m': 7, 'norte_m': 8, 'elevacion_msnm': 9,
            'tipo_de_ensayo': 10, 'diametro_taladro_nominacion': 11, 'litologia_1': 12,
            'litologia_2': 13, 'litologia_3': 14, 'd_mm': 15, 'p_instr_kn': 16,
            'tipo_rotura_code': 17, 'direccion_rotura_code': 18, 'ejecutadoPor': 19,
            'observaciones': 20
          };
          const colIdx = pltColMap[fieldName];
          if (colIdx !== undefined) {
            el = document.getElementById(`plt-cell-${index}-${colIdx}`);
          }
        }
      }

      // Fallback a buscar por el fieldId original si existe en DOM
      if (!el) {
        el = document.getElementById(fieldId);
      }

      // Si aún no se ha renderizado el input, forzamos un click en el elemento TD
      if (!el && index !== null && fieldName) {
        const pltColMap: Record<string, number> = {
          'fecha': 0, 'nro_muestra': 1, 'nro_caja': 2, 'corrida_desde': 3, 'corrida_hasta': 4,
          'from_m': 5, 'to_m': 6, 'este_m': 7, 'norte_m': 8, 'elevacion_msnm': 9,
          'tipo_de_ensayo': 10, 'diametro_taladro_nominacion': 11, 'litologia_1': 12,
          'litologia_2': 13, 'litologia_3': 14, 'd_mm': 15, 'p_instr_kn': 16,
          'tipo_rotura_code': 17, 'direccion_rotura_code': 18, 'ejecutadoPor': 19,
          'observaciones': 20
        };
        const colIdx = pltColMap[fieldName];
        if (colIdx !== undefined) {
          const tdEl = document.getElementById(`plt-cell-td-${index}-${colIdx}`);
          if (tdEl) {
            tdEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            tdEl.click();
            return;
          }
        }
      }

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        el.focus();
        if (el.tagName === 'INPUT') {
          (el as HTMLInputElement).select();
        }
      }
    }, 120);
  };

  return (
    <>
      <GeotechModuleLayout
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        subTabs={SUB_TABS}
        title="Registro de Ensayos PLT (Point Load Test)"
        subtitle="Ensayos de carga puntual diametral, axial e irregular para determinación del UCS e índice ISRM"
        icon={<FileSpreadsheet size={18} />}
        showKpis={showKpis}
        setShowKpis={setShowKpis}
        showFilters={false}
        setShowFilters={() => { }}
        onImportClick={() => setIsImportModalOpen(true)}
        onExportClick={handleExportExcel}
        isExportDisabled={!ensayos_plt || ensayos_plt.length === 0}
        activeTaladroName={collar.name || 'TALADRO'}
        geologo={collar.geologo || 'RD/RB'}
        onAddRow={addRow}
        addBtnLabel="Agregar Ensayo"
        recordCount={ensayos_plt.length}
        recordLabel="muestras"
      >
        {activeSubTab === 'plt' ? (
          <BaseEditableGrid
            data={ensayos_plt}
            columns={columns}
            selectedRowIndex={selectedRowIndex}
            onSelectRow={onSelectRow}
            onCellChange={stableHandleCellChange}
            alerts={alerts}
            idPrefix="plt-cell"
            onAddRow={addRow}
            getRowKey={(row, idx) => row.nro_muestra || idx}
            editableFields={EDITABLE_FIELDS}
            darkMode={darkMode}
            minWidth="3400px"
          />
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 scrollbar-thin">
            {activeSubTab === 'dashboard' ? (
              <PltDashboardPanel
                ensayos_plt={ensayos_plt}
                alerts={alerts}
                onSwitchTab={setActiveSubTab}
                darkMode={darkMode}
              />
            ) : (
              <PltQaqcPanel
                ensayos_plt={ensayos_plt}
                alerts={alerts}
                onFocusField={handleAlertFix}
                onSwitchTab={setActiveSubTab}
                darkMode={darkMode}
              />
            )}
          </div>
        )}
      </GeotechModuleLayout>

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={collar.name || ''}
        importType="PLT"
        onImport={(importedRows) => {
          if (onImportExcel) {
            onImportExcel(importedRows);
          }
        }}
      />
    </>
  );
}