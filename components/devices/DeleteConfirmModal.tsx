'use client';

import { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    type: 'single' | 'all';
    onClose: () => void;
    onConfirm: () => Promise<void>;
    deviceName?: string;
    validationText?: string;
}

export function DeleteConfirmModal({ isOpen, type, onClose, onConfirm, deviceName, validationText }: DeleteConfirmModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const targetText = validationText || (type === 'all' ? '전체 삭제' : '');
    const needsInput = !!targetText;

    const handleConfirm = async () => {
        if (needsInput && confirmText !== targetText) {
            alert(`"${targetText}"를 정확히 입력해주세요.`);
            return;
        }

        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
            setConfirmText('');
        } catch (error) {
            // Error handling usually in parent
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        {needsInput ? '삭제 확인' : '삭제 확인'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {type === 'single' && !needsInput ? (
                        <div className="space-y-3">
                            <p className="text-gray-700 dark:text-gray-300">
                                다음 기기를 삭제하시겠습니까?
                            </p>
                            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                <p className="font-medium text-red-700 dark:text-red-300">{deviceName}</p>
                            </div>
                            <p className="text-sm text-gray-500">이 작업은 되돌릴 수 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-2 border-red-200 dark:border-red-800">
                                <p className="font-bold text-red-700 dark:text-red-300 mb-2">⚠️ 경고</p>
                                <p className="text-red-600 dark:text-red-400">
                                    {type === 'all' ? '모든 기기 데이터가 영구적으로 삭제됩니다!' : '이 작업은 되돌릴 수 없습니다!'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    계속하려면 <span className="font-bold text-red-600">"{targetText}"</span>를 입력하세요:
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={targetText}
                                    className="w-full px-4 py-2 border-2 border-red-300 dark:border-red-700 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isDeleting || (needsInput && confirmText !== targetText)}
                            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-4 h-4" />
                            {isDeleting ? '삭제 중...' : '삭제'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
