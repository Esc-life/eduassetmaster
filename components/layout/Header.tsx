'use client';

import { UserCircle } from 'lucide-react';

export function Header() {
    return (
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shadow-sm sticky top-0 z-40">
            <div className="flex items-center gap-4">
                {/* Placeholder Logo */}
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 font-bold">
                    IMG
                </div>
                <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                    에듀에셋 마스터 학교
                </h1>
            </div>
            <button
                className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors cursor-pointer"
                onClick={() => alert('로그인 기능은 준비 중입니다.')}
            >
                <UserCircle className="w-6 h-6" />
                <span className="font-medium">Admin Login</span>
            </button>
        </header>
    );
}
