import React, { useState, useEffect } from 'react';

interface CreateTaladroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    proyecto: string;
    geologo: string;
    diametro: string;
    inclinacion: number;
    campana: string;
    fecha_registro: string;
    collar_este: number;
    collar_norte: number;
    collar_cota: number;
    turno: string;
    surveys: any[];
    corridas: any[];
    discontinuidades: any[];
    ensayos_plt: any[];
  }) => void;
  defaultGeologo?: string;
}

export function CreateTaladroModal({
  isOpen,
  onClose,
  onCreate,
  defaultGeologo = 'RD/RB'
}: CreateTaladroModalProps) {
  const [name, setName] = useState('');
  const [proyecto, setProyecto] = useState('Proyecto A');
  const [geologo, setGeologo] = useState(defaultGeologo);
  const [diametro, setDiametro] = useState('HQ3');
  const [inclinacion, setInclinacion] = useState(-60.0);
  const [campana, setCampana] = useState('2026');
  const [turno, setTurno] = useState('D');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setGeologo(defaultGeologo);
    }
  }, [isOpen, defaultGeologo]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim().toUpperCase(),
      proyecto,
      geologo,
      diametro,
      inclinacion,
      campana,
      fecha_registro: new Date().toISOString().split('T')[0],
      collar_este: 0.0,
      collar_norte: 0.0,
      collar_cota: 0.0,
      turno,
      surveys: [],
      corridas: [],
      discontinuidades: [],
      ensayos_plt: []
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/95">
        <div>
          <h3 className="text-lg font-bold text-slate-100 tracking-wide uppercase text-sm">
            Crear Nuevo Taladro Geotécnico
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Inicialice un nuevo sondaje en la base de datos local y SQL Server.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Código de Taladro</label>
            <input
              type="text"
              required
              placeholder="ej. FEGT25-002"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Proyecto</label>
              <input
                type="text"
                required
                value={proyecto}
                onChange={(e) => setProyecto(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Geólogo Logueador</label>
              <input
                type="text"
                required
                value={geologo}
                onChange={(e) => setGeologo(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Diámetro</label>
              <select
                value={diametro}
                onChange={(e) => setDiametro(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 focus:outline-none"
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
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
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
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Turno</label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 focus:outline-none"
              >
                <option value="D">Día</option>
                <option value="N">Noche</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-navy-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              Crear Taladro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RenameTaladroModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTaladroName: string;
  onRename: (newName: string) => void;
}

export function RenameTaladroModal({
  isOpen,
  onClose,
  activeTaladroName,
  onRename
}: RenameTaladroModalProps) {
  const [renameInput, setRenameInput] = useState(activeTaladroName);

  useEffect(() => {
    if (isOpen) {
      setRenameInput(activeTaladroName);
    }
  }, [isOpen, activeTaladroName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameInput.trim().toUpperCase();
    if (!trimmed || trimmed === activeTaladroName) {
      onClose();
      return;
    }
    onRename(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-sm p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/90">
        <h3 className="text-lg font-bold text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase text-sm">
          Renombrar Taladro Activo
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nuevo Código del Taladro</label>
            <input
              type="text"
              required
              placeholder="ej. FEGT25-001A"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value.toUpperCase())}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm tracking-wider"
            />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-navy-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              Renombrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
