'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Menu, X, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Hide layout on login, register, AND scan pages
    const isStandalonePage = pathname === '/login' || pathname === '/register' || pathname === '/scan';

    if (isStandalonePage) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Responsive */}
            <div className={`fixed inset-y-0 left-0 w-64 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar onItemClick={() => setIsSidebarOpen(false)} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300 min-w-0">
                {/* Mobile Header with Hamburger and Logout */}
                <div className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </button>
                    <span className="font-bold text-lg text-blue-600">EduAsset</span>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="p-2 -mr-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="로그아웃"
                    >
                        <LogOut className="w-6 h-6" />
                    </button>
                </div>

                {/* Desktop Header (Hidden on Mobile) */}
                <div className="hidden md:block">
                    <Header />
                </div>

                <main className="p-4 md:p-6 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
