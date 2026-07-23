import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    X, UploadCloud, FileSpreadsheet, Map, Compass,
    ChevronRight, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, RefreshCw
} from 'lucide-react';
import {
    EXPECTED_FIELDS, EXPECTED_STRUCT_FIELDS, EXPECTED_RMR_FIELDS,
    EXPECTED_COLLAR_FIELDS, EXPECTED_SURVEY_FIELDS,
    findHeaderRowGeneric, suggestMappingGeneric
} from '../../utils/excelMapper';

interface FileState {
    file: File | null;
    sheets: string[];
    workbook: XLSX.WorkBook | null;
}

interface MappingState {
    sheetName: string;
    headerRowIdx: number;
    headers: string[];
    mappings: Record<string, number>;
    isExpanded: boolean;
}

interface BulkImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: {
        files: { lgg_est: File; collar: File | null; survey: File | null };
        config: {
            lgg: { sheet: string; mappings: Record<string, number>; headerRowIdx: number };
            est: { sheet: string; mappings: Record<string, number>; headerRowIdx: number };
            rmr?: { sheet: string; mappings: Record<string, number>; headerRowIdx: number };
            collar?: { sheet: string; mappings: Record<string, number>; headerRowIdx: number };
            survey?: { sheet: string; mappings: Record<string, number>; headerRowIdx: number };
        }
    }) => void;
}

export default function BulkImportWizard({ isOpen, onClose, onConfirm }: BulkImportWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Estados de Carga para no congelar la UI
    const [loadingFiles, setLoadingFiles] = useState({ LGG_EST: false, COLLAR: false, SURVEY: false });

    // Estados de Archivos
    const [fileLggEst, setFileLggEst] = useState<FileState>({ file: null, sheets: [], workbook: null });
    const [fileCollar, setFileCollar] = useState<FileState>({ file: null, sheets: [], workbook: null });
    const [fileSurvey, setFileSurvey] = useState<FileState>({ file: null, sheets: [], workbook: null });

    // Estados de Asignación (Mapeo)
    const [mapLgg, setMapLgg] = useState<MappingState>({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });
    const [mapEst, setMapEst] = useState<MappingState>({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });
    const [mapRmr, setMapRmr] = useState<MappingState>({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });
    const [mapCollar, setMapCollar] = useState<MappingState>({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });
    const [mapSurvey, setMapSurvey] = useState<MappingState>({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });

    const inputLggRef = useRef<HTMLInputElement>(null);
    const inputCollarRef = useRef<HTMLInputElement>(null);
    const inputSurveyRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setFileLggEst({ file: null, sheets: [], workbook: null });
            setFileCollar({ file: null, sheets: [], workbook: null });
            setFileSurvey({ file: null, sheets: [], workbook: null });
            setLoadingFiles({ LGG_EST: false, COLLAR: false, SURVEY: false });
            setMapRmr({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'LGG_EST' | 'COLLAR' | 'SURVEY') => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = '';
        setLoadingFiles(prev => ({ ...prev, [type]: true }));

        const reader = new FileReader();
        reader.onload = (evt) => {
            setTimeout(() => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheets = workbook.SheetNames;

                    if (type === 'LGG_EST') {
                        setFileLggEst({ file, sheets, workbook });
                        const lggSheet = sheets.find(s => s.toLowerCase().includes('lgg') || s.toLowerCase().includes('general')) || sheets[0];
                        const estSheet = sheets.find(s => s.toLowerCase().includes('est')) || (sheets.length > 1 ? sheets[1] : sheets[0]);
                        const rmrSheet = sheets.find(s => s.toLowerCase().includes('rmr') || s.toLowerCase().includes('validacion_rmr'));

                        analyzeSheet(workbook, lggSheet, EXPECTED_FIELDS, setMapLgg);
                        analyzeSheet(workbook, estSheet, EXPECTED_STRUCT_FIELDS, setMapEst);
                        if (rmrSheet) {
                            analyzeSheet(workbook, rmrSheet, EXPECTED_RMR_FIELDS, setMapRmr);
                        } else {
                            setMapRmr({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false });
                        }
                    } else if (type === 'COLLAR') {
                        setFileCollar({ file, sheets, workbook });
                        analyzeSheet(workbook, sheets[0], EXPECTED_COLLAR_FIELDS, setMapCollar);
                    } else if (type === 'SURVEY') {
                        setFileSurvey({ file, sheets, workbook });
                        analyzeSheet(workbook, sheets[0], EXPECTED_SURVEY_FIELDS, setMapSurvey);
                    }
                } catch (err) {
                    alert('Error al leer el archivo Excel. Asegúrate de que sea un formato válido.');
                } finally {
                    setLoadingFiles(prev => ({ ...prev, [type]: false }));
                }
            }, 100);
        };
        reader.readAsArrayBuffer(file);
    };

    const analyzeSheet = (wb: XLSX.WorkBook, sheetName: string, expectedFields: any[], setMapState: React.Dispatch<React.SetStateAction<MappingState>>) => {
        if (!sheetName || !wb.Sheets[sheetName]) return;
        const dataGrid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
        if (dataGrid.length === 0) return;

        const headerIdx = findHeaderRowGeneric(dataGrid, expectedFields);
        const headerRow = dataGrid[headerIdx] || [];
        const headers = headerRow.map((val, idx) => val ? `${XLSX.utils.encode_col(idx)}: ${String(val).trim()}` : `${XLSX.utils.encode_col(idx)}: [Vacía]`);
        const rawHeaders = headerRow.map(c => c ? String(c) : '');
        const mappings = suggestMappingGeneric(rawHeaders, expectedFields);

        setMapState({ sheetName, headerRowIdx: headerIdx, headers, mappings, isExpanded: false });
    };

    const renderMappingSection = (
        title: string,
        icon: React.ReactNode,
        fileState: FileState,
        mapState: MappingState,
        setMapState: React.Dispatch<React.SetStateAction<MappingState>>,
        expectedFields: any[]
    ) => {
        if (!fileState.file || !mapState.sheetName) return null;

        const toggleExpand = () => setMapState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
        const missingReq = expectedFields.filter(f => f.required && mapState.mappings[f.key] === undefined).length;

        return (
            <div className={`border rounded-xl transition-all duration-300 ${missingReq > 0 ? 'border-red-500/50 bg-red-950/10' : 'border-navy-800 bg-navy-900/30'}`}>
                <div className="flex items-center justify-between p-4 cursor-pointer select-none" onClick={toggleExpand}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${missingReq > 0 ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                            {icon}
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-200">{title}</h4>
                            <p className="text-xs text-slate-400">
                                Archivo: <span className="font-semibold text-slate-300">{fileState.file.name}</span> ({mapState.sheetName})
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {missingReq > 0 ? (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg">
                                <AlertCircle size={14} /> Faltan {missingReq} req.
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg">
                                <CheckCircle2 size={14} /> Correcto
                            </span>
                        )}
                        {mapState.isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    </div>
                </div>

                {mapState.isExpanded && (
                    <div className="p-4 border-t border-navy-800 bg-navy-950/50 space-y-4">
                        {fileState.sheets.length > 1 && (
                            <div className="flex items-center gap-3 bg-navy-900/50 p-3 rounded-lg border border-navy-800">
                                <label className="text-xs font-bold text-slate-400 uppercase">Hoja de cálculo:</label>
                                <select
                                    value={mapState.sheetName}
                                    onChange={(e) => analyzeSheet(fileState.workbook!, e.target.value, expectedFields, setMapState)}
                                    className="bg-navy-950 border border-navy-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500"
                                >
                                    {fileState.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                            {expectedFields.map(field => {
                                const isMapped = mapState.mappings[field.key] !== undefined;
                                const isMissingReq = field.required && !isMapped;

                                return (
                                    <div key={field.key} className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 ${isMissingReq ? 'bg-red-500/5 border-red-500/40' :
                                        isMapped ? 'bg-navy-900/40 border-navy-700' : 'bg-navy-900/10 border-navy-800/50 opacity-70'
                                        }`}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-200 truncate">{field.label}</span>
                                            {field.required && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded font-black">REQ</span>}
                                        </div>
                                        <select
                                            value={isMapped ? mapState.mappings[field.key] : -1}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setMapState(prev => {
                                                    const newMap = { ...prev.mappings };
                                                    if (val === -1) delete newMap[field.key];
                                                    else newMap[field.key] = val;
                                                    return { ...prev, mappings: newMap };
                                                });
                                            }}
                                            className={`w-full bg-navy-950 border rounded p-1 text-xs focus:outline-none ${isMissingReq ? 'border-red-500/50 text-red-300' : 'border-navy-700 text-slate-300'
                                                }`}
                                        >
                                            <option value="-1">-- Sin Asignar --</option>
                                            {mapState.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const isAnyLoading = loadingFiles.LGG_EST || loadingFiles.COLLAR || loadingFiles.SURVEY;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-navy-950/90 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-5xl bg-[#090f1d] border border-navy-800 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] h-auto overflow-hidden">

                {/* Header & Steps */}
                <div className="shrink-0 border-b border-navy-800 bg-navy-900/30">
                    <div className="flex justify-between items-center p-5">
                        <div>
                            <h2 className="text-lg font-black text-slate-100 uppercase tracking-wider">Asistente de Revisión Geotécnica</h2>
                            <p className="text-xs text-slate-400 mt-1">Carga los archivos, asigna las columnas y ejecuta la revisión en segundo plano (LGG, Estructural y Validación RMR).</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex text-xs font-bold uppercase tracking-wider">
                        <div className={`flex-1 py-3 text-center border-b-2 transition-all ${step >= 1 ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-navy-800 text-slate-500'}`}>1. Archivos</div>
                        <div className={`flex-1 py-3 text-center border-b-2 transition-all ${step >= 2 ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-navy-800 text-slate-500'}`}>2. Asignación</div>
                        <div className={`flex-1 py-3 text-center border-b-2 transition-all ${step >= 3 ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-navy-800 text-slate-500'}`}>3. Confirmar</div>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-6">

                    {step === 1 && (
                        <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-slate-300">
                                Sube el archivo principal de <strong>Logueo General (LGG), Estructural y Validación RMR</strong>. Opcionalmente, carga los archivos de <strong>Collar</strong> y <strong>Survey</strong> para habilitar las validaciones espaciales cruzadas.
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div
                                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${loadingFiles.LGG_EST ? 'border-cyan-500/20 bg-cyan-900/10 pointer-events-none' : fileLggEst.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-cyan-500/30 hover:border-cyan-500/60 bg-navy-900/20 cursor-pointer'}`}
                                    onClick={() => !loadingFiles.LGG_EST && inputLggRef.current?.click()}
                                >
                                    <input type="file" className="hidden" accept=".xlsx, .xls" ref={inputLggRef} onChange={(e) => handleFileUpload(e, 'LGG_EST')} />
                                    {loadingFiles.LGG_EST ? <RefreshCw size={32} className="animate-spin text-cyan-500 mb-3" /> : <FileSpreadsheet size={32} className={fileLggEst.file ? 'text-emerald-400 mb-3' : 'text-cyan-500 mb-3'} />}
                                    <h3 className="text-sm font-bold text-slate-200">Archivo Base: LGG, Estructural y Validación RMR <span className="text-red-400">*</span></h3>
                                    <p className="text-xs text-slate-400 mt-1">{loadingFiles.LGG_EST ? 'Procesando...' : fileLggEst.file ? fileLggEst.file.name : 'Haz clic para explorar o arrastra aquí'}</p>
                                    {fileLggEst.file && !loadingFiles.LGG_EST && (
                                        <button onClick={(e) => { e.stopPropagation(); setFileLggEst({ file: null, sheets: [], workbook: null }); setMapRmr({ sheetName: '', headerRowIdx: 0, headers: [], mappings: {}, isExpanded: false }); }} className="mt-3 text-xs text-red-400 hover:underline">Eliminar archivo</button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all ${loadingFiles.COLLAR ? 'border-cyan-500/20 bg-cyan-900/10 pointer-events-none' : fileCollar.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-navy-700 hover:border-navy-500 bg-navy-900/20 cursor-pointer'}`}
                                        onClick={() => !loadingFiles.COLLAR && inputCollarRef.current?.click()}
                                    >
                                        <input type="file" className="hidden" accept=".xlsx, .xls" ref={inputCollarRef} onChange={(e) => handleFileUpload(e, 'COLLAR')} />
                                        {loadingFiles.COLLAR ? <RefreshCw size={24} className="animate-spin text-cyan-500 mb-2" /> : <Map size={24} className={fileCollar.file ? 'text-emerald-400 mb-2' : 'text-slate-500 mb-2'} />}
                                        <h3 className="text-xs font-bold text-slate-300">Archivo de Collar</h3>
                                        <p className="text-[10px] text-slate-500 mt-1">{loadingFiles.COLLAR ? 'Leyendo...' : fileCollar.file ? fileCollar.file.name : 'Haz clic para explorar'}</p>
                                        {fileCollar.file && !loadingFiles.COLLAR && (
                                            <button onClick={(e) => { e.stopPropagation(); setFileCollar({ file: null, sheets: [], workbook: null }); }} className="mt-2 text-[10px] text-red-400 hover:underline">Eliminar</button>
                                        )}
                                    </div>

                                    <div
                                        className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all ${loadingFiles.SURVEY ? 'border-cyan-500/20 bg-cyan-900/10 pointer-events-none' : fileSurvey.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-navy-700 hover:border-navy-500 bg-navy-900/20 cursor-pointer'}`}
                                        onClick={() => !loadingFiles.SURVEY && inputSurveyRef.current?.click()}
                                    >
                                        <input type="file" className="hidden" accept=".xlsx, .xls" ref={inputSurveyRef} onChange={(e) => handleFileUpload(e, 'SURVEY')} />
                                        {loadingFiles.SURVEY ? <RefreshCw size={24} className="animate-spin text-cyan-500 mb-2" /> : <Compass size={24} className={fileSurvey.file ? 'text-emerald-400 mb-2' : 'text-slate-500 mb-2'} />}
                                        <h3 className="text-xs font-bold text-slate-300">Archivo de Survey</h3>
                                        <p className="text-[10px] text-slate-500 mt-1">{loadingFiles.SURVEY ? 'Leyendo...' : fileSurvey.file ? fileSurvey.file.name : 'Haz clic para explorar'}</p>
                                        {fileSurvey.file && !loadingFiles.SURVEY && (
                                            <button onClick={(e) => { e.stopPropagation(); setFileSurvey({ file: null, sheets: [], workbook: null }); }} className="mt-2 text-[10px] text-red-400 hover:underline">Eliminar</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200">
                                <strong>Atención:</strong> Las columnas han sido autodetectadas. Si un cuadro aparece en rojo, falta asignar un campo obligatorio. Puedes desplegar los paneles para corregirlos manualmente si es necesario.
                            </div>

                            {renderMappingSection('Logueo General (LGG)', <FileSpreadsheet size={18} />, fileLggEst, mapLgg, setMapLgg, EXPECTED_FIELDS)}
                            {renderMappingSection('Logueo Estructural (EST)', <Compass size={18} />, fileLggEst, mapEst, setMapEst, EXPECTED_STRUCT_FIELDS)}
                            {mapRmr.sheetName && renderMappingSection('Validación RMR (RMR)', <FileSpreadsheet size={18} />, fileLggEst, mapRmr, setMapRmr, EXPECTED_RMR_FIELDS)}
                            {fileCollar.file && renderMappingSection('Metadatos de Collar', <Map size={18} />, fileCollar, mapCollar, setMapCollar, EXPECTED_COLLAR_FIELDS)}
                            {fileSurvey.file && renderMappingSection('Trayectorias de Survey', <Compass size={18} />, fileSurvey, mapSurvey, setMapSurvey, EXPECTED_SURVEY_FIELDS)}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="max-w-xl mx-auto text-center space-y-6 animate-fade-in py-8">
                            <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                <UploadCloud size={40} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-100 uppercase tracking-widest">¡Todo Listo para Revisar!</h3>
                                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                                    Se enviarán los archivos seleccionados junto con tu configuración al servidor. La revisión se ejecutará en segundo plano.
                                </p>
                            </div>

                            <div className="bg-navy-900/50 border border-navy-800 rounded-xl p-4 text-left space-y-3 inline-block mx-auto min-w-[300px]">
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span>Base LGG y Estructural <span className="font-bold text-slate-100">Lista</span></span>
                                </div>
                                {mapRmr.sheetName && (
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span>Validación RMR <span className="font-bold text-slate-100">Incluida</span></span>
                                    </div>
                                )}
                                {fileCollar.file && (
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span>Metadatos Collar <span className="font-bold text-slate-100">Incluido</span></span>
                                    </div>
                                )}
                                {fileSurvey.file && (
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span>Trayectorias Survey <span className="font-bold text-slate-100">Incluido</span></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-navy-800 bg-navy-950/80 flex justify-between shrink-0">
                    <button
                        onClick={() => step > 1 ? setStep((step - 1) as any) : onClose()}
                        className="px-5 py-2.5 rounded-lg font-bold text-xs bg-navy-800 hover:bg-navy-700 text-slate-300 transition-all"
                    >
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </button>

                    <button
                        disabled={isAnyLoading || (step === 1 && !fileLggEst.file)}
                        onClick={() => {
                            if (step < 3) setStep((step + 1) as any);
                            else {
                                onConfirm({
                                    files: { lgg_est: fileLggEst.file!, collar: fileCollar.file, survey: fileSurvey.file },
                                    config: {
                                        lgg: { sheet: mapLgg.sheetName, mappings: mapLgg.mappings, headerRowIdx: mapLgg.headerRowIdx },
                                        est: { sheet: mapEst.sheetName, mappings: mapEst.mappings, headerRowIdx: mapEst.headerRowIdx },
                                        ...(mapRmr.sheetName ? { rmr: { sheet: mapRmr.sheetName, mappings: mapRmr.mappings, headerRowIdx: mapRmr.headerRowIdx } } : {}),
                                        ...(fileCollar.file ? { collar: { sheet: mapCollar.sheetName, mappings: mapCollar.mappings, headerRowIdx: mapCollar.headerRowIdx } } : {}),
                                        ...(fileSurvey.file ? { survey: { sheet: mapSurvey.sheetName, mappings: mapSurvey.mappings, headerRowIdx: mapSurvey.headerRowIdx } } : {})
                                    }
                                });
                            }
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-xs bg-cyan-500 hover:bg-cyan-400 text-navy-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    >
                        {step === 3 ? 'Iniciar Revisión' : 'Siguiente Paso'}
                        {step < 3 && <ChevronRight size={16} />}
                    </button>
                </div>

            </div>
        </div>
    );
}