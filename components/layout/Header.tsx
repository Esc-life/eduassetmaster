'use client';

import { Search, LogOut, User } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

export function Header() {
    const { data: session } = useSession();

    return (
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-end sticky top-0 z-10 transition-colors">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">

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
            </div>
        </header>
    );
}
