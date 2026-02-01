'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Device, Location } from '@/types';
import { X, Monitor, Info, CheckCircle2, AlertCircle, Edit } from 'lucide-react';
import { PropsWithChildren } from 'react';

interface AssetZoneProps {
    location: Location;
    device?: Device;
    onClick: (e: React.MouseEvent) => void;
    isSelected?: boolean;
    isSelectMode?: boolean;
}

export function AssetZone({ location, device, onClick, isSelected, isSelectMode }: AssetZoneProps) {
    const isMaintenance = device?.status === 'Maintenance' || device?.status === 'Broken';

    // If no width/height, fallback to Pin (Legacy)
    if (!location.width || !location.height) {
        return (
            <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 hover:z-20"
                style={{ left: `${location.pinX}%`, top: `${location.pinY}%` }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onClick(e); }}
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
            ? 'bg-yellow-400/30 border-yellow-500 border-4'
            : 'bg-blue-500/10 border-blue-300 border-2 hover:bg-blue-500/20'
        : 'bg-blue-500/10 hover:bg-blue-500/20';

    return (
        <div
            className={`absolute cursor-pointer rounded-lg border transition-all ${selectModeStyle} ${isSelected && !isSelectMode ? 'ring-4 ring-yellow-400' : ''
                }`}
            style={{
                left: `${location.pinX}%`,
                top: `${location.pinY}%`,
                width: `${location.width}%`,
                height: `${location.height}%`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onClick(e); }}
        >
            <div className="p-2 flex flex-col items-center justify-center h-full">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                    {location.name}
                </span>
            </div>
        </div>
    );
}

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    zone: Location; // Zone 정보
    devices: Device[]; // 해당 구역의 모든 기기들
    onEditDevice?: (device: Device) => void; // 기기 수정 콜백
}

export function AssetDetailModal({ isOpen, onClose, zone, devices, onEditDevice, children }: PropsWithChildren<AssetDetailModalProps>) {
    if (!isOpen) return null;

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
                        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-100 dark:border-gray-800"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {zone.name}
                                    <span className="text-xs text-gray-500 font-normal">({devices.length}대)</span>
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

                        {/* Content - Device List */}
                        <div className="p-6 overflow-auto max-h-[60vh]">
                            {devices.length === 0 ? (
                                <div className="text-center py-12">
                                    <Monitor className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400">이 구역에 배치된 기기가 없습니다.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {devices.map((device) => (
                                        <div
                                            key={device.id}
                                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                                            onClick={() => onEditDevice?.(device)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3 flex-1">
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
                                                            {device.installLocation && (
                                                                <span className="text-xs text-gray-500">📍 {device.installLocation}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditDevice?.(device);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                                    title="수정"
                                                >
                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {children}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-2 justify-between bg-gray-50 dark:bg-gray-800/50">
                            <button
                                onClick={() => alert(`이 구역 ID를 복사하여 기기 관리 페이지에서\n"운용부서" 또는 "설치장소" 필드에 입력하면\n해당 구역에 기기가 배치됩니다.\n\nZone ID: ${zone.id}`)}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Info className="w-4 h-4" />
                                사용 방법
                            </button>
                            <Link
                                href={`/devices`}
                                className="px-4 py-2 bg-primary hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                기기 관리로 이동
                            </Link>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
