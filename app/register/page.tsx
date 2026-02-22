'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Lock, Database, FileSpreadsheet, Server, Cloud, Eye, Key, Loader2, Check, AlertCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { getSystemEmail, verifySpreadsheetAccess } from '@/app/actions';
import { useEffect } from 'react';
import { useMessage } from '@/components/Providers';

type DBType = 'sheet' | 'firebase';

interface RegisterForm {
    name: string;
    school: string;
    email: string;
    password: string;

    // Database Config
    dbType: DBType;

    // Google Sheets
    spreadsheetId: string;
    serviceAccountJson: string; // JSON string

    // Firebase
    fbApiKey: string;
    fbAuthDomain: string;
    fbProjectId: string;
    fbStorageBucket: string;
    fbMessagingSenderId: string;
    fbAppId: string;

    // AI Service
    visionApiKey: string;
}

export default function RegisterPage() {
    const router = useRouter();
    const { showAlert } = useMessage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [systemEmail, setSystemEmail] = useState('');
    const [isSheetLoading, setIsSheetLoading] = useState(false);
    const [isSheetVerified, setIsSheetVerified] = useState(false);
    const [sheetVerifyError, setSheetVerifyError] = useState('');
    const [extractedEmail, setExtractedEmail] = useState('');

    useEffect(() => {
        getSystemEmail().then(res => setSystemEmail(res.email));
    }, []);

    const [form, setForm] = useState<RegisterForm>({
        name: '',
        school: '',
        email: '',
        password: '',
        dbType: 'sheet',
        spreadsheetId: '',
        serviceAccountJson: '',
        fbApiKey: '',
        fbAuthDomain: '',
        fbProjectId: '',
        fbStorageBucket: '',
        fbMessagingSenderId: '',
        fbAppId: '',
        visionApiKey: ''
    });

    const handleVerifySheet = async () => {
        if (!form.spreadsheetId) {
            showAlert('스프레드시트 ID를 먼저 입력해주세요.', 'error');
            return;
        }
        setIsSheetLoading(true);
        setSheetVerifyError('');
        try {
            const res = await verifySpreadsheetAccess(form.spreadsheetId, form.serviceAccountJson);
            if (res.success) {
                setIsSheetVerified(true);
                showAlert('연결 성공! 구글 시트 초기화(탭 생성)가 완료되었습니다.', 'success');
            } else {
                if (res.error === 'PERMISSION_DENIED') {
                    setSheetVerifyError(`권한이 없습니다. 아래의 서비스 계정 이메일을 복사하여 구글 시트에 '편집자'로 추가해 주세요.\n\n${res.systemEmail}`);
                } else {
                    setSheetVerifyError(res.error || '알 수 없는 오류');
                }
            }
        } catch (e: any) {
            setSheetVerifyError(e.message);
        } finally {
            setIsSheetLoading(false);
        }
    };

    const handleChange = (field: keyof RegisterForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = JSON.parse(content);
                if (parsed.client_email) {
                    setExtractedEmail(parsed.client_email);
                }
                setForm(prev => ({ ...prev, serviceAccountJson: content }));
            } catch (err) {
                showAlert('올바른 JSON 파일이 아닙니다.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleFirebasePaste = (text: string) => {
        if (!text.trim()) return;

        // Extract value by key (Supports "key": "value" and key: "value")
        const extract = (key: string) => {
            const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i');
            const match = text.match(regex);
            return match ? match[1] : null;
        };

        const updates: Partial<RegisterForm> = {};
        const mapping: Record<string, keyof RegisterForm> = {
            apiKey: 'fbApiKey',
            authDomain: 'fbAuthDomain',
            projectId: 'fbProjectId',
            storageBucket: 'fbStorageBucket',
            messagingSenderId: 'fbMessagingSenderId',
            appId: 'fbAppId'
        };

        let found = false;
        for (const [src, dest] of Object.entries(mapping)) {
            const val = extract(src);
            if (val) {
                updates[dest] = val as any;
                found = true;
            }
        }

        if (found) {
            setForm(prev => ({ ...prev, ...updates }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Basic Validation
        if (!form.name || !form.school || !form.email || !form.password) {
            setError('계정 정보를 모두 입력해주세요.');
            setLoading(false);
            return;
        }

        // DB Specific Validation
        if (form.dbType === 'sheet') {
            if (!form.spreadsheetId) {
                setError('Google Spreadsheet ID를 입력해주세요.');
                setLoading(false);
                return;
            }
            if (!form.serviceAccountJson) {
                setError('Service Account Credential 파일을 업로드해주세요.');
                setLoading(false);
                return;
            }
        } else if (form.dbType === 'firebase') {
            if (!form.fbApiKey || !form.fbProjectId) {
                setError('Firebase 필수 정보를 입력해주세요.');
                setLoading(false);
                return;
            }
        }

        if (!form.visionApiKey) {
            setError('Vision API Key를 입력해주세요.');
            setLoading(false);
            return;
        }

        const configToSave = {
            dbType: form.dbType,
            managerName: form.name,
            schoolName: form.school,
            visionApiKey: form.visionApiKey,
            sheet: form.dbType === 'sheet' ? {
                spreadsheetId: form.spreadsheetId,
                serviceAccountJson: form.serviceAccountJson
            } : undefined,
            firebase: form.dbType === 'firebase' ? {
                apiKey: form.fbApiKey,
                authDomain: form.fbAuthDomain,
                projectId: form.fbProjectId,
                storageBucket: form.fbStorageBucket,
                messagingSenderId: form.fbMessagingSenderId,
                appId: form.fbAppId
            } : undefined
        };

        if (configToSave.sheet?.serviceAccountJson) {
            try {
                const minified = JSON.stringify(JSON.parse(configToSave.sheet.serviceAccountJson));
                configToSave.sheet.serviceAccountJson = minified;
            } catch (e) { }
        }

        try {
            if (form.dbType === 'firebase') {
                const { registerUser } = await import('@/app/firebase-actions');
                const res = await registerUser(configToSave.firebase, {
                    email: form.email,
                    password: form.password,
                    name: form.name
                }, {
                    visionApiKey: form.visionApiKey
                });
                if (!res.success) throw new Error(res.error || 'Firebase Register Failed');
            } else {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.message || '회원가입 실패');
                }
            }

            const cookieValue = encodeURIComponent(JSON.stringify(configToSave));
            document.cookie = `edu-asset-config=${cookieValue}; path=/; max-age=31536000; SameSite=Lax`;

            showAlert('회원가입 및 설정이 완료되었습니다. 로그인해주세요.', 'success');
            router.push('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex justify-center">
            <div className="max-w-4xl w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                        EduAssetMaster 시작하기
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        계정 정보와 데이터 서버 정보를 설정하세요.
                    </p>
                </div>

                <form className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700" onSubmit={handleSubmit}>

                    {/* 1. 계정 정보 */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2">
                            <UserPlus className="w-5 h-5 text-blue-500" />
                            계정 정보
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이름</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={form.name}
                                    placeholder="홍길동"
                                    onChange={(e) => handleChange('name', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">학교</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={form.school}
                                    placeholder="OO초등학교"
                                    onChange={(e) => handleChange('school', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이메일 (계정)</label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={form.email}
                                    placeholder="example@email.com"
                                    onChange={(e) => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
                                <input
                                    type="password"
                                    required
                                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={form.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. 데이터 서버 선택 */}
                    <div className="space-y-4 mt-8">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2">
                            <Database className="w-5 h-5 text-green-500" />
                            데이터 서버 설정
                        </h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button
                                type="button"
                                onClick={() => handleChange('dbType', 'sheet')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${form.dbType === 'sheet' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                            >
                                <FileSpreadsheet className={`w-8 h-8 mb-2 ${form.dbType === 'sheet' ? 'text-green-600' : 'text-gray-400'}`} />
                                <span className={`font-medium ${form.dbType === 'sheet' ? 'text-green-700 dark:text-green-300' : 'text-gray-500'}`}>Google Sheets (기본)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('dbType', 'firebase')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${form.dbType === 'firebase' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                            >
                                <Cloud className={`w-8 h-8 mb-2 ${form.dbType === 'firebase' ? 'text-orange-600' : 'text-gray-400'}`} />
                                <span className={`font-medium ${form.dbType === 'firebase' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-500'}`}>Firebase</span>
                            </button>
                        </div>

                        {/* Google Sheets Config */}
                        {form.dbType === 'sheet' && (
                            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg space-y-6 animate-in fade-in transition-all">

                                {/* Step 1: JSON Upload */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
                                        1. 서비스 계정 등록하기 (JSON 파일 업로드)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleFileUpload}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                                        />
                                        {form.serviceAccountJson && (
                                            <span className="text-xs text-green-600 font-bold flex items-center gap-1 whitespace-nowrap">
                                                <Check className="w-3 h-3" /> 업로드 완료
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                        Google Cloud Console에서 생성한 서비스 계정 키(JSON)를 업로드하세요.
                                    </p>
                                </div>

                                {/* Step 2: Permission Guide */}
                                <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <label className="block text-sm font-bold text-blue-900 dark:text-blue-200">
                                        2. 구글 시트에 서비스 계정 초대하기
                                    </label>
                                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                                        아래 이메일을 복사하여, 사용할 <strong>구글 시트의 [공유]</strong> 버튼을 누르고 <strong>'편집자(Editor)'</strong> 권한으로 초대해주세요.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            readOnly
                                            value={extractedEmail}
                                            placeholder="JSON 파일을 업로드하면 이메일이 자동 추출됩니다"
                                            className="flex-1 text-[11px] bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded px-3 py-2 font-mono text-blue-900 dark:text-blue-100 italic"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const email = extractedEmail;
                                                if (email) {
                                                    navigator.clipboard.writeText(email);
                                                    showAlert('이메일이 복사되었습니다.', 'success');
                                                } else {
                                                    showAlert('먼저 1단계에서 파일을 업로드해주세요.', 'error');
                                                }
                                            }}
                                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold transition-colors disabled:opacity-50"
                                            disabled={!extractedEmail}
                                        >
                                            복사
                                        </button>
                                    </div>
                                </div>

                                {/* Step 3: Sheet ID & Activation */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-800 dark:text-gray-200">
                                        3. 구글 시트 ID 입력 및 활성화
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white sm:text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="1BxiMVs0XRA5nFMdKbBdB..."
                                            value={form.spreadsheetId}
                                            onChange={(e) => {
                                                handleChange('spreadsheetId', e.target.value);
                                                setIsSheetVerified(false);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleVerifySheet}
                                            disabled={isSheetLoading || !form.spreadsheetId}
                                            className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap shadow-sm
                                                ${isSheetVerified
                                                    ? 'bg-green-600 text-white cursor-default'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'}`}
                                        >
                                            {isSheetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSheetVerified ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                            {isSheetVerified ? '활성화됨' : '탭 생성 및 활성화'}
                                        </button>
                                    </div>

                                    {sheetVerifyError && (
                                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-[11px] text-red-800 dark:text-red-200">
                                            연결 실패: {sheetVerifyError}
                                        </div>
                                    )}

                                    {!isSheetVerified && (
                                        <p className="text-[11px] text-gray-500">
                                            시트 ID 입력 후 위 버튼을 누르면 데이터 보관을 위한 <strong>필수 탭들이 자동으로 생성</strong>됩니다.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Firebase Config omitted for brevity, keep same logic but add links if needed */}
                        {form.dbType === 'firebase' && (
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4 animate-in fade-in">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Firebase 설정 붙여넣기 (자동 입력)
                                    </label>
                                    <textarea
                                        rows={4}
                                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 text-xs font-mono placeholder-gray-400"
                                        placeholder={`// 설정 코드를 붙여넣으세요.`}
                                        onChange={(e) => handleFirebasePaste(e.target.value)}
                                    />
                                    <p className="mt-2 text-xs text-gray-500">
                                        경로: <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Firebase Console</a> &gt; 프로젝트 설정 &gt; SDK 설정 (Config)
                                    </p>
                                </div>
                                {/* Rest of Firebase fields as before... */}
                            </div>
                        )}
                    </div>

                    {/* 3. AI Config */}
                    <div className="space-y-4 mt-8">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2">
                            <Eye className="w-5 h-5 text-purple-500" />
                            AI 서비스 설정
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Google Cloud Vision API Key</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Key className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="AIzaSy..."
                                    value={form.visionApiKey}
                                    onChange={(e) => handleChange('visionApiKey', e.target.value)}
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                경로: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a> &gt; 사용자 인증 정보 &gt; API 키 만들기
                            </p>
                            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800 text-[10px] text-blue-800 dark:text-blue-200">
                                <strong>💡 필수 설정:</strong> API 키 생성 후, <a href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" target="_blank" rel="noreferrer" className="underline font-bold">Generative Language API</a>를 반드시 '사용 설정' 해야 AI 기능이 작동합니다.
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-4 border border-red-200">
                            <div className="flex">
                                <AlertCircle className="h-5 w-5 text-red-400" />
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">오류가 발생했습니다.</h3>
                                    <div className="mt-2 text-sm text-red-700">{error}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                        <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                            이미 계정이 있으신가요? 로그인
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto inline-flex justify-center py-2 px-8 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    설정 및 가입 중...
                                </>
                            ) : (
                                '가입 및 설정 완료'
                            )}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
