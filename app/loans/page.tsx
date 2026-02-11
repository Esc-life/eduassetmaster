'use client';

import { useState, useEffect } from 'react';
import { getLoans, createLoan, returnLoan, fetchAssetData, LoanRecord } from '@/app/actions';
import { Device } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Calendar, User, Monitor, CheckCircle, AlertCircle, RefreshCw, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoansPage() {
    const [loans, setLoans] = useState<LoanRecord[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Modal State
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [userName, setUserName] = useState('');
    const [userId, setUserId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deviceSearch, setDeviceSearch] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const loansData = await getLoans();
            const { devices: devicesData } = await fetchAssetData();

            if (loansData) setLoans(loansData.sort((a: LoanRecord, b: LoanRecord) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime()));
            if (devicesData) setDevices(devicesData);
        } catch (error) {
            console.error(error);
            alert('데이터 로딩 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleReturn = async (loanId: string) => {
        if (!confirm('반납 처리하시겠습니까?')) return;

        try {
            const result = await returnLoan(loanId);
            if (result.success) {
                alert('반납 처리되었습니다.');
                loadData();
            } else {
                alert('반납 실패: ' + result.error);
            }
        } catch (error) {
            alert('반납 처리 중 오류 발생');
        }
    };

    const handleSubmitLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDevice) {
            alert('기기를 선택해주세요.');
            return;
        }
        if (!userName || !dueDate) {
            alert('필수 정보를 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createLoan(selectedDevice.id, userId || userName, userName, dueDate, notes);
            if (result.success) {
                alert('대여가 등록되었습니다.');
                setShowModal(false);
                // Reset Form
                setSelectedDevice(null);
                setUserName('');
                setUserId('');
                setDueDate('');
                setNotes('');
                loadData();
            } else {
                alert('대여 등록 실패: ' + result.error);
            }
        } catch (error) {
            alert('대여 등록 중 오류 발생');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredLoans = loans.filter(loan => {
        const matchesTab = activeTab === 'active'
            ? loan.status === 'Active' || loan.status === 'Overdue'
            : loan.status === 'Returned';

        const matchesSearch =
            loan.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            loan.userName?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesTab && matchesSearch;
    });

    // Available devices for new loan
    const availableDevices = devices.filter(d =>
        d.status === '사용 가능' &&
        (d.name?.toLowerCase().includes(deviceSearch.toLowerCase()) ||
            d.model?.toLowerCase().includes(deviceSearch.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">대여/반납 관리</h1>
                    <p className="text-sm text-gray-500">기기 대여 현황을 확인하고 관리합니다.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                        title="새로고침"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="w-5 h-5" />
                        대여 등록
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${activeTab === 'active'
                            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                    >
                        대여중 ({loans.filter(l => l.status === 'Active' || l.status === 'Overdue').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${activeTab === 'history'
                            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                    >
                        반납 완료
                    </button>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="기기명, 사용자명 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3">상태</th>
                                <th className="px-6 py-3">기기 정보</th>
                                <th className="px-6 py-3">대여자</th>
                                <th className="px-6 py-3">대여일</th>
                                <th className="px-6 py-3">반납 예정일</th>
                                {activeTab === 'history' && <th className="px-6 py-3">실제 반납일</th>}
                                <th className="px-6 py-3">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        로딩 중...
                                    </td>
                                </tr>
                            ) : filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        표시할 대여 기록이 없습니다.
                                    </td>
                                </tr>
                            ) : filteredLoans.map((loan) => {
                                const isOverdue = loan.status === 'Active' && new Date(loan.dueDate) < new Date();
                                return (
                                    <tr key={loan.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4">
                                            {loan.status === 'Returned' ? (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-semibold">반납 완료</span>
                                            ) : isOverdue ? (
                                                <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-semibold flex items-center gap-1 w-fit">
                                                    <AlertCircle className="w-3 h-3" /> 연체
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-xs font-semibold">대여중</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {loan.deviceName}
                                            <div className="text-xs text-gray-500 font-normal mt-0.5">{loan.deviceId}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                {loan.userName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{loan.loanDate}</td>
                                        <td className={`px-6 py-4 font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                                            {loan.dueDate}
                                        </td>
                                        {activeTab === 'history' && (
                                            <td className="px-6 py-4 text-gray-500">{loan.returnDate}</td>
                                        )}
                                        <td className="px-6 py-4">
                                            {loan.status !== 'Returned' && (
                                                <button
                                                    onClick={() => handleReturn(loan.id)}
                                                    className="font-medium text-blue-600 dark:text-blue-500 hover:underline cursor-pointer"
                                                >
                                                    반납 처리
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Filters & Content End */}

            {/* Loan Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">기기 대여 등록</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitLoan} className="p-6 space-y-4">
                                {/* Device Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        기기 선택 {selectedDevice && <span className="text-blue-600">({selectedDevice.name})</span>}
                                    </label>
                                    {!selectedDevice ? (
                                        <div className="border rounded-lg p-2 max-h-48 overflow-auto dark:border-gray-700">
                                            <input
                                                type="text"
                                                placeholder="기기 검색..."
                                                value={deviceSearch}
                                                onChange={(e) => setDeviceSearch(e.target.value)}
                                                className="w-full px-3 py-2 mb-2 border rounded text-sm dark:bg-gray-900 dark:border-gray-700"
                                            />
                                            <div className="space-y-1">
                                                {availableDevices.length === 0 ? (
                                                    <p className="text-center text-xs text-gray-500 py-4">대여 가능한 기기가 없습니다.</p>
                                                ) : (
                                                    availableDevices.map(d => (
                                                        <div
                                                            key={d.id}
                                                            onClick={() => setSelectedDevice(d)}
                                                            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer border border-transparent hover:border-blue-100"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Monitor className="w-4 h-4 text-gray-400" />
                                                                <div>
                                                                    <p className="text-sm font-medium">{d.name}</p>
                                                                    <p className="text-xs text-gray-500">{d.model}</p>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">가능</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-gray-800 rounded shadow-sm">
                                                    <Monitor className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{selectedDevice.name}</p>
                                                    <p className="text-xs text-gray-500">{selectedDevice.model}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDevice(null)}
                                                className="text-xs text-red-500 hover:underline cursor-pointer"
                                            >
                                                변경
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* User Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            사용자 이름 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="예: 홍길동"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            사용자 ID/학번
                                        </label>
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="선택 사항"
                                        />
                                    </div>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        반납 예정일 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        비고
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                                        placeholder="특이사항 입력"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 cursor-pointer"
                                    >
                                        {isSubmitting ? '처리 중...' : '대여 등록'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
