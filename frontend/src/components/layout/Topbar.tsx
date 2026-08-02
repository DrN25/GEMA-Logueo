import { Menu, Save, ArrowLeft, BookOpen, RotateCcw, Check } from 'lucide-react';

interface TopbarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  activeTaladro: any;
  currentView: string;
  syncStatus: 'synced' | 'unsaved' | 'saving' | 'offline';
  syncMessage: string;
  unsavedCount?: number;
  handleSaveActive: () => void;
  onDiscardClick?: () => void;
  setActiveTaladro: (val: any) => void;
  setCurrentView: (val: string) => void;
  onOpenCatalogs: () => void;
}

export default function Topbar({
  sidebarCollapsed,
  setSidebarCollapsed,
  currentView,
  syncStatus,
  syncMessage,
  unsavedCount = 0,
  handleSaveActive,
  onDiscardClick,
  setActiveTaladro,
  setCurrentView,
  onOpenCatalogs,
}: TopbarProps) {
  const isCurrentUnsaved = syncStatus === 'unsaved';
  const hasWorkspaceUnsaved = unsavedCount > 0;
  const hasAnyUnsaved = isCurrentUnsaved || hasWorkspaceUnsaved;
  const isSaveDisabled = syncStatus === 'saving' || !hasAnyUnsaved;

  return (
    <header className="dark h-16 glass-panel chrome-dark border-b border-navy-800 flex items-center justify-between px-6 z-10 shrink-0 select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 transition-all shadow-sm active:scale-95 flex items-center justify-center"
          title={sidebarCollapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
        >
          <Menu size={16} className="text-cyan-400" />
        </button>

        {currentView !== 'dashboard' && (
          <button
            onClick={() => {
              setActiveTaladro(null);
              setCurrentView('dashboard');
            }}
            className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Volver al Inicio</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Catálogos Geomecánicos */}
        <button
          onClick={onOpenCatalogs}
          className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-cyan-400 hover:text-cyan-300 border border-cyan-500/25 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 hover:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
          title="Ver Catálogos de Referencia Geomecánica"
        >
          <BookOpen size={14} />
          <span>Catálogos</span>
        </button>

        {/* Indicador Simplificado de Estado de Servidor / BD */}
        <div className="flex items-center gap-2 pr-3 border-r border-navy-800">
          <span className={`w-2.5 h-2.5 rounded-full ${
            syncStatus === 'saving' ? 'bg-blue-500 animate-pulse' :
            syncStatus === 'offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
            'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
          }`} />
          <span className="text-xs text-slate-400 font-semibold" title={syncMessage}>
            {syncStatus === 'saving' ? 'Guardando datos...' :
              syncStatus === 'offline' ? 'Modo sin conexión' :
              'Conectado con la BD'}
          </span>
        </div>

        {/* Acciones principales de guardado y descarte */}
        <div className="flex items-center gap-2">
          {/* Botón Descartar Cambios */}
          {hasAnyUnsaved && onDiscardClick && (
            <button
              onClick={onDiscardClick}
              className="flex items-center gap-1 bg-navy-900 hover:bg-red-500/15 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Descartar cambios no guardados y revertir a la base de datos"
            >
              <RotateCcw size={13} />
              <span>
                {!isCurrentUnsaved && hasWorkspaceUnsaved
                  ? `Descartar (${unsavedCount})`
                  : 'Descartar'}
              </span>
            </button>
          )}

          {/* Botón Guardar Cambios */}
          <button
            onClick={handleSaveActive}
            disabled={isSaveDisabled}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              hasAnyUnsaved && !isSaveDisabled
                ? 'bg-amber-500 hover:bg-amber-600 text-navy-950 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] active:scale-95 cursor-pointer font-black'
                : syncStatus === 'saving'
                ? 'bg-blue-600 text-white border-blue-500/30 cursor-wait opacity-90'
                : 'bg-navy-900 text-slate-500 border-navy-800 cursor-not-allowed opacity-75'
            }`}
            title={
              !hasAnyUnsaved
                ? 'Todos los datos están guardados correctamente en la base de datos'
                : syncStatus === 'saving'
                ? 'Guardando datos...'
                : 'Guardar todos los cambios pendientes en la base de datos'
            }
          >
            {syncStatus === 'saving' ? (
              <Save size={14} className="animate-spin" />
            ) : hasAnyUnsaved ? (
              <Save size={14} />
            ) : (
              <Check size={14} className="text-emerald-400" />
            )}
            <span>
              {syncStatus === 'saving'
                ? 'Guardando...'
                : isCurrentUnsaved
                ? 'GUARDAR CAMBIOS'
                : hasWorkspaceUnsaved
                ? `GUARDAR CAMBIOS (${unsavedCount})`
                : 'Todo guardado'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
