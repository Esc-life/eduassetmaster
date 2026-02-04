'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Device, Location, DeviceInstance } from '@/types';
import { X, Monitor, Info, Edit, Plus, Search, Trash2 } from 'lucide-react';
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

    // If no width/height, fallback to Pin (Legacy)
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

    // Render Rectangular Zone
    const selectModeStyle = isSelectMode
        ? isSelected
            ? 'border-yellow-500 border-4'
            : 'border-blue-300 border-2 hover:border-blue-400'
        : 'border-gray-300 dark:border-gray-600';

    // Default color if not set
    const bgColor = location.color || '#93c5fd'; // light blue default

    return (
        <div
            className={`absolute cursor-pointer rounded-lg border transition-all ${selectModeStyle} ${isSelected && !isSelectMode ? 'ring-4 ring-yellow-400' : ''
                }`}
            style={{
                left: `${location.pinX}%`,
                top: `${location.pinY}%`,
                width: `${location.width}%`,
                height: `${location.height}%`,
                backgroundColor: bgColor + 'CC', // Add alpha for semi-transparency
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClick(e); }}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
        >
            <div className="p-2 flex flex-col items-center justify-center h-full bg-white/40 dark:bg-gray-900/40 rounded-md backdrop-blur-sm">
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
    deviceInstances: DeviceInstance[]; // 이 구역의 인스턴스들
    allDevices: Device[]; // 전체 기기 목록
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

    // Get devices from instances
    const devicesInZone = deviceInstances
        .map(inst => {
            const device = allDevices.find(d => d.id === inst.deviceId);
            return device ? { device, instance: inst } : null;
        })
        .filter(Boolean) as { device: Device; instance: DeviceInstance }[];

    // Filter available devices
    const availableDevices = allDevices.filter(d =>
        (searchTerm === '' ||
            d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.category?.toLowerCase().includes(searchTerm.toLowerCase())
        ) &&
        (categoryFilter === '' || d.category === categoryFilter)
    );

    const categories = Array.from(new Set(allDevices.map(d => d.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));

    const handleSelectDevice = (device: Device) => {
        setSelectedDevice(device);
        setQuantity(1);
    };

    const handleConfirmAssign = async () => {
        if (!onAssignDevice || !selectedDevice) return;
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

    const totalDevices = deviceInstances.reduce((sum, inst) => sum + inst.quantity, 0);

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
                        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-gray-100 dark:border-gray-800"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {zone.name}
                                    <span className="text-xs text-gray-500 font-normal">
                                        ({totalDevices}대, {deviceInstances.length}개 품목)
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
                        <div className="p-6 overflow-auto max-h-[calc(85vh-180px)]">
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
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${device.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                        device.status === 'In Use' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                        }`}>
                                                                        {device.status}
                                                                    </span>
                                                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
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
                                        <h4 className="font-semibold text-gray-900 dark:text-white">수량 입력</h4>
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
                                            배치 수량
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={quantity}
                                            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                            className="w-full px-4 py-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-lg font-semibold"
                                            autoFocus
                                        />
                                        <p className="text-xs text-gray-500 mt-1">이 구역에 배치할 기기 수량을 입력하세요.</p>
                                    </div>

                                    <button
                                        onClick={handleConfirmAssign}
                                        disabled={isAssigning || quantity < 1}
                                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
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

                                    {/* Available Devices */}
                                    <div className="max-h-96 overflow-auto space-y-2">
                                        {availableDevices.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">검색 결과가 없습니다.</p>
                                        ) : (
                                            availableDevices.map(device => {
                                                // Check if this device is already deployed anywhere
                                                const deployedInstances = deviceInstances.filter(inst => inst.deviceId === device.id);
                                                const totalDeployed = deployedInstances.reduce((sum, inst) => sum + inst.quantity, 0);
                                                const isDeployed = deployedInstances.length > 0;

                                                return (
                                                    <div
                                                        key={device.id}
                                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${isDeployed
                                                            ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                                            : 'border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                            }`}
                                                        onClick={() => handleSelectDevice(device)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-medium text-sm ${isDeployed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                                        {device.name}
                                                                    </p>
                                                                    {isDeployed && (
                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                            {totalDeployed}대 배치됨
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className={`text-xs ${isDeployed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500'}`}>
                                                                    {device.category} - {device.model}
                                                                </p>
                                                            </div>
                                                            <Plus className={`w-4 h-4 ${isDeployed ? 'text-gray-400' : 'text-blue-600'}`} />
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
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-2 justify-between bg-gray-50 dark:bg-gray-800/50">
                            {!showAddDevice && !selectedDevice ? (
                                <>
                                    <button
                                        onClick={() => setShowAddDevice(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                                        disabled={!onAssignDevice}
                                    >
                                        <Plus className="w-4 h-4" />
                                        기기 추가
                                    </button>
                                    <Link
                                        href={`/devices`}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                                    >
                                        기기 관리로 이동
                                    </Link>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    {selectedDevice ? '수량을 입력하고 배정하세요' : '기기를 선택하세요'}
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
