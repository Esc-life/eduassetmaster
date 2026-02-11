'use client';

import { Bell, Search, LogOut, User } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

export function Header() {
    const { data: session } = useSession();

    return (
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-end sticky top-0 z-10 transition-colors">
            <div className="flex items-center gap-4">
                {/* Notification Bell */}
                <button className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                </button>

                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                {/* User Profile & Logout */}
                {session?.user ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-700">
                            <User className="w-4 h-4 text-primary" />
                            <span className="truncate max-w-[150px]">{session.user.name || session.user.email}</span>
                        </div>

                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                            title="로그아웃"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <span className="text-sm text-gray-400">Guest</span>
                )}
            </div>
        </header>
    );
}
