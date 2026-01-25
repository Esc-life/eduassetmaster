'use client';

import { useState } from 'react';
import { X, Save, AlertCircle, FileText, ArrowRight } from 'lucide-react';

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
];

export function BulkUploadModal({ isOpen, onClose, onSave }: BulkUploadModalProps) {
    const [step, setStep] = useState<'paste' | 'map'>('paste');
    const [rawText, setRawText] = useState('');
    const [parsedData, setParsedData] = useState<string[][]>([]);
    const [columnMapping, setColumnMapping] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleParse = () => {
        if (!rawText.trim()) return;

        // Split by newlines, then by tabs (common excel copy format)
        const lines = rawText.trim().split('\n');
        const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));

        // Filter empty rows
        const validRows = rows.filter(r => r.some(c => c !== ''));

        if (validRows.length === 0) {
            alert('데이터가 없습니다.');
            return;
        }

        // Initialize mapping (guess based on index if possible, or default to ignore)
        const initialMapping = validRows[0].map(() => 'ignore');
        setColumnMapping(initialMapping);
        setParsedData(validRows);
        setStep('map');
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Convert to objects based on mapping
            // Skip the first row if it looks like a header (optional logic, but usually safe to let user decide via mapping)
            // Here we treat ALL rows as data, or user can ignore the first row if they map it to 'ignore'? 
            // Better: Just process all rows. If user pasted headers, they will be imported as a device named "Model Name". 
            // Let's add a checkbox "First row is header" later if needed. For now, simple.

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

            // Filter out empty objects
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        기기 일괄 등록 (엑셀 붙여넣기)
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden p-6 flex flex-col">
                    {step === 'paste' ? (
                        <>
                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg flex gap-2">
                                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                                <div>
                                    엑셀이나 한셀에서 표를 복사(Ctrl+C)한 후 아래 상자에 붙여넣기(Ctrl+V) 하세요.<br />
                                    <strong>모델명, 구입일, 기기명</strong> 등이 포함되면 좋습니다.
                                </div>
                            </div>
                            <textarea
                                className="flex-1 w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 dark:bg-gray-900 resize-none"
                                placeholder={`예시:\n삼성전자\t갤럭시탭 S7\t2023-01-01\nLG전자\t그램 15\t2022-05-05\n...`}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                            />
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleParse}
                                    disabled={!rawText.trim()}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    다음 (데이터 확인)
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                                각 열(Column)에 해당하는 항목을 선택해주세요. 필요 없는 열은 '- 무시함 -'으로 두세요.
                            </div>

                            <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
                                        <tr>
                                            {parsedData[0]?.map((_, index) => (
                                                <th key={index} className="p-2 border-b border-gray-200 dark:border-gray-600 min-w-[150px]">
                                                    <select
                                                        className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:ring-2 focus:ring-blue-500"
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
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {parsedData.slice(0, 50).map((row, rIndex) => (
                                            <tr key={rIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                {row.map((cell, cIndex) => (
                                                    <td key={cIndex} className="p-3 text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-gray-800 last:border-0 truncate max-w-[200px]">
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 50 && (
                                    <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 border-t">
                                        {parsedData.length - 50}개 행이 더 있습니다...
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-between items-center">
                                <button
                                    onClick={() => setStep('paste')}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    뒤로 가기
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isSaving ? '저장 중...' : `${parsedData.length}개 항목 등록`}
                                    {!isSaving && <Save className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
