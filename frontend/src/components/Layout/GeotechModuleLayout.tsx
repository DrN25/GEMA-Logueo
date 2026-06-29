import React from 'react';
import { Eye, EyeOff, Filter, Upload, Download, Plus, Layers } from 'lucide-react';

interface SubTab {
    id: string;
    label: string;
}

interface GeotechModuleLayoutProps {
    activeSubTab: string;
    setActiveSubTab: (tab: any) => void;
    subTabs: SubTab[];

    // Encabezado
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    showKpis: boolean;
    setShowKpis: (show: boolean) => void;

    // Acciones Superiores
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    onImportClick: () => void;
    onExportClick: () => void;
    isExportDisabled?: boolean;
    filterContent?: React.ReactNode; // Filtros específicos de cada vista

    // Barra de Herramientas de la Grilla
    activeTaladroName: string;
    geologo: string;
    onAddRow: () => void;
    addBtnLabel?: string;
    onCloneRow?: () => void; // Mostrar clonar si se pasa esta función (LGG, Estructural)
    isCloneDisabled?: boolean;
    recordCount: number;
    recordLabel?: string; // "reg.", "muestras", etc.

    // Contenido de la Rejilla o Vistas Alternativas (Dashboard/QAQC)
    children: React.ReactNode;
    sidebarCollapsed?: boolean;
}

export default function GeotechModuleLayout({
    activeSubTab,
    setActiveSubTab,
    subTabs,
    title,
    subtitle,
    icon,
    showKpis,
    setShowKpis,
    showFilters,
    setShowFilters,
    onImportClick,
    onExportClick,
    isExportDisabled = false,
    filterContent,
    activeTaladroName,
    geologo,
    onAddRow,
    addBtnLabel = "Agregar",
    onCloneRow,
    isCloneDisabled = true,
    recordCount,
    recordLabel = "regs.",
    children,
    sidebarCollapsed = false
}: GeotechModuleLayoutProps) {

    // Auto-adaptación del ancho horizontal considerando el Sidebar colapsado
    const panelWidthStyle = {
        position: 'sticky' as const,
        left: 0,
        width: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
        maxWidth: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
    };

    return (
        <div className="h-full flex flex-col select-none min-h-0 overflow-hidden">

            {/* Sub-Pestañas Superiores - Comunes a todos los módulos */}
            <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0 mb-4 justify-between items-center">
                <div className="flex">
                    {subTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === tab.id
                                    ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
                                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Botón Modo Enfoque integrado */}
                {activeSubTab === subTabs[0].id && (
                    <button
                        onClick={() => setShowKpis(!showKpis)}
                        className={`mr-4 flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xxs font-black uppercase tracking-wider transition-all active:scale-95 ${showKpis
                                ? 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200 hover:bg-navy-850'
                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                            }`}
                        title={showKpis ? "Ocultar cabecera para maximizar filas" : "Mostrar cabecera"}
                    >
                        {showKpis ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{showKpis ? "Modo Enfoque" : "Mostrar Cabecera"}</span>
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col p-1 space-y-3 min-h-0 overflow-hidden relative">
                {activeSubTab === subTabs[0].id ? (
                    <>
                        {/* CABECERA ESTÁTICA OCULTABLE DINÁMICAMENTE */}
                        <div className={`shrink-0 space-y-3 transition-all duration-300 ease-in-out ${showKpis ? 'opacity-100 max-h-[350px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
                            }`}>
                            <div
                                style={panelWidthStyle}
                                className="glass-panel p-3.5 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 transition-[width,max-width] duration-300 animate-none"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                                        {icon}
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">{title}</h2>
                                        <p className="text-[10px] text-slate-400">{subtitle}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {filterContent && (
                                        <button
                                            type="button"
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={`flex items-center gap-1.5 border active:scale-95 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm ${showFilters
                                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                                                    : 'bg-navy-900 border-navy-800 text-slate-400 hover:bg-navy-850'
                                                }`}
                                        >
                                            <Filter size={12} />
                                            <span>{showFilters ? "Ocultar Filtros" : "Filtros"}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onImportClick}
                                        className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 text-emerald-500 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm"
                                    >
                                        <Upload size={12} />
                                        <span>Importar</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onExportClick}
                                        disabled={isExportDisabled}
                                        className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 text-blue-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Download size={12} />
                                        <span>Exportar</span>
                                    </button>
                                </div>
                            </div>

                            {/* Contenedor de Filtros Expandible */}
                            {showFilters && filterContent && (
                                <div style={panelWidthStyle} className="transition-[width,max-width] duration-300">
                                    {filterContent}
                                </div>
                            )}
                        </div>

                        {/* BARRA DE HERRAMIENTAS ADAPTATIVA AUTOMÁTICA */}
                        <div
                            style={panelWidthStyle}
                            className="shrink-0 flex justify-between items-center bg-navy-900/50 p-2.5 rounded-xl border border-navy-800/35 backdrop-blur-md transition-[width,max-width] duration-300 shadow-md animate-none"
                        >
                            <div className="flex items-center gap-2">
                                {/* Resumen compacto de Taladro cuando la cabecera pesada se oculta */}
                                {!showKpis && (
                                    <div className="flex items-center gap-2 border-r border-navy-800 pr-3 mr-1">
                                        <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md tracking-wider">
                                            {activeTaladroName}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">
                                            {geologo}
                                        </span>
                                    </div>
                                )}

                                <button
                                    onClick={onAddRow}
                                    className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                                >
                                    <Plus size={13} />
                                    <span>{addBtnLabel}</span>
                                </button>

                                {onCloneRow && (
                                    <button
                                        onClick={onCloneRow}
                                        disabled={isCloneDisabled}
                                        className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                                        title="Insertar y clonar fila seleccionada"
                                    >
                                        <Layers size={12} className="text-cyan-400" />
                                        <span>Clonar</span>
                                    </button>
                                )}

                                {/* Import/Export rápidos visibles únicamente en Modo Enfoque */}
                                {!showKpis && (
                                    <div className="flex items-center gap-1.5 pl-1.5 border-l border-navy-800">
                                        <button
                                            type="button"
                                            onClick={onImportClick}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xxs font-black uppercase tracking-wider transition-all border border-emerald-500/10 active:scale-95"
                                            title="Importar Excel"
                                        >
                                            <Upload size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onExportClick}
                                            disabled={isExportDisabled}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xxs font-black uppercase tracking-wider transition-all border border-blue-500/10 active:scale-95 disabled:opacity-30"
                                            title="Exportar Excel"
                                        >
                                            <Download size={12} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-1 bg-navy-950/80 border border-navy-850 rounded-lg px-2.5 py-1.5 text-xxs text-slate-400 shadow-sm">
                                    <span className="text-slate-300 font-bold">{recordCount}</span>
                                    <span className="text-slate-500">{recordLabel}</span>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium hidden md:block">
                                Foco en celdas con <span className="font-bold text-slate-400">Teclas de Dirección</span> • <span className="font-bold text-slate-400">ENTER</span> para avanzar.
                            </div>
                        </div>

                        {/* Renderizado Dinámico de la Rejilla Base */}
                        <div className="flex-1 min-h-0 flex flex-col">
                            {children}
                        </div>
                    </>
                ) : (
                    /* Renderizado alternativo para paneles de Análisis QA/QC o Dashboards */
                    <div style={panelWidthStyle} className="transition-[width,max-width] duration-300">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}