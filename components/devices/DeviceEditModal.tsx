'use client';

import { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Device, Location } from '@/types';
import { getDeviceInstances, updateDeviceWithDistribution } from '@/app/actions';
import { useRouter } from 'next/navigation';

interface DeviceEditModalProps {
    isOpen: boolean;
    device: Device | null;
    onClose: () => void;
    onSave: (updates: Partial<Device>) => Promise<void>;
    zones?: Location[];
}

export function DeviceEditModal({ isOpen, device, onClose, onSave, zones = [] }: DeviceEditModalProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<Partial<Device>>({
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

    // 배치 정보 관리
    const [distributions, setDistributions] = useState<{ locationId?: string, locationName: string, quantity: number }[]>([]);
    const [isLoadingDist, setIsLoadingDist] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (device) {
            setFormData({
                name: device.name || '',
                model: device.model || '',
                category: device.category || '',
                ip: device.ip || '',
                status: device.status || '사용 가능',
                purchaseDate: device.purchaseDate ? device.purchaseDate.replace(/\./g, '-') : '',
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

            // 배치 상세 정보 로드
            setIsLoadingDist(true);
            getDeviceInstances(device.id).then((insts: any[]) => {
                if (insts && insts.length > 0) {
                    setDistributions(insts.map((i: any) => ({ locationId: i.locationId, locationName: i.locationName, quantity: i.quantity })));
                } else {
                    const qty = parseInt(String(device.quantity || '1'));
                    if (device.installLocation && device.installLocation.trim() !== '') {
                        // 기존 단순 텍스트가 있으면 그것을 1개의 배치로 간주
                        setDistributions([{ locationName: device.installLocation, quantity: qty }]);
                    } else {
                        setDistributions([{ locationName: '', quantity: qty }]);
                    }
                }
                setIsLoadingDist(false);
            });
        } else {
            // 신규 등록
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
            setDistributions([{ locationName: '', quantity: 1 }]);
        }
    }, [device, isOpen]);

    const formatNumber = (value: string | number | undefined): string => {
        if (!value) return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
        if (isNaN(num)) return '';
        return num.toLocaleString('ko-KR');
    };

    const handleDistChange = (index: number, field: 'locationName' | 'quantity', value: any) => {
        const newDist = [...distributions];
        // If updating location from Select (ID based)
        if (field === 'locationName' && zones.length > 0) {
            // This handler might be called with ID if we change the Select value to ID.
            // But for safety, let's create a dedicated handler for location.
            newDist[index] = { ...newDist[index], [field]: value };
        } else {
            newDist[index] = { ...newDist[index], [field]: value };
        }
        setDistributions(newDist);
    };

    const handleLocationSelect = (index: number, zoneId: string) => {
        const newDist = [...distributions];
        const zone = zones.find(z => z.id === zoneId);
        newDist[index] = {
            ...newDist[index],
            locationId: zoneId,
            locationName: zone ? zone.name : ''
        };
        setDistributions(newDist);
    };

    const addDistRow = () => {
        setDistributions([...distributions, { locationId: '', locationName: '', quantity: 0 }]);
    };

    const removeDistRow = (index: number) => {
        if (distributions.length > 1) {
            setDistributions(distributions.filter((_, i) => i !== index));
        } else {
            setDistributions([{ locationId: '', locationName: '', quantity: 0 }]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const totalQty = parseInt(String(formData.quantity || 0));
        const distSum = distributions.reduce((sum, d) => sum + Number(d.quantity), 0);

        if (distSum !== totalQty) {
            if (!confirm(`배치 수량 합계(${distSum})가 총 수량(${totalQty})과 일치하지 않습니다.\n이대로 저장하시겠습니까?\n(불일치 시 배치 정보가 우선될 수 있습니다)`)) {
                return;
            }
        }

        setIsSaving(true);
        try {
            if (device) {
                const result = await updateDeviceWithDistribution(device.id, formData, distributions);
                if (!result.success) throw new Error(result.error);
                router.refresh();
                await onSave({});
                onClose();
            } else {
                await onSave(formData);
                onClose();
            }
        } catch (error) {
            alert('저장 실패: ' + error);
        } finally {
            setIsSaving(false);
        }
    };

    const isPCDevice = formData.category?.includes('노트북') || formData.category?.includes('데스크톱');

    if (!isOpen) return null;

    const totalQty = parseInt(String(formData.quantity || 0));
    const currentDistSum = distributions.reduce((sum, d) => sum + Number(d.quantity), 0);
    const isSumMismatch = totalQty !== currentDistSum;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {device ? '기기 정보 수정' : '기기 추가'}
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
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">물품분류명 *</label>
                                    <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" required placeholder="예: 노트북컴퓨터" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">물품목록번호</label>
                                    <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">상태</label>
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
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
                                    <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">취득구분</label>
                                    <input type="text" value={formData.acquisitionDivision} onChange={(e) => setFormData({ ...formData, acquisitionDivision: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">수량</label>
                                    <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">단가</label>
                                    <input type="text" value={formatNumber(formData.unitPrice)} onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (raw === '' || /^\d+$/.test(raw)) setFormData({ ...formData, unitPrice: raw }); }} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">취득금액</label>
                                    <input type="text" value={formatNumber(formData.totalAmount)} onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); if (raw === '' || /^\d+$/.test(raw)) setFormData({ ...formData, totalAmount: raw }); }} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">내용연수 중 변경</label>
                                    <input type="text" value={formData.serviceLifeChange} onChange={(e) => setFormData({ ...formData, serviceLifeChange: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                </div>
                            </div>
                        </div>

                        {/* 배치 상세 관리 */}
                        <div>
                            <div className="flex items-center justify-between mb-4 border-b pb-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    배치 상세 관리 (총 {totalQty}대)
                                    {isSumMismatch && <span className="text-sm font-normal text-amber-500 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> 수량 불일치</span>}
                                </h3>
                                <button type="button" onClick={addDistRow} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
                                    <Plus className="w-4 h-4" /> 장소 추가
                                </button>
                            </div>

                            {isLoadingDist ? (
                                <div className="text-center py-4 text-gray-500">배치 정보를 불러오는 중...</div>
                            ) : (
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                                    {distributions.map((dist, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">설치장소 {idx + 1}</label>
                                                {zones.length > 0 ? (
                                                    <select
                                                        value={dist.locationId || ''}
                                                        onChange={(e) => handleLocationSelect(idx, e.target.value)}
                                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
                                                    >
                                                        <option value="">-- 구역 선택 --</option>
                                                        {[...zones].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((zone) => (
                                                            <option key={zone.id} value={zone.id}>{zone.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={dist.locationName}
                                                        onChange={(e) => handleDistChange(idx, 'locationName', e.target.value)}
                                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
                                                        placeholder="장소 이름 입력"
                                                    />
                                                )}
                                            </div>
                                            <div className="w-24">
                                                <label className="block text-xs text-gray-500 mb-1">수량</label>
                                                <input
                                                    type="number"
                                                    value={dist.quantity}
                                                    onChange={(e) => handleDistChange(idx, 'quantity', parseInt(e.target.value))}
                                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm text-center"
                                                />
                                            </div>
                                            <div className="pt-6">
                                                <button
                                                    type="button"
                                                    onClick={() => removeDistRow(idx)}
                                                    className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flex justify-between items-center pt-2 text-sm border-t border-gray-200 dark:border-gray-700 mt-2">
                                        <span className="text-gray-500">기기 총 수량: {totalQty}</span>
                                        <span className={`font-bold ${isSumMismatch ? 'text-red-500' : 'text-green-600'}`}>
                                            배치 합계: {currentDistSum}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PC 상세 정보 */}
                        {isPCDevice && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white border-b pb-2 flex items-center gap-2">
                                    <span>🖥️ PC 상세 정보</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">IP 주소</label>
                                        <input type="text" value={formData.ip} onChange={(e) => setFormData({ ...formData, ip: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" placeholder="192.168.0.1" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">OS 버전</label>
                                        <input type="text" value={formData.osVersion} onChange={(e) => setFormData({ ...formData, osVersion: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">사용자명</label>
                                        <input type="text" value={formData.userName} onChange={(e) => setFormData({ ...formData, userName: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">PC 이름</label>
                                        <input type="text" value={formData.pcName} onChange={(e) => setFormData({ ...formData, pcName: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">윈도우 비밀번호</label>
                                        <input type="password" value={formData.windowsPassword} onChange={(e) => setFormData({ ...formData, windowsPassword: e.target.value })} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">취소</button>
                        <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            <Save className="w-4 h-4" /> {isSaving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
