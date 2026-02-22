'use client';

import { useState, useEffect } from 'react';
import {
    getSoftwareList, saveSoftware, deleteSoftware,
    getAccountList, saveAccount, deleteAccount
} from '@/app/actions';
import { Plus, Edit2, Trash2, Key, Globe, Shield, Search, Loader2 } from 'lucide-react';
import PageLoading from '@/components/ui/PageLoading';
import { useMessage } from '@/components/Providers';

export default function SoftwarePage() {
    const { showConfirmAsync } = useMessage();
    const [activeTab, setActiveTab] = useState<'software' | 'accounts'>('software');
    const [softwareList, setSoftwareList] = useState<any[]>([]);
    const [accountList, setAccountList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<any>(null); // If null, create mode
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [sw, acc] = await Promise.all([
                getSoftwareList(),
                getAccountList()
            ]);
            setSoftwareList(sw);
            setAccountList(acc);
        } catch (e) {
            console.error("Load Error:", e);
            setError(`데이터를 불러오는 중 오류가 발생했습니다: ${String(e)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (item?: any) => {
        setEditItem(item || null);
        setFormData(item || (activeTab === 'software' ? {
            type: 'Subscription',
            name: '',
            licenseKey: '',
            notes: ''
        } : {
            category: 'General',
            serviceName: '',
            username: '',
            notes: ''
        }));
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditItem(null);
        setFormData({});
    };

    const confirmDelete = async (id: string) => {
        if (!await showConfirmAsync("삭제하시겠습니까?")) return;

        setIsLoading(true);
        if (activeTab === 'software') {
            await deleteSoftware(id);
        } else {
            await deleteAccount(id);
        }
        await loadData();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const payload = { ...formData };
        if (!payload.id) payload.id = `${activeTab === 'software' ? 'sw' : 'acc'}-${Date.now()}`;

        if (activeTab === 'software') {
            await saveSoftware(payload);
        } else {
            await saveAccount(payload);
        }

        await loadData();
        handleCloseModal();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap">소프트웨어 및 계정 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">학교에서 사용하는 라이선스와 관리자 계정을 관리합니다.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap w-full md:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" />
                    {activeTab === 'software' ? '소프트웨어 등록' : '계정 등록'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('software')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'software'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    소프트웨어 라이선스 ({softwareList.length})
                </button>
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'accounts'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    관리자 계정 ({accountList.length})
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm">
                    ⚠️ {error}
                </div>
            )}

            {isLoading ? (
                <PageLoading />
            ) : (
                <div className="grid gap-4">
                    {activeTab === 'software' ? (
                        softwareList.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-start hover:shadow-sm transition-shadow">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{item.type}</span>
                                            <span>|</span>
                                            <span>Key: {item.licenseKey || 'N/A'}</span>
                                        </div>
                                        {item.notes && <p className="text-xs text-gray-400 mt-2">{item.notes}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => confirmDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        accountList.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-start hover:shadow-sm transition-shadow">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center text-green-600">
                                        <Key className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{item.serviceName}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{item.category}</span>
                                            <span>|</span>
                                            <span>ID: {item.username}</span>
                                        </div>
                                        {item.url && (
                                            <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1">
                                                <Globe className="w-3 h-3" /> 바로가기
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => confirmDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))
                    )}

                    {(!isLoading && ((activeTab === 'software' && softwareList.length === 0) || (activeTab === 'accounts' && accountList.length === 0))) && (
                        <div className="text-center py-20 text-gray-500">
                            등록된 데이터가 없습니다.
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold mb-4">{editItem ? '수정' : '등록'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {activeTab === 'software' ? (
                                <>
                                    <div>
                                        <label className="text-sm font-medium">소프트웨어 명</label>
                                        <input
                                            required
                                            value={formData.name || ''}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium">유형</label>
                                            <select
                                                value={formData.type || 'Subscription'}
                                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            >
                                                <option>Subscription</option>
                                                <option>Permanent</option>
                                                <option>Free</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">버전</label>
                                            <input
                                                value={formData.version || ''}
                                                onChange={e => setFormData({ ...formData, version: e.target.value })}
                                                className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">라이선스 키</label>
                                        <input
                                            value={formData.licenseKey || ''}
                                            onChange={e => setFormData({ ...formData, licenseKey: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
                                            placeholder="XXXX-XXXX-XXXX-XXXX"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">메모</label>
                                        <textarea
                                            value={formData.notes || ''}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            rows={3}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-sm font-medium">서비스 명</label>
                                        <input
                                            required
                                            value={formData.serviceName || ''}
                                            onChange={e => setFormData({ ...formData, serviceName: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">URL</label>
                                        <input
                                            value={formData.url || ''}
                                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium">ID / Email</label>
                                            <input
                                                value={formData.username || ''}
                                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">비밀번호</label>
                                            <input
                                                value={formData.password || ''}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                                placeholder="필요 시 입력"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">메모</label>
                                        <textarea
                                            value={formData.notes || ''}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isLoading ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
