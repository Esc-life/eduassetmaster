'use client';

import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Device, Location } from '@/types';

interface DeviceEditModalProps {
    isOpen: boolean;
    device: Device | null;
    onClose: () => void;
    onSave: (updates: Partial<Device>) => Promise<void>;
    zones?: Location[]; // Available zones for dropdown
}

export function DeviceEditModal({ isOpen, device, onClose, onSave, zones = [] }: DeviceEditModalProps) {
    const [formData, setFormData] = useState<Partial<Device>>({
        name: '',
        model: '',
        category: '',
        ip: '',
        status: '사용 가능',
        purchaseDate: '',
        groupId: '',
        acquisitionDivision: '',
        quantity: '',
        unitPrice: '',
        totalAmount: '',
        serviceLifeChange: '',
        installLocation: '',
        osVersion: '',
        windowsPassword: '',
        userName: '',
        pcName: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (device) {
            setFormData({
                name: device.name || '',
                model: device.model || '',
                category: device.category || '',
                ip: device.ip || '',
                status: device.status || '사용 가능',
                purchaseDate: device.purchaseDate || '',
                groupId: device.groupId || '',
                acquisitionDivision: device.acquisitionDivision || '',
                quantity: device.quantity || '',
                unitPrice: device.unitPrice || '',
                totalAmount: device.totalAmount || '',
                serviceLifeChange: device.serviceLifeChange || '',
                installLocation: device.installLocation || '',
                osVersion: device.osVersion || '',
                windowsPassword: device.windowsPassword || '',
                userName: device.userName || '',
                pcName: device.pcName || '',
            });
        } else {
            // Reset for new device
            setFormData({
                name: '',
                model: '',
                category: '',
                ip: '',
                status: '사용 가능',
                purchaseDate: '',
                groupId: '',
                acquisitionDivision: '',
                quantity: '1',
                unitPrice: '0',
                totalAmount: '0',
                serviceLifeChange: '',
                installLocation: '',
                osVersion: '',
                windowsPassword: '',
                userName: '',
                pcName: '',
            });
        }
    }, [device, isOpen]);

    // Format number with commas for display
    const formatNumber = (value: string | number | undefined): string => {
        if (!value) return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
        if (isNaN(num)) return '';
        return num.toLocaleString('ko-KR');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    const isPCDevice = formData.category?.includes('노트북') || formData.category?.includes('데스크톱');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {device ? '기기 수정' : '기기 추가'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
                    <div className="space-y-6">
                        {/* 기본 정보 */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2">기본 정보</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">품명/규격 *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">물품분류명 *</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                                        required
                                        placeholder="예: 노트북컴퓨터, 데스크톱컴퓨터"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">물품목록번호</label>
                                    <input
                                        type="text"
                                        value={formData.model}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">상태</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        <option value="사용 가능">사용 가능</option>
                                        <option value="사용 중">사용 중</option>
                                        <option value="수리/점검">수리/점검</option>
                                        <option value="고장/폐기">고장/폐기</option>
                                        <option value="분실">분실</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 취득 정보 */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2">취득 정보</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">취득일</label>
                                    <input
                                        type="date"
                                        value={formData.purchaseDate}
                                        onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">취득구분</label>
                                    <input
                                        type="text"
                                        value={formData.acquisitionDivision}
                                        onChange={(e) => setFormData({ ...formData, acquisitionDivision: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">수량</label>
                                    <input
                                        type="number"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">단가</label>
                                    <input
                                        type="text"
                                        value={formatNumber(formData.unitPrice)}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/,/g, '');
                                            if (rawValue === '' || /^\d+$/.test(rawValue)) {
                                                setFormData({ ...formData, unitPrice: rawValue });
                                            }
                                        }}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">취득금액</label>
                                    <input
                                        type="text"
                                        value={formatNumber(formData.totalAmount)}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/,/g, '');
                                            if (rawValue === '' || /^\d+$/.test(rawValue)) {
                                                setFormData({ ...formData, totalAmount: rawValue });
                                            }
                                        }}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">내용연수 중 변경</label>
                                    <input
                                        type="text"
                                        value={formData.serviceLifeChange}
                                        onChange={(e) => setFormData({ ...formData, serviceLifeChange: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 위치 정보 */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2">위치 정보</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">운용부서</label>
                                    <input
                                        type="text"
                                        value={formData.groupId}
                                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        placeholder="예: zone-1234"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">설치장소</label>
                                    {zones.length > 0 ? (
                                        <select
                                            value={formData.installLocation}
                                            onChange={(e) => setFormData({ ...formData, installLocation: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        >
                                            <option value="">-- 구역 선택 --</option>
                                            {zones.map((zone) => (
                                                <option key={zone.id} value={zone.name}>
                                                    {zone.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.installLocation}
                                            onChange={(e) => setFormData({ ...formData, installLocation: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            placeholder="상세 위치 입력"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* PC 상세 정보 (노트북/데스크톱만) */}
                        {isPCDevice && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2 flex items-center gap-2">
                                    <span>🖥️ PC 상세 정보</span>
                                    <span className="text-xs text-gray-500">(노트북/데스크톱 전용)</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">IP 주소</label>
                                        <input
                                            type="text"
                                            value={formData.ip}
                                            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            placeholder="192.168.0.1"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">OS 버전</label>
                                        <input
                                            type="text"
                                            value={formData.osVersion}
                                            onChange={(e) => setFormData({ ...formData, osVersion: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            placeholder="Windows 11 Pro"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">사용자명</label>
                                        <input
                                            type="text"
                                            value={formData.userName}
                                            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            placeholder="홍길동"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">PC 이름</label>
                                        <input
                                            type="text"
                                            value={formData.pcName}
                                            onChange={(e) => setFormData({ ...formData, pcName: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            placeholder="DESKTOP-ABC123"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">윈도우 비밀번호</label>
                                        <input
                                            type="password"
                                            value={formData.windowsPassword}
                                            onChange={(e) => setFormData({ ...formData, windowsPassword: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
