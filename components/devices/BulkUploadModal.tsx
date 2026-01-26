'use client';

import { useState } from 'react';
import { X, Save, AlertCircle, FileText, ArrowRight, Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractTextFromPdf } from '@/app/actions';

interface BulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any[]) => Promise<void>;
}

const COLUMNS = [
    { key: 'ignore', label: '- 무시함 -' },
    { key: 'name', label: '기기명/별칭' },
    { key: 'model', label: '모델명' },
    { key: 'category', label: '종류(노트북/태블릿 등)' },
    { key: 'purchaseDate', label: '구입일' },
    { key: 'status', label: '상태' },
    { key: 'note', label: '비고' },
    { key: 'ip', label: 'IP 주소' },
    { key: 'sn', label: 'S/N' },
];

export function BulkUploadModal({ isOpen, onClose, onSave }: BulkUploadModalProps) {
    const [step, setStep] = useState<'paste' | 'map'>('paste');
    const [rawText, setRawText] = useState('');
    const [parsedData, setParsedData] = useState<string[][]>([]);
    const [columnMapping, setColumnMapping] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);

        try {
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                // Excel Parsing (Client-side)
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                // Convert to string table
                const stringData = jsonData.map(row => row.map(cell => String(cell === undefined || cell === null ? '' : cell)));

                // Filter empty rows
                const validRows = stringData.filter(r => r.some(c => c.trim() !== ''));

                if (validRows.length === 0) {
                    alert('엑셀 파일에 유효한 데이터가 없습니다.');
                } else {
                    const initialMapping = validRows[0].map(() => 'ignore');
                    setColumnMapping(initialMapping);
                    setParsedData(validRows);
                    setStep('map');
                }

            } else if (file.name.toLowerCase().endsWith('.pdf')) {
                // PDF Parsing (Server-side)
                const formData = new FormData();
                formData.append('file', file);

                const result = await extractTextFromPdf(formData);
                if (result.success && result.text) {
                    setRawText(result.text); // Allow user to edit extracted text
                    // Optional: Try to auto-parse lines if structure looks like a table?
                    // For now, let user see the text.
                } else {
                    alert('PDF 텍스트 추출 실패: ' + result.error);
                }
            } else {
                alert('지원하지 않는 파일 형식입니다. (.xlsx, .xls, .pdf)');
            }
        } catch (error: any) {
            console.error(error);
            alert('파일 처리 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setIsProcessing(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleParse = () => {
        if (!rawText.trim()) return;

        // Split by newlines, then by tabs (common excel copy format) or 2+ spaces (PDF tables often use spaces)
        const lines = rawText.trim().split('\n');

        // Detect likely separator: Tab or Multiple Spaces
        const hasTabs = lines.some(l => l.includes('\t'));

        const rows = lines.map(line => {
            if (hasTabs) return line.split('\t').map(c => c.trim());
            // Fallback for PDF text which might use spaces
            // Split by 2 or more spaces
            return line.split(/\s{2,}/).map(c => c.trim());
        });

        const validRows = rows.filter(r => r.some(c => c !== ''));

        if (validRows.length === 0) {
            alert('데이터가 없습니다.');
            return;
        }

        const initialMapping = validRows[0].map(() => 'ignore');
        setColumnMapping(initialMapping);
        setParsedData(validRows);
        setStep('map');
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const devices = parsedData.map(row => {
                const device: any = {};
                row.forEach((cell, index) => {
                    const key = columnMapping[index];
                    if (key && key !== 'ignore') {
                        device[key] = cell;
                    }
                });
                return device;
            });

            const validDevices = devices.filter(d => Object.keys(d).length > 0);

            if (validDevices.length === 0) {
                alert('저장할 데이터가 유효하지 않습니다. 열을 매핑해주세요.');
                setIsSaving(false);
                return;
            }

            await onSave(validDevices);
            onClose();
            setStep('paste');
            setRawText('');
            setParsedData([]);
        } catch (e) {
            alert('오류 발생: ' + e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        기기 일괄 등록 {step === 'map' && '> 열 매핑'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden p-6 flex flex-col">
                    {step === 'paste' ? (
                        <div className="flex flex-col h-full gap-4">
                            {/* File Upload Area */}
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .pdf"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={isProcessing}
                                />
                                <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${isProcessing ? 'bg-gray-100 border-gray-300' : 'border-blue-300 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20'
                                    }`}>
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                                            <p className="font-medium text-gray-700 dark:text-gray-300">파일 분석 중...</p>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-10 h-10 text-blue-500 mb-3" />
                                            <p className="font-medium text-gray-900 dark:text-white text-lg">파일을 여기로 드래그하거나 클릭하세요</p>
                                            <p className="text-sm text-gray-500 mt-1">지원 형식: 엑셀 파일(.xlsx), PDF 문서(.pdf)</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                                <span className="text-sm text-gray-400 font-medium">또는 직접 붙여넣기</span>
                                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
                            </div>

                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="mb-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-gray-400" />
                                    <span>엑셀 표를 복사(Ctrl+C)하여 아래에 붙여넣으세요. PDF 텍스트는 자동으로 추출되어 여기에 표시됩니다.</span>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 dark:bg-gray-900 resize-none custom-scrollbar"
                                    placeholder={`예시:\n삼성전자\t갤럭시탭 S7\t2023-01-01\nLG전자\t그램 15\t2022-05-05\n...`}
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={handleParse}
                                    disabled={!rawText.trim() || isProcessing}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium transition-all"
                                >
                                    데이터 분석 및 매핑
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div>
                                    각 열(Column)의 의미를 선택해주세요. <strong>'기기명', '모델명', '구입일'</strong> 같은 핵심 정보를 매핑해야 합니다.
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-inner bg-gray-50 dark:bg-gray-900/50 relative">
                                <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
                                    <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
                                        <tr>
                                            {parsedData[0]?.map((_, index) => (
                                                <th key={index} className="p-2 border-b-2 border-gray-200 dark:border-gray-600 min-w-[160px] bg-gray-50 dark:bg-gray-700/50">
                                                    <div className="mb-1 text-xs text-gray-500 font-mono text-center">Column {index + 1}</div>
                                                    <select
                                                        className={`w-full p-2 border rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 ${columnMapping[index] !== 'ignore'
                                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500'
                                                                : 'border-gray-300 bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                                                            }`}
                                                        value={columnMapping[index]}
                                                        onChange={(e) => {
                                                            const newMapping = [...columnMapping];
                                                            newMapping[index] = e.target.value;
                                                            setColumnMapping(newMapping);
                                                        }}
                                                    >
                                                        {COLUMNS.map(col => (
                                                            <option key={col.key} value={col.key}>
                                                                {col.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                        {parsedData.slice(0, 100).map((row, rIndex) => (
                                            <tr key={rIndex} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                                {row.map((cell, cIndex) => (
                                                    <td key={cIndex} className={`p-3 border-r last:border-0 border-gray-100 dark:border-gray-800 truncate max-w-[200px] ${columnMapping[cIndex] !== 'ignore' ? 'text-gray-900 dark:text-white font-medium bg-blue-50/10' : 'text-gray-500 dark:text-gray-500'
                                                        }`}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 100 && (
                                    <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 border-t sticky bottom-0">
                                        ... 외 {parsedData.length - 100}개 항목
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={() => setStep('paste')}
                                    className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                                >
                                    다시 업로드
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="text-sm text-gray-500">
                                        총 <strong className="text-blue-600">{parsedData.length}</strong>개 항목 감지됨
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-6 py-2.5 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 shadow-sm font-medium transition-all transform active:scale-95"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                저장 중...
                                            </button>
                                        ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            데이터 등록 완료
                                        </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
