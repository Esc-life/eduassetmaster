'use client';

import { useState } from 'react';
import { Device } from '@/types';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useMessage } from '@/components/Providers';

interface DisposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    devices: Device[]; // Selected devices
    onConfirm: (ids: string[]) => Promise<void>;
}

export function DisposalModal({ isOpen, onClose, devices, onConfirm }: DisposalModalProps) {
    const { showAlert, showConfirmAsync } = useMessage();
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleDownloadExcel = () => {
        // Format based on request or standard government form
        // Columns: 연번, 물품목록번호(Model?), 물품분류명(Category), 품명/규격(Name), 취득일(PurchaseDate), 취득금액(Price), 처분사유(Reason - Empty)

        const data = devices.map((d, index) => ({
            '연번': index + 1,
            '물품목록번호': d.model || '-',
            '물품분류명': d.category || '-',
            '품명/규격': d.name || '-',
            '취득일자': d.purchaseDate || '-',
            '취득금액': d.unitPrice ? Number(d.unitPrice).toLocaleString() : '0',
            '설치장소': d.installLocation || '-',
            '처분사유': '노후화/고장' // Default reason
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "불용대상목록");

        // Auto width (Basic)
        const wscols = [
            { wch: 6 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, "불용신청목록.xlsx");
    };

    const handleConfirm = async () => {
        const ok = await showConfirmAsync('선택한 기기를 불용(고장/폐기) 상태로 변경하시겠습니까?');
        if (!ok) return;
        setIsProcessing(true);
        try {
            await onConfirm(devices.map(d => d.id));
            onClose();
        } catch (e) {
            showAlert('오류 발생: ' + e, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        불용 처리 (Disposal Processing)
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800/30">
                        <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                            선택한 {devices.length}개의 기기에 대해 불용 신청 목록을 생성하고 상태를 변경합니다.
                        </p>
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">기기명</th>
                                    <th className="px-4 py-2">모델명</th>
                                    <th className="px-4 py-2">취득일</th>
                                    <th className="px-4 py-2">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {devices.map(d => (
                                    <tr key={d.id}>
                                        <td className="px-4 py-2">{d.name}</td>
                                        <td className="px-4 py-2">{d.model}</td>
                                        <td className="px-4 py-2">{d.purchaseDate}</td>
                                        <td className="px-4 py-2">{d.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                    <button
                        onClick={handleDownloadExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        엑셀 목록 생성
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:bg-gray-400"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        상태 변경 (불용 확정)
                    </button>
                </div>
            </div>
        </div>
    );
}
