'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Device, Location, DeviceInstance } from '@/types';
import { X, Monitor, Info, Edit, Plus, Search, Trash2, AlertCircle } from 'lucide-react';
import { PropsWithChildren } from 'react';

interface AssetZoneProps {
    location: Location;
    device?: Device;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick?: () => void;
    isSelected?: boolean;
    isSelectMode?: boolean;
}

export function AssetZone({ location, device, onClick, onDoubleClick, isSelected, isSelectMode }: AssetZoneProps) {
    const isMaintenance = device?.status === 'Maintenance' || device?.status === 'Broken';

    if (!location.width || !location.height) {
        return (
            <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 hover:z-20"
                style={{ left: `${location.pinX}%`, top: `${location.pinY}%` }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onClick(e); }}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
            >
                <motion.div
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-8 h-8 rounded-full shadow-lg flex items-center justify-center border-2 transition-colors ${isMaintenance ? 'bg-red-500 border-white' : 'bg-blue-600 border-white'
                        } ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}
                >
                    {isMaintenance ? (
                        <span className="text-white font-bold text-xs">!</span>
                    ) : (
                        <Monitor className="w-4 h-4 text-white" />
                    )}
                </motion.div>
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                    {location.name}
                </div>
            </div>
        );
    }

    const selectModeStyle = isSelectMode
        ? isSelected
            ? 'border-yellow-500 border-4'
            : 'border-blue-300 border-2 hover:border-blue-400'
        : 'border-gray-300 dark:border-gray-600';

    const bgColor = location.color || '#93c5fd';

    return (
        <div
            className={`absolute cursor-pointer rounded-lg border transition-all ${selectModeStyle} ${isSelected && !isSelectMode ? 'ring-4 ring-yellow-400' : ''
                }`}
            style={{
                left: `${location.pinX}%`,
                top: `${location.pinY}%`,
                width: `${location.width}%`,
                height: `${location.height}%`,
                backgroundColor: bgColor + 'CC',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClick(e); }}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
        >
            <div className="p-2 flex flex-col items-center justify-center h-full bg-white/40 dark:bg-gray-900/40 rounded-md backdrop-blur-sm pointer-events-none">
                <span className="text-sm font-bold text-gray-900 dark:text-white text-center drop-shadow-md whitespace-nowrap">
                    {location.name}
                </span>
            </div>
        </div>
    );
}

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    zone: Location;
    deviceInstances: DeviceInstance[];
    allDevices: Device[];
    allDeviceInstances?: DeviceInstance[]; // Added prop
    onEditDevice?: (device: Device) => void;
    onAssignDevice?: (deviceId: string, zoneId: string, zoneName: string, quantity: number) => Promise<void>;
    onRemoveInstance?: (instanceId: string) => Promise<void>;
}

export function AssetDetailModal({
    isOpen,
    onClose,
    zone,
    deviceInstances,
    allDevices = [],
    allDeviceInstances = [], // Default empty
    onEditDevice,
    onAssignDevice,
    onRemoveInstance,
    children
}: PropsWithChildren<AssetDetailModalProps>) {
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isAssigning, setIsAssigning] = useState(false);

    // Get devices in current zone
    const devicesInZone = deviceInstances
        .map(inst => {
            const device = allDevices.find(d => d.id === inst.deviceId);
            return device ? { device, instance: inst } : null;
        })
        .filter(Boolean) as { device: Device; instance: DeviceInstance }[];

    // Filter available devices for adding
    const availableDevices = allDevices.filter(d =>
        (searchTerm === '' ||
            d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.category?.toLowerCase().includes(searchTerm.toLowerCase())
        ) &&
        (categoryFilter === '' || d.category === categoryFilter)
    );

    const categories = Array.from(new Set(allDevices.map(d => d.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

    // Helper to calculate quantities
    const getDeviceStats = (device: Device) => {
        const deployedInstances = allDeviceInstances.filter(inst => inst.deviceId === device.id);
        const totalDeployed = deployedInstances.reduce((sum, inst) => sum + inst.quantity, 0);
        const totalQty = parseInt(String(device.quantity)) || 0;
        const remaining = Math.max(0, totalQty - totalDeployed);
        return { totalDeployed, totalQty, remaining };
    };

    const handleSelectDevice = (device: Device) => {
        const { remaining } = getDeviceStats(device);
        if (remaining > 0) {
            setSelectedDevice(device);
            setQuantity(1);
        } else {
            alert('배치 가능한 잔여 수량이 없습니다.');
        }
    };

    const handleConfirmAssign = async () => {
        if (!onAssignDevice || !selectedDevice) return;

        const { remaining } = getDeviceStats(selectedDevice);
        if (quantity > remaining) {
            alert(`배치 가능한 수량을 초과했습니다. (잔여: ${remaining}대)`);
            return;
        }

        setIsAssigning(true);
        try {
            await onAssignDevice(selectedDevice.id, zone.id, zone.name, quantity);
            setShowAddDevice(false);
            setSelectedDevice(null);
            setSearchTerm('');
            setCategoryFilter('');
            setQuantity(1);
        } catch (error) {
            alert('기기 배정 실패: ' + error);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleRemove = async (instanceId: string) => {
        if (!onRemoveInstance) return;
        if (!confirm('이 배치를 삭제하시겠습니까?')) return;
        try {
            await onRemoveInstance(instanceId);
        } catch (error) {
            alert('삭제 실패');
        }
    };

    if (!isOpen) return null;

    const totalDevicesInZone = deviceInstances.reduce((sum, inst) => sum + inst.quantity, 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {zone.name}
                                    <span className="text-xs text-gray-500 font-normal">
                                        ({totalDevicesInZone}대, {deviceInstances.length}개 품목)
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Zone ID: {zone.id}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-auto flex-1">
                            {!showAddDevice && !selectedDevice ? (
                                <>
                                    {/* Device Instance List */}
                                    {devicesInZone.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Monitor className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400">이 구역에 배치된 기기가 없습니다.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {devicesInZone.map(({ device, instance }) => (
                                                <div
                                                    key={instance.id}
                                                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div
                                                            className="flex items-start gap-3 flex-1 cursor-pointer"
                                                            onClick={() => onEditDevice?.(device)}
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                                <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-gray-900 dark:text-white">{device.name || '이름 없음'}</h4>
                                                                <p className="text-sm text-gray-600 dark:text-gray-400">{device.model}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${device.status === '사용 가능' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                        {device.status}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 px-2 py-0.5 rounded">
                                                                        수량: {instance.quantity}
                                                                    </span>
                                                                    {instance.notes && (
                                                                        <span className="text-xs text-gray-500">| {instance.notes}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => onEditDevice?.(device)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                                                title="기기 정보 수정"
                                                            >
                                                                <Edit className="w-4 h-4 text-blue-600" />
                                                            </button>
                                                            {onRemoveInstance && (
                                                                <button
                                                                    onClick={() => handleRemove(instance.id)}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                                    title="배치 삭제"
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {children}
                                </>
                            ) : selectedDevice ? (
                                /* Quantity Input */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            수량 입력
                                            <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                잔여: {getDeviceStats(selectedDevice).remaining}대
                                            </span>
                                        </h4>
                                        <button
                                            onClick={() => setSelectedDevice(null)}
                                            className="text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            취소
                                        </button>
                                    </div>

                                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">선택한 기기</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedDevice.name}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDevice.category} - {selectedDevice.model}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                            배치 수량 (최대 {getDeviceStats(selectedDevice).remaining}대)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max={getDeviceStats(selectedDevice).remaining}
                                            value={quantity}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const max = getDeviceStats(selectedDevice).remaining;
                                                if (val > max) setQuantity(max);
                                                else setQuantity(val);
                                            }}
                                            className="w-full px-4 py-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-lg font-semibold text-center"
                                            autoFocus
                                        />
                                        <input
                                            type="range"
                                            min="1"
                                            max={getDeviceStats(selectedDevice).remaining}
                                            value={quantity}
                                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                                            className="w-full mt-2"
                                        />
                                    </div>

                                    <button
                                        onClick={handleConfirmAssign}
                                        disabled={isAssigning || quantity < 1}
                                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-lg"
                                    >
                                        {isAssigning ? '배정 중...' : `${quantity}대 배정하기`}
                                    </button>
                                </div>
                            ) : (
                                /* Add Device UI */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-semibold text-gray-900 dark:text-white">기기 선택</h4>
                                        <button
                                            onClick={() => {
                                                setShowAddDevice(false);
                                                setSearchTerm('');
                                                setCategoryFilter('');
                                            }}
                                            className="text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            취소
                                        </button>
                                    </div>

                                    {/* Filters */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="검색..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
                                            />
                                        </div>
                                        <select
                                            value={categoryFilter}
                                            onChange={(e) => setCategoryFilter(e.target.value)}
                                            className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
                                        >
                                            <option value="">전체 분류</option>
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Available Devices List */}
                                    <div className="max-h-96 overflow-auto space-y-2 pr-1">
                                        {availableDevices.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">검색 결과가 없습니다.</p>
                                        ) : (
                                            availableDevices.map(device => {
                                                const { totalDeployed, totalQty, remaining } = getDeviceStats(device);
                                                const isDepleted = remaining <= 0;

                                                return (
                                                    <div
                                                        key={device.id}
                                                        className={`p-3 border rounded-lg transition-all ${isDepleted
                                                            ? 'opacity-60 bg-gray-100 dark:bg-gray-800 cursor-not-allowed border-gray-200'
                                                            : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 border-gray-200 hover:border-blue-300'
                                                            }`}
                                                        onClick={() => !isDepleted && handleSelectDevice(device)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                                                        {device.name}
                                                                    </p>
                                                                    {isDepleted ? (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                                                                            배치 완료
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                                                            잔여 {remaining}대
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                                    <span>{device.category}</span>
                                                                    <span className="w-px h-3 bg-gray-300"></span>
                                                                    <span>총 {totalQty}대</span>
                                                                    <span className="w-px h-3 bg-gray-300"></span>
                                                                    <span>배치됨 {totalDeployed}대</span>
                                                                </div>
                                                            </div>
                                                            {!isDepleted && (
                                                                <Plus className="w-4 h-4 text-blue-600" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-2 justify-between bg-gray-50 dark:bg-gray-800/50 shrink-0">
                            {!showAddDevice && !selectedDevice ? (
                                <>
                                    <button
                                        onClick={() => setShowAddDevice(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                                        disabled={!onAssignDevice}
                                    >
                                        <Plus className="w-4 h-4" />
                                        기기 추가
                                    </button>
                                    <Link
                                        href={`/devices`}
                                        className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                                    >
                                        기기 관리로 이동
                                    </Link>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Info className="w-4 h-4" />
                                    {selectedDevice ? '수량을 입력하고 배정하세요' : '구역에 추가할 기기를 선택하세요'}
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
