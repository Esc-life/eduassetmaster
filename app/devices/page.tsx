'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchAssetData, registerBulkDevices, updateDevice, deleteDevice, deleteAllDevices, deleteBulkDevices, fetchMapConfiguration, setDevicesStatus } from '@/app/actions';
import { Device, DeviceStatus, Location } from '@/types';
import { Search, Filter, MoreHorizontal, Laptop, Tablet, Smartphone, Monitor, Loader2, FileSpreadsheet, Plus, Edit, Trash2, AlertTriangle, Minus, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { BulkUploadModal } from '@/components/devices/BulkUploadModal';
import { DeviceEditModal } from '@/components/devices/DeviceEditModal';
import { DeleteConfirmModal } from '@/components/devices/DeleteConfirmModal';
import { DisposalModal } from '@/components/devices/DisposalModal';
import { useRouter } from 'next/navigation';

export default function DevicesPage() {
    const router = useRouter();
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'All'>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
    const [editDevice, setEditDevice] = useState<Device | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; type: 'single' | 'all'; device?: Device }>({ open: false, type: 'single' });
    const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
    const [zones, setZones] = useState<Location[]>([]); // Available zones
    const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await fetchAssetData();
                setDevices(data.devices);

                // Load zones for dropdown
                const mapConfig = await fetchMapConfiguration();
                setZones(mapConfig.zones);
            } catch (error) {
                console.warn('[Devices] Server data fetch failed:', error);
                setDevices([]);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleBulkSave = async (data: any[]) => {
        setIsLoading(true);
        const result = await registerBulkDevices(data);
        if (result.success) {
            alert(`${(result as any).count}개 기기가 성공적으로 등록되었습니다.`);
            // Reload page to reflect changes
            window.location.reload();
        } else {
            alert('등록 실패: ' + result.error);
            setIsLoading(false);
        }
    };

    const handleUpdateDevice = async (updates: Partial<Device>) => {
        if (!editDevice) return;
        setIsLoading(true);
        const result = await updateDevice(editDevice.id, updates);
        if (result.success) {
            alert('수정이 저장되었습니다.');
            window.location.reload();
        } else {
            alert('수정 실패: ' + result.error);
            setIsLoading(false);
        }
    };

    const handleDeleteDevice = async () => {
        if (!deleteModal.device) return;
        const result = await deleteDevice(deleteModal.device.id);
        if (result.success) {
            alert('삭제되었습니다.');
            window.location.reload();
        } else {
            alert('삭제 실패: ' + result.error);
        }
    };

    const handleDeleteAll = async () => {
        const result = await deleteAllDevices();
        if (result.success) {
            alert('모든 기기가 삭제되었습니다.');
            window.location.reload();
        } else {
            alert('전체 삭제 실패: ' + result.error);
        }
    };

    const toggleDeviceSelection = (deviceId: string) => {
        setSelectedDevices(prev =>
            prev.includes(deviceId)
                ? prev.filter(id => id !== deviceId)
                : [...prev, deviceId]
        );
    };

    // toggleSelectAll & handleDeleteSelected moved below sortedDevices definition

    const [itemsPerPage, setItemsPerPage] = useState(30);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Device, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: keyof Device) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedDevices = useMemo(() => {
        let result = [...devices];

        // 1. Filter
        result = result.filter((device) => {
            const matchesStatus = filterStatus === 'All' || device.status === filterStatus;
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                (device.name || '').toLowerCase().includes(searchLower) ||
                (device.model || '').toLowerCase().includes(searchLower) ||
                (device.id || '').toLowerCase().includes(searchLower);
            return matchesStatus && matchesSearch;
        });

        // 2. Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';

                // Handle numbers
                const aNum = parseFloat(String(aValue).replace(/,/g, ''));
                const bNum = parseFloat(String(bValue).replace(/,/g, ''));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                }

                // Handle strings
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [devices, filterStatus, searchTerm, sortConfig]);

    const paginatedDevices = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedDevices.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedDevices, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedDevices.length / itemsPerPage);

    const toggleSelectAll = () => {
        setSelectedDevices(prev =>
            prev.length === sortedDevices.length ? [] : sortedDevices.map(d => d.id)
        );
    };

    const handleDeleteSelected = async () => {
        const result = await deleteBulkDevices(selectedDevices);
        if (result.success) {
            alert(`${selectedDevices.length}개 기기가 삭제되었습니다.`);
            window.location.reload();
        } else {
            alert('일괄 삭제 실패: ' + result.error);
        }
    };

    const formatNumber = (value: number | string | undefined) => {
        if (!value) return '0';
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '0';
        return num.toLocaleString('ko-KR');
    };

    const getStatusColor = (status: DeviceStatus) => {
        switch (status) {
            case '사용 가능': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case '사용 중': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case '수리/점검': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case '고장/폐기': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case '분실': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
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
            <BulkUploadModal
                isOpen={isBulkOpen}
                onClose={() => setIsBulkOpen(false)}
                onSave={handleBulkSave}
            />

            <DeviceEditModal
                isOpen={isAddDeviceOpen}
                device={null}
                onClose={() => setIsAddDeviceOpen(false)}
                onSave={async (device) => {
                    await registerBulkDevices([device]);
                    setIsAddDeviceOpen(false);
                    window.location.reload();
                }}
                zones={zones}
            />

            <DeviceEditModal
                isOpen={!!editDevice}
                device={editDevice}
                onClose={() => setEditDevice(null)}
                onSave={handleUpdateDevice}
                zones={zones}
            />

            <DeleteConfirmModal
                isOpen={deleteModal.open}
                type={deleteModal.type}
                deviceName={deleteModal.device?.name}
                onClose={() => setDeleteModal({ open: false, type: 'single' })}
                onConfirm={deleteModal.type === 'all' ? handleDeleteAll : handleDeleteDevice}
            />

            {/* Disposal Modal */}
            <DisposalModal
                isOpen={isDisposalModalOpen}
                onClose={() => setIsDisposalModalOpen(false)}
                devices={devices.filter(d => selectedDevices.includes(d.id))}
                onConfirm={async (ids) => {
                    const res = await setDevicesStatus(ids, '고장/폐기');
                    if (res.success) {
                        alert('상태가 변경되었습니다.');
                        window.location.reload();
                    } else {
                        alert('변경 실패: ' + res.error);
                    }
                }}
            />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">기기 관리</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">전체 자산 목록 및 상태를 관리합니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setIsAddDeviceOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap flex-auto md:flex-none justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        개별 등록
                    </button>
                    <button
                        onClick={() => setIsBulkOpen(true)}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap flex-auto md:flex-none justify-center"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        일괄 등록 (엑셀)
                    </button>
                    <button
                        onClick={() => selectedDevices.length > 0 && setIsDisposalModalOpen(true)}
                        disabled={selectedDevices.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium whitespace-nowrap flex-auto md:flex-none justify-center ${selectedDevices.length > 0
                            ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <Minus className="w-4 h-4" />
                        불용 처리 {selectedDevices.length > 0 && `(${selectedDevices.length})`}
                    </button>
                    {selectedDevices.length > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap flex-auto md:flex-none justify-center"
                        >
                            <Trash2 className="w-4 h-4" />
                            선택 삭제 ({selectedDevices.length})
                        </button>
                    )}
                    <button
                        onClick={() => setDeleteModal({ open: true, type: 'all' })}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap flex-auto md:flex-none justify-center"
                    >
                        <Trash2 className="w-4 h-4" />
                        전체 삭제
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
                    {(['All', '사용 가능', '사용 중', '수리/점검', '고장/폐기', '분실'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === status
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
                        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedDevices.length === sortedDevices.length && sortedDevices.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 cursor-pointer"
                                    />
                                </th>
                                {[
                                    { key: 'model', label: '물품목록번호', align: 'center' },
                                    { key: 'category', label: '물품분류명', align: 'center' },
                                    { key: 'name', label: '품명/규격', align: 'left' },
                                    { key: 'purchaseDate', label: '취득일', align: 'center' },
                                    { key: 'acquisitionDivision', label: '취득구분', align: 'center' },
                                    { key: 'groupId', label: '운용부서', align: 'center' },
                                    { key: 'quantity', label: '수량', align: 'right' },
                                    { key: 'unitPrice', label: '단가', align: 'right' },
                                    { key: 'totalAmount', label: '취득금액', align: 'right' },
                                    { key: 'serviceLifeChange', label: '내용연수', align: 'center' },
                                    { key: 'installLocation', label: '설치장소', align: 'left' },
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        className={`px-6 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-${col.align}`}
                                        onClick={() => handleSort(col.key as keyof Device)}
                                    >
                                        <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                                            {col.label}
                                            <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                        </div>
                                    </th>
                                ))}
                                <th className="px-6 py-4 font-medium whitespace-nowrap text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={13} className="px-6 py-20 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            <span className="text-sm">데이터를 불러오는 중입니다...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paginatedDevices.map((device) => (
                                        <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDevices.includes(device.id)}
                                                    onChange={() => toggleDeviceSelection(device.id)}
                                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-gray-900 dark:text-white font-medium text-center">{device.model || '-'}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-center">{device.category}</td>
                                            <td className="px-6 py-4 text-gray-900 dark:text-white text-left">
                                                <div className="font-medium">{device.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap text-center">{device.purchaseDate}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-center">{device.acquisitionDivision}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-center">{device.groupId}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-right">{formatNumber(device.quantity)}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-right">{formatNumber(device.unitPrice)}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-right">{formatNumber(device.totalAmount)}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-center">{device.serviceLifeChange}</td>
                                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-left">{device.installLocation}</td>
                                            <td className="px-6 py-4 text-center relative">
                                                <div className="flex items-center justify-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditDevice(device)}
                                                        className="cursor-pointer p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="수정"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteModal({ open: true, type: 'single', device })}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedDevices.length === 0 && (
                                        <tr>
                                            <td colSpan={13} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                {sortedDevices.length > 0 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-xl shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">페이지 당 항목:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                                <option value={70}>70</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-gray-500 ml-2">
                                총 {sortedDevices.length}개 중 {(currentPage - 1) * itemsPerPage + 1}-
                                {Math.min(currentPage * itemsPerPage, sortedDevices.length)}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
