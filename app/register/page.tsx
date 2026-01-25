'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Lock, FileSpreadsheet, Info, Loader2, Copy, Check, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [serviceEmail, setServiceEmail] = useState('');
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    // Form State
    const [form, setForm] = useState({
        email: '',
        password: '',
        name: '',
        spreadsheetId: ''
    });
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch Service Account Email for the user to copy
        fetch('/api/system/config')
            .then(res => res.json())
            .then(data => setServiceEmail(data.serviceAccountEmail));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!form.spreadsheetId) {
            setError('Google Spreadsheet ID는 필수입니다.');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || '회원가입 실패');
            }

            alert('회원가입이 완료되었습니다. 로그인해주세요.');
            router.push('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('복사되었습니다: ' + text);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8 relative">

            {/* Guide Modal */}
            {isGuideOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsGuideOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            워크스페이스 연동 가이드
                        </h3>

                        <ol className="list-decimal pl-5 space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <li>
                                <strong>새 구글 스프레드시트 생성</strong>
                                <p className="text-xs text-gray-500 mt-1">school.google.com 등에서 새 시트를 만드세요.</p>
                            </li>
                            <li>
                                <strong>서비스 계정 초대 (필수)</strong>
                                <p className="text-xs text-gray-500 mt-1">시트 우측 상단 '공유' 버튼을 누르고 아래 이메일을 <strong>'편집자'</strong>로 추가하세요.</p>
                                <div className="flex items-center gap-2 mt-2 bg-gray-100 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                                    <code className="text-xs flex-1 break-all text-blue-600 font-mono">{serviceEmail || 'Loading...'}</code>
                                    <button onClick={() => copyToClipboard(serviceEmail)} className="p-1 hover:bg-white rounded">
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </div>
                            </li>
                            <li>
                                <strong>Spreadsheet ID 복사</strong>
                                <p className="text-xs text-gray-500 mt-1">
                                    시트 주소창 URL에서 <code className="bg-gray-100 px-1 rounded">/d/</code> 와 <code className="bg-gray-100 px-1 rounded">/edit</code> 사이의 긴 문자열을 복사하세요.
                                </p>
                                <div className="mt-1 p-2 bg-yellow-50 text-xs text-yellow-700 rounded border border-yellow-100">
                                    예: https://docs.google.com/spreadsheets/d/<br />
                                    <strong>1BxiMVs0XRA5nFMdKbBdB_7...</strong><br />
                                    /edit#gid=0
                                </div>
                            </li>
                        </ol>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setIsGuideOpen(false)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                                확인했습니다
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">회원가입</h1>
                    <p className="text-sm text-gray-500 mt-2">나만의 자산 관리 워크스페이스 생성</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            이름 (학교/부서명)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                                placeholder="예: 서울초등학교 정보부"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            이메일
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                                placeholder="teacher@school.edu"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            비밀번호
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                type="password"
                                required
                                minLength={4}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* Spreadsheet ID (Required) */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Google Spreadsheet ID <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsGuideOpen(true)}
                                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                            >
                                <HelpCircle className="w-3 h-3" />
                                ID 확인 및 설정 방법
                            </button>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                required
                                value={form.spreadsheetId}
                                onChange={(e) => setForm({ ...form, spreadsheetId: e.target.value })}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary font-mono text-sm"
                                placeholder="1xA..."
                            />
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                            * 본인의 구글 시트를 연결해야 데이터가 저장됩니다.<br />
                            * 위 '설정 방법'을 눌러 서비스 계정을 꼭 <strong>초대</strong>해주세요.
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center font-medium">
                            {error}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '계정 생성 완료'}
                        </button>
                    </div>

                    <div className="text-center text-sm mt-4">
                        <Link href="/login" className="text-primary hover:underline">
                            취소하고 로그인하기
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
