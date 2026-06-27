import { useState } from 'react';
import { X, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface SheetSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: string[];
  onConfirm: (lggSheet: string, estSheet: string) => void;
}

export default function SheetSelectModal({
  isOpen,
  onClose,
  sheets,
  onConfirm
}: SheetSelectModalProps) {
  const [lggSheet, setLggSheet] = useState<string>('');
  const [estSheet, setEstSheet] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!lggSheet || !estSheet) {
      setError('Por favor, selecciona las hojas para ambos módulos.');
      return;
    }
    if (lggSheet === estSheet) {
      setError('No puedes seleccionar la misma hoja para ambos módulos geotécnicos.');
      return;
    }
    setError('');
    onConfirm(lggSheet, estSheet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm select-none">
      <div className="glass-panel w-full max-w-md rounded-xl border border-navy-800 bg-[#090f1d]/95 p-6 shadow-2xl relative animate-fade-in text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-navy-900 hover:text-slate-100 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
              Mapear Hojas del Libro Excel
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifica la hoja correspondiente a cada módulo
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* LGG Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
              Hoja de Logueo General (LGG)
            </label>
            <select
              value={lggSheet}
              onChange={(e) => {
                setLggSheet(e.target.value);
                setError('');
              }}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">-- Seleccionar Hoja --</option>
              {sheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </div>

          {/* Estructural Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
              Hoja de Logueo Estructural (LG EST)
            </label>
            <select
              value={estSheet}
              onChange={(e) => {
                setEstSheet(e.target.value);
                setError('');
              }}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">-- Seleccionar Hoja --</option>
              {sheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2.5 justify-end mt-6 pt-4 border-t border-slate-850">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-navy-900 border border-navy-800 text-slate-400 hover:bg-navy-850 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 border border-indigo-400/30 text-white transition-all shadow-[0_0_12px_rgba(99,102,241,0.2)] active:scale-95"
          >
            Confirmar Mapeo
          </button>
        </div>
      </div>
    </div>
  );
}
