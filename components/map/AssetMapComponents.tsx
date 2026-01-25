'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Device, Location } from '@/types';
import { X, Monitor, Info, CheckCircle2, AlertCircle } from 'lucide-react';
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
        ? (isSelected ? 'bg-red-500/40 border-red-500 z-20' : 'bg-gray-400/10 border-gray-400/30 hover:bg-red-500/10 hover:border-red-400 border-dashed')
        : (isSelected ? 'bg-primary/40 border-yellow-400 z-10' : 'bg-primary/20 border-primary/50 hover:bg-primary/30 dark:bg-primary/30 dark:border-primary/50');

    return (
        <div
            className={`absolute cursor-pointer group transition-all border-2 ${selectModeStyle} ${!isSelectMode && isMaintenance ? 'bg-red-500/20 border-red-500/50' : ''
                }`}
            style={{
                left: `${location.pinX}%`,
                top: `${location.pinY}%`,
                width: `${location.width}%`,
                height: `${location.height}%`
            }}
            onMouseDown={(e) => e.stopPropagation()} // Prevent background clearing selection
            onClick={(e) => { e.stopPropagation(); onClick(e); }}
        >
            {/* Center Icon/Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isMaintenance && <AlertCircle className="w-6 h-6 text-red-600 drop-shadow-md mb-1" />}
                <span className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {location.name}
                </span>
            </div>
        </div>
    );
}

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: any; // Flexible data for now
}

export function AssetDetailModal({ isOpen, onClose, title, data, children }: PropsWithChildren<AssetDetailModalProps>) {
    // Prevent rendering if not open
    // However, AnimatePresence needs the component to be mounted (but conditionally rendered inside)
    // or wrapped by AnimatePresence in the parent.
    // Here we assume parent wraps it or we only render content when isOpen is true.
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
                        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {title}
                                {data?.status && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${data.status === 'Available' ? 'bg-green-50 text-green-600 border-green-200' :
                                        data.status === 'In Use' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                            'bg-red-50 text-red-600 border-red-200'
                                        }`}>
                                        {data.status}
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                                    <Monitor className="w-8 h-8 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">대표 기기 정보</p>
                                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{data?.model || '배치된 기기 없음'}</h4>
                                    <p className="text-xs text-gray-400 mt-1">{data?.id || '-'}</p>
                                </div>
                            </div>

                            {children}

                            <div className="pt-4 flex gap-2">
                                <Link
                                    href={`/devices`}
                                    className="flex-1 px-4 py-2 bg-primary hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                                >
                                    기기 상세보기
                                </Link>
                                <button
                                    onClick={() => alert(`Zone ID: ${data?.id}\nCustom Name 설정을 위해 이 ID를 Locations 시트에 입력하세요.`)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Info className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
