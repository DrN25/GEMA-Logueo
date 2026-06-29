import React, { useMemo } from 'react';
import { Plus, FileSpreadsheet, Keyboard, Upload, Download } from 'lucide-react';
import type { EnsayoPlt } from '../../App';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import PltQaqcPanel from './components/PltQaqcPanel';
import PltDashboardPanel from './components/PltDashboardPanel';
import BaseEditableGrid from '../../components/common/BaseEditableGrid';
import { usePltState } from './usePltState';
import { getPltColumns } from './pltColumns';

interface PltViewProps {
  ensayos_plt: EnsayoPlt[];
  onEnsayosPltChange: (plts: EnsayoPlt[]) => void;
  corridas: any[];
  collar: any;
  alerts: ValidationAlert[];
  darkMode?: boolean;
  onImportExcel?: (importedRows: any[]) => void;
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

export default function PltView({
  ensayos_plt,
  onEnsayosPltChange,
  corridas,
  collar,
  alerts,
  darkMode = true,
  onImportExcel
}: PltViewProps) {
  const {
    activeSubTab,
    setActiveSubTab,
    isImportModalOpen,
    setIsImportModalOpen,
    selectedRowIndex,
    setSelectedRowIndex,
    handleCellChange,
    addRow,
    deleteRow,
    handleExportExcel
  } = usePltState({ ensayos_plt, onEnsayosPltChange, corridas, collar });

  const columns = useMemo(() => {
    return getPltColumns({
      darkMode,
      collar,
      handleCellChange,
      deleteRow
    });
  }, [darkMode, collar, handleCellChange, deleteRow]);

  const handleAlertFix = (fieldId: string) => {
    setActiveSubTab('plt');
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        if (el.tagName === 'INPUT') {
          (el as HTMLInputElement).select();
        }
      }
    }, 100);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none space-y-4">
      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0">
        <button
          onClick={() => setActiveSubTab('plt')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${
            activeSubTab === 'plt'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          Registro de Ensayos PLT
        </button>
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${
            activeSubTab === 'dashboard'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          Dashboard de Resultados
        </button>
        <button
          onClick={() => setActiveSubTab('qaqc')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${
            activeSubTab === 'qaqc'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
          }`}
        >
          Análisis QA/QC PLT
        </button>
      </div>

      {activeSubTab === 'plt' ? (
        <>
          {/* Panel Superior */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                  Registro de Ensayos PLT (Point Load Test)
                </h2>
                <p className="text-xs text-slate-400">
                  Ensayos de carga puntual diametral, axial e irregular para determinación del UCS e índice ISRM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-navy-900/40 border border-navy-800 rounded-lg px-2.5 py-1.5">
                <Keyboard size={14} className="text-blue-500 dark:text-cyan-400" />
                <span>Navega con flechas, Enter avanza/crea fila</span>
              </div>

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 text-white dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 border border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-none"
              >
                <Plus size={14} />
                <span>Agregar Ensayo</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 dark:text-slate-300 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <Upload size={14} className="text-emerald-400" />
                <span>Importar Excel</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 dark:text-slate-300 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <Download size={14} className="text-blue-400" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Grid Container */}
          <BaseEditableGrid
            data={ensayos_plt}
            columns={columns}
            selectedRowIndex={selectedRowIndex}
            onSelectRow={setSelectedRowIndex}
            onCellChange={handleCellChange}
            alerts={alerts}
            idPrefix="plt-cell"
            onAddRow={addRow}
            getRowKey={(row, idx) => row.nro_muestra || idx}
            editableFields={EDITABLE_FIELDS}
            darkMode={darkMode}
            minWidth="3400px"
          />

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
    </div>
  );
}