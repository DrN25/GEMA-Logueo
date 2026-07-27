import { useState } from 'react';
import { 
  X, BookOpen, Layers, Hammer, ShieldAlert, 
  Sparkles, Palette, FileSpreadsheet, Compass
} from 'lucide-react';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';

// ─── Catálogo Centralizado de Litología y Factor K (PLT) ─────────────────────

const LITHOLOGY_K_REFERENCES = [
  { clase: "Intrusivas", lito1: "MZB", lito2: "MZB", lito3: "MZB_EQ", k: 8.29 },
  { clase: "Intrusivas", lito1: "MZB", lito2: "MZB", lito3: "MZB_P", k: 8.53 },
  { clase: "Intrusivas", lito1: "MBF1", lito2: "MBF", lito3: "MBF1", k: 9.20 },
  { clase: "Intrusivas", lito1: "MBF2", lito2: "MBF", lito3: "MBF2", k: 10.73 },
  { clase: "Intrusivas", lito1: "MBF2", lito2: "MBF", lito3: "MBF_P", k: 9.31 },
  { clase: "Intrusivas", lito1: "MZM", lito2: "MZM", lito3: "MZM_F", k: 9.31 },
  { clase: "Intrusivas", lito1: "MZM", lito2: "MZM", lito3: "MZM_M", k: 8.61 },
  { clase: "Intrusivas", lito1: "MZH", lito2: "MZH", lito3: "MZH_1", k: 11.62 },
  { clase: "Intrusivas", lito1: "MZH", lito2: "MZH", lito3: "MZH_2", k: 9.31 },
  { clase: "Intrusivas", lito1: "MZD", lito2: "MZD", lito3: "MZD", k: 7.60 },
  { clase: "Intrusivas", lito1: "MZQ", lito2: "MZQ", lito3: "MZQ", k: 12.29 },
  { clase: "Intrusivas", lito1: "AN", lito2: "AN", lito3: "LAM", k: 9.31 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_M", k: 14.74 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_MG", k: 14.25 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_S", k: 14.84 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_C", k: 16.83 },
  { clase: "Sedimentarias", lito1: "LMT", lito2: "LMT", lito3: "LMT_U", k: 14.84 },
  { clase: "Sedimentarias", lito1: "SHL", lito2: "HFL", lito3: "SHL_MA", k: 14.84 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "GSK", lito3: "Varios", k: 11.15 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "PSK", lito3: "Varios", k: 12.63 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "MSK", lito3: "Varios", k: 12.63 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "ESK", lito3: "Varios", k: 12.63 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "MBC", lito3: "Varios", k: 11.78 },
  { clase: "Metamórficas", lito1: "LMT", lito2: "MBL", lito3: "Varios", k: 13.34 },
  { clase: "Metamórficas", lito1: "SHL", lito2: "HFL", lito3: "-", k: 12.63 },
  { clase: "Metamórficas", lito1: "SND", lito2: "QZT", lito3: "-", k: 12.63 },
  { clase: "Brechas", lito1: "TBX", lito2: "TBX", lito3: "TBX", k: 13.72 },
  { clase: "Brechas", lito1: "HBX", lito2: "HBX", lito3: "HBX", k: 11.41 },
  { clase: "Brechas", lito1: "MBX / varios", lito2: "MBX", lito3: "MBX", k: 11.41 },
  { clase: "Endoskarn", lito1: "MZM", lito2: "EPG", lito3: "-", k: 9.87 },
  { clase: "Endoskarn", lito1: "MZM", lito2: "EGT", lito3: "-", k: 9.87 }
];

function getLithologyClasses(code: string): string[] {
  if (!code) return [];
  const upperCode = code.toUpperCase().trim();
  const classesSet = new Set<string>();

  LITHOLOGY_K_REFERENCES.forEach(ref => {
    const checkMatch = (field: string) => {
      if (!field) return false;
      const normalized = field.toUpperCase().trim();
      if (normalized === upperCode) return true;
      if (normalized.includes('/')) {
        return normalized.split('/').map(x => x.trim()).includes(upperCode);
      }
      return false;
    };

    if (checkMatch(ref.lito3) || checkMatch(ref.lito2) || checkMatch(ref.lito1)) {
      classesSet.add(ref.clase);
    }
  });

  return Array.from(classesSet);
}

function getClassPillStyles(clase: string): string {
  switch (clase) {
    case "Intrusivas":
      return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    case "Sedimentarias":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "Metamórficas":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "Brechas":
      return "bg-pink-500/10 text-pink-400 border-pink-500/20";
    case "Endoskarn":
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
}

interface CatalogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CatalogsModal({ isOpen, onClose }: CatalogsModalProps) {
  const [activeTab, setActiveTab] = useState<string>('lithology');

  if (!isOpen) return null;

  const groups = [
    {
      title: 'Roca Intacta & Litología',
      items: [
        { id: 'lithology', label: 'Litología y Colores', icon: Palette },
        { id: 'plt', label: 'PLT Referencia', icon: FileSpreadsheet }
      ]
    },
    {
      title: 'Parámetros RMR',
      items: [
        { id: 'rmr', label: 'Parámetros RMR', icon: BookOpen },
        { id: 'weathering', label: 'Meteorización (ISRM)', icon: ShieldAlert }
      ]
    },
    {
      title: 'Discontinuidades & Estructura',
      items: [
        { id: 'structural', label: 'Forma de Juntas (SVG)', icon: Compass },
        { id: 'structures', label: 'Tipos de Estructuras', icon: Layers },
        { id: 'filling', label: 'Tipos de Relleno', icon: Hammer },
        { id: 'jrc', label: 'Perfiles Rugosidad', icon: Sparkles }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md select-none p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-7xl h-[85vh] rounded-2xl border border-navy-800 flex flex-col overflow-hidden shadow-2xl text-slate-300 bg-[#090f1d]/95">

        {/* Header */}
        <div className="p-5 border-b border-navy-800 flex items-center justify-between bg-navy-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">Catálogos Geomecánicos de Referencia</h2>
              <p className="text-xs text-slate-500 font-medium">Parámetros estándar de clasificación de macizos rocosos de Bieniawski (RMR76 / RMR89) y estándares corporativos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-slate-100 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-navy-700/50 active:scale-95"
          >
            <X size={14} />
            <span>Cerrar</span>
          </button>
        </div>

        {/* main container split into sidebar & content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Categorical Sidebar */}
          <div className="w-64 border-r border-navy-850 bg-navy-950/60 p-4 space-y-5 overflow-y-auto shrink-0 select-none">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1.5">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">
                  {group.title}
                </h4>
                <div className="flex flex-col gap-1">
                  {group.items.map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${isActive
                          ? 'bg-blue-600/15 text-blue-500 dark:bg-cyan-500/10 dark:text-cyan-400 font-black border-l-2 border-blue-600 dark:border-cyan-400 shadow-sm'
                          : 'bg-transparent text-slate-400 hover:bg-navy-900/40 hover:text-white'
                          }`}
                      >
                        <Icon size={14} className={isActive ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-500'} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Table Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#090f1d]/20">
            
            {/* LITOLOGIA Y COLORES */}
            {activeTab === 'lithology' && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-navy-850 pb-2">
                  Catálogo de Litologías y Códigos de Colores
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(LITHOLOGY_CATALOG).map(([code, item]) => {
                    const classes = getLithologyClasses(code);
                    return (
                      <div
                        key={code}
                        className="flex items-center justify-between gap-3 p-2 rounded-lg bg-navy-900/60 border border-navy-800/80 hover:bg-navy-850/50 transition-colors h-14"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-10 h-7 rounded border border-white/20 flex items-center justify-center text-[10px] font-black tracking-wider flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: item.bg, color: item.text }}
                          >
                            {code}
                          </div>
                          <div className="truncate min-w-0">
                            <div className="text-[10px] font-bold text-slate-400">{code}</div>
                            <div className="text-xs text-slate-200 font-semibold truncate" title={item.name}>{item.name}</div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-[76px] shrink-0 justify-center items-end">
                          {classes.length > 0 ? (
                            classes.map(cls => (
                              <span
                                key={cls}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-center border truncate max-w-[76px] ${getClassPillStyles(cls)}`}
                                title={cls}
                              >
                                {cls}
                              </span>
                            ))
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider text-center border border-slate-800/50 text-slate-500 max-w-[76px] truncate">
                              S/C
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LOGUEO ESTRUCTURAL - FORMA DE JUNTAS */}
            {activeTab === 'structural' && (
              <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-950/45 max-w-2xl mx-auto animate-fade-in">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Logueo Estructural — Forma de Juntas
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clasificación cualitativa, perfil geométrico de juntas y asignación de puntuación estándar
                  </p>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                      <th className="py-2.5 px-3">Forma de Juntas</th>
                      <th className="py-2.5 px-3 text-center">Puntuación</th>
                      <th className="py-2.5 px-3 text-center">Forma Esquemática (Vectorial)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        name: "Plano",
                        pts: 1,
                        svg: (
                          <svg viewBox="0 0 100 30" className="w-24 h-8 stroke-cyan-500 dark:stroke-cyan-400" fill="none">
                            <path d="M 10 20 L 90 10" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )
                      },
                      {
                        name: "Curva",
                        pts: 2,
                        svg: (
                          <svg viewBox="0 0 100 30" className="w-24 h-8 stroke-cyan-500 dark:stroke-cyan-400" fill="none">
                            <path d="M 10 22 Q 50 5 90 10" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )
                      },
                      {
                        name: "Ondulada",
                        pts: 3,
                        svg: (
                          <svg viewBox="0 0 100 30" className="w-24 h-8 stroke-cyan-500 dark:stroke-cyan-400" fill="none">
                            <path d="M 10 22 Q 30 10 50 18 T 90 10" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )
                      },
                      {
                        name: "Escalonada",
                        pts: 4,
                        svg: (
                          <svg viewBox="0 0 100 30" className="w-24 h-8 stroke-cyan-500 dark:stroke-cyan-400" fill="none">
                            <path d="M 10 24 L 35 24 L 35 16 L 65 16 L 65 8 L 90 8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )
                      },
                      {
                        name: "Ambos",
                        pts: 5,
                        customText: "(1+2+3+4)"
                      },
                      {
                        name: "Irregular",
                        pts: 6,
                        svg: (
                          <svg viewBox="0 0 100 30" className="w-24 h-8 stroke-cyan-500 dark:stroke-cyan-400" fill="none">
                            <path d="M 10 22 L 20 16 L 30 20 L 40 12 L 50 16 L 60 8 L 70 12 L 80 6 L 90 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )
                      }
                    ].map(r => (
                      <tr key={r.name} className="border-b border-navy-900 hover:bg-navy-900/10">
                        <td className="py-2.5 px-3 font-semibold text-slate-100">{r.name}</td>
                        <td className="py-2.5 px-3 text-center font-black text-blue-600 dark:text-cyan-400 text-sm">{r.pts}</td>
                        <td className="py-2.5 px-3 flex justify-center items-center h-12">
                          {r.svg ? r.svg : <span className="text-slate-500 font-bold font-mono">{r.customText}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PARAMETROS RMR */}
            {activeTab === 'rmr' && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Resistencia Intacta */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-yellow-500 dark:text-amber-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>Resistencia Uniaxial (ISRM)</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">isrm scale</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2">Código</th>
                          <th className="py-2 px-2">Descripción</th>
                          <th className="py-2 px-2 text-center">Rango (MPa)</th>
                          <th className="py-2 px-2 text-center text-amber-400">Pts RMR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "R6", desc: "Extremadamente Resistente", range: "> 250", pts: 15, col: "text-red-400" },
                          { code: "R5", desc: "Muy Resistente", range: "100 - 250", pts: 12, col: "text-orange-400" },
                          { code: "R4", desc: "Resistente", range: "50 - 100", pts: 7, col: "text-amber-400" },
                          { code: "R3", desc: "Moderadamente Resistente", range: "25 - 50", pts: 4, col: "text-yellow-400" },
                          { code: "R2", desc: "Débil", range: "5 - 25", pts: 2, col: "text-cyan-400" },
                          { code: "R1", desc: "Muy Débil", range: "1 - 5", pts: 1, col: "text-teal-400" },
                          { code: "R0", desc: "Extremadamente Débil", range: "< 1", pts: 0, col: "text-slate-400" }
                        ].map(r => (
                          <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className={`py-2 px-2 font-bold ${r.col}`}>{r.code}</td>
                            <td className="py-2 px-2 text-slate-300">{r.desc}</td>
                            <td className="py-2 px-2 text-center font-medium text-slate-400">{r.range}</td>
                            <td className="py-2 px-2 text-center font-bold text-amber-400">{r.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* RQD % */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>RQD% (R76/R89)</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">quality index</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2">Rango (%)</th>
                          <th className="py-2 px-2">Calidad Geomecánica</th>
                          <th className="py-2 px-2 text-center text-emerald-400">Pts RMR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { range: "90 - 100", desc: "Excelente", pts: 20, col: "text-emerald-400 bg-emerald-500/5" },
                          { range: "75 - 90", desc: "Buena", pts: 17, col: "text-cyan-400 bg-cyan-500/5" },
                          { range: "50 - 75", desc: "Regular", pts: 13, col: "text-amber-400 bg-amber-500/5" },
                          { range: "25 - 50", desc: "Mala", pts: 8, col: "text-orange-400 bg-orange-500/5" },
                          { range: "< 25", desc: "Muy Mala", pts: 3, col: "text-red-400 bg-red-500/5" }
                        ].map(r => (
                          <tr key={r.range} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 font-bold text-slate-100">{r.range}%</td>
                            <td className="py-2 px-2 font-semibold"><span className={`px-2 py-0.5 rounded text-xs ${r.col}`}>{r.desc}</span></td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-400">{r.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-xs text-slate-500 leading-normal pt-1.5 border-t border-navy-900">
                      * Nota: En el sistema reactivo, RQD se evalúa mediante una función continua cúbica suavizada.
                    </div>
                  </div>

                  {/* Espaciamiento */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-cyan-500 dark:text-cyan-400 uppercase tracking-wider border-b border-navy-850 pb-1.5">
                      Espaciamiento de Discontinuidades (Spacing)
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2">Espaciamiento (m)</th>
                          <th className="py-2 px-2">Clasificación de Frecuencia</th>
                          <th className="py-2 px-2 text-center text-cyan-400">Pts RMR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { range: "> 2.0 m", desc: "Muy amplio", pts: 20 },
                          { range: "0.6 - 2.0 m", desc: "Amplio", pts: 15 },
                          { range: "200 - 600 mm", desc: "Moderado", pts: 10 },
                          { range: "60 - 200 mm", desc: "Estrecho", pts: 8 },
                          { range: "< 60 mm", desc: "Muy estrecho", pts: 5 }
                        ].map(r => (
                          <tr key={r.range} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 font-bold text-slate-100">{r.range}</td>
                            <td className="py-2 px-2 text-slate-300">{r.desc}</td>
                            <td className="py-2 px-2 text-center font-bold text-cyan-400">{r.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Agua Subterránea */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>Presencia de Agua Subterránea</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">groundwater</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2">Código</th>
                          <th className="py-2 px-2">Condición del Testigo</th>
                          <th className="py-2 px-2 text-center text-blue-400">R76</th>
                          <th className="py-2 px-2 text-center text-cyan-400">R89</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "CDC", desc: "Completamente seco", r76: 10, r89: 15 },
                          { code: "DPH", desc: "Apenas Húmedo", r76: 7, r89: 10 },
                          { code: "WTM", desc: "Mojado", r76: 7, r89: 7 },
                          { code: "DGE", desc: "Agua bajo presión moderada", r76: 4, r89: 4 },
                          { code: "FGF", desc: "Flujo continuo", r76: 0, r89: 0 }
                        ].map(r => (
                          <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 font-bold text-blue-500 dark:text-cyan-400">{r.code}</td>
                            <td className="py-2 px-2 text-slate-300">{r.desc}</td>
                            <td className="py-2 px-2 text-center font-bold text-slate-400">{r.r76}</td>
                            <td className="py-2 px-2 text-center font-bold text-cyan-400">{r.r89}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Condición de Discontinuidades */}
                <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-950/45">
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest border-b border-navy-850 pb-2">
                    Condición de Discontinuidades / Juntas (Sub-parámetros)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Continuidad */}
                    <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                      <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                        Continuidad / Persistencia
                      </h4>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                            <th className="py-1 px-1">Continuidad</th>
                            <th className="py-1 px-1 text-center text-cyan-400">R89</th>
                            <th className="py-1 px-1 text-center text-yellow-500">R76</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { range: "< 1 m", r89: 6, r76: 5 },
                            { range: "1 - 3 m", r89: 4, r76: 4 },
                            { range: "3 - 10 m", r89: 2, r76: 3 },
                            { range: "10 - 20 m", r89: 1, r76: 1 },
                            { range: "> 20 m", r89: 0, r76: 0 }
                          ].map((r, idx) => (
                            <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                              <td className="py-1.5 px-1 font-semibold text-slate-300">{r.range}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.r89}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-yellow-500">{r.r76}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Abertura */}
                    <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                      <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                        Abertura
                      </h4>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                            <th className="py-1 px-1">Abertura</th>
                            <th className="py-1 px-1 text-center">Rango (mm)</th>
                            <th className="py-1 px-1 text-center text-cyan-400">R89</th>
                            <th className="py-1 px-1 text-center text-yellow-500">R76</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: "Masiva", val: "0", r89: 6, r76: 5 },
                            { name: "Entre Abierta", val: "<0.1", r89: 5, r76: 4 },
                            { name: "Abierta", val: "0.1-1", r89: 3, r76: 3 },
                            { name: "Muy Abierta", val: "1 - 5", r89: 1, r76: 1 },
                            { name: "Extremadamente Abierta", val: ">5", r89: 0, r76: 0 }
                          ].map((r, idx) => (
                            <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                              <td className="py-1.5 px-1 font-semibold text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-1 text-center text-slate-400 font-medium">{r.val}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.r89}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-yellow-500">{r.r76}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Rugosidad */}
                    <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                      <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                        Valoración de Rugosidad
                      </h4>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                            <th className="py-1 px-1">Descripción</th>
                            <th className="py-1 px-1 text-center text-cyan-400">R89</th>
                            <th className="py-1 px-1 text-center text-yellow-500">R76</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: "Muy rugosa", r89: 6, r76: 5 },
                            { name: "Rugosa", r89: 5, r76: 4 },
                            { name: "Lig. Rugosa", r89: 3, r76: 3 },
                            { name: "Suave", r89: 1, r76: 1 },
                            { name: "Pulida", r89: 0, r76: 0 }
                          ].map((r, idx) => (
                            <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                              <td className="py-1.5 px-1 font-semibold text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.r89}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-yellow-500">{r.r76}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Relleno */}
                    <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                      <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                        Valoración de Relleno
                      </h4>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                            <th className="py-1 px-1">Descripción</th>
                            <th className="py-1 px-1 text-center text-cyan-400">R89</th>
                            <th className="py-1 px-1 text-center text-yellow-500">R76</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: "Sin relleno (Ninguno)", r89: 6, r76: 5 },
                            { name: "Relleno duro ≤ 5 mm", r89: 4, r76: 4 },
                            { name: "Relleno duro > 5 mm", r89: 2, r76: 2 },
                            { name: "Relleno blando ≤ 5 mm", r89: 2, r76: 2 },
                            { name: "Relleno blando > 5 mm", r89: 0, r76: 0 }
                          ].map((r, idx) => (
                            <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                              <td className="py-1.5 px-1 font-semibold text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.r89}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-yellow-500">{r.r76}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Meteorización */}
                    <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                      <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                        Valoración de Meteorización
                      </h4>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                            <th className="py-1 px-1 text-center">Código</th>
                            <th className="py-1 px-1">Descripción</th>
                            <th className="py-1 px-1 text-center text-cyan-400">R89</th>
                            <th className="py-1 px-1 text-center text-yellow-500">R76</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { code: "W1", name: "No Meteorizada", r89: 6, r76: 5 },
                            { code: "W2", name: "Ligeramente Met.", r89: 5, r76: 4 },
                            { code: "W3", name: "Moderadamente met.", r89: 3, r76: 3 },
                            { code: "W4", name: "Altamente Met.", r89: 1, r76: 1 },
                            { code: "W5", name: "Descompuesta", r89: 0, r76: 0 }
                          ].map((r, idx) => (
                            <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                              <td className="py-1.5 px-1 text-center font-bold text-red-500">{r.code}</td>
                              <td className="py-1.5 px-1 font-semibold text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.r89}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-yellow-500">{r.r76}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Abertura Simbología */}
                    <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                      <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                        Simbología Logueo Abertura
                      </h4>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                            <th className="py-1 px-1">Abertura</th>
                            <th className="py-1 px-1 text-center">Simbolo</th>
                            <th className="py-1 px-1 text-center text-cyan-400">R89</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: "Nada", sym: 1, val: 6 },
                            { name: "< 0.1 mm", sym: 2, val: 5 },
                            { name: "0.1 - 1.0 mm", sym: 3, val: 4 },
                            { name: "1 - 5 mm", sym: 4, val: 1 },
                            { name: "> 5 mm", sym: 5, val: 0 }
                          ].map((r, idx) => (
                            <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                              <td className="py-1.5 px-1 font-semibold text-slate-300">{r.name}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-indigo-400">{r.sym}</td>
                              <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>

                {/* Tabla Calidad Final */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-navy-850 pb-1.5">
                    Clasificación Final de Macizos Rocosos (Bieniawski)
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-2 px-3">Rango de Puntaje</th>
                        <th className="py-2 px-3 text-center">Clase Verbal</th>
                        <th className="py-2 px-3">Calidad Cualitativa</th>
                        <th className="py-2 px-3">Descripción Geomecánica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { score: "81 – 100", cls: "I", qual: "Muy Buena", col: "text-emerald-400 bg-emerald-500/5 border border-emerald-500/25", desc: "Macizo rocoso extremadamente competente, cohesivo y seco. Altísima estabilidad." },
                        { score: "61 – 80", cls: "II", qual: "Buena", col: "text-cyan-400 bg-cyan-500/5 border border-cyan-500/25", desc: "Roca de buena calidad, bloques bien trabados, juntas cerradas con poca alteración." },
                        { score: "41 – 60", cls: "III", qual: "Regular", col: "text-amber-400 bg-amber-500/5 border border-amber-500/25", desc: "Roca de calidad media, fracturamiento moderado, relleno blando o alteración local." },
                        { score: "21 – 40", cls: "IV", qual: "Mala", col: "text-orange-400 bg-orange-500/5 border border-orange-500/25", desc: "Macizo rocoso fracturado, baja cohesión de juntas, rellenos espesos de arcilla blanda." },
                        { score: "0 – 20", cls: "V", qual: "Muy Mala", col: "text-red-400 bg-red-500/5 border border-red-500/25", desc: "Macizo completamente triturado, descompuesto o bajo flujos de agua severos." }
                      ].map(r => (
                        <tr key={r.cls} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-2.5 px-3 font-bold text-slate-100">{r.score}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">{r.cls}</td>
                          <td className="py-2.5 px-3 font-bold">
                            <span className={`px-2.5 py-0.5 rounded text-xs ${r.col}`}>{r.qual}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* METEORIZACION (ISRM) */}
            {activeTab === 'weathering' && (
              <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-950/45 max-w-3xl mx-auto animate-fade-in">
                <h3 className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-widest border-b border-navy-850 pb-2">
                  Grado de Meteorización e Intemperismo (ISRM)
                </h3>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                      <th className="py-2.5 px-3 text-center">Código</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">RMR'76</th>
                      <th className="py-2.5 px-3 text-center text-cyan-400">RMR'89</th>
                      <th className="py-2.5 px-3">Descripción (Grado de Alteración / Weathering)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "UWF", r76: 5, r89: 6, desc: "Fresca / Inalterada (Unweathered): No se aprecian signos de alteración. La roca no cambia de color." },
                      { code: "SWD", r76: 4, r89: 5, desc: "Débilmente meteorizada (Slightly): Tinción en discontinuidades. Las paredes de junta están alteradas." },
                      { code: "MWM", r76: 3, r89: 3, desc: "Moderadamente meteorizada (Moderately): Menos de la mitad del material está alterado o desintegrado." },
                      { code: "HWA", r76: 1, r89: 1, desc: "Altamente meteorizada (Highly): Más de la mitad de la roca está alterada. Se rompe fácilmente con la mano." },
                      { code: "CWC", r76: 0, r89: 0, desc: "Completamente meteorizada (Completely): Roca desintegrada a suelo pero conserva su estructura original." },
                      { code: "RS", r76: 0, r89: 0, desc: "Suelo Residual (Residual Soil): Estructura original destruida por meteorización. Comportamiento puramente arcilloso." },
                      { code: "-1", r76: -1, r89: -1, desc: "Sin Información: Registro geotécnico no especificado o incompleto." }
                    ].map(r => (
                      <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                        <td className="py-2.5 px-3 text-center font-black text-red-500 dark:text-red-400">{r.code}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{r.r76}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-cyan-400">{r.r89}</td>
                        <td className="py-2.5 px-3 text-slate-300 leading-normal">{r.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TIPOS DE ESTRUCTURAS */}
            {activeTab === 'structures' && (
              <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-950/45 max-w-2xl mx-auto animate-fade-in">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b border-navy-850 pb-2">
                  Tipos de Estructuras Geológicas
                </h3>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                      <th className="py-2.5 px-3">Estructura</th>
                      <th className="py-2.5 px-3 text-center">Código</th>
                      <th className="py-2.5 px-3">Implicancia Geotécnica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: "JN", name: "Junta / Discontinuidad", desc: "Fractura plana natural sin desplazamiento relativo." },
                      { code: "F-10", name: "Fallas < 10.0 cm", desc: "Discontinuidad menor con estrías de falla o panizo fino." },
                      { code: "SZ", name: "Zona de Cizalla", desc: "Banda de roca triturada por esfuerzos cortantes." },
                      { code: "BED", name: "Estratos / Planos Estratificación", desc: "Planos deposicionales sedimentarios." },
                      { code: "VN", name: "Venas / Vetillas", desc: "Fractura rellenada por mineralización posterior secundaria." },
                      { code: "CON", name: "Contacto Litológico", desc: "Límite espacial entre dos unidades rocosas distintas." },
                      { code: "SE", name: "Sin Estructuras", desc: "Roca masiva libre de discontinuidades visibles." },
                      { code: "F+10", name: "Fallas > 10.0 cm", desc: "Plano de movimiento tectónico mayor con brechas de falla." },
                      { code: "RF", name: "Roca Fracturada", desc: "Macizo intensamente quebrado sin orientación particular." },
                      { code: "Dq", name: "Dique", desc: "Intrusión ígnea tabular que corta el macizo encajonante." }
                    ].map(r => (
                      <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                        <td className="py-2.5 px-3 font-semibold text-slate-100">{r.name}</td>
                        <td className="py-2.5 px-3 text-center font-black text-blue-600 dark:text-cyan-400">{r.code}</td>
                        <td className="py-2.5 px-3 text-slate-400">{r.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TIPOS DE RELLENO */}
            {activeTab === 'filling' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* RMR Ranges */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45 max-w-2xl mx-auto">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-navy-850 pb-1.5">
                    Valoración de Relleno de Juntas (RMR'76 y RMR'89)
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-2 px-2 text-center text-amber-400">RMR_76</th>
                        <th className="py-2 px-2 text-center text-cyan-400">RMR_89</th>
                        <th className="py-2 px-2">Descripción del Relleno de Junta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { r76: 5, r89: 6, desc: "Sin relleno (Ninguno)", col: "text-cyan-400 bg-blue-500/5" },
                        { r76: 4, r89: 4, desc: "Relleno duro ≤ 5 mm", col: "text-emerald-400 bg-emerald-500/5" },
                        { r76: 3, r89: 2, desc: "Relleno duro > 5 mm", col: "text-emerald-500 bg-emerald-500/5" },
                        { r76: 2, r89: 2, desc: "Relleno blando ≤ 5 mm", col: "text-amber-400 bg-amber-500/5" },
                        { r76: 0, r89: 0, desc: "Relleno blando > 5 mm", col: "text-red-400 bg-red-500/5" }
                      ].map((r, idx) => (
                        <tr key={idx} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-2 px-2 text-center font-bold text-slate-400">{r.r76}</td>
                          <td className="py-2 px-2 text-center font-bold text-cyan-400">{r.r89}</td>
                          <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded ${r.col}`}>{r.desc}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Minerals Lookup */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                    <span>Minerales de Relleno Comunes y Clasificación</span>
                    <span className="text-xs text-slate-500 font-semibold lowercase">mineral lookup</span>
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-2 px-2">Mineral</th>
                        <th className="py-2 px-2">Código</th>
                        <th className="py-2 px-2 text-center">Clasificación Dureza</th>
                        <th className="py-2 px-2 text-center text-cyan-400">R76 (e &lt; 5mm)</th>
                        <th className="py-2 px-2 text-center text-cyan-400">R76 (e &gt; 5mm)</th>
                        <th className="py-2 px-2 text-center text-emerald-400">R89 (e &lt; 5mm)</th>
                        <th className="py-2 px-2 text-center text-emerald-400">R89 (e &gt; 5mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "ca", name: "Calcita", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "sand", name: "Arena", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "ch", name: "Clorita", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "cl", name: "Arcilla", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "gy", name: "Yeso", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "RXF", name: "Roca triturada", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "GOU", name: "Panizo (Gouge)", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "PAT", name: "Patinas / Recubrimientos", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400" },
                        { code: "FBX", name: "Brecha de falla", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400" },
                        { code: "SIO", name: "Silicatos", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400" },
                        { code: "QZ", name: "Cuarzo", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400" },
                        { code: "SU", name: "Sulfuros", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400" },
                        { code: "OX", name: "Óxido de cobre", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400" },
                        { code: "ep", name: "Epidota", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400" },
                        { code: "cwf", name: "Limpia, sin relleno", type: "Sin relleno", cls: 3, r76: 5, r76_gt: 5, r89: 6, r89_gt: 6, col: "text-blue-400" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-2 px-2 font-semibold text-slate-100">{r.name}</td>
                          <td className="py-2 px-2 font-bold text-slate-400 text-center">{r.code}</td>
                          <td className="py-2 px-2 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${r.col} bg-navy-900/60`}>{r.type} (Clase {r.cls})</span></td>
                          <td className="py-2 px-2 text-center text-slate-300">{r.r76}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{r.r76_gt}</td>
                          <td className="py-2 px-2 text-center text-cyan-400">{r.r89}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{r.r89_gt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PERFILES DE RUGOSIDAD */}
            {activeTab === 'jrc' && (
              <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 bg-navy-950/45 max-w-4xl mx-auto animate-fade-in">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Perfiles de Rugosidad (JRC10 vs. ISRM 1989)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Relación geométrica y visual entre los valores Barton de JRC10 y los perfiles morfológicos típicos de la ISRM
                  </p>
                </div>

                <div className="relative border border-navy-800 rounded-lg overflow-hidden bg-navy-950 p-2">
                  <img
                    src="/catalog/image_1780069072578.png"
                    alt="Perfiles de rugosidad JRC10 e ISRM 1989"
                    className="w-full h-auto max-h-[350px] object-contain mx-auto"
                    onError={(e) => {
                      console.warn("La imagen del catálogo de JRC no se cargó correctamente");
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* JRC10 ranges */}
                  <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                    <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                      Valores de JRC10 (Barton, 1977)
                    </h4>
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-1 px-1 text-center w-24">Rango JRC10</th>
                          <th className="py-1 px-1">Descripción Morfológica</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { range: "0 – 2", desc: "Plana, completamente pulida / lisa" },
                          { range: "2 – 4", desc: "Plana, lisa" },
                          { range: "4 – 6", desc: "Plana, ligeramente ondulada" },
                          { range: "6 – 8", desc: "Ondulada, lisa" },
                          { range: "8 – 10", desc: "Ondulada, rugosa" },
                          { range: "10 – 12", desc: "Fuertemente ondulada, rugosa" },
                          { range: "12 – 14", desc: "Escalonada, lisa" },
                          { range: "14 – 16", desc: "Escalonada, ligeramente rugosa" },
                          { range: "16 – 18", desc: "Escalonada, moderadamente rugosa" },
                          { range: "18 – 20", desc: "Escalonada, extremadamente rugosa" }
                        ].map((r, idx) => (
                          <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                            <td className="py-1.5 px-1 text-center font-bold text-cyan-400">{r.range}</td>
                            <td className="py-1.5 px-1 text-slate-300 font-medium">{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ISRM Profiles */}
                  <div className="space-y-1.5 bg-navy-900/25 p-3 rounded-lg border border-navy-800/60">
                    <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider border-b border-navy-800 pb-1 block">
                      Perfiles de Rugosidad Típicos (ISRM, 1989)
                    </h4>
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-1 px-1 text-center w-16">ID Perfil</th>
                          <th className="py-1 px-1">Morfología de la Discontinuidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { id: 1, es: "Rugosa y escalonada", en: "Rough stepped" },
                          { id: 2, es: "Suave y escalonada", en: "Smooth stepped" },
                          { id: 3, es: "Estriada y escalonada", en: "Slickensided stepped" },
                          { id: 4, es: "Rugosa y ondulada", en: "Rough undulating" },
                          { id: 5, es: "Suave y ondulada", en: "Smooth undulating" },
                          { id: 6, es: "Estriada y ondulada", en: "Slickensided undulating" },
                          { id: 7, es: "Rugosa y plana", en: "Rough planar" },
                          { id: 8, es: "Suave y plana", en: "Smooth planar" },
                          { id: 9, es: "Estriada y plana", en: "Slickensided planar" }
                        ].map(r => (
                          <tr key={r.id} className="border-b border-navy-900/50 hover:bg-navy-900/10">
                            <td className="py-1.5 px-1 text-center font-bold text-blue-500 dark:text-cyan-400">{r.id}</td>
                            <td className="py-1.5 px-1 text-slate-300">
                              <span className="font-semibold text-slate-200">{r.es}</span>{" "}
                              <span className="text-slate-500 italic">({r.en})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            )}

            {/* PLT REFERENCIAS */}
            {activeTab === 'plt' && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Test type */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>Tipo de Ensayo PLT</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">test type</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2 text-center w-[100px]">Abreviatura</th>
                          <th className="py-2 px-2">Tipo de ensayo PLT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "D", name: "Diametral" },
                          { code: "A", name: "Axial" },
                          { code: "B", name: "Bloques" },
                          { code: "I", name: "Irregular" }
                        ].map(r => (
                          <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 text-center font-black text-cyan-400">{r.code}</td>
                            <td className="py-2 px-2 text-slate-300">{r.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Hole diameter */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>Diámetro de Perforación</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">drill diameter</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2 text-center w-[100px]">Abreviatura</th>
                          <th className="py-2 px-2 text-center">Diámetro nominal (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "BQ", val: "36.5" },
                          { code: "NQ", val: "47.6" },
                          { code: "HQ", val: "61.1" },
                          { code: "PQ", val: "85.0" }
                        ].map(r => (
                          <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 text-center font-black text-blue-400">{r.code}</td>
                            <td className="py-2 px-2 text-center font-bold text-slate-300">{r.val} mm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Failure modes */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>Tipo de Rotura</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">failure mode</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2 text-center w-[100px]">Abreviatura</th>
                          <th className="py-2 px-2">Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "M", desc: "Rotura por matriz (Si la muestra no se rompe no se considera M)" },
                          { code: "E", desc: "Rotura por estructura" },
                          { code: "C", desc: "Rotura combinada" }
                        ].map(r => (
                          <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 text-center font-black text-amber-400">{r.code}</td>
                            <td className="py-2 px-2 text-slate-300 leading-normal">{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Failure direction */}
                  <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                      <span>Dirección de Rotura</span>
                      <span className="text-xs text-slate-500 font-semibold lowercase">failure direction</span>
                    </h3>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                          <th className="py-2 px-2 text-center w-[100px]">Abreviatura</th>
                          <th className="py-2 px-2">Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: "Pa", desc: "Paralela a los planos de debilidad (estratificación, foliación)" },
                          { code: "Pe", desc: "Perpendicular a los planos de debilidad (estratificación, foliación)" },
                          { code: "NA", desc: "No aplica (rocas masivas sin planos de debilidad)" }
                        ].map(r => (
                          <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-2 text-center font-black text-purple-400">{r.code}</td>
                            <td className="py-2 px-2 text-slate-300 leading-normal">{r.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* UCS classification */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                    <span>Clasificación ISRM (Basado en UCS)</span>
                    <span className="text-xs text-slate-500 font-semibold lowercase">isrm rock strength class</span>
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-2 px-3 text-center">Índice ISRM</th>
                        <th className="py-2 px-3 text-center">UCS (MPa)</th>
                        <th className="py-2 px-3">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "Suelo", range: "<= 0.25", desc: "Material tipo suelo, sin comportamiento de roca competente." },
                        { code: "R0", range: "> 0.25 y <= 1.0", desc: "Roca extremadamente débil (Extremely Weak Rock)." },
                        { code: "R1", range: "> 1.0 y <= 5.0", desc: "Roca muy débil (Very Weak Rock)." },
                        { code: "R2", range: "> 5.0 y <= 25.0", desc: "Roca débil (Weak Rock)." },
                        { code: "R3", range: "> 25.0 y <= 50.0", desc: "Roca moderadamente resistente (Moderately Strong Rock)." },
                        { code: "R4", range: "> 50.0 y <= 100.0", desc: "Roca resistente (Strong Rock)." },
                        { code: "R5", range: "> 100.0 y <= 250.0", desc: "Roca muy resistente (Very Strong Rock)." },
                        { code: "R6", range: "> 250.0", desc: "Roca extremadamente resistente (Extremely Strong Rock)." }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-2 px-3 text-center font-black text-emerald-400">{r.code}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-300">{r.range}</td>
                          <td className="py-2 px-3 text-slate-400 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Lithology K factor lookup */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-navy-850 pb-1.5 flex justify-between">
                    <span>Tabla de Litología y Factor K</span>
                    <span className="text-xs text-slate-500 font-semibold lowercase">lithology factor k lookup</span>
                  </h3>
                  <div className="max-h-[300px] overflow-y-auto pr-1">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-navy-950 z-10 border-b border-navy-850">
                        <tr className="text-slate-500 font-bold uppercase bg-navy-950">
                          <th className="py-2 px-3">Clase</th>
                          <th className="py-2 px-3">Litología 1</th>
                          <th className="py-2 px-3">Litología 2</th>
                          <th className="py-2 px-3">Litología 3</th>
                          <th className="py-2 px-3 text-center text-cyan-400">Factor K</th>
                        </tr>
                      </thead>
                      <tbody>
                        {LITHOLOGY_K_REFERENCES.map((r, idx) => (
                          <tr key={idx} className="border-b border-navy-900 hover:bg-navy-900/10">
                            <td className="py-2 px-3 text-slate-300 font-bold">{r.clase}</td>
                            <td className="py-2 px-3 text-slate-400 font-semibold">{r.lito1}</td>
                            <td className="py-2 px-3 text-slate-400">{r.lito2}</td>
                            <td className="py-2 px-3 text-slate-400">{r.lito3}</td>
                            <td className="py-2 px-3 text-center text-cyan-400 font-bold">{r.k}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-navy-800 text-xs text-slate-500 text-center bg-navy-900/20 shrink-0">
          Usa los perfiles JRC, la forma de juntas y las clases de intemperismo para estimar los coeficientes geomecánicos de Bieniawski.
        </div>

      </div>
    </div>
  );
}