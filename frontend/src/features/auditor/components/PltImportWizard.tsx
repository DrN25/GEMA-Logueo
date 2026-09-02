import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Layers, X, AlertCircle, RefreshCw, UploadCloud, CheckCircle2 } from 'lucide-react';

interface PltImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (pltFile: File, lggFile?: File | null) => Promise<void>;
    isUploading: boolean;
}

export default function PltImportWizard({
    isOpen,
    onClose,
    onUpload,
    isUploading
}: PltImportWizardProps) {
    const [filePlt, setFilePlt] = useState<File | null>(null);
    const [fileLgg, setFileLgg] = useState<File | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const inputPltRef = useRef<HTMLInputElement>(null);
    const inputLggRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const validateFile = (file: File): boolean => {
        const name = file.name.toLowerCase();
        return name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xls');
    };

    const handlePltUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (validateFile(file)) {
            setErrorMsg('');
            setFilePlt(file);
        } else {
            setErrorMsg('Formato no soportado. El archivo PLT debe ser un Excel (.xlsx, .xlsm, .xls).');
        }
    };

    const handleLggUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (validateFile(file)) {
            setErrorMsg('');
            setFileLgg(file);
        } else {
            setErrorMsg('Formato no soportado. El archivo LGG debe ser un Excel (.xlsx, .xlsm, .xls).');
        }
    };

    const handleSubmit = async () => {
        if (!filePlt) return;
        try {
            await onUpload(filePlt, fileLgg);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al procesar los archivos.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-navy-950/90 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-3xl bg-[#090f1d] border border-navy-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header idéntico a LGG Collar Survey */}
                <div className="shrink-0 border-b border-navy-800 bg-navy-900/30">
                    <div className="flex justify-between items-center p-5">
                        <div>
                            <h2 className="text-lg font-black text-slate-100 uppercase tracking-wider">
                                Asistente de Auditoría PLT Regulares (DDH)
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Carga la planilla de ensayos de carga puntual y opcionalmente la base de logueo general para validaciones cruzadas.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isUploading}
                            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 transition-all disabled:opacity-50"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Body idéntico a Step 1 de BulkImportWizard */}
                <div className="p-6 space-y-6">
                    {/* Banner Informativo azul idéntico a LGG */}
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-xs text-slate-300 leading-relaxed">
                        Sube el archivo principal de <strong>Ensayos PLT Regulares (34 columnas)</strong>. Opcionalmente, carga la base de <strong>Logueo General (LGG)</strong> para habilitar el cruce geomecánico de corridas, límites de profundidad, consistencia de litología y contraste de dureza ISRM.
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* 1. Archivo Base PLT (Obligatorio) */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${
                                isUploading
                                    ? 'border-cyan-500/20 bg-cyan-900/10 pointer-events-none'
                                    : filePlt
                                    ? 'border-emerald-500/50 bg-emerald-500/5'
                                    : 'border-cyan-500/30 hover:border-cyan-500/60 bg-navy-900/20 cursor-pointer'
                            }`}
                            onClick={() => !isUploading && inputPltRef.current?.click()}
                        >
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xlsm, .xls"
                                ref={inputPltRef}
                                onChange={handlePltUpload}
                                disabled={isUploading}
                            />
                            {isUploading ? (
                                <RefreshCw size={32} className="animate-spin text-cyan-500 mb-3" />
                            ) : (
                                <FileSpreadsheet size={32} className={filePlt ? 'text-emerald-400 mb-3' : 'text-cyan-500 mb-3'} />
                            )}
                            <h3 className="text-sm font-bold text-slate-200">
                                Archivo Base: Planilla de Ensayos PLT Regulares <span className="text-red-400">*</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                {filePlt ? `${filePlt.name} (${(filePlt.size / (1024 * 1024)).toFixed(2)} MB)` : 'Haz clic para explorar o arrastra aquí'}
                            </p>
                            {filePlt && !isUploading && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFilePlt(null);
                                    }}
                                    className="mt-3 text-xs text-red-400 hover:underline"
                                >
                                    Eliminar archivo
                                </button>
                            )}
                        </div>

                        {/* 2. Archivo LGG Opcional idéntico al bloque Collar / Survey */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all ${
                                isUploading
                                    ? 'border-cyan-500/20 bg-cyan-900/10 pointer-events-none'
                                    : fileLgg
                                    ? 'border-emerald-500/50 bg-emerald-500/5'
                                    : 'border-navy-700 hover:border-navy-500 bg-navy-900/20 cursor-pointer'
                            }`}
                            onClick={() => !isUploading && inputLggRef.current?.click()}
                        >
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xlsm, .xls"
                                ref={inputLggRef}
                                onChange={handleLggUpload}
                                disabled={isUploading}
                            />
                            <Layers size={26} className={fileLgg ? 'text-emerald-400 mb-2' : 'text-slate-500 mb-2'} />
                            <h3 className="text-xs font-bold text-slate-300">
                                Base de Logueo General (LGG) <span className="text-slate-500 font-normal lowercase">(opcional)</span>
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {fileLgg ? `${fileLgg.name} (${(fileLgg.size / (1024 * 1024)).toFixed(2)} MB) • Cruce Geomecánico Activo` : 'Haz clic para explorar o arrastra aquí'}
                            </p>
                            {fileLgg && !isUploading && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFileLgg(null);
                                    }}
                                    className="mt-2 text-[10px] text-red-400 hover:underline"
                                >
                                    Eliminar archivo
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Mensaje de Error si ocurre */}
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                </div>

                {/* Footer idéntico a BulkImportWizard */}
                <div className="p-5 border-t border-navy-800 bg-navy-900/40 flex justify-between items-center">
                    <div className="text-xs text-slate-400">
                        {fileLgg ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                <CheckCircle2 size={14} /> Cruce Geomecánico con LGG habilitado
                            </span>
                        ) : filePlt ? (
                            <span className="text-slate-400">Modo autónomo (validación interna PLT)</span>
                        ) : (
                            <span className="text-slate-500">Selecciona el archivo PLT para continuar</span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isUploading}
                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-navy-800 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!filePlt || isUploading}
                            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-cyan-500/20 flex items-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Auditando...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={14} />
                                    <span>{fileLgg ? 'Ejecutar con Cruce LGG' : 'Ejecutar Auditoría PLT'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
