import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Plus, FileSpreadsheet, Keyboard, Upload, Download, Eye, EyeOff } from 'lucide-react';
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
    <div className="flex flex-col h-full overflow-hidden select-none space-y-4">
      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0 justify-between items-center">
        <div className="flex">
          <button
            onClick={() => setActiveSubTab('plt')}
            className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'plt'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
          >
            Registro de Ensayos PLT
          </button>
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'dashboard'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
          >
            Dashboard de Resultados
          </button>
          <button
            onClick={() => setActiveSubTab('qaqc')}
            className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'qaqc'
              ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
          >
            Análisis QA/QC PLT
          </button>
        </div>

        {/* BOTÓN DE MODO ENFOQUE PARA MAXIMIZAR REGISTROS DE LABORATORIO */}
        {activeSubTab === 'plt' && (
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

      {activeSubTab === 'plt' ? (
        <div className="flex-1 flex flex-col space-y-3 min-h-0 overflow-hidden relative">
          {/* CABECERA ESTÁTICA OCULTABLE DINÁMICAMENTE */}
          <div className={`shrink-0 space-y-3 transition-all duration-300 ease-in-out ${showKpis ? 'opacity-100 max-h-[250px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
            }`}>
            <div className="glass-panel p-3.5 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Registro de Ensayos PLT (Point Load Test)
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Ensayos de carga puntual diametral, axial e irregular para determinación del UCS e índice ISRM
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 text-white dark:text-cyan-400 px-3.5 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 border border-cyan-500/25"
                >
                  <Plus size={12} />
                  <span>Agregar Ensayo</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-350 border border-navy-800 px-3.5 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all active:scale-95"
                >
                  <Upload size={12} className="text-emerald-400" />
                  <span>Importar Excel</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-350 border border-navy-800 px-3.5 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all active:scale-95"
                >
                  <Download size={12} className="text-blue-400" />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>
          </div>

          {/* BARRA DE ACCIONES DE GRILLA AUTOADAPTABLE */}
          <div className="shrink-0 flex justify-between items-center bg-navy-900/50 p-2.5 rounded-xl border border-navy-800/35 backdrop-blur-md transition-[width,max-width] duration-300 shadow-md">
            <div className="flex items-center gap-2">
              {/* Indicadores compactos en Modo Enfoque */}
              {!showKpis && (
                <div className="flex items-center gap-2 border-r border-navy-800 pr-3 mr-1">
                  <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md tracking-wider">
                    {collar.name || 'TALADRO'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">
                    {collar.geologo || "RD/RB"}
                  </span>
                </div>
              )}

              {/* Botón rápido de adición en la barra */}
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
              >
                <Plus size={13} />
                <span>Agregar Ensayo</span>
              </button>

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
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xxs font-black uppercase tracking-wider transition-all border border-blue-500/10 active:scale-95"
                    title="Exportar Excel"
                  >
                    <Download size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-navy-950/80 border border-navy-850 rounded-lg px-2.5 py-1.5 text-xxs text-slate-400 shadow-sm">
                <span className="text-slate-300 font-bold">{ensayos_plt.length}</span>
                <span className="text-slate-500">muestras</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-medium hidden md:block">
              Foco en celdas con <span className="font-bold text-slate-400">Teclas de Dirección</span> • <span className="font-bold text-slate-400">ENTER</span> para avanzar.
            </div>
          </div>

          {/* SECCIÓN INFERIOR FLEXIBLE CON SCROLLBARS INTERNAS VISIBLES EN VIEWPORT */}
          <div className="flex-1 min-h-0 flex flex-col">
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
          </div>

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
        </div>
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