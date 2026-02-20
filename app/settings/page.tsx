'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Key, User, Copy, Check, Link as LinkIcon, HelpCircle, X, ExternalLink, Trash2, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { fetchSystemConfig, saveSystemConfig, getMySheetId, changePassword, getServerType, deleteMyAccount } from '@/app/actions';
import { signOut } from 'next-auth/react';

// --- Guide Modal ---
function GuideModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Key className="w-5 h-5 text-purple-500" />
                        Vision API 키 발급 가이드
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 overflow-y-auto max-h-[60vh] pr-2">
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800 text-orange-800 dark:text-orange-200 mb-4">
                        <p className="font-bold flex items-center gap-2 mb-1">
                            <span className="text-lg">✋</span> 잠깐!
                        </p>
                        JSON 파일(서비스 계정)이 아닙니다. <br />
                        <strong>AIza...</strong> 로 시작하는 <strong>API 키(문자열)</strong>가 필요합니다.
                    </div>

                    <ol className="list-decimal pl-5 space-y-3 marker:text-gray-400 marker:font-medium">
                        <li>
                            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                                Google Cloud Console 접속 <ExternalLink className="w-3 h-3" />
                            </a>
                        </li>
                        <li>상단 프로젝트 목록에서 사용 중인 프로젝트 선택</li>
                        <li>
                            좌측 메뉴 <strong>[사용자 인증 정보]</strong> &rarr; 상단 <strong>[+ 사용자 인증 정보 만들기]</strong> 클릭
                        </li>
                        <li>
                            메뉴에서 <strong>[API 키]</strong> 선택 (서비스 계정 X)
                        </li>
                        <li>
                            생성된 키 복사 (예: <code>AIzaSyD...</code>)
                        </li>
                        <li>이곳 설정 페이지 입력창에 붙여넣기</li>
                    </ol>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
                        * <strong>Cloud Vision API</strong>가 '사용 설정' 되어 있어야 합니다. (라이브러리 메뉴에서 검색)
                    </div>
                </div>

                <button onClick={onClose} className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-purple-200 dark:shadow-none">
                    확인했습니다
                </button>
            </div>
        </div>
    );
}

// --- Delete Account Confirmation Modal ---
function DeleteAccountModal({ onClose, onConfirm, isDeleting }: { onClose: () => void, onConfirm: () => void, isDeleting: boolean }) {
    const [confirmText, setConfirmText] = useState('');
    const isValid = confirmText === '계정 탈퇴하기';

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-red-100 dark:border-red-900/50">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        계정 탈퇴
                    </h3>
                    <button onClick={onClose} disabled={isDeleting} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-5">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="font-bold text-red-700 dark:text-red-300 mb-2 text-sm flex items-center gap-1.5">
                            ⚠️ 이 작업은 되돌릴 수 없습니다.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-xs text-red-600 dark:text-red-300/80">
                            <li>모든 기기(Devices) 데이터가 삭제됩니다.</li>
                            <li>소프트웨어, 계정/비밀번호 관리 정보가 삭제됩니다.</li>
                            <li>대여 기록이 삭제됩니다.</li>
                            <li>배치도 및 구역 설정이 삭제됩니다.</li>
                            <li>계정 정보가 영구적으로 삭제됩니다.</li>
                        </ul>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            확인을 위해 아래에 <span className="font-bold text-red-600 dark:text-red-400">&apos;계정 탈퇴하기&apos;</span>를 정확히 입력하세요.
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            disabled={isDeleting}
                            className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm disabled:opacity-50"
                            placeholder="계정 탈퇴하기"
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!isValid || isDeleting}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
                        >
                            {isDeleting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> 삭제 진행 중...</>
                            ) : (
                                <><Trash2 className="w-4 h-4" /> 영구 삭제</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Main Settings Page ---
export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'account' | 'system'>('account');

    // Config States
    const [managerName, setManagerName] = useState('');
    const [visionKey, setVisionKey] = useState('');
    const [sheetId, setSheetId] = useState('');
    const [serverType, setServerType] = useState('google-sheets');

    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [scanLink, setScanLink] = useState('');
    const [copied, setCopied] = useState(false);

    // Guide Modal
    const [showGuide, setShowGuide] = useState(false);

    // Password Change
    const [curPass, setCurPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [cfmPass, setCfmPass] = useState('');
    const [isPwChanging, setIsPwChanging] = useState(false);

    // Account Deletion
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Magic Link (config_sync) handler
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const magic = params.get('config_sync');
        if (magic) {
            try {
                const configStr = decodeURIComponent(escape(atob(magic)));
                JSON.parse(configStr);
                if (confirm('설정 동기화 링크가 감지되었습니다.\n현재 기기에 설정을 적용하시겠습니까?')) {
                    const encoded = encodeURIComponent(configStr);
                    document.cookie = `edu-asset-config=${encoded}; path=/; max-age=31536000; SameSite=Lax`;
                    alert('설정이 성공적으로 적용되었습니다!');
                    window.location.href = '/settings';
                }
            } catch (e) {
                console.error(e);
                alert('유효하지 않은 설정 링크입니다.');
            }
        }
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const [conf, id, sType] = await Promise.all([fetchSystemConfig(), getMySheetId(), getServerType()]);
                setManagerName(conf['ManagerName'] || '');
                setVisionKey(conf['GOOGLE_VISION_KEY'] || '');
                setSheetId(id || '');
                if (sType) setServerType(sType as string);

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

    const handleChangePassword = async () => {
        if (!curPass || !newPass || !cfmPass) return alert('모든 항목을 입력해주세요.');
        if (newPass !== cfmPass) return alert('새 비밀번호가 일치하지 않습니다.');
        if (newPass.length < 4) return alert('비밀번호는 4자 이상이어야 합니다.');

        setIsPwChanging(true);
        const result = await changePassword(curPass, newPass);
        setIsPwChanging(false);

        if (result.success) {
            alert('비밀번호가 변경되었습니다.');
            setCurPass('');
            setNewPass('');
            setCfmPass('');
        } else {
            alert('변경 실패: ' + result.error);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteMyAccount();
            if (result.success) {
                // Clear local config cookie
                document.cookie = 'edu-asset-config=; path=/; max-age=0';
                alert('계정이 성공적으로 삭제되었습니다.');
                await signOut({ callbackUrl: '/login' });
            } else {
                alert('삭제 실패: ' + (result.error || '알 수 없는 오류'));
            }
        } catch (e) {
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(scanLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const dbLabel = serverType === 'firebase' ? 'Firebase' : 'Google Sheets';

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6 animate-in fade-in pb-20">
            {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
            {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteAccount} isDeleting={isDeleting} />}

            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">설정</h1>
                <p className="text-gray-500 mt-1">계정 정보 및 시스템 데이터를 관리합니다.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('account')}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'account' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    계정 설정
                </button>
                <button
                    onClick={() => setActiveTab('system')}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'system' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    시스템 관리
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
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="text-xs text-gray-400">데이터베이스:</span>
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{dbLabel}</span>
                            </div>
                        </div>
                    </Section>

                    {/* 2. API Key */}
                    <Section title="API 키 설정 (BYOK)" icon={<Key className="w-5 h-5 text-purple-500" />} color="bg-purple-50 dark:bg-purple-900/20">
                        <div className="space-y-4">
                            <div>
                                <label className="label flex items-center gap-2">
                                    Google Cloud Vision API Key
                                    <button
                                        onClick={() => setShowGuide(true)}
                                        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 inline-flex items-center gap-1 text-xs font-normal border border-purple-200 dark:border-purple-800 rounded-full px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 transition-colors"
                                    >
                                        <HelpCircle className="w-3 h-3" />
                                        발급 방법
                                    </button>
                                </label>
                                <input
                                    type="password"
                                    value={visionKey}
                                    onChange={e => setVisionKey(e.target.value)}
                                    className="input-field font-mono text-sm"
                                    placeholder="AIzaSyD..."
                                />
                                <p className="help-text">
                                    이미지 텍스트 인식(OCR)에 사용됩니다.<br />
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">* 가입 시 입력한 키는 데이터베이스에 자동 저장되어, 다른 기기에서도 그대로 사용됩니다.</span>
                                </p>
                            </div>
                        </div>
                    </Section>

                    {/* 3. Password Change */}
                    <Section title="계정 보안" icon={<Shield className="w-5 h-5 text-amber-500" />} color="bg-amber-50 dark:bg-amber-900/20">
                        <div className="space-y-4">
                            <div>
                                <label className="label">현재 비밀번호</label>
                                <input type="password" value={curPass} onChange={e => setCurPass(e.target.value)} className="input-field" placeholder="현재 비밀번호 입력" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">새 비밀번호</label>
                                    <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="input-field" placeholder="새 비밀번호 (4자 이상)" />
                                </div>
                                <div>
                                    <label className="label">새 비밀번호 확인</label>
                                    <input type="password" value={cfmPass} onChange={e => setCfmPass(e.target.value)} className="input-field" placeholder="비밀번호 확인" />
                                </div>
                            </div>
                            <button
                                onClick={handleChangePassword}
                                disabled={isPwChanging}
                                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 text-sm"
                            >
                                {isPwChanging ? '변경 중...' : '비밀번호 변경'}
                            </button>
                        </div>
                    </Section>

                    {/* 4. Scan Link */}
                    <Section title="담당자용 스캔 링크" icon={<LinkIcon className="w-5 h-5 text-orange-500" />} color="bg-orange-50 dark:bg-orange-900/20">
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-300 break-keep">
                                아래 링크를 복사하여 구역 담당자(선생님)들에게 공유하세요.<br />
                                <span className="font-semibold text-orange-600 dark:text-orange-400">이 링크로 접속하면 별도의 ID 입력 없이 바로 등록 가능합니다.</span>
                            </p>
                            <div className="flex flex-col md:flex-row gap-2">
                                <input type="text" readOnly value={scanLink} className="input-field bg-gray-50 dark:bg-gray-900 text-xs font-mono" />
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
                    {/* Data Reset */}
                    <Section title="데이터 초기화" icon={<RefreshCw className="w-5 h-5 text-orange-500" />} color="bg-orange-50 dark:bg-orange-900/20">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 break-keep">
                            시스템 오류 발생 시 특정 데이터를 강제로 초기화할 수 있습니다.<br />
                            <span className="text-xs text-orange-500 font-medium">⚠️ 초기화된 데이터는 복구할 수 없습니다.</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => alert('준비 중')} className="btn-danger-outline">Devices 초기화</button>
                            <button onClick={() => alert('준비 중')} className="btn-danger-outline">Software 초기화</button>
                        </div>
                    </Section>

                    {/* Account Deletion */}
                    <Section title="계정 탈퇴" icon={<Trash2 className="w-5 h-5 text-red-500" />} color="bg-red-50 dark:bg-red-900/20">
                        <div className="space-y-4">
                            <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-900/50">
                                <p className="text-sm text-red-700 dark:text-red-300 break-keep">
                                    계정을 탈퇴하면 <strong>데이터베이스의 모든 데이터</strong>가 영구적으로 삭제되며,
                                    이 계정으로는 더 이상 로그인할 수 없습니다.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                계정 탈퇴하기
                            </button>
                        </div>
                    </Section>
                </div>
            )}

            <style jsx>{`
                .label { @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1; }
                .input-field { @apply w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-gray-900 dark:text-gray-100; }
                .help-text { @apply text-xs text-gray-400 mt-1.5; }
                .btn-primary { @apply py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md active:scale-95 transition-all text-sm; }
                .btn-secondary { @apply px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium bg-white dark:bg-gray-800; }
                .btn-danger-outline { @apply px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium bg-white dark:bg-gray-800; }
            `}</style>
        </div>
    );
}

function Section({ title, icon, color, children }: any) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow">
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
