'use client';

import { useState, useEffect } from 'react';
import { Location } from '@/types';
import { X, Save, ScanSearch, Wand2, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ZoneBatchEditModalProps {
    isOpen: boolean;
    zones: Location[];
    onClose: () => void;
    onSave: (newZones: Location[]) => void;
    onAutoDetect: () => void;
    isScanning?: boolean;
}

export function ZoneBatchEditModal({ isOpen, zones, onClose, onSave, onAutoDetect, isScanning }: ZoneBatchEditModalProps) {
    const [editedZones, setEditedZones] = useState<Location[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Initial Sort and Set
            const sorted = JSON.parse(JSON.stringify(zones)).sort((a: Location, b: Location) => {
                const isTempA = !a.name || /^구역\s*\d+$/.test(a.name);
                const isTempB = !b.name || /^구역\s*\d+$/.test(b.name);
                if (isTempA && !isTempB) return -1;
                if (!isTempA && isTempB) return 1;

                const numA = parseInt(a.name?.replace(/[^0-9]/g, '') || '9999');
                const numB = parseInt(b.name?.replace(/[^0-9]/g, '') || '9999');
                if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;

                return (a.name || '').localeCompare(b.name || '');
            });
            setEditedZones(sorted);
        }
    }, [isOpen, zones]);

    const handleChangeName = (id: string, newName: string) => {
        setEditedZones(prev => prev.map(z => z.id === id ? { ...z, name: newName } : z));
    };

    const handleSave = () => {
        onSave(editedZones);
        onClose();
    };

    // Use editedZones directly for rendering to prevent re-sorting during typing
    const displayedZones = editedZones;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">구역 이름 일괄 편집</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            목록에서 구역 이름을 직접 수정하고 한 번에 저장하세요.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800 flex flex-wrap gap-3 shrink-0 items-center">
                    <button
                        onClick={onAutoDetect}
                        disabled={isScanning}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 shadow-sm text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-75 disabled:cursor-wait"
                    >
                        {isScanning ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                추출 중...
                            </>
                        ) : (
                            <>
                                <ScanSearch className="w-4 h-4" />
                                AI 이름 자동 추출
                            </>
                        )}
                    </button>
                    <div className="text-xs text-blue-600 flex items-center ml-auto hidden sm:flex">
                        <Wand2 className="w-3 h-3 mr-1" />
                        AI 인식 후 아래 목록에서 결과를 수정할 수 있습니다.
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-gray-50/30 dark:bg-black/10">
                    {displayedZones.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            등록된 구역이 없습니다. (구역 편집 모드에서 구역을 생성하세요)
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {displayedZones.map((zone) => {
                                const isTemp = !zone.name || /^구역\s*\d+$/.test(zone.name);
                                return (
                                    <div key={zone.id} className={`group flex items-center gap-3 p-3 rounded-lg border transition-colors ${isTemp ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300'}`}>
                                        <div
                                            className="w-8 h-8 rounded border shrink-0 shadow-sm"
                                            style={{ backgroundColor: zone.color || '#93c5fd' }}
                                            title="구역 색상 (편집 모드에서 변경 가능)"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between">
                                                <label className="text-[10px] font-mono text-gray-400 mb-0.5 block truncate" title={zone.id}>
                                                    ID: ...{zone.id.slice(-8)}
                                                </label>
                                                {isTemp && (
                                                    <span className="text-[9px] text-orange-600 bg-orange-100 px-1 rounded font-bold">임시</span>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                value={zone.name || ''}
                                                onChange={(e) => handleChangeName(zone.id, e.target.value)}
                                                placeholder="이름 입력"
                                                className={`w-full text-sm font-medium bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none transition-colors ${isTemp ? 'text-gray-900 placeholder-orange-300' : 'text-gray-900 dark:text-white'}`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium">
                        닫기
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                    >
                        <Check className="w-4 h-4" />
                        변경 사항 저장 ({editedZones.length})
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
