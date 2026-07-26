import { CheckCircle2, XCircle, AlertTriangle, X, Edit3, PlusCircle, Trash2, Database, Activity } from 'lucide-react';
import type { TaladroDiffSummary } from '../../utils/diffUtils';

interface SaveResultModalProps {
  show: boolean;
  success: boolean;
  message: string;
  details?: string;
  diffSummary?: TaladroDiffSummary | null;
  activeTaladroName?: string;
  onClose: () => void;
}

/**
 * Modal de resultado de guardado con reporte de auditoría (Geolog Pro 2.0 style)
 * Muestra feedback glassmorphic estructurado con el desglose exacto de lo que cambió.
 * Tamaño mínimo de letra: 12px (text-xs).
 */
export default function SaveResultModal({
  show,
  success,
  message,
  details,
  diffSummary,
  activeTaladroName,
  onClose,
}: SaveResultModalProps) {
  if (!show) return null;

  const hasModifications = diffSummary && (
    diffSummary.totalFieldsChanged > 0 ||
    diffSummary.totalRowsAdded > 0 ||
    diffSummary.totalRowsDeleted > 0
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/80 backdrop-blur-md animate-fade-in p-4">
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden bg-navy-900/95 text-slate-200 transition-all ${
          success
            ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]'
            : 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
        }`}
      >
        {/* Banda de estado superior brillante */}
        <div
          className={`h-1.5 w-full bg-gradient-to-r ${
            success
              ? 'from-emerald-500 via-cyan-400 to-blue-500'
              : 'from-red-500 via-amber-500 to-orange-500'
          }`}
        />

        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-navy-800 transition-colors z-10"
          title="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="p-6 space-y-5">
          {/* Header del Modal */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 ring-4 ring-emerald-500/5'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 ring-4 ring-red-500/5'
              }`}
            >
              {success ? (
                <CheckCircle2 size={26} />
              ) : (
                <XCircle size={26} />
              )}
            </div>

            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                    success
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {success ? 'Guardado Exitoso' : 'Error en Guardado'}
                </span>
                {activeTaladroName && (
                  <span className="bg-navy-950 border border-navy-800 text-cyan-400 text-xs font-bold px-2.5 py-0.5 rounded-md">
                    {activeTaladroName}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-200 leading-snug">
                {message}
              </p>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* REPORTE DE AUDITORÍA Y ESTRUCTURA DE CAMBIOS (Solo en éxito) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {success && diffSummary && (
            <div className="space-y-3 pt-1 border-t border-navy-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={15} className="text-cyan-400" />
                  Auditoría de Cambios Sincronizados
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {diffSummary.isNewTaladro ? 'Creación de Registro' : 'Actualización de Celdas'}
                </span>
              </div>

              {diffSummary.isNewTaladro ? (
                /* Caso 1: Taladro Nuevo */
                <div className="bg-navy-950/70 border border-navy-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Database size={14} className="text-emerald-400" />
                    <span>Nuevo Taladro Registrado en la BD</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="bg-navy-900 px-2.5 py-1.5 rounded-lg border border-navy-800 text-slate-300">
                      • <span className="font-bold text-slate-100">{diffSummary.corridas.added}</span> corridas (LGG)
                    </div>
                    <div className="bg-navy-900 px-2.5 py-1.5 rounded-lg border border-navy-800 text-slate-300">
                      • <span className="font-bold text-slate-100">{diffSummary.discontinuidades.added}</span> estructuras (EST)
                    </div>
                    <div className="bg-navy-900 px-2.5 py-1.5 rounded-lg border border-navy-800 text-slate-300">
                      • <span className="font-bold text-slate-100">{diffSummary.ensayosPlt.added}</span> ensayos (PLT)
                    </div>
                    <div className="bg-navy-900 px-2.5 py-1.5 rounded-lg border border-navy-800 text-slate-300">
                      • <span className="font-bold text-slate-100">{diffSummary.surveys.added}</span> lecturas (Survey)
                    </div>
                  </div>
                </div>
              ) : (
                /* Caso 2: Actualización de Taladro Existente */
                <div className="space-y-3">
                  {/* Tarjetas KPI de Resumen Rápido */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-navy-950/80 border border-cyan-500/20 rounded-xl p-2.5 text-center">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Celdas Editadas</div>
                      <div className="text-base font-black text-cyan-400 flex items-center justify-center gap-1">
                        <Edit3 size={14} />
                        <span>{diffSummary.totalFieldsChanged}</span>
                      </div>
                    </div>

                    <div className="bg-navy-950/80 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filas Agregadas</div>
                      <div className="text-base font-black text-emerald-400 flex items-center justify-center gap-1">
                        <PlusCircle size={14} />
                        <span>{diffSummary.totalRowsAdded}</span>
                      </div>
                    </div>

                    <div className="bg-navy-950/80 border border-red-500/20 rounded-xl p-2.5 text-center">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filas Eliminadas</div>
                      <div className="text-base font-black text-red-400 flex items-center justify-center gap-1">
                        <Trash2 size={14} />
                        <span>{diffSummary.totalRowsDeleted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desglose por Módulos donde hubo cambios */}
                  <div className="bg-navy-950/70 border border-navy-800 rounded-xl p-3.5 space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {/* 1. Collar */}
                    {diffSummary.collar.changed && (
                      <div className="text-xs border-b border-navy-800/60 pb-2 space-y-1">
                        <span className="font-bold text-cyan-400 flex items-center gap-1">
                          📌 Metadata & Collar:
                        </span>
                        {diffSummary.collar.changes.map((ch, idx) => (
                          <div key={idx} className="text-slate-300 pl-3">
                            • <span className="font-semibold text-slate-200">{ch.label}:</span>{' '}
                            <span className="line-through text-slate-500">{ch.from}</span> ➔{' '}
                            <span className="font-bold text-emerald-400">{ch.to}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. LGG */}
                    {(diffSummary.corridas.fieldsChanged > 0 || diffSummary.corridas.added > 0 || diffSummary.corridas.deleted > 0) && (
                      <div className="text-xs border-b border-navy-800/60 pb-2 space-y-1">
                        <span className="font-bold text-slate-200 flex items-center gap-1">
                          ⛏️ Logueo Geotécnico General (LGG):
                        </span>
                        <div className="text-slate-300 pl-3 space-y-0.5">
                          {diffSummary.corridas.fieldsChanged > 0 && (
                            <div>• <span className="font-bold text-cyan-400">{diffSummary.corridas.fieldsChanged}</span> celdas modificadas en <span className="font-bold text-slate-100">{diffSummary.corridas.modifiedRows}</span> corridas.</div>
                          )}
                          {diffSummary.corridas.added > 0 && (
                            <div>• <span className="font-bold text-emerald-400">+{diffSummary.corridas.added}</span> corridas agregadas.</div>
                          )}
                          {diffSummary.corridas.deleted > 0 && (
                            <div>• <span className="font-bold text-red-400">-{diffSummary.corridas.deleted}</span> corridas eliminadas.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. Estructural */}
                    {(diffSummary.discontinuidades.fieldsChanged > 0 || diffSummary.discontinuidades.added > 0 || diffSummary.discontinuidades.deleted > 0) && (
                      <div className="text-xs border-b border-navy-800/60 pb-2 space-y-1">
                        <span className="font-bold text-slate-200 flex items-center gap-1">
                          🧬 Logueo Estructural (EST):
                        </span>
                        <div className="text-slate-300 pl-3 space-y-0.5">
                          {diffSummary.discontinuidades.fieldsChanged > 0 && (
                            <div>• <span className="font-bold text-cyan-400">{diffSummary.discontinuidades.fieldsChanged}</span> celdas modificadas en <span className="font-bold text-slate-100">{diffSummary.discontinuidades.modifiedRows}</span> estructuras.</div>
                          )}
                          {diffSummary.discontinuidades.added > 0 && (
                            <div>• <span className="font-bold text-emerald-400">+{diffSummary.discontinuidades.added}</span> estructuras agregadas.</div>
                          )}
                          {diffSummary.discontinuidades.deleted > 0 && (
                            <div>• <span className="font-bold text-red-400">-{diffSummary.discontinuidades.deleted}</span> estructuras eliminadas.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. PLT */}
                    {(diffSummary.ensayosPlt.fieldsChanged > 0 || diffSummary.ensayosPlt.added > 0 || diffSummary.ensayosPlt.deleted > 0) && (
                      <div className="text-xs border-b border-navy-800/60 pb-2 space-y-1">
                        <span className="font-bold text-slate-200 flex items-center gap-1">
                          💥 Ensayos PLT:
                        </span>
                        <div className="text-slate-300 pl-3 space-y-0.5">
                          {diffSummary.ensayosPlt.fieldsChanged > 0 && (
                            <div>• <span className="font-bold text-cyan-400">{diffSummary.ensayosPlt.fieldsChanged}</span> celdas modificadas en <span className="font-bold text-slate-100">{diffSummary.ensayosPlt.modifiedRows}</span> muestras.</div>
                          )}
                          {diffSummary.ensayosPlt.added > 0 && (
                            <div>• <span className="font-bold text-emerald-400">+{diffSummary.ensayosPlt.added}</span> muestras agregadas.</div>
                          )}
                          {diffSummary.ensayosPlt.deleted > 0 && (
                            <div>• <span className="font-bold text-red-400">-{diffSummary.ensayosPlt.deleted}</span> muestras eliminadas.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 5. Surveys */}
                    {(diffSummary.surveys.fieldsChanged > 0 || diffSummary.surveys.added > 0 || diffSummary.surveys.deleted > 0) && (
                      <div className="text-xs space-y-1">
                        <span className="font-bold text-slate-200 flex items-center gap-1">
                          📐 Trayectorias (Survey):
                        </span>
                        <div className="text-slate-300 pl-3 space-y-0.5">
                          {diffSummary.surveys.fieldsChanged > 0 && (
                            <div>• <span className="font-bold text-cyan-400">{diffSummary.surveys.fieldsChanged}</span> lecturas modificadas.</div>
                          )}
                          {diffSummary.surveys.added > 0 && (
                            <div>• <span className="font-bold text-emerald-400">+{diffSummary.surveys.added}</span> lecturas agregadas.</div>
                          )}
                          {diffSummary.surveys.deleted > 0 && (
                            <div>• <span className="font-bold text-red-400">-{diffSummary.surveys.deleted}</span> lecturas eliminadas.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {!hasModifications && !diffSummary.collar.changed && (
                      <div className="text-center py-2 text-xs text-slate-400 font-semibold">
                        Sincronización completa realizada sin modificaciones detectadas.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Details Section (Only on failure) */}
          {!success && details && (
            <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Detalle del Fallo de Transacción
                </span>
              </div>
              <p className="text-xs text-red-300/90 font-mono leading-relaxed break-words">
                {details}
              </p>
              <p className="text-xs text-slate-400 pt-1 border-t border-red-500/10">
                La transacción fue abortada por el motor SQL Server. Sus datos locales se mantienen seguros.
              </p>
            </div>
          )}

          {/* Botón Entendido */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md ${
                success
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] border border-emerald-400/30'
                  : 'bg-navy-900 hover:bg-navy-800 text-slate-200 border border-navy-700'
              }`}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
