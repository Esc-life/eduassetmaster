'use client';

import Link from 'next/link';
import { LayoutDashboard, MonitorSmartphone, Key, CalendarClock, Settings, X, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface SidebarProps {
    onItemClick?: () => void;
}

export function Sidebar({ onItemClick }: SidebarProps) {
    const menuItems = [
        { name: '대시보드', href: '/', icon: LayoutDashboard },
        { name: '기기 관리', href: '/devices', icon: MonitorSmartphone },
        { name: 'SW/계정 관리', href: '/software', icon: Key },
        { name: '대여/반납', href: '/loans', icon: CalendarClock },
        { name: '설정', href: '/settings', icon: Settings },
    ];

    return (
        // Removed 'fixed left-0 top-0' to respect parent container's transform
        <aside className="w-full h-full bg-sidebar text-sidebar-fg flex flex-col shadow-xl">
            <div className="p-6 text-2xl font-bold border-b border-blue-800 flex items-center justify-between">
                <span>EduAsset</span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (onItemClick) onItemClick();
                    }}
                    className="md:hidden p-3 -mr-3 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer relative z-50 touch-manipulation"
                    aria-label="메뉴 닫기"
                    title="메뉴 닫기"
                >
                    <X className="w-7 h-7" />
                </button>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onItemClick}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-700/50 transition-colors"
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                    </Link>
                ))}
            </nav>
            <div className="p-4 space-y-4 border-t border-blue-800">
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-3 px-4 py-3 text-blue-200 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span>로그아웃</span>
                </button>
                <div className="text-sm text-blue-300 px-4">
                    v1.0.0
                </div>
            </div>
        </aside>
    );
}
