'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parsePdfAction } from '@/app/actions';

interface BulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any[]) => Promise<void>;
}

type Step = 'upload' | 'mapping' | 'preview';

interface ColumnMapping {
    target: string;
    source: string;
}

const TARGET_FIELDS = [
    { key: 'category', label: '물품분류명', required: true },
    { key: 'model', label: '물품목록번호', required: false },
    { key: 'name', label: '품명/규격', required: true },
    { key: 'purchaseDate', label: '취득일', required: false },
    { key: 'acquisitionDivision', label: '취득구분', required: false },
    { key: 'groupId', label: '운용부서', required: false },
    { key: 'quantity', label: '수량', required: false },
    { key: 'unitPrice', label: '단가', required: false },
    { key: 'totalAmount', label: '취득금액', required: false },
    { key: 'serviceLifeChange', label: '내용연수', required: false },
    { key: 'installLocation', label: '설치장소', required: false },
];

export function BulkUploadModal({ isOpen, onClose, onSave }: BulkUploadModalProps) {
    const [step, setStep] = useState<Step>('upload');
    const [textData, setTextData] = useState('');
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setStep('upload');
            setTextData('');
            setParsedData([]);
            setHeaders([]);
            setMappings([]);
            setIsProcessing(false);
        }
    }, [isOpen]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = async (file: File) => {
        setIsProcessing(true);
        try {
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                // Handle Spreadsheet
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (json && json.length > 0) {
                        // Smart Header Detection
                        let headerIndex = 0;
                        const keywords = ['품명', '규격', '모델', '번호', '수량', '단가', '금액', '부서', '취득'];

                        // Find the row that contains the most keywords
                        let maxMatchCount = 0;
                        for (let i = 0; i < Math.min(json.length, 10); i++) { // Check first 10 rows
                            const row = json[i] as any[];
                            let matchCount = 0;
                            row.forEach(cell => {
                                if (cell && typeof cell === 'string') {
                                    if (keywords.some(k => cell.includes(k))) matchCount++;
                                }
                            });
                            if (matchCount > maxMatchCount) {
                                maxMatchCount = matchCount;
                                headerIndex = i;
                            }
                        }

                        const headerRow = (json[headerIndex] as any[]).map(h => h ? String(h).trim() : '');
                        const dataRows = json.slice(headerIndex + 1);

                        // Convert to array of objects based on index
                        const objects = dataRows
                            .map((row: any) => {
                                const obj: any = {};
                                headerRow.forEach((h, i) => {
                                    if (h) obj[h] = row[i];
                                });
                                obj._raw = row; // Store raw row for index-based access
                                return obj;
                            })
                            .filter((obj: any) => {
                                // 1. Filter out empty rows
                                const hasData = Object.keys(obj).some(k => k !== '_raw' && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '');
                                if (!hasData) return false;

                                // 2. Filter out summary rows
                                const values = Object.values(obj).map(v => String(v).trim().toLowerCase());
                                const invalidKeywords = ['합계', '소계', '총계', '누계', 'total', 'subtotal'];
                                // Check if any value exactly matches or contains keywords (safer to match strictly or startWith usually, but contains is safer for 'Total Amount')
                                // But 'Total Amount' might be a header. Here we check values. '합계' usually is in the first column.
                                if (values.some(v => invalidKeywords.includes(v))) return false;

                                return true;
                            });

                        setHeaders(headerRow.filter(h => h !== ''));
                        setParsedData(objects);
                        autoMapColumns(headerRow);
                        setStep('mapping');
                    }
                };
                reader.readAsBinaryString(file);
            } else if (file.name.endsWith('.pdf')) {
                // Handle PDF via Server Action
                const formData = new FormData();
                formData.append('file', file);
                const result = await parsePdfAction(formData);
                if (result.success && result.text) {
                    setTextData(result.text);
                    alert('PDF 텍스트가 추출되었습니다. 확인 후 "다음"을 눌러주세요.');
                } else {
                    alert('PDF 처리 실패: ' + result.error);
                }
            } else {
                alert('지원되지 않는 파일 형식입니다. (xlsx, xls, csv, pdf)');
            }
        } catch (error) {
            console.error(error);
            alert('파일 처리 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTextParse = () => {
        // Parse tab-separated or comma-separated text
        const rows = textData.trim().split('\n');
        if (rows.length < 1) return;

        // Detect delimiter (tab or comma)
        const firstRow = rows[0];
        const delimiter = firstRow.includes('\t') ? '\t' : ',';

        const headerRow = rows[0].split(delimiter).map(h => h.trim());
        const dataRows = rows.slice(1).map(r => {
            const values = r.split(delimiter);
            const obj: any = {};
            headerRow.forEach((h, i) => {
                obj[h] = values[i]?.trim();
            });
            return obj;
        });

        setHeaders(headerRow);
        setParsedData(dataRows);
        autoMapColumns(headerRow);
        setStep('mapping');
    };

    const autoMapColumns = (headers: string[]) => {
        const newMappings: ColumnMapping[] = [];
        TARGET_FIELDS.forEach(field => {
            // Find best match (with null safety)
            const match = headers.find(h =>
                h && typeof h === 'string' && (
                    h.toLowerCase().includes(field.key.toLowerCase()) ||
                    h.toLowerCase().includes(field.label.split(' (')[0].toLowerCase())
                )
            );
            if (match) {
                newMappings.push({ target: field.key, source: match });
            }
        });
        setMappings(newMappings);
    };

    const handleMappingChange = (target: string, source: string) => {
        const newMappings = mappings.filter(m => m.target !== target);
        if (source) {
            newMappings.push({ target, source });
        }
        setMappings(newMappings);
    };

    const getPreviewData = () => {
        return parsedData.map(row => {
            // Do not initialize installLocation to empty string to prevent overwriting existing data
            const newRow: any = {};
            mappings.forEach(m => {
                // User Request: Do not import installLocation from Excel
                if (m.target === 'installLocation') return;
                newRow[m.target] = row[m.source];
            });

            // Special Logic for '내용연수 중 변경' (Service Life Change)
            // User Request: Use R column (index 17) if exists, otherwise Q column (index 16)
            // This is based on 0-based index from the raw excel row
            if (row._raw) {
                const qVal = row._raw[16];
                const rVal = row._raw[17];
                let serviceLife = '';

                if (rVal !== undefined && rVal !== null && String(rVal).trim() !== '') {
                    serviceLife = String(rVal).trim();
                } else if (qVal !== undefined && qVal !== null && String(qVal).trim() !== '') {
                    serviceLife = String(qVal).trim();
                }

                if (serviceLife) {
                    newRow.serviceLifeChange = serviceLife;
                }
            }

            return newRow;
        });
    };

    const handleFinalSave = async () => {
        const dataToSave = getPreviewData();
        await onSave(dataToSave);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white dark:bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl transition-all`}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        기기 일괄 등록 (Bulk Upload)
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Steps Indicator */}
                    <div className="flex items-center justify-center mb-8">
                        <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                            <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs border-current">1</span>
                            업로드
                        </div>
                        <div className="w-12 h-px bg-gray-200 mx-2"></div>
                        <div className={`flex items-center gap-2 ${step === 'mapping' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                            <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs border-current">2</span>
                            매핑
                        </div>
                        <div className="w-12 h-px bg-gray-200 mx-2"></div>
                        <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                            <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs border-current">3</span>
                            확인
                        </div>
                    </div>

                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Drag & Drop Area */}
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400'
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx,.xls,.csv,.pdf"
                                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                />
                                {isProcessing ? (
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                        <p>파일 처리 중...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <p className="font-medium text-lg">파일을 드래그하거나 클릭하여 업로드</p>
                                        <p className="text-sm">지원: XLSX, PDF, CSV</p>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">또는 직접 입력</span>
                                </div>
                            </div>

                            <textarea
                                className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder={`여기에 데이터를 붙여넣으세요 (엑셀에서 복사 가능).\n예:\n이름\t모델\t카테고리\nPC-01\tDell Optiplex\tDesktop`}
                                value={textData}
                                onChange={(e) => setTextData(e.target.value)}
                            ></textarea>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleTextParse}
                                    disabled={!textData.trim()}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                                >
                                    다음 단계로
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 text-blue-700 dark:text-blue-300">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-bold mb-1">데이터 매핑</p>
                                    <p>업로드한 데이터의 각 열(Column)을 시스템 필드와 연결해주세요.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {TARGET_FIELDS.map((field) => (
                                    <div key={field.key} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        <select
                                            className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                                            value={mappings.find(m => m.target === field.key)?.source || ''}
                                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                        >
                                            <option value="">(선택 안 함)</option>
                                            {headers.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-4">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg"
                                >
                                    뒤로
                                </button>
                                <button
                                    onClick={() => setStep('preview')}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    미리보기
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-lg">데이터 확인 ({parsedData.length}건)</h3>
                            </div>

                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-[400px] overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium sticky top-0">
                                        <tr>
                                            {TARGET_FIELDS.map(f => (
                                                <th key={f.key} className="px-4 py-3 whitespace-nowrap">{f.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                        {getPreviewData().slice(0, 50).map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                {TARGET_FIELDS.map(f => (
                                                    <td key={f.key} className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                        {row[f.key] || <span className="text-gray-300">-</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 50 && (
                                    <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 border-t border-gray-200">
                                        ... 외 {parsedData.length - 50}건
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between pt-4">
                                <button
                                    onClick={() => setStep('mapping')}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg"
                                >
                                    뒤로
                                </button>
                                <button
                                    onClick={handleFinalSave}
                                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm transition-all hover:scale-105"
                                >
                                    <Check className="w-4 h-4" />
                                    일괄 등록 완료
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
