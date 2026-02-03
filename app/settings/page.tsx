'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Database, Key, User, Copy, Check, Link as LinkIcon, Server } from 'lucide-react';
import { fetchSystemConfig, saveSystemConfig, getMySheetId } from '@/app/actions';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'account' | 'system'>('account');

    // Config States
    const [managerName, setManagerName] = useState('');
    const [visionKey, setVisionKey] = useState('');
    const [sheetId, setSheetId] = useState('');

    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [scanLink, setScanLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [conf, id] = await Promise.all([fetchSystemConfig(), getMySheetId()]);
                setManagerName(conf['ManagerName'] || '');
                setVisionKey(conf['GOOGLE_VISION_KEY'] || '');
                setSheetId(id || '');

                if (typeof window !== 'undefined' && id) {
                    const nameParam = conf['ManagerName'] ? `&manager=${encodeURIComponent(conf['ManagerName'])}` : '';
                    setScanLink(`${window.location.origin}/scan?id=${id}${nameParam}`);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (sheetId && typeof window !== 'undefined') {
            const nameParam = managerName ? `&manager=${encodeURIComponent(managerName)}` : '';
            setScanLink(`${window.location.origin}/scan?id=${sheetId}${nameParam}`);
        }
    }, [managerName, sheetId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSystemConfig({
                'ManagerName': managerName,
                'GOOGLE_VISION_KEY': visionKey
            });
            alert('설정이 저장되었습니다.');
        } catch (e) {
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(scanLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6 animate-in fade-in pb-20">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">설정</h1>
                <p className="text-gray-500 mt-1">계정 정보 및 시스템 데이터를 관리합니다.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('account')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'account' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    계정 설정 (정보부장)
                </button>
                <button
                    onClick={() => setActiveTab('system')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'system' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    시스템 설정 (데이터)
                </button>
            </div>

            {/* Content */}
            {activeTab === 'account' ? (
                <div className="space-y-6">
                    {/* 1. Basic Info */}
                    <Section title="기본 정보" icon={<User className="w-5 h-5 text-blue-500" />} color="bg-blue-50 dark:bg-blue-900/20">
                        <div className="space-y-4">
                            <div>
                                <label className="label">정보부장 이름 (관리자명)</label>
                                <input
                                    type="text"
                                    value={managerName}
                                    onChange={e => setManagerName(e.target.value)}
                                    className="input-field"
                                    placeholder="예: 홍길동"
                                />
                                <p className="help-text">이 이름은 스캔 페이지에서 담당자가 확인할 수 있습니다.</p>
                            </div>
                        </div>
                    </Section>

                    {/* 2. API Key */}
                    <Section title="API 키 설정 (BYOK)" icon={<Key className="w-5 h-5 text-purple-500" />} color="bg-purple-50 dark:bg-purple-900/20">
                        <div className="space-y-4">
                            <div>
                                <label className="label">Google Cloud Vision API Key</label>
                                <input
                                    type="password"
                                    value={visionKey}
                                    onChange={e => setVisionKey(e.target.value)}
                                    className="input-field"
                                    placeholder="AIzaSy..."
                                />
                                <p className="help-text">이미지 텍스트 인식(OCR)을 위해 필요합니다.</p>
                            </div>
                        </div>
                    </Section>

                    {/* 3. Server Config (Mock) */}
                    <Section title="서버 설정" icon={<Server className="w-5 h-5 text-green-500" />} color="bg-green-50 dark:bg-green-900/20">
                        <div className="space-y-4 opacity-75">
                            <div>
                                <label className="label">데이터베이스 유형</label>
                                <select className="input-field" disabled defaultValue="google-sheets">
                                    <option value="google-sheets">Google Sheets (현재 사용 중)</option>
                                    <option value="firebase">Firebase (준비 중)</option>
                                    <option value="supabase">Supabase (준비 중)</option>
                                </select>
                            </div>
                        </div>
                    </Section>

                    {/* 4. Scan Link */}
                    <Section title="담당자용 스캔 링크" icon={<LinkIcon className="w-5 h-5 text-orange-500" />} color="bg-orange-50 dark:bg-orange-900/20">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 dark:text-gray-300 break-keep">
                                아래 링크를 복사하여 구역 담당자(선생님)들에게 공유하세요.<br />
                                <span className="font-semibold text-orange-600">이 링크로 접속하면 별도의 ID 입력 없이 바로 등록 가능합니다.</span>
                            </p>
                            <div className="flex flex-col md:flex-row gap-2">
                                <input type="text" readOnly value={scanLink} className="input-field bg-gray-50 dark:bg-gray-800 text-xs font-mono" />
                                <button onClick={copyLink} className="btn-secondary whitespace-nowrap min-w-[80px] flex justify-center items-center">
                                    {copied ? <><Check className="w-4 h-4 mr-1" /> 복사됨</> : <><Copy className="w-4 h-4 mr-1" /> 복사</>}
                                </button>
                            </div>
                        </div>
                    </Section>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button onClick={handleSave} disabled={isSaving} className="btn-primary w-full md:w-auto md:px-8">
                            {isSaving ? '저장 중...' : '설정 저장하기'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* System Settings */}
                    <Section title="데이터 초기화" icon={<RefreshCw className="w-5 h-5 text-red-500" />} color="bg-red-50 dark:bg-red-900/20">
                        <p className="text-sm text-gray-500 mb-4 break-keep">
                            시스템 오류 발생 시 데이터를 강제로 초기화할 수 있습니다. (주의: 복구 불가능)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => alert('준비 중')} className="btn-danger-outline">Devices 초기화</button>
                            <button onClick={() => alert('준비 중')} className="btn-danger-outline">Software 초기화</button>
                        </div>
                    </Section>
                </div>
            )}

            <style jsx>{`
                .label { @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1; }
                .input-field { @apply w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all; }
                .help-text { @apply text-xs text-gray-400 mt-1; }
                .btn-primary { @apply py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md active:scale-95 transition-all text-sm; }
                .btn-secondary { @apply px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium bg-white dark:bg-gray-800; }
                .btn-danger-outline { @apply px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium bg-white dark:bg-gray-800; }
            `}</style>
        </div>
    );
}

function Section({ title, icon, color, children }: any) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg shrink-0 ${color}`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
                    {children}
                </div>
            </div>
        </div>
    );
}
