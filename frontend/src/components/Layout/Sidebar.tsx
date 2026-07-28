import {
  Home,
  MapPin,
  FileText,
  Share2,
  TrendingUp,
  Settings,
  BarChart2,
  Moon,
  Sun,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedTaladro: string | null;
  activeTaladroObj?: any;
  hasUnsavedChanges?: boolean;
  onClearActiveTaladro?: () => void;
}

export default function Sidebar({
  currentView,
  onViewChange,
  darkMode,
  onToggleDarkMode,
  selectedTaladro,
  activeTaladroObj,
  hasUnsavedChanges = false,
}: SidebarProps) {
  // Mantener 100% de los nombres de secciones y categorías originales
  const menuItems = [
    { id: 'dashboard', label: 'Home / Dashboard', icon: Home, category: 'GENERAL' },
    { id: 'collar', label: 'Collar y Survey', icon: MapPin, category: 'REGISTRO DE CAMPO' },
    { id: 'lgg', label: 'Logueo General (LGG)', icon: FileText, category: 'REGISTRO DE CAMPO' },
    { id: 'lgest', label: 'Logueo estructural', icon: Share2, category: 'REGISTRO DE CAMPO' },
    { id: 'rmr', label: 'Validación RMR', icon: TrendingUp, category: 'CONTROL Y ANÁLISIS' },
    { id: 'formulas', label: 'Fórmulas de Cálculo', icon: Calculator, category: 'CONTROL Y ANÁLISIS' },
    { id: 'dashboard_rqd', label: 'Validación Espaciamiento RQD% - FF/1', icon: BarChart2, category: 'REPORTES' },
    { id: 'reports_pdf', label: 'Reportes PDF', icon: FileText, category: 'REPORTES' },
    { id: 'reports_plt', label: 'Ensayos PLT', icon: BarChart2, category: 'ENSAYOS' },
    { id: 'revision', label: 'Carga para Revisión', icon: ShieldCheck, category: 'REVISION GENERAL' },
    { id: 'config', label: 'Parámetros del Sistema', icon: Settings, category: 'CONFIGURACIÓN' },
  ];

  const categories = [
    'GENERAL',
    'REGISTRO DE CAMPO',
    'CONTROL Y ANÁLISIS',
    'REPORTES',
    'ENSAYOS',
    'REVISION GENERAL',
    'CONFIGURACIÓN',
  ];

  const activeName = activeTaladroObj?.name || selectedTaladro;

  // Extraer únicamente el año de la campaña (ej. "Campaña 2026" -> "2026")
  const getYearOnly = (campanaVal: any): string => {
    if (!campanaVal) return '';
    const str = String(campanaVal).trim();
    const match = str.match(/\d{4}/);
    return match ? match[0] : str;
  };

  return (
    <aside className="dark w-64 glass-panel chrome-dark border-r border-navy-800 bg-navy-950 flex flex-col h-screen text-slate-300 select-none shadow-lg transition-all duration-300">
      {/* Brand Header */}
      <div className="p-5 border-b border-navy-800 flex items-center justify-between bg-navy-950">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-navy-900 border border-cyan-500/30 flex items-center justify-center">
            <span className="text-xs font-black text-cyan-400">GP</span>
          </div>
          <div>
            <h1 className="text-base font-black text-slate-100 tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              LOGUEO 2026
            </h1>
            <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest leading-none mt-0.5">
              Geolog Pro v2.0
            </p>
          </div>
        </div>
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-cyan-400 hover:text-cyan-300 transition-all active:scale-95"
          title="Alternar Modo Claro/Oscuro"
        >
          {darkMode ? <Sun size={14} className="text-cyan-400" /> : <Moon size={14} className="text-cyan-400" />}
        </button>
      </div>

      {/* Tarjeta Destacada de Sondaje Activo */}
      <div className="p-4 border-b border-navy-800 bg-navy-950/60">
        {activeName ? (
          <div className="p-3.5 bg-navy-900/90 border border-cyan-500/30 rounded-xl shadow-md space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Taladro Activo</span>
              </span>
            </div>

            <div className="space-y-0.5">
              <h4 className="text-sm font-black text-slate-100 tracking-wide break-all flex items-center gap-1.5">
                <MapPin size={13} className="text-cyan-400 shrink-0" />
                <span>{activeName}</span>
              </h4>
              {(() => {
                const year = getYearOnly(activeTaladroObj?.campana);
                const details = [
                  activeTaladroObj?.proyecto,
                  year,
                  activeTaladroObj?.geologo
                ].filter(val => val && String(val).trim() !== '' && val !== '-1');

                if (details.length === 0) return null;
                return (
                  <p className="text-[11px] text-slate-400 font-medium truncate pl-4">
                    {details.join(' · ')}
                  </p>
                );
              })()}
            </div>

            <div className="pt-2 border-t border-navy-800 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                hasUnsavedChanges
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {hasUnsavedChanges ? (
                  <>
                    <AlertCircle size={10} />
                    <span>Cambios no guardados</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={10} />
                    <span>Todo guardado</span>
                  </>
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-navy-900/40 border border-navy-800/80 rounded-xl text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Sin Sondaje Seleccionado
            </span>
            <p className="text-[11px] text-slate-400 font-medium">
              Selecciona un taladro en el Inicio para habilitar el registro.
            </p>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-3.5 space-y-5 scrollbar-thin">
        {categories.map(category => {
          const items = menuItems.filter(item => item.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1">
              <div className="flex items-center gap-1.5 px-3 mb-1.5">
                <span className="w-1 h-1 rounded-full bg-cyan-500/60" />
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  {category}
                </h3>
              </div>
              {items.map(item => {
                const isActive = currentView === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-300 font-bold border-l-2 border-cyan-400'
                        : 'hover:bg-navy-900/60 hover:text-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left min-w-0">
                      <Icon
                        size={15}
                        className={`${
                          isActive
                            ? 'text-cyan-400'
                            : 'text-slate-500 group-hover:text-cyan-400'
                        } transition-colors shrink-0`}
                      />
                      <span className="text-left leading-tight break-words font-medium">
                        {item.label}
                      </span>
                    </div>

                    {isActive && (
                      <ChevronRight size={12} className="text-cyan-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-navy-800 text-[10px] text-slate-500 text-center font-medium bg-navy-950">
        LGG-2026 GEMA &copy; 2026
      </div>
    </aside>
  );
}
