'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Key, User, Copy, Check, Link as LinkIcon, HelpCircle, X, ExternalLink, Trash2, AlertTriangle, Shield, Loader2, Download, Upload, FolderArchive, Share2 } from 'lucide-react';
import { fetchSystemConfig, saveSystemConfig, getMySheetId, changePassword, getServerType, deleteMyAccount, exportAllData, importAllData, getSystemEmail } from '@/app/actions';
import { signOut } from 'next-auth/react';
import { useMessage } from '@/components/Providers';

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

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 space-y-2">
                        <p>
                            * <strong>Generative Language API</strong>(Gemini)가 반드시 &apos;사용 설정&apos; 되어 있어야 합니다.
                        </p>
                        <a href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" target="_blank" className="text-purple-600 hover:underline flex items-center gap-1 font-bold">
                            API 활성화 페이지 바로가기 <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>

                <button onClick={onClose} className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-purple-200 dark:shadow-none">
                    확인했습니다
                </button>
            </div>
        </div>
    );
}

// --- Sheet Sharing Guide Modal ---
function SharingGuideModal({ onClose, systemEmail }: { onClose: () => void, systemEmail: string }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-blue-500" />
                        스캔 페이지 연결 가이드
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                        <p className="font-bold text-blue-800 dark:text-blue-200 mb-2">왜 시트를 공유해야 하나요?</p>
                        <p className="text-xs leading-relaxed">
                            로그인하지 않은 담당 선생님이 스캔 페이지에서 구역 목록을 보려면, 서버가 안전하게 시트 데이터를 읽어올 수 있어야 합니다.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="font-bold flex items-center gap-2">방법 1. 시스템 계정 공유 (권장)</p>
                        <ol className="list-decimal pl-5 space-y-2 marker:text-gray-400">
                            <li>사용 중인 구글 시트 우측 상단 <strong>[공유]</strong> 클릭</li>
                            <li>아래 시스템 이메일을 추가하고 <strong>&apos;편집자&apos;</strong> 또는 <strong>&apos;뷰어&apos;</strong> 권한 부여</li>
                            <li className="bg-gray-100 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 font-mono text-[11px] break-all select-all">
                                {systemEmail}
                            </li>
                        </ol>

                        <p className="font-bold flex items-center gap-2 mt-4">방법 2. 시트 공개 (비권장)</p>
                        <p className="text-xs">시트를 &apos;링크가 있는 모든 사용자에게 공개&apos;로 설정하면 별도 공유 없이도 작동하지만, 보안상 권장하지 않습니다.</p>
                    </div>
                </div>

                <button onClick={onClose} className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-200 dark:shadow-none">
                    가이드 확인 완료
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
                            탈퇴를 진행하려면 아래에 <span className="text-red-600 font-bold">&apos;계정 탈퇴하기&apos;</span>를 입력하세요.
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            placeholder="계정 탈퇴하기"
                            disabled={isDeleting}
                        />
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!isValid || isDeleting}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-red-200 dark:shadow-none inline-flex items-center justify-center gap-2"
                    >
                        {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> 처리 중</> : '계정 탈퇴 및 삭제'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const { showAlert, showConfirmAsync } = useMessage();
    const [activeTab, setActiveTab] = useState<'account' | 'system'>('account');

    // Data States
    const [managerName, setManagerName] = useState('');
    const [visionKey, setVisionKey] = useState('');
    const [sheetId, setSheetId] = useState('');
    const [serverType, setServerType] = useState('google-sheets');
    const [systemEmail, setSystemEmail] = useState('');

    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [scanLink, setScanLink] = useState('');
    const [copied, setCopied] = useState(false);

    // Modals visibility
    const [showGuide, setShowGuide] = useState(false);
    const [showShareGuide, setShowShareGuide] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [curPass, setCurPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [cfmPass, setCfmPass] = useState('');
    const [isPwChanging, setIsPwChanging] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [conf, id, sType, sysEmailRes] = await Promise.all([
                    fetchSystemConfig(),
                    getMySheetId(),
                    getServerType(),
                    getSystemEmail()
                ]);

                setManagerName(conf['ManagerName'] || '');
                setVisionKey(conf['GOOGLE_VISION_KEY'] || '');
                setSheetId(id || '');
                setSystemEmail(sysEmailRes.email);

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
            showAlert('설정이 저장되었습니다.', 'success');
        } catch (e) {
            showAlert('저장 실패', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!curPass || !newPass || !cfmPass) return showAlert('모든 항목을 입력해주세요.', 'alert');
        if (newPass !== cfmPass) return showAlert('새 비밀번호가 일치하지 않습니다.', 'error');
        if (newPass.length < 4) return showAlert('비밀번호는 4자 이상이어야 합니다.', 'alert');

        setIsPwChanging(true);
        try {
            const result = await changePassword(curPass, newPass);
            if (result.success) {
                showAlert('비밀번호가 성공적으로 변경되었습니다.', 'success');
                setCurPass('');
                setNewPass('');
                setCfmPass('');
            } else {
                showAlert(result.error || '변경 실패', 'error');
            }
        } catch (e) {
            showAlert('비밀번호 변경 중 오류 발생', 'error');
        } finally {
            setIsPwChanging(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteMyAccount();
            if (result.success) {
                await showAlert('그동안 감사했습니다. 계정이 영구 삭제되었습니다.', 'success');
                signOut({ callbackUrl: '/' });
            } else {
                showAlert(result.error || '삭제 실패', 'error');
            }
        } catch (e) {
            showAlert('계정 삭제 중 오류 발생', 'error');
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

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const result = await exportAllData();
            if (result.success && result.backup) {
                const json = JSON.stringify(result.backup, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const date = new Date().toISOString().slice(0, 10);
                a.href = url;
                a.download = `EduAssetMaster_Backup_${date}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showAlert('백업 파일이 다운로드되었습니다.', 'success');
            } else {
                showAlert('백업 실패: ' + (result.error || ''), 'error');
            }
        } catch (e) {
            showAlert('백업 중 오류 발생', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (fileInputRef.current) fileInputRef.current.value = '';

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.data || !backup.version) {
                alert('유효하지 않은 백업 파일입니다.');
                return;
            }

            const devCount = backup.data.devices?.length || 0;
            const swCount = backup.data.software?.length || 0;

            const msg = `백업 파일 정보를 확인하세요:\n` +
                `- 내보낸 날짜: ${backup.exportDate?.slice(0, 10) || '알 수 없음'}\n` +
                `- 기기: ${devCount}건 / 소프트웨어: ${swCount}건\n\n` +
                `이 데이터를 현재 계정에 가져오시겠습니까?\n` +
                `⚠️ 기존 데이터는 모두 덮어쓰여집니다.`;

            if (await showConfirmAsync(msg)) {
                setIsImporting(true);
                const result = await importAllData(backup);

                if (result.success) {
                    await showAlert('데이터를 성공적으로 가져왔습니다!\n페이지를 새로고침합니다.', 'success');
                    window.location.reload();
                } else {
                    showAlert('가져오기 실패: ' + (result.error || ''), 'error');
                }
            }
        } catch (e) {
            showAlert('파일을 읽을 수 없습니다.', 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const dbLabel = serverType === 'firebase' ? 'Firebase' : 'Google Sheets';

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 animate-pulse">설정 데이터를 불러오는 중...</p>
            </div>
        );
    }

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

                    <Section title="담당자용 스캔 링크" icon={<LinkIcon className="w-5 h-5 text-orange-500" />} color="bg-orange-50 dark:bg-orange-900/20">
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600 dark:text-gray-300 break-keep">
                                아래 링크를 복사하여 구역 담당자(선생님)들에게 공유하세요.<br />
                                <span className="font-semibold text-orange-600 dark:text-orange-400 text-xs">이 링크로 접속하면 별도의 ID 입력 없이 바로 등록 가능합니다.</span>
                            </p>
                            <div className="flex flex-col md:flex-row gap-2">
                                <input type="text" readOnly value={scanLink} className="input-field bg-gray-50 dark:bg-gray-900 text-xs font-mono" />
                                <button onClick={copyLink} className="btn-secondary whitespace-nowrap min-w-[80px] flex justify-center items-center">
                                    {copied ? <><Check className="w-4 h-4 mr-1" /> 복사됨</> : <><Copy className="w-4 h-4 mr-1" /> 복사</>}
                                </button>
                            </div>
                            <button
                                onClick={() => setShowShareGuide(true)}
                                className="flex items-center gap-2 text-[11px] text-blue-600 hover:text-blue-700 transition-colors font-medium underline"
                            >
                                <HelpCircle className="w-3 h-3" />
                                연결 안 됨? 스캔 가이드 보기 (시트 공유 방법)
                            </button>
                        </div>
                    </Section>

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

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button onClick={handleSave} disabled={isSaving} className="btn-primary w-full md:w-auto md:px-8">
                            {isSaving ? '저장 중...' : '설정 저장하기'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <Section title="데이터베이스 관리" icon={<FolderArchive className="w-5 h-5 text-red-500" />} color="bg-red-50 dark:bg-red-900/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={handleExport}
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 transition-all hover:shadow-md group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                                        <Download className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">전체 데이터 백업</p>
                                        <p className="text-[10px] text-gray-500">JSON 파일로 저장</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-emerald-300 transition-all hover:shadow-md group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">백업 데이터 복원</p>
                                        <p className="text-[10px] text-gray-500">JSON 파일 불러오기</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                    </Section>

                    <Section title="위험 구역" icon={<Trash2 className="w-5 h-5 text-red-500" />} color="bg-red-50 dark:bg-red-900/20">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-red-100 dark:border-red-900/30 shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <p className="text-sm font-bold text-red-600 dark:text-red-400">모든 데이터 초기화 및 탈퇴</p>
                                    <p className="text-[10px] text-gray-500">계정과 모든 자산 정보를 즉시 삭제합니다.</p>
                                </div>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-md hover:shadow-red-200"
                                >
                                    영구 삭제
                                </button>
                            </div>
                        </div>
                    </Section>
                </div>
            )}

            {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
            {showShareGuide && <SharingGuideModal onClose={() => setShowShareGuide(false)} systemEmail={systemEmail} />}
            {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteAccount} isDeleting={isDeleting} />}

            <style jsx>{`
                .label { @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1; }
                .input-field { @apply w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-gray-900 dark:text-gray-100; }
                .help-text { @apply text-[11px] text-gray-400 mt-1.5 leading-relaxed; }
                .btn-primary { @apply py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all text-sm; }
                .btn-secondary { @apply px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm font-medium bg-white dark:bg-gray-800 active:scale-95; }
            `}</style>
        </div>
    );
}

function Section({ title, icon, color, children }: { title: string, icon: React.ReactNode, color: string, children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${color}`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
                    {children}
                </div>
            </div>
        </div>
    );
}
