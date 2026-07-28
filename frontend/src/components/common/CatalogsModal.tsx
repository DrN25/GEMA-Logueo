import { useState } from 'react';
import { 
  X, BookOpen, Layers, Hammer, ShieldAlert, 
  Sparkles, Palette, FileSpreadsheet, Compass,
  Droplets, Activity, Gauge, CheckCircle2, ChevronRight
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
      return "bg-violet-500/10 text-violet-400 border-violet-500/25";
    case "Sedimentarias":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    case "Metamórficas":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "Brechas":
      return "bg-pink-500/10 text-pink-400 border-pink-500/25";
    case "Endoskarn":
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/25";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/25";
  }
}

function getClassRowBgStyles(clase: string): string {
  switch (clase) {
    case "Intrusivas":
      return "bg-violet-500/5 hover:bg-violet-500/10";
    case "Sedimentarias":
      return "bg-amber-500/5 hover:bg-amber-500/10";
    case "Metamórficas":
      return "bg-emerald-500/5 hover:bg-emerald-500/10";
    case "Brechas":
      return "bg-pink-500/5 hover:bg-pink-500/10";
    case "Endoskarn":
      return "bg-cyan-500/5 hover:bg-cyan-500/10";
    default:
      return "hover:bg-cyan-500/5";
  }
}

interface CatalogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CatalogsModal({ isOpen, onClose }: CatalogsModalProps) {
  const [activeTab, setActiveTab] = useState<string>('lithology');

  if (!isOpen) return null;

  // Categorías sin números y sin puntos cian
  const groups = [
    {
      title: 'LITOLOGÍA',
      items: [
        { id: 'lithology', label: 'Litología y Códigos de Colores', icon: Palette },
        { id: 'lito_factor_k', label: 'Litología y Factor K (PLT)', icon: FileSpreadsheet }
      ]
    },
    {
      title: 'DISCONTINUIDADES Y ESTRUCTURAS',
      items: [
        { id: 'struct_forma', label: 'Forma de Juntas (Perfiles Vectoriales)', icon: Compass },
        { id: 'struct_rugosidad', label: 'Perfiles de Rugosidad (ISRM 1-9 & JRC10)', icon: Sparkles },
        { id: 'struct_relleno', label: 'Tipos de Relleno y Clasificación', icon: Hammer },
        { id: 'struct_weathering', label: 'Grados de Meteorización (ISRM)', icon: ShieldAlert },
        { id: 'struct_estructuras', label: 'Tipos de Estructuras Geológicas', icon: Layers }
      ]
    },
    {
      title: 'PARÁMETROS RMR (BIENIAWSKI)',
      items: [
        { id: 'rmr_resistencia', label: 'Resistencia Uniaxial (ISRM)', icon: Activity },
        { id: 'rmr_rqd', label: 'Valoración RQD%', icon: Gauge },
        { id: 'rmr_espaciamiento', label: 'Espaciamiento de Discontinuidades', icon: BookOpen },
        { id: 'rmr_agua', label: 'Presencia de Agua Subterránea', icon: Droplets },
        { id: 'rmr_calidad', label: 'Clasificación Final de Macizos Rocosos', icon: CheckCircle2 }
      ]
    },
    {
      title: 'ENSAYOS PLT (CARGA PUNTUAL)',
      items: [
        { id: 'plt_tipo_ensayo', label: 'Tipos de Ensayo PLT', icon: FileSpreadsheet },
        { id: 'plt_diametro', label: 'Diámetros de Perforación', icon: FileSpreadsheet },
        { id: 'plt_rotura_tipo', label: 'Tipos de Rotura (Matriz/Estructura)', icon: ShieldAlert },
        { id: 'plt_rotura_dir', label: 'Dirección de Rotura (Pa/Pe/NA)', icon: Compass },
        { id: 'plt_ucs', label: 'Clasificación ISRM basada en UCS', icon: Activity }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm select-none p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-7xl h-[88vh] rounded-2xl border border-navy-800 flex flex-col overflow-hidden shadow-2xl text-slate-300 bg-[#090f1d]/95">

        {/* Modal Header */}
        <div className="p-5 border-b border-navy-800 flex items-center justify-between bg-navy-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">
                Catálogos Geomecánicos de Referencia
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Estándares corporativos y tablas normativas de clasificación Bieniawski (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">RMR76</span> / <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">RMR89</span>) e ISRM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-slate-100 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-navy-700/60 active:scale-95"
          >
            <X size={15} />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Categorical Sidebar */}
          <div className="w-64 border-r border-navy-800 bg-navy-950/60 p-4 space-y-5 overflow-y-auto shrink-0 select-none scrollbar-thin">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1.5">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
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
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left group ${
                          isActive
                            ? 'bg-cyan-500/15 text-cyan-300 font-black border-l-2 border-cyan-400 shadow-sm'
                            : 'bg-transparent text-slate-400 hover:bg-navy-900/50 hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon size={14} className={isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'} />
                          <span className="truncate">{t.label}</span>
                        </div>
                        {isActive && <ChevronRight size={12} className="text-cyan-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Viewport Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#090f1d]/40 scrollbar-thin">
            
            {/* 1.1 LITOLOGIA Y COLORES */}
            {activeTab === 'lithology' && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Catálogo de Litologías y Códigos de Colores
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mapeo visual de abreviaturas litológicas, colores corporativos y clasificación geomecánica
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(LITHOLOGY_CATALOG).map(([code, item]) => {
                    const classes = getLithologyClasses(code);
                    return (
                      <div
                        key={code}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-navy-900/60 border border-navy-800 hover:bg-navy-850/50 transition-colors h-14"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-7 rounded-md border border-white/20 flex items-center justify-center text-[10px] font-black tracking-wider shrink-0 shadow-sm"
                            style={{ backgroundColor: item.bg, color: item.text }}
                          >
                            {code}
                          </div>
                          <div className="truncate min-w-0">
                            <div className="text-[10px] font-bold text-slate-400">{code}</div>
                            <div className="text-xs text-slate-200 font-semibold truncate" title={item.name}>{item.name}</div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 shrink-0 items-end">
                          {classes.length > 0 ? (
                            classes.map(cls => (
                              <span
                                key={cls}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border truncate ${getClassPillStyles(cls)}`}
                                title={cls}
                              >
                                {cls}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-medium uppercase border border-navy-800 text-slate-500">
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

            {/* 1.2 LITOLOGIA Y FACTOR K (PLT) */}
            {activeTab === 'lito_factor_k' && (
              <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                    <span>Matriz de Litología y Factor K de Corrección PLT</span>
                    <span className="text-xs text-cyan-400 font-mono font-bold">cat.FactorK_PLT</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tabla oficial de conversión y calibración del Factor K según combinaciones litológicas (Lito 1, Lito 2, Lito 3)
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60">Clase Geomecánica</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Lito 1</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Lito 2</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Lito 3</th>
                        <th className="py-3 px-4 text-center text-cyan-400">Factor K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LITHOLOGY_K_REFERENCES.map((r, idx) => (
                        <tr key={idx} className={`border-b border-navy-800/40 transition-colors ${getClassRowBgStyles(r.clase)}`}>
                          <td className="py-2.5 px-4 border-r border-navy-800/50">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase ${getClassPillStyles(r.clase)}`}>
                              {r.clase}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-slate-200 font-bold">{r.lito1}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-slate-400 font-medium">{r.lito2}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-slate-400 font-medium">{r.lito3}</td>
                          <td className="py-2.5 px-4 text-center text-cyan-400 font-black text-sm">{r.k.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2.1 FORMA DE JUNTAS (VECTORIAL) */}
            {activeTab === 'struct_forma' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Logueo Estructural — Forma de Juntas
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Clasificación cualitativa, perfil geométrico de juntas y asignación de puntuación estándar
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60">Forma de Juntas</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center">Puntuación</th>
                        <th className="py-3 px-4 text-center">Forma Esquemática (Vectorial)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          name: "Plano",
                          pts: 1,
                          svg: (
                            <svg viewBox="0 0 100 30" className="w-28 h-7 stroke-cyan-400" fill="none">
                              <path d="M 10 20 L 90 10" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                          )
                        },
                        {
                          name: "Curva",
                          pts: 2,
                          svg: (
                            <svg viewBox="0 0 100 30" className="w-28 h-7 stroke-cyan-400" fill="none">
                              <path d="M 10 22 Q 50 5 90 10" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                          )
                        },
                        {
                          name: "Ondulada",
                          pts: 3,
                          svg: (
                            <svg viewBox="0 0 100 30" className="w-28 h-7 stroke-cyan-400" fill="none">
                              <path d="M 10 22 Q 30 10 50 18 T 90 10" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                          )
                        },
                        {
                          name: "Escalonada",
                          pts: 4,
                          svg: (
                            <svg viewBox="0 0 100 30" className="w-28 h-7 stroke-cyan-400" fill="none">
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
                            <svg viewBox="0 0 100 30" className="w-28 h-7 stroke-cyan-400" fill="none">
                              <path d="M 10 22 L 20 16 L 30 20 L 40 12 L 50 16 L 60 8 L 70 12 L 80 6 L 90 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )
                        }
                      ].map(r => (
                        <tr key={r.name} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 font-bold text-slate-100">{r.name}</td>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-cyan-400 text-sm">{r.pts}</td>
                          <td className="py-3 px-4 flex justify-center items-center h-12">
                            {r.svg ? r.svg : <span className="text-slate-400 font-bold font-mono">{r.customText}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2.2 PERFILES DE RUGOSIDAD (ISRM 1-9 & JRC10) */}
            {activeTab === 'struct_rugosidad' && (
              <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Perfiles de Rugosidad (ISRM 1-9 & Barton JRC10)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Valores normativos de rugosidad para cálculo de <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">RMR'76</span> y <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">RMR'89</span> (según Reglas.md)
                  </p>
                </div>

                {/* Tabla de Rugosidad ISRM 1 a 9 desde Reglas.md con columnas teñidas sutiles */}
                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg space-y-2">
                  <div className="px-4 pt-3 pb-1 text-xs font-black text-cyan-400 uppercase tracking-wider border-b border-navy-800 flex justify-between items-center">
                    <span>Tabla de Rugosidad (ISRM) — Reglas.md</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">R76</span> (Ámbar Sutil) vs <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">R89</span> (Fucsia Sutil)
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-2.5 px-4 border-r border-navy-800/60 text-center w-20">Código</th>
                        <th className="py-2.5 px-4 border-r border-navy-800/60">Roughness & Shape (ISRM)</th>
                        <th className="py-2.5 px-4 border-r border-navy-800/60 text-center text-amber-400 bg-amber-950/20">Val_RMR76</th>
                        <th className="py-2.5 px-4 text-center text-fuchsia-400 bg-fuchsia-950/20">Val_RMR89</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: 1, name: "Rugosa y Escalonada", r76: 5, r89: 6 },
                        { code: 2, name: "Suave y Escalonada", r76: 4, r89: 5 },
                        { code: 3, name: "Estriada y Escalonada", r76: 3, r89: 3 },
                        { code: 4, name: "Rugosa y Ondulada", r76: 4, r89: 5 },
                        { code: 5, name: "Suave y Ondulada", r76: 3, r89: 3 },
                        { code: 6, name: "Estriada y Ondulada", r76: 1, r89: 1 },
                        { code: 7, name: "Rugosa y Plana", r76: 3, r89: 3 },
                        { code: 8, name: "Suave y Plana", r76: 1, r89: 1 },
                        { code: 9, name: "Estriada y Plana", r76: 0, r89: 0 },
                        { code: -1, name: "Sin Información / Incompleto", r76: 0, r89: 0 }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-2 px-4 border-r border-navy-800/50 text-center font-black text-cyan-400">{r.code}</td>
                          <td className="py-2 px-4 border-r border-navy-800/50 text-slate-200 font-medium">{r.name}</td>
                          <td className="py-2 px-4 border-r border-navy-800/50 text-center font-black text-amber-400 bg-amber-500/5">{r.r76}</td>
                          <td className="py-2 px-4 text-center font-black text-fuchsia-400 bg-fuchsia-500/5">{r.r89}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Perfil Visual JRC10 */}
                <div className="bg-navy-900/40 border border-navy-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Perfiles de Rugosidad JRC10 (Barton, 1977)
                  </h4>
                  <div className="border border-navy-800 rounded-lg overflow-hidden bg-navy-950 p-2">
                    <img
                      src="/catalog/image_1780069072578.png"
                      alt="Perfiles de rugosidad JRC10 e ISRM 1989"
                      className="w-full h-auto max-h-[300px] object-contain mx-auto"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2.3 TIPOS DE RELLENO Y CLASIFICACION */}
            {activeTab === 'struct_relleno' && (
              <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Tipos de Relleno y Clasificación RMR
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mapeo de minerales, clase de dureza y sub-ratings para <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">RMR76</span> y <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">RMR89</span>
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60">Tipo de Relleno</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center">Código</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center">Clasificación Dureza</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center text-amber-400 bg-amber-950/20">R76 (&lt; 5mm)</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center text-amber-400 bg-amber-950/20">R76 (&gt; 5mm)</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center text-fuchsia-400 bg-fuchsia-950/20">R89 (&lt; 5mm)</th>
                        <th className="py-3 px-4 text-center text-fuchsia-400 bg-fuchsia-950/20">R89 (&gt; 5mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "ca", name: "Calcita", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "sand", name: "Arena", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "ch", name: "Clorita", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "cl", name: "Arcilla", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "gy", name: "Yeso", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "RXF", name: "Roca triturada", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "GOU", name: "Panizo (Gouge)", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "PAT", name: "Patinas / Recubrimientos", type: "Blando", cls: 1, r76: 2, r76_gt: 2, r89: 2, r89_gt: 2, col: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                        { code: "FBX", name: "Brecha de falla", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "SIO", name: "Silicatos", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "QZ", name: "Cuarzo", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "SU", name: "Sulfuros", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "OX", name: "Óxido de cobre", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "ep", name: "Epidota", type: "Duro", cls: 2, r76: 4, r76_gt: 2, r89: 4, r89_gt: 2, col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "cwf", name: "Limpia, sin relleno", type: "Sin relleno", cls: 3, r76: 5, r76_gt: 5, r89: 6, r89_gt: 6, col: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-2.5 px-4 border-r border-navy-800/50 font-bold text-slate-100">{r.name}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center font-mono font-bold text-slate-400">{r.code}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase ${r.col}`}>
                              {r.type} (Clase {r.cls})
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center text-amber-400 font-bold bg-amber-500/5">{r.r76}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center text-amber-500/70 bg-amber-500/5">{r.r76_gt}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center text-fuchsia-400 font-bold bg-fuchsia-500/5">{r.r89}</td>
                          <td className="py-2.5 px-4 text-center text-fuchsia-500/70 bg-fuchsia-500/5">{r.r89_gt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2.4 GRADOS DE METEORIZACION (ISRM) */}
            {activeTab === 'struct_weathering' && (
              <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Grado de Meteorización e Intemperismo (ISRM)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gradiente cualitativo de alteración y su correspondiente sub-rating en <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">RMR'76</span> y <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">RMR'89</span>
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-24">Código</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center text-amber-400 bg-amber-950/20 w-20">RMR'76</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center text-fuchsia-400 bg-fuchsia-950/20 w-20">RMR'89</th>
                        <th className="py-3 px-4">Descripción (Grado de Alteración / Weathering)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "UWF", r76: 5, r89: 6, desc: "Fresca / Inalterada (Unweathered): No se aprecian signos de alteración. La roca no cambia de color.", badge: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "SWD", r76: 4, r89: 5, desc: "Débilmente meteorizada (Slightly): Tinción en discontinuidades. Las paredes de junta están alteradas.", badge: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
                        { code: "MWM", r76: 3, r89: 3, desc: "Moderadamente meteorizada (Moderately): Menos de la mitad del material está alterado o desintegrado.", badge: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
                        { code: "HWA", r76: 1, r89: 1, desc: "Altamente meteorizada (Highly): Más de la mitad de la roca está alterada. Se rompe fácilmente con la mano.", badge: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
                        { code: "CWC", r76: 0, r89: 0, desc: "Completamente meteorizada (Completely): Roca desintegrada a suelo pero conserva su estructura original.", badge: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
                        { code: "RS", r76: 0, r89: 0, desc: "Suelo Residual (Residual Soil): Estructura original destruida por meteorización. Comportamiento puramente arcilloso.", badge: "text-rose-500 border-rose-600/30 bg-rose-600/10" },
                        { code: "-1", r76: -1, r89: -1, desc: "Sin Información: Registro geotécnico no especificado o incompleto.", badge: "text-slate-400 border-navy-700 bg-navy-900" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${r.badge}`}>
                              {r.code}
                            </span>
                          </td>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-amber-400 bg-amber-500/5">{r.r76}</td>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-fuchsia-400 bg-fuchsia-500/5">{r.r89}</td>
                          <td className="py-3 px-4 text-slate-300 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2.5 TIPOS DE ESTRUCTURAS GEOLOGICAS */}
            {activeTab === 'struct_estructuras' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Tipos de Estructuras Geológicas
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Diccionario oficial de estructuras mapeadas en sondajes y logueo orientado
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-24">Código</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Nombre de la Estructura</th>
                        <th className="py-3 px-4">Implicancia Geotécnica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "JN", name: "Junta / Discontinuidad", badge: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10", desc: "Fractura plana natural sin desplazamiento relativo." },
                        { code: "F-10", name: "Fallas < 10.0 cm", badge: "text-orange-400 border-orange-500/30 bg-orange-500/10", desc: "Discontinuidad menor con estrías de falla o panizo fino." },
                        { code: "SZ", name: "Zona de Cizalla", badge: "text-rose-400 border-rose-500/30 bg-rose-500/10", desc: "Banda de roca triturada por esfuerzos cortantes." },
                        { code: "BED", name: "Estratos / Planos Estratificación", badge: "text-amber-400 border-amber-500/30 bg-amber-500/10", desc: "Planos deposicionales sedimentarios." },
                        { code: "VN", name: "Venas / Vetillas", badge: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", desc: "Fractura rellenada por mineralización posterior secundaria." },
                        { code: "CON", name: "Contacto Litológico", badge: "text-violet-400 border-violet-500/30 bg-violet-500/10", desc: "Límite espacial entre dos unidades rocosas distintas." },
                        { code: "SE", name: "Sin Estructuras", badge: "text-slate-400 border-slate-600/30 bg-slate-700/10", desc: "Roca masiva libre de discontinuidades visibles." },
                        { code: "F+10", name: "Fallas > 10.0 cm", badge: "text-rose-500 border-rose-600/40 bg-rose-600/15", desc: "Plano de movimiento tectónico mayor con brechas de falla." },
                        { code: "RF", name: "Roca Fracturada", badge: "text-pink-400 border-pink-500/30 bg-pink-500/10", desc: "Macizo intensamente quebrado sin orientación particular." },
                        { code: "Dq", name: "Dique", badge: "text-purple-400 border-purple-500/30 bg-purple-500/10", desc: "Intrusión ígnea tabular que corta el macizo encajonante." }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center font-black font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${r.badge}`}>
                              {r.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 font-bold text-slate-100">{r.name}</td>
                          <td className="py-2.5 px-4 text-slate-300">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3.1 RESISTENCIA UNIAXIAL (ISRM) */}
            {activeTab === 'rmr_resistencia' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Resistencia Uniaxial de la Roca Intacta (ISRM)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gradiente cromático de resistencia ISRM (R0 a R6) y su asignación de puntaje RMR
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-24">Código</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Descripción ISRM</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center">Rango UCS (MPa)</th>
                        <th className="py-3 px-4 text-center text-cyan-400">Puntaje RMR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "R6", desc: "Extremadamente Resistente", range: "> 250", pts: 15, rowBg: "bg-emerald-500/5 hover:bg-emerald-500/10", col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { code: "R5", desc: "Muy Resistente", range: "100 - 250", pts: 12, rowBg: "bg-teal-500/5 hover:bg-teal-500/10", col: "text-teal-400 border-teal-500/30 bg-teal-500/10" },
                        { code: "R4", desc: "Resistente", range: "50 - 100", pts: 7, rowBg: "bg-cyan-500/5 hover:bg-cyan-500/10", col: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
                        { code: "R3", desc: "Moderadamente Resistente", range: "25 - 50", pts: 4, rowBg: "bg-yellow-500/5 hover:bg-yellow-500/10", col: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
                        { code: "R2", desc: "Débil", range: "5 - 25", pts: 2, rowBg: "bg-orange-500/5 hover:bg-orange-500/10", col: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
                        { code: "R1", desc: "Muy Débil", range: "1 - 5", pts: 1, rowBg: "bg-rose-500/5 hover:bg-rose-500/10", col: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
                        { code: "R0", desc: "Extremadamente Débil", range: "< 1", pts: 0, rowBg: "bg-rose-500/10 hover:bg-rose-500/15", col: "text-rose-500 border-rose-600/30 bg-rose-600/10" }
                      ].map(r => (
                        <tr key={r.code} className={`border-b border-navy-800/40 transition-colors ${r.rowBg}`}>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${r.col}`}>
                              {r.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-slate-200 font-medium">{r.desc}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center font-mono text-slate-400">{r.range}</td>
                          <td className="py-2.5 px-4 text-center font-black text-cyan-400 text-sm">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3.2 VALORACION RQD% */}
            {activeTab === 'rmr_rqd' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Valoración del Índice RQD% (Bieniawski)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Puntuación geomecánica por calidad de testigo y ecuación polinómica continua reactiva
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60">Rango RQD (%)</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Calidad Cualitativa</th>
                        <th className="py-3 px-4 text-center text-cyan-400">Puntaje RMR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { range: "90% – 100%", desc: "Excelente", pts: 20, rowBg: "bg-emerald-500/5 hover:bg-emerald-500/10", col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { range: "75% – 90%", desc: "Buena", pts: 17, rowBg: "bg-cyan-500/5 hover:bg-cyan-500/10", col: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
                        { range: "50% – 75%", desc: "Regular", pts: 13, rowBg: "bg-yellow-500/5 hover:bg-yellow-500/10", col: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
                        { range: "25% – 50%", desc: "Mala", pts: 8, rowBg: "bg-orange-500/5 hover:bg-orange-500/10", col: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
                        { range: "< 25%", desc: "Muy Mala", pts: 3, rowBg: "bg-rose-500/5 hover:bg-rose-500/10", col: "text-rose-400 border-rose-500/30 bg-rose-500/10" }
                      ].map(r => (
                        <tr key={r.range} className={`border-b border-navy-800/40 transition-colors ${r.rowBg}`}>
                          <td className="py-3 px-4 border-r border-navy-800/50 font-black text-slate-100">{r.range}</td>
                          <td className="py-3 px-4 border-r border-navy-800/50">
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${r.col}`}>
                              {r.desc}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-black text-cyan-400 text-sm">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-navy-900/30 border border-navy-800 rounded-xl text-xs text-slate-400 space-y-1">
                  <span className="font-bold text-cyan-400 block uppercase">Ecuación Reactiva Continua (RQD Rating):</span>
                  <code className="text-cyan-300 font-mono text-[11px] block bg-navy-950 p-2 rounded border border-navy-800">
                    Rating = ROUND(-0.000006 * RQD³ + 0.0015 * RQD² + 0.0806 * RQD + 3.0282, 0)
                  </code>
                </div>
              </div>
            )}

            {/* 3.3 ESPACIAMIENTO DE DISCONTINUIDADES */}
            {activeTab === 'rmr_espaciamiento' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Espaciamiento de Discontinuidades (Spacing)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Separación media entre juntas naturales y su asignación de puntaje RMR
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60">Espaciamiento (m / mm)</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Frecuencia Geomecánica</th>
                        <th className="py-3 px-4 text-center text-cyan-400">Puntaje RMR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { range: "> 2.0 m", desc: "Muy amplio", pts: 20 },
                        { range: "0.6 – 2.0 m", desc: "Amplio", pts: 15 },
                        { range: "200 – 600 mm", desc: "Moderado", pts: 10 },
                        { range: "60 – 200 mm", desc: "Estrecho", pts: 8 },
                        { range: "< 60 mm", desc: "Muy estrecho", pts: 5 }
                      ].map(r => (
                        <tr key={r.range} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 font-black text-slate-100">{r.range}</td>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-slate-300 font-medium">{r.desc}</td>
                          <td className="py-3 px-4 text-center font-black text-cyan-400 text-sm">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3.4 PRESENCIA DE AGUA SUBTERRANEA */}
            {activeTab === 'rmr_agua' && (
              <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Presencia de Agua Subterránea y Criterios de Profundidad
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Clasificación por profundidad de taladro (según Reglas.md) y sub-ratings para <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">RMR'76</span> y <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">RMR'89</span>
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="px-4 pt-3 pb-1 text-xs font-black text-cyan-400 uppercase tracking-wider border-b border-navy-800 flex justify-between items-center">
                    <span>Criterio de Profundidad (Reglas.md)</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">R76</span> (Ámbar Sutil) vs <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">R89</span> (Fucsia Sutil)
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-2.5 px-4 border-r border-navy-800/60 text-center w-24">Código</th>
                        <th className="py-2.5 px-4 border-r border-navy-800/60">Estado del Testigo</th>
                        <th className="py-2.5 px-4 border-r border-navy-800/60">Criterio de Profundidad (m)</th>
                        <th className="py-2.5 px-4 border-r border-navy-800/60 text-center text-amber-400 bg-amber-950/20">R76</th>
                        <th className="py-2.5 px-4 text-center text-fuchsia-400 bg-fuchsia-950/20">R89</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "CDC", state: "Seco", depth: "0 <= Profundidad < 92 m", r76: 10, r89: 15 },
                        { code: "DPH", state: "Húmedo (Apenas Húmedo)", depth: "92 <= Profundidad < 97 m", r76: 7, r89: 10 },
                        { code: "WTM", state: "Mojado", depth: "97 <= Profundidad <= 301.2 m", r76: 7, r89: 7 },
                        { code: "DGE", state: "Agua bajo presión", depth: "Observación directa de campo", r76: 4, r89: 4 },
                        { code: "FGF", state: "Flujo continuo", depth: "Observación directa de campo", r76: 0, r89: 0 }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center font-black text-cyan-400 font-mono">{r.code}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 font-bold text-slate-200">{r.state}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 font-mono text-slate-400">{r.depth}</td>
                          <td className="py-2.5 px-4 border-r border-navy-800/50 text-center font-black text-amber-400 bg-amber-500/5">{r.r76}</td>
                          <td className="py-2.5 px-4 text-center font-black text-fuchsia-400 bg-fuchsia-500/5">{r.r89}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3.5 CLASIFICACION FINAL BIENIAWSKI */}
            {activeTab === 'rmr_calidad' && (
              <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Clasificación Final de Macizos Rocosos (Bieniawski)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Categorización final del macizo rocoso según el puntaje RMR Total (0 a 100)
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60">Rango de Puntaje</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center">Clase Verbal</th>
                        <th className="py-3 px-4 border-r border-navy-800/60">Calidad Cualitativa</th>
                        <th className="py-3 px-4">Descripción Geomecánica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { score: "81 – 100", cls: "I", qual: "Muy Buena", rowBg: "bg-emerald-500/5 hover:bg-emerald-500/10", col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", desc: "Macizo rocoso extremadamente competente, cohesivo y seco. Altísima estabilidad." },
                        { score: "61 – 80", cls: "II", qual: "Buena", rowBg: "bg-cyan-500/5 hover:bg-cyan-500/10", col: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10", desc: "Roca de buena calidad, bloques bien trabados, juntas cerradas con poca alteración." },
                        { score: "41 – 60", cls: "III", qual: "Regular", rowBg: "bg-yellow-500/5 hover:bg-yellow-500/10", col: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", desc: "Roca de calidad media, fracturamiento moderado, relleno blando o alteración local." },
                        { score: "21 – 40", cls: "IV", qual: "Mala", rowBg: "bg-orange-500/5 hover:bg-orange-500/10", col: "text-orange-400 border-orange-500/30 bg-orange-500/10", desc: "Macizo rocoso fracturado, baja cohesión de juntas, rellenos espesos de arcilla blanda." },
                        { score: "0 – 20", cls: "V", qual: "Muy Mala", rowBg: "bg-rose-500/5 hover:bg-rose-500/10", col: "text-rose-400 border-rose-500/30 bg-rose-500/10", desc: "Macizo completamente triturado, descompuesto o bajo flujos de agua severos." }
                      ].map(r => (
                        <tr key={r.cls} className={`border-b border-navy-800/40 transition-colors ${r.rowBg}`}>
                          <td className="py-3 px-4 border-r border-navy-800/50 font-black text-slate-100">{r.score}</td>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-bold text-slate-400">{r.cls}</td>
                          <td className="py-3 px-4 border-r border-navy-800/50">
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${r.col}`}>
                              {r.qual}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.1 TIPOS DE ENSAYO PLT */}
            {activeTab === 'plt_tipo_ensayo' && (
              <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Ensayos PLT — Tipos de Ensayo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modalidades estándar de aplicación de carga puntual en testigos de perforación
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-28">Código</th>
                        <th className="py-3 px-4">Tipo de Ensayo PLT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "D", name: "Diametral" },
                        { code: "A", name: "Axial" },
                        { code: "B", name: "Bloques" },
                        { code: "I", name: "Irregular" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-cyan-400 text-sm">{r.code}</td>
                          <td className="py-3 px-4 text-slate-200 font-bold">{r.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.2 DIAMETROS DE PERFORACION PLT */}
            {activeTab === 'plt_diametro' && (
              <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Diámetros Nominales de Perforación PLT
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Nominaciones de broca diamantina y diámetros nominales en milímetros
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-28">Código</th>
                        <th className="py-3 px-4 text-center">Diámetro Nominal (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "BQ", val: "36.5 mm" },
                        { code: "NQ", val: "47.6 mm" },
                        { code: "HQ", val: "61.1 mm" },
                        { code: "PQ", val: "85.0 mm" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-cyan-400 text-sm">{r.code}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{r.val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.3 TIPOS DE ROTURA PLT */}
            {activeTab === 'plt_rotura_tipo' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Tipos de Rotura (PLT Failure Mode)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Clasificación del plano de falla producido durante el ensayo de carga puntual
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-24">Código</th>
                        <th className="py-3 px-4">Descripción de la Falla</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "M", desc: "Rotura por matriz (Si la muestra no se rompe completamente no se considera M)" },
                        { code: "E", desc: "Rotura por estructura (Plano de junta previa)" },
                        { code: "C", desc: "Rotura combinada (Mezcla de matriz rocosa y estructura previa)" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-amber-400 text-sm">{r.code}</td>
                          <td className="py-3 px-4 text-slate-200 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.4 DIRECCION DE ROTURA PLT */}
            {activeTab === 'plt_rotura_dir' && (
              <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Dirección de Rotura Respecto a Planos de Debilidad
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Orientación de la fractura en relación con folias, estratos o planos de debilidad
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-24">Código</th>
                        <th className="py-3 px-4">Orientación de Falla</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "Pa", desc: "Paralela a los planos de debilidad (estratificación, foliación)" },
                        { code: "Pe", desc: "Perpendicular a los planos de debilidad (estratificación, foliación)" },
                        { code: "NA", desc: "No aplica (rocas masivas sin planos de debilidad orientados)" }
                      ].map(r => (
                        <tr key={r.code} className="border-b border-navy-800/40 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-black text-purple-400 text-sm">{r.code}</td>
                          <td className="py-3 px-4 text-slate-200 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.5 CLASIFICACION ISRM BASADA EN UCS */}
            {activeTab === 'plt_ucs' && (
              <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                <div className="border-b border-navy-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    Clasificación ISRM basada en Resistencia UCS
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Niveles de resistencia geomecánica derivados del índice Is(50) y estimación de UCS
                  </p>
                </div>

                <div className="bg-navy-900/40 border border-navy-800 rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-navy-800">
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-28">Índice ISRM</th>
                        <th className="py-3 px-4 border-r border-navy-800/60 text-center w-40">Rango UCS (MPa)</th>
                        <th className="py-3 px-4">Descripción de Clase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "Suelo", range: "<= 0.25", desc: "Material tipo suelo, sin comportamiento de roca competente.", rowBg: "bg-rose-500/10 hover:bg-rose-500/15", col: "text-rose-500 border-rose-600/30 bg-rose-600/10" },
                        { code: "R0", range: "> 0.25 y <= 1.0", desc: "Roca extremadamente débil (Extremely Weak Rock).", rowBg: "bg-rose-500/5 hover:bg-rose-500/10", col: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
                        { code: "R1", range: "> 1.0 y <= 5.0", desc: "Roca muy débil (Very Weak Rock).", rowBg: "bg-rose-500/5 hover:bg-rose-500/10", col: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
                        { code: "R2", range: "> 5.0 y <= 25.0", desc: "Roca débil (Weak Rock).", rowBg: "bg-orange-500/5 hover:bg-orange-500/10", col: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
                        { code: "R3", range: "> 25.0 y <= 50.0", desc: "Roca moderadamente resistente (Moderately Strong Rock).", rowBg: "bg-yellow-500/5 hover:bg-yellow-500/10", col: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
                        { code: "R4", range: "> 50.0 y <= 100.0", desc: "Roca resistente (Strong Rock).", rowBg: "bg-cyan-500/5 hover:bg-cyan-500/10", col: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
                        { code: "R5", range: "> 100.0 y <= 250.0", desc: "Roca muy resistente (Very Strong Rock).", rowBg: "bg-teal-500/5 hover:bg-teal-500/10", col: "text-teal-400 border-teal-500/30 bg-teal-500/10" },
                        { code: "R6", range: "> 250.0", desc: "Roca extremadamente resistente (Extremely Strong Rock).", rowBg: "bg-emerald-500/5 hover:bg-emerald-500/10", col: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" }
                      ].map(r => (
                        <tr key={r.code} className={`border-b border-navy-800/40 transition-colors ${r.rowBg}`}>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${r.col}`}>
                              {r.code}
                            </span>
                          </td>
                          <td className="py-3 px-4 border-r border-navy-800/50 text-center font-mono font-bold text-slate-300">{r.range}</td>
                          <td className="py-3 px-4 text-slate-300 leading-normal">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-navy-800 text-xs text-slate-400 text-center bg-navy-950/80 shrink-0">
          Manual de Referencia Geotécnica LGG-2026 — Clasificación Bieniawski (<span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">RMR76</span> / <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 font-bold border border-fuchsia-500/30">RMR89</span>) e Estándares ISRM
        </div>

      </div>
    </div>
  );
}