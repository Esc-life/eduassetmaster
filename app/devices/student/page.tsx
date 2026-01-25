'use client';

import { useState } from 'react';
import { MOCK_DEVICES } from '@/lib/mock-data';
import { Device } from '@/types';
import { Tablet, BoxSelect, BatteryCharging, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentDevicesPage() {
    const [selectedCart, setSelectedCart] = useState<string>('CART-A');
    const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

    // Filter only tablets/student devices
    const studentDevices = MOCK_DEVICES.filter(d =>
        d.category === 'Tablet' || d.groupId.startsWith('CART')
    );

    const cartGroups = Array.from(new Set(studentDevices.map(d => d.groupId)));

    const toggleSelection = (id: string) => {
        setSelectedDevices(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkStatusChange = (newStatus: string) => {
        if (selectedDevices.length === 0) return;
        alert(`${selectedDevices.length}개 기기의 상태를 [${newStatus}]로 변경합니다.\n(실제 DB 연동 예정)`);
        // Reset selection after action
        setSelectedDevices([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Tablet className="w-6 h-6 text-primary" />
                        학생용 기기 (충전보관함)
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        카트 단위 대량 관리 및 상태 일괄 업데이트
                    </p>
                </div>
            </div>

            {/* Cart Selection Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {cartGroups.map(group => (
                    <button
                        key={group}
                        onClick={() => { setSelectedCart(group); setSelectedDevices([]); }}
                        className={`px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap border ${selectedCart === group
                                ? 'bg-primary text-white border-primary shadow-lg shadow-blue-500/20'
                                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50'
                            }`}
                    >
                        {group} 보관함
                    </button>
                ))}
            </div>

            {/* Bulk Actions Header */}
            <div className={`
        flex items-center justify-between p-4 rounded-xl border transition-all
        ${selectedDevices.length > 0
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 translate-y-0 opacity-100'
                    : 'bg-gray-50 dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-700 opacity-80'}
      `}>
                <div className="flex items-center gap-3">
                    <BoxSelect className="w-5 h-5 text-gray-500" />
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {selectedDevices.length}개 선택됨
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={selectedDevices.length === 0}
                        onClick={() => handleBulkStatusChange('Available')}
                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                        <CheckCircle2 className="w-3 h-3" /> 반납/정상화
                    </button>
                    <button
                        disabled={selectedDevices.length === 0}
                        onClick={() => handleBulkStatusChange('Maintenance')}
                        className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                        <AlertCircle className="w-3 h-3" /> 수리 접수
                    </button>
                </div>
            </div>

            {/* Device Grid (Cart View) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {studentDevices
                    .filter(d => d.groupId === selectedCart)
                    .map((device, index) => {
                        const isSelected = selectedDevices.includes(device.id);
                        const isBroken = device.status === 'Maintenance' || device.status === 'Broken';

                        return (
                            <motion.div
                                key={device.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => toggleSelection(device.id)}
                                className={`
                  relative aspect-[3/4] rounded-2xl border-2 cursor-pointer transition-all group overflow-hidden
                  flex flex-col items-center justify-between p-4
                  ${isSelected
                                        ? 'border-primary bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'}
                `}
                            >
                                {/* Top Indicator */}
                                <div className="w-full flex justify-between items-start">
                                    <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
                                    <div className={`w-2 h-2 rounded-full ${isBroken ? 'bg-red-500' : 'bg-green-500'}`} />
                                </div>

                                {/* Center Icon */}
                                <div className={`
                    p-3 rounded-full mb-2 transition-transform group-hover:scale-110
                    ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}
                 `}>
                                    <Tablet className="w-8 h-8" />
                                </div>

                                {/* Bottom Info */}
                                <div className="text-center w-full">
                                    <div className="font-bold text-gray-800 dark:text-gray-200 truncate text-sm">
                                        {device.name?.replace('학생용 태블릿', '') || `Tab ${index + 1}`}
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate mt-1">
                                        {device.status}
                                    </div>
                                </div>

                                {/* Selection Overlay Checkmark */}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 text-primary">
                                        <CheckCircle2 className="w-5 h-5 fill-current" />
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}

                {/* Add Empty Slot Placeholders to simulate a real cart grid if needed */}
                {Array.from({ length: Math.max(0, 30 - studentDevices.filter(d => d.groupId === selectedCart).length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-[3/4] rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center opacity-30">
                        <span className="text-xs text-gray-400">Empty Slot</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
