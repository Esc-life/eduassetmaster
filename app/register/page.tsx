'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Lock, Database, FileSpreadsheet, Server, Cloud, Eye, Key, Loader2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type DBType = 'sheet' | 'firebase';

interface RegisterForm {
    name: string;
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState<RegisterForm>({
        name: '',
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

    const handleChange = (field: keyof RegisterForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
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
        if (!form.name || !form.email || !form.password) {
            setError('기본 정보를 모두 입력해주세요.');
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
                setError('Service Account JSON을 입력해주세요.');
                setLoading(false);
                return;
            }
            try {
                JSON.parse(form.serviceAccountJson);
            } catch (e) {
                setError('Service Account JSON 형식이 올바르지 않습니다.');
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

        // 1. Construct Config (Needed before calling register action)
        const configToSave = {
            dbType: form.dbType,
            managerName: form.name,
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

        // Minify JSON if needed
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

            // Encode (Handle UTF-8 safely)
            // Use Lax for better UX on redirect
            const cookieValue = encodeURIComponent(JSON.stringify(configToSave));
            document.cookie = `edu-asset-config=${cookieValue}; path=/; max-age=31536000; SameSite=Lax`;

            alert('회원가입 및 설정이 완료되었습니다. 로그인해주세요.');
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
                        데이터 서버를 선택하고 필요한 설정을 입력하세요.
                    </p>
                </div>

                <form className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700" onSubmit={handleSubmit}>

                    {/* 1. 기본 정보 */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 border-b pb-2">
                            <UserPlus className="w-5 h-5 text-blue-500" />
                            관리자 계정 정보
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이름 (학교/부서명)</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">이메일</label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={form.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-2">
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
                                <span className={`font-medium ${form.dbType === 'sheet' ? 'text-green-700 dark:text-green-300' : 'text-gray-500'}`}>Google Sheets</span>
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
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4 animate-in fade-in">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Spreadsheet ID</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white sm:text-sm font-mono"
                                        placeholder="1BxiMVs0XRA5nFMdKbBdB..."
                                        value={form.spreadsheetId}
                                        onChange={(e) => handleChange('spreadsheetId', e.target.value)}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">구글 시트 URL에서 /d/와 /edit 사이의 값입니다.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Account Credential (JSON)</label>
                                    <textarea
                                        rows={5}
                                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white sm:text-sm font-mono text-xs"
                                        placeholder='{"type": "service_account", "project_id": "...", ...}'
                                        value={form.serviceAccountJson}
                                        onChange={(e) => handleChange('serviceAccountJson', e.target.value)}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        경로: Google Cloud Console &gt; IAM 및 관리자 &gt; 서비스 계정 &gt; 키 만들기 (JSON)
                                        <br />다운로드한 JSON 파일 내용을 그대로 붙여넣으세요.
                                    </p>
                                    <div className="mt-2 bg-yellow-50 p-2 rounded border border-yellow-200 text-xs text-yellow-800">
                                        <strong>⚠️ 중요:</strong> JSON 내용 중 <code>client_email</code> 값을 복사하여, <br />
                                        연동할 <strong>구글 시트의 [공유]</strong> 버튼을 눌러 '편집자' 권한으로 초대해야 합니다.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Firebase Config */}
                        {form.dbType === 'firebase' && (
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4 animate-in fade-in">
                                {/* Paste Area */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Firebase 설정 붙여넣기 (자동 입력)
                                    </label>
                                    <textarea
                                        rows={4}
                                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 text-xs font-mono placeholder-gray-400"
                                        placeholder={`// 아래와 같은 설정 코드를 붙여넣으면 자동 입력됩니다.\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  ...\n};`}
                                        onChange={(e) => handleFirebasePaste(e.target.value)}
                                    />
                                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        ✨ 코드를 붙여넣으면 아래 필드가 자동으로 채워집니다.
                                    </p>
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-700 border-dashed"></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={form.fbApiKey} onChange={(e) => handleChange('fbApiKey', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Auth Domain</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={form.fbAuthDomain} onChange={(e) => handleChange('fbAuthDomain', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project ID</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={form.fbProjectId} onChange={(e) => handleChange('fbProjectId', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Storage Bucket</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={form.fbStorageBucket} onChange={(e) => handleChange('fbStorageBucket', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Messaging Sender ID</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={form.fbMessagingSenderId} onChange={(e) => handleChange('fbMessagingSenderId', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">App ID</label>
                                        <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={form.fbAppId} onChange={(e) => handleChange('fbAppId', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded text-center">
                                            경로: Firebase 콘솔 &gt; 프로젝트 설정 &gt; 일반 &gt; 내 앱 &gt; SDK 설정 및 구성 (Config)
                                        </p>
                                    </div>
                                </div>
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
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                                    placeholder="AIzaSy..."
                                    value={form.visionApiKey}
                                    onChange={(e) => handleChange('visionApiKey', e.target.value)}
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                이미지 텍스트 인식(OCR)을 위해 필요합니다.<br />
                                <span className="text-gray-400">경로: Google Cloud Console &gt; 사용자 인증 정보 &gt; 사용자 인증 정보 만들기 &gt; API 키</span>
                            </p>
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

                    <div className="flex items-center justify-between pt-4">
                        <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                            이미 계정이 있으신가요? 로그인
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    설정 중...
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
