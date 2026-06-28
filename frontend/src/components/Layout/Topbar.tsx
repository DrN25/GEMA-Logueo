import { Menu, Save, ArrowLeft, BookOpen } from 'lucide-react';

interface TopbarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  activeTaladro: any;
  currentView: string;
  syncStatus: 'synced' | 'unsaved' | 'saving' | 'offline';
  syncMessage: string;
  handleSaveActive: () => void;
  setActiveTaladro: (val: any) => void;
  setCurrentView: (val: string) => void;
  onOpenCatalogs: () => void;
}

export default function Topbar({
  sidebarCollapsed,
  setSidebarCollapsed,
  activeTaladro,
  currentView,
  syncStatus,
  syncMessage,
  handleSaveActive,
  setActiveTaladro,
  setCurrentView,
  onOpenCatalogs,
}: TopbarProps) {
  const getFriendlyViewName = (view: string) => {
    switch (view) {
      case 'lgg':
        return 'Logueo General';
      case 'lgest':
        return 'Logueo Estructural';
      case 'reports_plt':
        return 'Reportes PLT';
      case 'dashboard_rqd':
        return 'Dashboard RQD';
      case 'dashboard':
        return 'Dashboard';
      default:
        return view.toUpperCase();
    }
  };

  return (
    <header className="dark h-16 glass-panel chrome-dark border-b border-navy-800 flex items-center justify-between px-6 z-10 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-400 hover:text-slate-100 transition-colors border border-navy-800 active:scale-95"
          title="Colapsar barra lateral"
        >
          <Menu size={16} />
        </button>

        {activeTaladro && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modo Activo:</span>
            <span className="bg-blue-600/10 border border-blue-500/20 text-blue-500 dark:text-cyan-400 text-xs font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm">
              {activeTaladro.name}
            </span>
            <span className="text-slate-600 text-xs font-semibold">/</span>
            <span className="text-slate-400 text-xs font-semibold uppercase">
              {getFriendlyViewName(currentView)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Catálogos Geomecánicos global button in topbar */}
        <button
          onClick={onOpenCatalogs}
          className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-cyan-400 hover:text-cyan-300 border border-cyan-500/25 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-sm active:scale-95 hover:shadow-[0_0_10px_rgba(34,211,238,0.15)]"
          title="Ver Catálogos de Referencia Geomecánica"
        >
          <BookOpen size={14} />
          <span>Catálogos</span>
        </button>

        {/* Server Connectivity Indicator */}
        <div className="flex items-center gap-2 pr-3 border-r border-navy-800">
          <span className={`w-2.5 h-2.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
            syncStatus === 'saving' ? 'bg-blue-500 animate-pulse' :
              syncStatus === 'unsaved' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
            }`} />
          <span className="text-xs text-slate-400 font-semibold" title={syncMessage}>
            {syncStatus === 'synced' ? 'SQL Server Conectado' :
              syncStatus === 'saving' ? 'Guardando...' :
                syncStatus === 'unsaved' ? 'Cambios pendientes' :
                  'Almacenamiento Local Offline'}
          </span>
        </div>

        {/* General Drillhole Actions */}
        <div className="flex items-center gap-2">
          {/* Save: visible on any view when a drillhole is active */}
          {activeTaladro && (
            <button
              onClick={handleSaveActive}
              disabled={syncStatus === 'saving'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 border ${syncStatus === 'unsaved'
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                : syncStatus === 'saving'
                  ? 'bg-blue-600 text-white border-blue-500/30 cursor-wait'
                  : syncStatus === 'synced'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] font-bold'
                    : 'bg-navy-900 hover:bg-navy-850 text-slate-300 border-navy-800'
                }`}
              title="Guardar todos los cambios en SQL Server"
            >
              <Save size={14} />
              <span>{syncStatus === 'saving' ? 'Guardando...' : 'Guardar'}</span>
            </button>
          )}
          {/* Back to Panel: shows when NOT on dashboard */}
          {currentView !== 'dashboard' && (
            <button
              onClick={() => {
                setActiveTaladro(null);
                setCurrentView('dashboard');
              }}
              className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white border border-navy-800 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft size={14} />
              <span>Volver al Panel</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
