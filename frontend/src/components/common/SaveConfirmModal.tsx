import { useState, useMemo } from 'react';
import { Save, CheckCircle2, X, Database, Layers, Activity, AlertCircle, AlertTriangle } from 'lucide-react';
import type { TaladroDiffSummary, AllTaladrosDiffSummary } from '../../utils/diffUtils';
import { validateLogueoMandatory } from '../../utils/mandatoryRules';
import { validateLogueoQAQC } from '../../utils/qaQcRules';

interface SaveConfirmModalProps {
  show: boolean;
  activeTaladroName: string;
  activeTaladro?: any | null;
  activeDiffSummary?: TaladroDiffSummary | null;
  allDiffSummary?: AllTaladrosDiffSummary | null;
  onConfirm: (scope: 'active' | 'all') => void;
  onClose: () => void;
}

/**
 * Modal de pre-confirmación de guardado (Pre-Flight Audit).
 * Permite al usuario revisar de forma amigable la información y métricas
 * antes de enviar la transacción a SQL Server.
 * El guardado se BLOQUEA si hay campos obligatorios vacíos o errores
 * CRITICOS de QA/QC (las ADVERTENCIAS no bloquean). Red de seguridad final:
 * recalcula todo con evaluateAll=true al abrir el modal.
 * Tamaño mínimo de letra: 12px (text-xs).
 */
export default function SaveConfirmModal({
  show,
  activeTaladroName,
  activeTaladro,
  activeDiffSummary,
  allDiffSummary,
  onConfirm,
  onClose,
}: SaveConfirmModalProps) {
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
  const [saveScope, setSaveScope] = useState<'active' | 'all'>(activeTaladroName ? 'active' : 'all');

  const isScopeActive = saveScope === 'active';

  // ─── AUDITORÍA FINAL (red de seguridad): vacíos + QA/QC críticos ─────────
  const blockingIssues = useMemo(() => {
    if (!activeTaladro) return { vacios: [], criticas: [], advertencias: [] };
    const vacios = validateLogueoMandatory(activeTaladro);
    const qaqc = validateLogueoQAQC(
      activeTaladro,
      activeTaladro.surveys || [],
      activeTaladro.corridas || [],
      activeTaladro.discontinuidades || [],
      activeTaladro.ensayos_plt || [],
      true // evaluateAll: red de seguridad final
    );
    return {
      vacios,
      criticas: qaqc.filter(a => a.type === 'CRITICA'),
      advertencias: qaqc.filter(a => a.type === 'ADVERTENCIA'),
    };
  }, [activeTaladro]);

  const totalBlockingCount = blockingIssues.vacios.length + blockingIssues.criticas.length;
  const hasBlockingErrors = totalBlockingCount > 0;

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-lg flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/95 text-slate-200">

        {/* Banda de acento superior brillante en gradiente verde/cyan */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500 w-full" />

        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Save size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Confirmar Guardado de Cambios
              </h3>
              <p className="text-xs text-slate-400">
                Auditoría previa a la sincronización oficial en la base de datos
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

          {/* Selector de Alcance de Guardado */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Selecciona el alcance del guardado:
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Opción 1: Solo Taladro Activo */}
              {activeTaladroName && (
                <button
                  type="button"
                  onClick={() => setSaveScope('active')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    isScopeActive
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100 ring-1 ring-emerald-500/30'
                      : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-850 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    isScopeActive ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                  }`}>
                    {isScopeActive && <CheckCircle2 size={10} className="text-slate-900" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Database size={13} className="text-cyan-400" />
                      <span>Solo Taladro Activo: <strong className="text-cyan-400">{activeTaladroName}</strong></span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Sincronizará las celdas y filas modificadas de este sondaje específico.
                    </p>
                  </div>
                </button>
              )}

              {/* Opción 2: Todos los Taladros con Cambios Pendientes */}
              <button
                type="button"
                onClick={() => setSaveScope('all')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  !isScopeActive
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100 ring-1 ring-emerald-500/30'
                    : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:bg-navy-850 hover:text-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  !isScopeActive ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                }`}>
                  {!isScopeActive && <CheckCircle2 size={10} className="text-slate-900" />}
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <Layers size={13} className="text-emerald-400" />
                    <span>TODOS los Taladros con cambios pendientes (<strong className="text-emerald-400">{allTaladrosCount} sondaje(s)</strong>)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Sincronizará de forma secuencial todos los registros no guardados en la BD.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Resumen dinámico pre-guardado */}
          <div className="bg-navy-950/80 border border-navy-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <Activity size={15} />
              <span>Resumen de Cambios a Escribir en la BD:</span>
            </div>

            {isScopeActive && activeHasChanges ? (
              /* Resumen Taladro Activo */
              <div className="text-xs text-slate-300 space-y-1.5 pt-1">
                {activeFieldsCount > 0 ? (
                  <div>• <span className="font-bold text-cyan-400">{activeFieldsCount}</span> celdas o campos editados.</div>
                ) : (
                  <div>• Nuevos registros creados listos para subir.</div>
                )}
                {activeAddedCount > 0 && (
                  <div>• <span className="font-bold text-emerald-400">+{activeAddedCount}</span> filas/corridas nuevas.</div>
                )}
                {activeDeletedCount > 0 && (
                  <div>• <span className="font-bold text-red-400">-{activeDeletedCount}</span> filas eliminadas.</div>
                )}
                <div className="text-slate-400 pt-1">
                  El taladro <strong className="text-slate-200">{activeTaladroName}</strong> actualizará su historial oficial en la BD.
                </div>
              </div>
            ) : (
              /* Resumen Todos los Taladros */
              <div className="text-xs text-slate-300 space-y-1.5 pt-1">
                <div>
                  • <span className="font-bold text-emerald-400">{allTaladrosCount}</span> sondaje(s) a guardar: <strong className="text-cyan-400">{allTaladrosNames.join(', ')}</strong>.
                </div>
                <div>
                  • Aprox. <span className="font-bold text-cyan-400">{allFieldsCount}</span> celdas editadas en total.
                </div>
                <div className="text-slate-400 pt-1">
                  Se ejecutará una transacción atómica para asegurar la consistencia.
                </div>
              </div>
            )}
          </div>

          {/* BANNER DE BLOQUEO POR CAMPOS VACÍOS O ERRORES CRÍTICOS */}
          {hasBlockingErrors && (
            <div className="bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-4 space-y-3 shadow-[0_0_25px_rgba(244,63,94,0.2)] text-rose-100">
              <div className="flex items-start gap-3 border-b border-rose-500/30 pb-3">
                <div className="p-2 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded-lg shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-rose-100 uppercase tracking-wide">
                    ¡GUARDADO BLOQUEADO!
                  </h4>
                  <p className="text-xs text-rose-300 font-medium mt-0.5">
                    El sistema detectó {totalBlockingCount} problema(s) crítico(s) que impiden sincronizar
                    con la base de datos: campos obligatorios vacíos o errores críticos de QA/QC.
                  </p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {blockingIssues.criticas.map((err, idx) => (
                  <div key={`crit-${idx}`} className="text-xs bg-red-950/70 border border-red-500/50 rounded-xl p-3 flex items-center justify-between text-red-100">
                    <span className="font-semibold leading-tight">{err.message}</span>
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-red-500/30 text-red-200 uppercase shrink-0 ml-2 border border-red-500/40 tracking-wider">
                      Crítico
                    </span>
                  </div>
                ))}
                {blockingIssues.vacios.map((issue, idx) => (
                  <div key={`vac-${idx}`} className="text-xs bg-violet-900/60 border border-violet-500/40 rounded-xl p-3 flex items-center justify-between text-violet-100">
                    <span className="font-semibold leading-tight">{issue.message}</span>
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-violet-500/30 text-violet-200 uppercase shrink-0 ml-2 border border-violet-500/40 tracking-wider">
                      {issue.section}
                    </span>
                  </div>
                ))}
                {blockingIssues.advertencias.map((err, idx) => (
                  <div key={`adv-${idx}`} className="text-xs bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between text-amber-100">
                    <span className="font-semibold leading-tight">{err.message}</span>
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-amber-500/30 text-amber-200 uppercase shrink-0 ml-2 border border-amber-500/40 tracking-wider">
                      Advertencia
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning Banner (solo si no hay bloqueo) */}
          {!hasBlockingErrors && (
            <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
              <AlertTriangle size={16} className="shrink-0 text-amber-400" />
              <span>Al confirmar, los datos serán guardados y auditados de forma permanente en la base de datos.</span>
            </div>
          )}

          {/* Pie y Botones */}
          <div className="pt-2 border-t border-navy-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">
              {hasBlockingErrors
                ? 'Corrija los errores señalados para habilitar el guardado.'
                : 'Verifique los datos antes de continuar.'}
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
                disabled={hasBlockingErrors}
                onClick={() => !hasBlockingErrors && onConfirm(saveScope)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  hasBlockingErrors
                    ? 'bg-navy-900 border border-navy-800 text-slate-500 cursor-not-allowed opacity-50'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.25)] active:scale-95'
                }`}
              >
                <Save size={14} />
                <span>Sí, Guardar Cambios</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
