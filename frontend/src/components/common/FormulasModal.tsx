import { useState } from 'react';
import { X, Calculator, ShieldAlert, BookOpen, AlertCircle } from 'lucide-react';

interface FormulasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FormulasModal({ isOpen, onClose }: FormulasModalProps) {
  const [activeTab, setActiveTab] = useState<'formulas' | 'validation' | 'rmr'>('formulas');

  if (!isOpen) return null;

  const tabs = [
    { id: 'formulas', label: 'Fórmulas de Cálculo', icon: Calculator },
    { id: 'validation', label: 'Reglas de Validación', icon: ShieldAlert },
    { id: 'rmr', label: 'Puntajes RMR (Tablas)', icon: BookOpen }
  ];

  const formulas = [
    {
      t: "1. Perforación (Perf.)",
      bg: "#1a2040",
      bc: "#3b5298",
      f: "Perf. = A − De",
      n: "Longitud total perforada en el tramo."
    },
    {
      t: "2. QA/QC — Perf./LR",
      bg: "#1e1e0a",
      bc: "#92750a",
      f: '=SI(LR > Perf.; "CHECK"; "")',
      n: "Si Long. Recuperada supera la Perforación → muestra ⚠ CHECK. Condición: LR no puede ser mayor que Perf."
    },
    {
      t: "3. ∑ Frag\'s < 10 cm — CALCULADO",
      bg: "#1e0f2a",
      bc: "#7c3aed",
      f: "Frag\'s<10 = LR − Frag\'s≥10 − LRF",
      n: "Fragmentos de testigo que NO aportan al RQD. Se calcula automáticamente como el residuo entre LR y las otras dos medidas."
    },
    {
      t: "4. ∑ RQD+LRF+∑ Frag\'s<10 cm",
      bg: "#0a1e20",
      bc: "#0e7490",
      f: 'SI(O([Frag≥10]="";[LRF]="";[Frag<10]="");"";[Frag≥10]+[LRF]+[Frag<10])',
      n: "Si alguno de los tres campos está vacío → vacío. Resultado = ∑ RQD + LRF + Frag\'s<10 cm. Debe ser IGUAL a LR."
    },
    {
      t: "5. QA/QC — LR/(RQD+LRF)",
      bg: "#1e1400",
      bc: "#92400e",
      f: 'SI([LR]=""; ""; SI([∑RQD+LRF+Frag<10] ≤ [Perf.]; ""; "CHECK"))',
      n: "Si la suma reconstruida del testigo (∑ RQD + LRF + Frag<10) supera la longitud perforada → muestra ⚠ CHECK. Si LR está vacío → vacío. No hay valor numérico: es solo una alerta de validación."
    },
    {
      t: "6. RQD% — Rock Quality Designation",
      bg: "#0a1f0f",
      bc: "#166534",
      f: "RQD% = (Frag≥10 ÷ LR) × 100",
      n: "Porcentaje de la longitud recuperada compuesto por fragmentos ≥10 cm. Si LR = 0, RQD% = 0."
    },
    {
      t: "7. Clasificación RQD",
      bg: "#0f1f0f",
      bc: "#15803d",
      f: "≥90% → Excelente  |  ≥75% → Buena  |  ≥50% → Regular  |  ≥25% → Mala  |  <25% → Muy mala",
      n: "Clasificación cualitativa de la calidad de la roca según el valor de RQD%."
    },
    {
      t: "8. N° Fracturas mecánicas — DATO DE ENTRADA",
      bg: "#1a2040",
      bc: "#3b5298",
      f: "INPUT — digitado por el usuario durante el logueo",
      n: "Número de fracturas mecánicas (inducidas por la perforación). Campo de entrada libre."
    },
    {
      t: "9. FRF — Frecuencia de Roca Fracturada",
      bg: "#1e1800",
      bc: "#92750a",
      f: "FRF = PISO( REDOND(LRF×100) ÷ 5 ) + 1   (si LRF > 0, sino FRF = 0)",
      n: "Equivale a REDONDEAR.MAS(COCIENTE(LRF×100; 5)+1; 0) en Excel. Ej: LRF=0.40 m → PISO(40/5)+1 = 8+1 = 9."
    },
    {
      t: "10. N° de Frac. Naturales — DATO DE ENTRADA",
      bg: "#0a1f0f",
      bc: "#166534",
      f: "INPUT — digitado por el usuario durante el logueo",
      n: "Número de fracturas naturales contadas en el testigo. Campo de entrada libre."
    }
  ];

  const validationRules = [
    {
      category: "Collar & Survey",
      rules: [
        {
          type: "CRITICAL" as const,
          expr: "Survey.depth <= Collar.eoh",
          msg: "La profundidad de Survey no puede exceder el límite final de perforación (EOH) del collar."
        },
        {
          type: "WARNING" as const,
          expr: "|Dip_N - Dip_N-1| <= 2°",
          msg: "Aviso si se detecta un cambio brusco en la inclinación (Dip) mayor a 2 grados entre lecturas de Survey consecutivas."
        }
      ]
    },
    {
      category: "Registro Geotécnico de Corridas (LGG)",
      rules: [
        {
          type: "CRITICAL" as const,
          expr: "De < A",
          msg: "La profundidad inicial 'de:' debe ser estrictamente menor que la profundidad final 'a:'."
        },
        {
          type: "CRITICAL" as const,
          expr: "Perf. <= 1.6m",
          msg: "La longitud del intervalo perforado (a - de) no puede exceder el límite físico de 1.6 metros."
        },
        {
          type: "CRITICAL" as const,
          expr: "Recuperada <= Perf.",
          msg: "La longitud recuperada físicamente no puede superar el avance perforado de la corrida."
        },
        {
          type: "CRITICAL" as const,
          expr: "Frag >= 10 cm <= Recuperada",
          msg: "El metraje de fragmentos de RQD no puede superar la longitud de roca recuperada."
        },
        {
          type: "CRITICAL" as const,
          expr: "LRF <= Recuperada",
          msg: "La longitud de roca fracturada (LRF) no puede superar la longitud de roca recuperada."
        },
        {
          type: "CRITICAL" as const,
          expr: "RQD + LRF + Frag < 10 cm <= Perf.",
          msg: "Suma de control: La sumatoria de las partes de roca declaradas no puede ser mayor que el avance perforado."
        },
        {
          type: "CRITICAL" as const,
          expr: "Valores >= 0",
          msg: "Todos los campos numéricos (longitudes, conteos de fracturas) deben ser mayores o iguales a cero."
        },
        {
          type: "WARNING" as const,
          expr: "Buz30 + Buz60 + Buz90 = FracNat",
          msg: "La sumatoria de fracturas en bins de buzamiento debe coincidir exactamente con el conteo general de fracturas naturales."
        },
        {
          type: "WARNING" as const,
          expr: "Espesor Relleno > 0 <=> Abertura > 0",
          msg: "Si se declara un espesor de relleno de junta, la abertura debe ser mayor a 0; si la abertura es mayor a 0, debe haber espesor (o viceversa)."
        },
        {
          type: "WARNING" as const,
          expr: "Resistencia compatible con Intemperismo",
          msg: "Alerta por incompatibilidad geológica severa en la matriz de alteración (ej. combinar roca intacta R5 con meteorización total CWC)."
        }
      ]
    }
  ];

  const compatibilityMatrix = [
    { res: 'R0', name: 'Extremadamente Débil (<1 MPa)', allowed: ['RS (Suelo)', 'CWC (Completamente Met.)'] },
    { res: 'R1', name: 'Muy Débil (1–5 MPa)', allowed: ['HWA (Altamente Met.)', 'CWC (Completamente Met.)'] },
    { res: 'R2', name: 'Débil (5–25 MPa)', allowed: ['SWD (Ligeramente Met.)', 'MWM (Moderadamente Met.)', 'HWA (Altamente Met.)'] },
    { res: 'R3', name: 'Moderadamente Resistente (25–50 MPa)', allowed: ['UWF (Fresca)', 'SWD (Ligeramente Met.)', 'MWM (Moderadamente Met.)'] },
    { res: 'R4', name: 'Resistente (50–100 MPa)', allowed: ['UWF (Fresca)', 'SWD (Ligeramente Met.)', 'MWM (Moderadamente Met.)'] },
    { res: 'R5', name: 'Muy Resistente (100–250 MPa)', allowed: ['UWF (Fresca)', 'SWD (Ligeramente Met.)'] },
    { res: 'R6', name: 'Extremadamente Resistente (>250 MPa)', allowed: ['UWF (Fresca)'] }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-4xl h-[85vh] rounded-2xl border border-navy-800 flex flex-col overflow-hidden shadow-2xl text-slate-300">
        
        {/* Header */}
        <div className="p-5 border-b border-navy-800 flex items-center justify-between bg-navy-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">Fórmulas y Reglas de Validación QA/QC</h2>
              <p className="text-xs text-slate-500 font-medium">Especificaciones del motor de cálculo geotécnico reactivo y de consistencia física del macizo rocoso</p>
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

        {/* Tab navigation */}
        <div className="flex border-b border-navy-800 bg-navy-950/40 p-2 gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-cyan-400 border-blue-500/30 dark:border-cyan-500/25' 
                    : 'border-transparent text-slate-400 hover:bg-navy-900/40 hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-navy-950/20">
          
          {/* FÓRMULAS */}
          {activeTab === 'formulas' && (
            <div className="space-y-6">
              <h3 className="text-xs font-black text-blue-500 dark:text-cyan-400 uppercase tracking-widest border-b border-navy-800 pb-2">
                📐 Fórmulas — Logueo General
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formulas.map(k => (
                  <div 
                    key={k.t} 
                    style={{ background: k.bg, borderColor: k.bc }} 
                    className="border-2 rounded-xl p-4 flex flex-col justify-between shadow-md text-slate-100"
                  >
                    <div>
                      <div className="fontWeight-700 text-xs font-bold text-slate-100 mb-2">{k.t}</div>
                      <div className="bg-black/35 rounded px-3 py-2 font-mono text-xs font-bold text-yellow-300 mb-3 break-words">
                        {k.f}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 italic flex items-start gap-1">
                      <span className="shrink-0 mt-0.5">ℹ</span>
                      <span>{k.n}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VALIDACIONES */}
          {activeTab === 'validation' && (
            <div className="space-y-6">
              <h3 className="text-xs font-black text-red-500 dark:text-red-400 uppercase tracking-widest border-b border-navy-800 pb-2 flex justify-between">
                <span>🛡 Reglas de Validación QA/QC Activas en el Sistema</span>
                <span className="text-xxs text-slate-500 font-semibold lowercase">real-time engine</span>
              </h3>

              <div className="space-y-6">
                {validationRules.map(cat => (
                  <div key={cat.category} className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-navy-850 pb-1.5">
                      {cat.category}
                    </h4>
                    <div className="space-y-3">
                      {cat.rules.map((rule, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-3 py-2 border-b border-navy-900/60 last:border-b-0 text-xs">
                          <div className="flex items-center gap-2 shrink-0">
                            {rule.type === 'CRITICAL' ? (
                              <span className="flex items-center gap-1 bg-red-950/60 border border-red-500/30 text-red-400 px-2 py-0.5 rounded font-black text-[10px]">
                                <AlertCircle size={10} className="text-red-400" />
                                CRÍTICO
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 bg-amber-950/60 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded font-black text-[10px]">
                                <AlertCircle size={10} className="text-amber-400" />
                                AVISO
                              </span>
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="font-mono font-bold text-yellow-300/90 dark:text-cyan-400">{rule.expr}</div>
                            <div className="text-slate-400 font-medium text-[11px] leading-relaxed">{rule.msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Matriz de compatibilidad */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider border-b border-navy-850 pb-1.5">
                    Matriz de Compatibilidad: Resistencia vs Intemperismo
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    El sistema lanza advertencias si la meteorización no es físicamente compatible con la resistencia intacta medida de la roca.
                  </p>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-2 px-2 w-1/4">Resistencia (ISRM)</th>
                        <th className="py-2 px-2">Grados de Intemperismo Permitidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compatibilityMatrix.map(m => (
                        <tr key={m.res} className="border-b border-navy-900 last:border-b-0 hover:bg-navy-900/10">
                          <td className="py-2.5 px-2 font-bold text-slate-200">
                            <span className="bg-navy-900 px-2 py-0.5 rounded border border-navy-800 text-[11px] mr-1.5 font-bold text-cyan-400">{m.res}</span>
                            {m.name}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex flex-wrap gap-1">
                              {m.allowed.map(w => (
                                <span key={w} className="bg-blue-600/5 dark:bg-cyan-500/5 text-blue-500 dark:text-cyan-400 px-2 py-0.5 rounded text-[10px] border border-blue-500/10 dark:border-cyan-500/10 font-semibold">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* RMR TABLAS */}
          {activeTab === 'rmr' && (
            <div className="space-y-6">
              <h3 className="text-xs font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest border-b border-navy-800 pb-2">
                🪨 Parámetros RMR76 / RMR89 — Rangos de Puntuación
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* P1 */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider border-b border-navy-800 pb-1.5">
                    P1 — Resistencia Uniaxial (R76/R89 = idéntico)
                  </h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-1 px-2">Código</th>
                        <th className="py-1 px-2">Rango (MPa)</th>
                        <th className="py-1 px-2 text-center text-amber-400">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["R6", "> 250", 15, "text-red-400"],
                        ["R5", "100–250", 12, "text-orange-400"],
                        ["R4", "50–100", 7, "text-amber-400"],
                        ["R3", "25–50", 4, "text-yellow-400"],
                        ["R2", "5–25", 2, "text-cyan-400"],
                        ["R1", "1–5", 1, "text-teal-400"],
                        ["R0", "< 1", 0, "text-slate-400"]
                      ].map(([k, q, ve, col]) => (
                        <tr key={k as string} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className={`py-1.5 px-2 font-bold ${col}`}>{k}</td>
                          <td className="py-1.5 px-2 text-slate-300 font-medium">{q}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-amber-400">{ve}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* P2 */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider border-b border-navy-800 pb-1.5">
                    P2 — RQD% (R76/R89 = idéntico)
                  </h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-1 px-2">RQD%</th>
                        <th className="py-1 px-2 text-center text-emerald-400">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["90–100 (Excelente)", 20],
                        ["75–90 (Buena)", 17],
                        ["50–75 (Regular)", 13],
                        ["25–50 (Mala)", 8],
                        ["<25 (Muy Mala)", 3]
                      ].map(([k, q]) => (
                        <tr key={k as string} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-1.5 px-2 text-slate-300 font-semibold">{k}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-emerald-400">{q}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* P3 */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-cyan-500 dark:text-cyan-400 uppercase tracking-wider border-b border-navy-800 pb-1.5">
                    P3 — Espaciamiento de Juntas (estimado)
                  </h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-1 px-2">Espaciamiento</th>
                        <th className="py-1 px-2 text-center text-cyan-400">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["> 2.0 m", 20],
                        ["0.6–2.0 m", 15],
                        ["0.2–0.6 m", 10],
                        ["0.06–0.2 m", 8],
                        ["<0.06 m", 5]
                      ].map(([k, q]) => (
                        <tr key={k as string} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-1.5 px-2 text-slate-300 font-semibold">{k}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-cyan-400">{q}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* P4 */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider border-b border-navy-800 pb-1.5">
                    P4 — Intemperismo (Cond. de Juntas)
                  </h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-1 px-2">Código</th>
                        <th className="py-1 px-2 text-center text-emerald-400">RMR76</th>
                        <th className="py-1 px-2 text-center text-amber-400">RMR89</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["W1 (Fresca)", 9, 6],
                        ["W2 (Ligeramente)", 7, 5],
                        ["W3 (Moderado)", 5, 3],
                        ["W4 (Altamente)", 3, 1],
                        ["W5 (Completamente)", 1, 0]
                      ].map(([k, q, ve]) => (
                        <tr key={k as string} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-1.5 px-2 text-slate-300 font-semibold">{k}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-emerald-400">{q}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-amber-400">{ve}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* P5 */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider border-b border-navy-800 pb-1.5">
                    P5 — Presencia de Agua
                  </h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-1 px-2">Condición</th>
                        <th className="py-1 px-2 text-center text-emerald-400">RMR76</th>
                        <th className="py-1 px-2 text-center text-amber-400">RMR89</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Seca", 10, 15],
                        ["Húmeda", 7, 10],
                        ["Mojada", 4, 7],
                        ["Goteo", 4, 4],
                        ["Flujo libre", 0, 0]
                      ].map(([k, q, ve]) => (
                        <tr key={k as string} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-1.5 px-2 text-slate-300 font-semibold">{k}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-emerald-400">{q}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-amber-400">{ve}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Clasificación Final */}
                <div className="glass-panel p-4 rounded-xl border border-navy-800 space-y-3 bg-navy-950/45">
                  <h4 className="text-xs font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider border-b border-navy-800 pb-1.5">
                    Clasificación Final de Macizos Rocosos
                  </h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold uppercase border-b border-navy-850">
                        <th className="py-1 px-2">Puntaje RMR</th>
                        <th className="py-1 px-2 text-center">Clase</th>
                        <th className="py-1 px-2">Calidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["81–100", "I", "Muy Buena", "text-emerald-400 bg-emerald-500/5 border border-emerald-500/25"],
                        ["61–80", "II", "Buena", "text-cyan-400 bg-cyan-500/5 border border-cyan-500/25"],
                        ["41–60", "III", "Regular", "text-amber-400 bg-amber-500/5 border border-amber-500/25"],
                        ["21–40", "IV", "Mala", "text-orange-400 bg-orange-500/5 border border-orange-500/25"],
                        ["0–20", "V", "Muy Mala", "text-red-400 bg-red-500/5 border border-red-500/25"]
                      ].map(([k, q, ve, col]) => (
                        <tr key={q as string} className="border-b border-navy-900 hover:bg-navy-900/10">
                          <td className="py-1.5 px-2 text-slate-300 font-semibold">{k}</td>
                          <td className="py-1.5 px-2 text-center font-bold text-slate-400">{q}</td>
                          <td className="py-1.5 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${col}`}>{ve}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-navy-800 text-xs text-slate-500 text-center bg-navy-900/20">
          Usa estas reglas y especificaciones para auditar e interpretar el cálculo del macizo rocoso RMR de forma reactiva.
        </div>

      </div>
    </div>
  );
}
