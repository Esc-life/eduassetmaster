'use client';

import { useState, useEffect } from 'react';
import { X, Save, Palette } from 'lucide-react';
import { Location } from '@/types';

interface ZoneEditModalProps {
    isOpen: boolean;
    zone: Location | null;
    onClose: () => void;
    onSave: (zoneId: string, updates: Partial<Location>) => void;
}

const PRESET_COLORS = [
    { name: '하늘색', value: '#93c5fd' },
    { name: '연두색', value: '#bef264' },
    { name: '노란색', value: '#fde047' },
    { name: '주황색', value: '#fb923c' },
    { name: '분홍색', value: '#f9a8d4' },
    { name: '보라색', value: '#c084fc' },
    { name: '민트색', value: '#5eead4' },
    { name: '회색', value: '#d1d5db' },
];

export function ZoneEditModal({ isOpen, zone, onClose, onSave }: ZoneEditModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        color: '#93c5fd',
        width: 10,
        height: 10,
    });

    useEffect(() => {
        if (zone) {
            setFormData({
                name: zone.name || '',
                color: zone.color || '#93c5fd',
                width: zone.width || 10,
                height: zone.height || 10,
            });
        }
    }, [zone]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!zone) return;

        // Auto-correct values (Clamp between 1 and 100, default to 10 if NaN)
        const width = isNaN(formData.width) ? 10 : Math.min(100, Math.max(1, formData.width));
        const height = isNaN(formData.height) ? 10 : Math.min(100, Math.max(1, formData.height));

        const correctedData = {
            ...formData,
            width,
            height
        };

        onSave(zone.id, correctedData);
        onClose();
    };

    if (!isOpen || !zone) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">구역 편집</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">구역 이름</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            배경 색상
                        </label>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {PRESET_COLORS.map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color: preset.value })}
                                    className={`h-12 rounded-lg border-2 transition-all ${formData.color === preset.value
                                        ? 'border-blue-500 ring-2 ring-blue-200'
                                        : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    style={{ backgroundColor: preset.value }}
                                    title={preset.name}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className="w-16 h-10 rounded border cursor-pointer"
                            />
                            <input
                                type="text"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm font-mono"
                                placeholder="#93c5fd"
                            />
                        </div>
                    </div>

                    {/* Size */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">너비 (%)</label>
                            <input
                                type="number"
                                value={formData.width}
                                onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                step="0.5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">높이 (%)</label>
                            <input
                                type="number"
                                value={formData.height}
                                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                step="0.5"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">미리보기</label>
                        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                            <div
                                className="rounded-lg border border-gray-400 flex items-center justify-center"
                                style={{
                                    backgroundColor: formData.color + 'CC',
                                    width: '100%',
                                    height: '80px',
                                }}
                            >
                                <div className="bg-white/40 dark:bg-gray-900/40 px-4 py-2 rounded backdrop-blur-sm">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white drop-shadow-md">
                                        {formData.name || '구역 이름'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            저장
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
