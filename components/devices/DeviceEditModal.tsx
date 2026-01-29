'use client';

import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Device } from '@/types';

interface DeviceEditModalProps {
    isOpen: boolean;
    device: Device | null;
    onClose: () => void;
    onSave: (deviceId: string, updates: Partial<Device>) => Promise<void>;
}

export function DeviceEditModal({ isOpen, device, onClose, onSave }: DeviceEditModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        model: '',
        category: '',
        ip: '',
        status: 'Active' as any,
        purchaseDate: '',
        groupId: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (device) {
            setFormData({
                name: device.name || '',
                model: device.model || '',
                category: device.category || '',
                ip: device.ip || '',
                status: device.status || 'Active',
                purchaseDate: device.purchaseDate || '',
                groupId: device.groupId || '',
            });
        }
    }, [device]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!device) return;

        setIsSaving(true);
        try {
            await onSave(device.id, formData);
            onClose();
        } catch (error) {
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !device) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">기기 수정</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">품명/규격 *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">물품목록번호</label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">물품분류명 *</label>
                            <input
                                type="text"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">IP 주소</label>
                            <input
                                type="text"
                                value={formData.ip}
                                onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">상태</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            >
                                <option value="Active">Active</option>
                                <option value="In Use">In Use</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Broken">Broken</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">취득일</label>
                            <input
                                type="date"
                                value={formData.purchaseDate}
                                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">운용부서</label>
                            <input
                                type="text"
                                value={formData.groupId}
                                onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
