import React, { useState } from 'react';
import { Plus, Search, MapPin, User, LayoutGrid, Trash2, Construction, TrendingUp } from 'lucide-react';

interface TaladroSummary {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  fecha_registro: string;
  corridas_count: number;
  surveys_count: number;
}

interface DashboardProps {
  taladros: TaladroSummary[];
  onSelectTaladro: (name: string) => void;
  onCreateTaladro: (newTaladro: any) => void;
  onDeleteTaladro: (name: string) => void;
}

export default function Dashboard({
  taladros,
  onSelectTaladro,
  onCreateTaladro,
  onDeleteTaladro
}: DashboardProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [proyecto, setProyecto] = useState('Proyecto A');
  const [geologo, setGeologo] = useState('RD/RB');
  const [diametro, setDiametro] = useState('HQ3');
  const [inclinacion, setInclinacion] = useState(-60.0);
  const [campana, setCampana] = useState('2026');
  const [turno, setTurno] = useState('D');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateTaladro({
      name: name.trim().toUpperCase(),
      proyecto,
      geologo,
      diametro,
      inclinacion,
      campana,
      fecha_registro: new Date().toISOString().split('T')[0],
      // Proyectado
      collar_este_proyectado: 0.0,
      collar_norte_proyectado: 0.0,
      collar_cota_proyectado: 0.0,
      prof_final_eoh_proyectada: 0.0,
      comentarios_proyectado: '',
      // Oficial
      collar_este: 0.0,
      collar_norte: 0.0,
      collar_cota: 0.0,
      prof_final_eoh: 0.0,
      comentarios: '',
      turno,
      surveys: [],
      corridas: [],
      discontinuidades: [],
      ensayos_plt: []
    });
    setShowModal(false);
    setName('');
  };

  // Cálculos dinámicos para el Mockup operacional diario
  const totalMetrosHoy = taladros.reduce((acc, t) => acc + (t.corridas_count * 1.5), 0);
  
  const taladroPredominante = taladros.length > 0
    ? [...taladros].sort((a, b) => b.corridas_count - a.corridas_count)[0].name
    : 'Ninguno';

  const rmrPromedio = taladros.length > 0 ? 68 : 0;

  const filtered = taladros.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const dateObj = new Date();
  const dayNum = dateObj.getDate().toString().padStart(2, '0');
  const monthName = dateObj.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
  const weekdayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
  const capitalizedWeekday = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

  return (
    <div className="space-y-6 select-none w-full">
      {/* Welcome Banner */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-wide bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Panel de Control de Sondajes</h2>
          <p className="text-slate-400 text-xs mt-1">Registra y administra testigos diamantinos con RMR en tiempo real y validación QA/QC física.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
        >
          <Plus size={18} />
          <span>Registrar Nuevo Taladro</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Premium Date Card */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between bg-gradient-to-br from-navy-900/40 to-navy-950/20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center bg-cyan-500/10 border border-cyan-500/30 rounded-lg w-12 h-12 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
              <span className="text-[9px] font-black text-cyan-400 leading-none">{monthName}</span>
              <span className="text-lg font-black text-slate-100 leading-none mt-0.5">{dayNum}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Fecha de Hoy</span>
              <span className="text-xs font-bold text-slate-300 block leading-tight">{capitalizedWeekday}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Taladros</span>
            <span className="text-2xl font-black text-slate-100 block">{taladros.length}</span>
          </div>
          <LayoutGrid size={24} className="text-cyan-500/40" />
        </div>
        
        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Perf. Total Hoy</span>
            <span className="text-2xl font-black text-slate-100 block">{totalMetrosHoy.toFixed(1)} m</span>
          </div>
          <Construction size={24} className="text-cyan-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Taladro Predom.</span>
            <span className="text-lg font-black text-slate-100 block truncate max-w-[140px]">{taladroPredominante}</span>
          </div>
          <MapPin size={24} className="text-cyan-500/40" />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-navy-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
            <span className="text-2xl font-black text-emerald-400 block">{rmrPromedio}</span>
          </div>
          <TrendingUp size={24} className="text-emerald-500/40" />
        </div>
      </div>

      {/* Search and Table Grid */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar taladro por código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs text-slate-500 font-bold uppercase tracking-wider border-b border-navy-800">
                <th className="py-3 px-4">Taladro / Sondaje</th>
                <th className="py-3 px-4 text-center">Perf. Hoy (m)</th>
                <th className="py-3 px-4">Geólogo</th>
                <th className="py-3 px-4 text-center">Diámetro</th>
                <th className="py-3 px-4 text-center">Inclinación</th>
                <th className="py-3 px-4 text-center">Corridas</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr 
                  key={t.name}
                  onClick={() => onSelectTaladro(t.name)}
                  className="border-b border-navy-900/60 hover:bg-navy-900/10 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-100 tracking-wide">{t.name}</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 font-bold">{(t.corridas_count * 1.5).toFixed(1)} m</td>
                  <td className="py-3.5 px-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-500" />
                      <span>{t.geologo}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-300 font-semibold">{t.diametro}</td>
                  <td className="py-3.5 px-4 text-center text-slate-400">{t.inclinacion}&deg;</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-navy-800 text-slate-300 px-2 py-0.5 rounded text-xs font-bold">
                      {t.corridas_count}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelectTaladro(t.name)}
                        className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-sm active:scale-95"
                      >
                        Ingresar
                      </button>
                      <button
                        onClick={() => onDeleteTaladro(t.name)}
                        className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto"
                        title="Eliminar taladro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No se encontraron taladros. Haz clic en "Registrar Nuevo Taladro" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registro Nuevo Taladro */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95">
            <h3 className="text-lg font-bold text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase text-sm">
              Registrar Nuevo Taladro
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Código del Taladro</label>
                <input
                  type="text"
                  required
                  placeholder="ej. FEGT25-001"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Proyecto</label>
                  <select
                    value={proyecto}
                    onChange={(e) => setProyecto(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="Proyecto A">Proyecto A</option>
                    <option value="Proyecto B">Proyecto B</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Geólogo</label>
                  <input
                    type="text"
                    required
                    value={geologo}
                    onChange={(e) => setGeologo(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Diámetro</label>
                  <select
                    value={diametro}
                    onChange={(e) => setDiametro(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="HQ3">HQ3</option>
                    <option value="NQ3">NQ3</option>
                    <option value="PQ3">PQ3</option>
                    <option value="HQ">HQ</option>
                    <option value="NQ">NQ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Inclinación (&deg;)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={inclinacion}
                    onChange={(e) => setInclinacion(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Campaña</label>
                  <input
                    type="text"
                    required
                    value={campana}
                    onChange={(e) => setCampana(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Turno</label>
                  <select
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="D">Día</option>
                    <option value="N">Noche</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Guardar Taladro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
