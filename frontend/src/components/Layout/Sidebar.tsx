import {
  Home,
  List,
  MapPin,
  FileText,
  Share2,
  TrendingUp,
  Settings,
  BarChart2,
  Moon,
  Sun,
  Calculator,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  selectedTaladro: string | null;
}

export default function Sidebar({
  currentView,
  onViewChange,
  darkMode,
  onToggleDarkMode,
  selectedTaladro
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Home / Dashboard', icon: Home, category: 'GENERAL' },
    { id: 'list', label: 'Lista de taladros', icon: List, category: 'GENERAL', isMock: true },
    { id: 'collar', label: 'Collar y Survey', icon: MapPin, category: 'REGISTRO DE CAMPO' },
    { id: 'lgg', label: 'Logueo General (LGG)', icon: FileText, category: 'REGISTRO DE CAMPO' },
    { id: 'lgest', label: 'Logueo estructural', icon: Share2, category: 'REGISTRO DE CAMPO' },
    { id: 'rmr', label: 'Validación RMR', icon: TrendingUp, category: 'CONTROL Y ANÁLISIS' },
    { id: 'formulas', label: 'Fórmulas de Cálculo', icon: Calculator, category: 'CONTROL Y ANÁLISIS' },
    { id: 'dashboard_rqd', label: 'Validación Espaciamiento RQD% - FF/1', icon: BarChart2, category: 'REPORTES' },
    { id: 'reports_pdf', label: 'Reportes PDF', icon: FileText, category: 'REPORTES' },
    { id: 'reports_plt', label: 'Ensayos PLT', icon: BarChart2, category: 'ENSAYOS' },
    { id: 'auditoria', label: 'Carga para Revisión', icon: ShieldCheck, category: 'REVISION GENERAL' },
    { id: 'config', label: 'Parámetros del Sistema', icon: Settings, category: 'CONFIGURACIÓN' },
  ];

  // Agrupar por categoría
  const categories = [
    'GENERAL',
    'REGISTRO DE CAMPO',
    'CONTROL Y ANÁLISIS',
    'REPORTES',
    'ENSAYOS',
    'REVISION GENERAL',
    'CONFIGURACIÓN',
  ];

  return (
    <aside className="dark w-64 glass-panel chrome-dark border-r border-navy-800 flex flex-col h-screen text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-navy-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-100 tracking-wider bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">LOGUEO 2026</h1>
          <p className="text-xs text-cyan-500 dark:text-cyan-400 font-semibold uppercase mt-0.5">
            {selectedTaladro ? `Taladro: ${selectedTaladro}` : 'Ningún taladro'}
          </p>
        </div>
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-400 hover:text-slate-100 transition-colors shadow-md active:scale-95"
          title="Alternar Modo Claro/Oscuro"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {categories.map(category => {
          const items = menuItems.filter(item => item.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
                {category}
              </h3>
              {items.map(item => {
                const isDisabled = false;
                const isActive = currentView === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    disabled={isDisabled}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all group relative ${isDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : isActive
                        ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-cyan-400 font-bold border-l-2 border-blue-600 dark:border-cyan-400 shadow-sm'
                        : 'hover:bg-navy-900/40 hover:text-slate-100 text-slate-400'
                      }`}
                  >
                    <div className="flex items-center gap-3 text-left min-w-0">
                      <Icon
                        size={18}
                        className={`${isActive ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-500 group-hover:text-blue-600 dark:group-hover:text-cyan-400'
                          } transition-colors shrink-0`}
                      />
                      <span className="text-left leading-tight break-words">{item.label}</span>
                    </div>

                    {item.isMock && (
                      <span className="text-xs bg-navy-800 text-slate-400 px-1.5 py-0.5 rounded-full border border-navy-700 font-medium shrink-0 ml-2">
                        Pronto
                      </span>
                    )}

                    {/* Blue bar on active item */}
                    {isActive && (
                      <span className="absolute right-0 top-1 bottom-1 w-1 bg-blue-600 dark:bg-cyan-400 rounded-l-md" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-navy-800 text-xs text-slate-500 text-center">
        LGG-2026 GEMA &copy; 2026
      </div>
    </aside>
  );
}
