'use client';

import { useState } from 'react';
import { Mail, Lock, User, School, FileSpreadsheet, Key, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function RecoverPage() {
    const [tab, setTab] = useState<'id' | 'pw'>('id');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: 'id' | 'pw', value: string } | null>(null);
    const [error, setError] = useState('');

    const [idForm, setIdForm] = useState({ name: '', school: '' });
    const [pwForm, setPwForm] = useState({ email: '', sheetId: '' });

    const handleRecoverId = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch('/api/auth/recover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'id', ...idForm })
            });
            const data = await res.json();
            if (res.ok) {
                setResult({ type: 'id', value: data.email });
            } else {
                setError(data.message || '정보를 찾을 수 없습니다.');
            }
        } catch (err) {
            setError('서버 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleRecoverPw = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch('/api/auth/recover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'pw', ...pwForm })
            });
            const data = await res.json();
            if (res.ok) {
                setResult({ type: 'pw', value: data.password });
            } else {
                setError(data.message || '정보를 찾을 수 없습니다.');
            }
        } catch (err) {
            setError('서버 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-8">
                    <div className="mb-6">
                        <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors gap-1 mb-6">
                            <ArrowLeft className="w-4 h-4" />
                            로그인으로 돌아가기
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">계정 찾기</h1>
                        <p className="text-sm text-gray-500">잊어버린 아이디 또는 비밀번호를 조회합니다.</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl mb-8">
                        <button
                            onClick={() => { setTab('id'); setResult(null); setError(''); }}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'id' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            아이디(이메일) 찾기
                        </button>
                        <button
                            onClick={() => { setTab('pw'); setResult(null); setError(''); }}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'pw' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            비밀번호 찾기
                        </button>
                    </div>

                    {!result ? (
                        <AnimatePresence mode="wait">
                            {tab === 'id' ? (
                                <motion.form
                                    key="id-form"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    onSubmit={handleRecoverId}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">이름</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="가입 시 입력한 이름"
                                                value={idForm.name}
                                                onChange={(e) => setIdForm({ ...idForm, name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">학교명</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                <School className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="가입 시 입력한 학교명"
                                                value={idForm.school}
                                                onChange={(e) => setIdForm({ ...idForm, school: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '아이디 확인'}
                                    </button>
                                </motion.form>
                            ) : (
                                <motion.form
                                    key="pw-form"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    onSubmit={handleRecoverPw}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">아이디 (이메일)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="email"
                                                required
                                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="가입 계정 이메일"
                                                value={pwForm.email}
                                                onChange={(e) => setPwForm({ ...pwForm, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">구글 시트 ID</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                                <FileSpreadsheet className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="연동된 스프레드시트 ID"
                                                value={pwForm.sheetId}
                                                onChange={(e) => setPwForm({ ...pwForm, sheetId: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '비밀번호 확인'}
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    ) : (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center py-8"
                        >
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">조회 결과</h3>
                            <p className="text-sm text-gray-500 mb-6">입력하신 정보와 일치하는 {result.type === 'id' ? '아이디' : '비밀번호'}입니다.</p>

                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 mb-8">
                                <span className="text-lg font-mono font-bold text-blue-600 break-all">
                                    {result.value}
                                </span>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Link href="/login" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
                                    로그인하러 가기
                                </Link>
                                <button
                                    onClick={() => setResult(null)}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    다시 조회하기
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
