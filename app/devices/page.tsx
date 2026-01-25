'use client';

import { useState, useEffect } from 'react';
import { fetchAssetData } from '@/app/actions';
import { Device, DeviceStatus } from '@/types';
import { Search, Filter, MoreHorizontal, Laptop, Tablet, Smartphone, Monitor, Loader2 } from 'lucide-react';

export default function DevicesPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'All'>('All');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const data = await fetchAssetData();
            setDevices(data.devices);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const filteredDevices = devices.filter((device) => {
        const matchesStatus = filterStatus === 'All' || device.status === filterStatus;
        const matchesSearch =
            device.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            device.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            device.id.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const getStatusColor = (status: DeviceStatus) => {
        switch (status) {
            case 'Available': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'In Use': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Maintenance': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Broken': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'Lost': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getIcon = (category: string) => {
        const cat = category.toLowerCase();
        if (cat.includes('laptop')) return <Laptop className="w-4 h-4" />;
        if (cat.includes('tablet')) return <Tablet className="w-4 h-4" />;
        if (cat.includes('pc') || cat.includes('desktop')) return <Monitor className="w-4 h-4" />;
        return <Smartphone className="w-4 h-4" />;
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">기기 관리</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">전체 자산 목록 및 상태를 관리합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        내보내기
                    </button>
                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors shadow-sm">
                        + 기기 등록
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="기기명, 모델, ID 검색..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {(['All', 'Available', 'In Use', 'Maintenance', 'Broken'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === status
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {status === 'All' ? '전체' : status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Device Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">자산 정보</th>
                                <th className="px-6 py-4 font-medium">상태</th>
                                <th className="px-6 py-4 font-medium">위치/그룹</th>
                                <th className="px-6 py-4 font-medium">IP 주소</th>
                                <th className="px-6 py-4 font-medium">구매일</th>
                                <th className="px-6 py-4 font-medium text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            <span className="text-sm">데이터를 불러오는 중입니다...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredDevices.map((device) => (
                                        <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-primary dark:text-blue-400">
                                                        {getIcon(device.category)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900 dark:text-white">{device.name}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                                            <span className="font-mono">{device.id}</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                            <span>{device.model}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                                                    {device.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                                    {device.groupId}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-500 text-xs">
                                                {device.ip}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {device.purchaseDate}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredDevices.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                검색 결과가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Placeholder */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>Showing {filteredDevices.length} items</span>
                    <div className="flex gap-1">
                        <button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" disabled>Prev</button>
                        <button className="px-2 py-1 bg-primary text-white rounded">1</button>
                        <button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
