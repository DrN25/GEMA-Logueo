import { useState } from 'react';
import { AlertTriangle, RotateCcw, X, Database, Layers, Check } from 'lucide-react';
import type { TaladroDiffSummary, AllTaladrosDiffSummary } from '../../utils/diffUtils';

interface DiscardModalProps {
  show: boolean;
  activeTaladroName: string;
  activeDiffSummary?: TaladroDiffSummary | null;
  allDiffSummary?: AllTaladrosDiffSummary | null;
  onConfirm: (scope: 'active' | 'all') => void;
  onClose: () => void;
}

/**
 * Modal de confirmación para descartar cambios no guardados en borradores locales.
 * Admite alcance por Taladro Activo o por TODOS los Taladros.
 * Estilo visual profesional en temática roja/temática oscura de la aplicación.
 * Tamaño mínimo de letra: 12px (text-xs).
 */
export default function DiscardModal({
  show,
  activeTaladroName,
  activeDiffSummary,
  allDiffSummary,
  onConfirm,
  onClose,
}: DiscardModalProps) {
  if (!show) return null;

  // Métricas del taladro activo
  const activeFieldsCount = activeDiffSummary?.totalFieldsChanged || 0;
  const activeAddedCount = activeDiffSummary?.totalRowsAdded || 0;
  const activeDeletedCount = activeDiffSummary?.totalRowsDeleted || 0;
  const activeHasChanges = activeFieldsCount > 0 || activeAddedCount > 0 || activeDeletedCount > 0;

  // Métricas de todos los taladros
  const allTaladrosCount = allDiffSummary?.unsavedTaladrosCount || 1;
  const allFieldsCount = allDiffSummary?.totalFieldsChanged || activeFieldsCount;
  const allTaladrosNames = allDiffSummary?.unsavedTaladrosNames || [activeTaladroName];

  // Si el taladro activo no tiene cambios pero otros taladros sí, seleccionar 'all' por defecto
  const [discardScope, setDiscardScope] = useState<'active' | 'all'>(() => {
    return activeHasChanges ? 'active' : 'all';
  });

  const isScopeActive = discardScope === 'active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-lg flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-slate-200">
        
        {/* Banda roja en gradiente superior */}
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 w-full" />

        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Descartar Cambios No Guardados
              </h3>
              <p className="text-xs text-slate-400">
                Confirmación de descarte de borradores en memoria local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Cancelar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          
          {/* Selector de Alcance */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Selecciona el alcance del descarte:
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Opción 1: Taladro Activo (Solo si el taladro activo tiene cambios propios) */}
              {activeHasChanges && (
                <button
                  type="button"
                  onClick={() => setDiscardScope('active')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    isScopeActive
                      ? 'bg-red-500/10 border-red-500/40 text-slate-100 ring-1 ring-red-500/30'
                      : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-850 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    isScopeActive ? 'border-red-400 bg-red-500' : 'border-slate-600'
                  }`}>
                    {isScopeActive && <Check size={10} className="text-white" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Database size={13} className="text-cyan-400" />
                      <span>Solo Taladro Activo: <strong className="text-cyan-400">{activeTaladroName}</strong></span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Revisará únicamente las celdas y corridas modificadas en este sondaje.
                    </p>
                  </div>
                </button>
              )}

              {/* Opción 2: Todos los Taladros */}
              {(allTaladrosCount > 1 || !activeHasChanges) && (
                <button
                  type="button"
                  onClick={() => setDiscardScope('all')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    !isScopeActive || !activeHasChanges
                      ? 'bg-red-500/10 border-red-500/40 text-slate-100 ring-1 ring-red-500/30'
                      : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-850 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    !isScopeActive || !activeHasChanges ? 'border-red-400 bg-red-500' : 'border-slate-600'
                  }`}>
                    {(!isScopeActive || !activeHasChanges) && <Check size={10} className="text-white" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Layers size={13} className="text-amber-400" />
                      <span>TODOS los Taladros con cambios pendientes (<strong className="text-amber-400">{allTaladrosCount} sondaje(s)</strong>)</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Eliminará los borradores no guardados de todo el sistema.
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Resumen dinámico de lo que se revertirá */}
          <div className="bg-navy-950/80 border border-navy-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wider">
              <RotateCcw size={15} />
              <span>Resumen de Cambios que se Perderán:</span>
            </div>

            {isScopeActive && activeHasChanges ? (
              /* Resumen Taladro Activo */
              <div className="text-xs text-slate-300 space-y-1.5 pt-1">
                {activeFieldsCount > 0 ? (
                  <div>• <span className="font-bold text-amber-400">{activeFieldsCount}</span> celdas o campos editados.</div>
                ) : (
                  <div>• Registros borradores temporales.</div>
                )}
                {activeAddedCount > 0 && (
                  <div>• <span className="font-bold text-red-400">{activeAddedCount}</span> filas/corridas agregadas no guardadas.</div>
                )}
                {activeDeletedCount > 0 && (
                  <div>• <span className="font-bold text-red-400">{activeDeletedCount}</span> filas marcadas para eliminación.</div>
                )}
                <div className="text-slate-400 pt-1">
                  El taladro <strong className="text-slate-200">{activeTaladroName}</strong> se restaurará a la versión de la base de datos.
                </div>
              </div>
            ) : (
              /* Resumen Todos los Taladros */
              <div className="text-xs text-slate-300 space-y-1.5 pt-1">
                <div>
                  • <span className="font-bold text-red-400">{allTaladrosCount}</span> sondaje(s) con borradores: <strong className="text-amber-400">{allTaladrosNames.join(', ')}</strong>.
                </div>
                <div>
                  • Aprox. <span className="font-bold text-amber-400">{allFieldsCount}</span> celdas editadas en total en el espacio de trabajo.
                </div>
                <div className="text-slate-400 pt-1">
                  Se limpiarán todas las copias locales en almacenamiento temporal.
                </div>
              </div>
            )}
          </div>

          {/* Pie y Botones */}
          <div className="pt-2 border-t border-navy-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">
              Esta acción no se puede deshacer.
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-850 border border-navy-800 transition-all active:scale-95"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => onConfirm(discardScope)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white border border-red-400/30 shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all active:scale-95"
              >
                <RotateCcw size={14} />
                <span>Sí, Descartar Cambios</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
