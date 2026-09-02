import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, AlertCircle, Loader2 } from 'lucide-react';

interface PltImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => Promise<void>;
    isUploading: boolean;
}

export default function PltImportWizard({
    isOpen,
    onClose,
    onUpload,
    isUploading
}: PltImportWizardProps) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const validateAndSetFile = (file: File) => {
        setErrorMsg('');
        const name = file.name.toLowerCase();
        if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.xls')) {
            setErrorMsg('Formato no soportado. Debe seleccionar un archivo de Excel (.xlsx, .xlsm, .xls).');
            return;
        }
        setSelectedFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile) return;
        try {
            await onUpload(selectedFile);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al procesar el archivo.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-navy-900 border border-cyan-500/20 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
                {/* Encabezado */}
                <div className="px-6 py-4 border-b border-navy-800 flex items-center justify-between bg-navy-950/50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-cyan-400" size={20} />
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                            Cargar Planilla de Ensayos PLT Regulares
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Zona de Arrastre */}
                <div className="p-6 space-y-4">
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                            dragActive
                                ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                                : selectedFile
                                ? 'border-emerald-500/50 bg-emerald-500/5'
                                : 'border-navy-750 hover:border-cyan-500/40 bg-navy-950/40 hover:bg-navy-950/80'
                        }`}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xlsm,.xls"
                            className="hidden"
                            onChange={handleChange}
                            disabled={isUploading}
                        />

                        {selectedFile ? (
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full">
                                    <FileSpreadsheet size={32} />
                                </div>
                                <span className="text-sm font-bold text-slate-200">{selectedFile.name}</span>
                                <span className="text-xs text-slate-500">
                                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Listo para auditar
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-full">
                                    <UploadCloud size={32} />
                                </div>
                                <span className="text-sm font-bold text-slate-300">
                                    Arrastra tu archivo Excel aquí o <span className="text-cyan-400 underline">haz clic para examinar</span>
                                </span>
                                <span className="text-xs text-slate-500">
                                    Formatos compatibles: .xlsx, .xlsm, .xls (Planilla 34 columnas oficial)
                                </span>
                            </div>
                        )}
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                </div>

                {/* Pie de Acciones */}
                <div className="px-6 py-4 border-t border-navy-800 bg-navy-950/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-navy-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedFile || isUploading}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Auditando Planilla...</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud size={14} />
                                <span>Ejecutar Auditoría QA/QC</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
