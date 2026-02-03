'use client';

import Link from 'next/link';
import { LayoutDashboard, MonitorSmartphone, Key, CalendarClock, Settings } from 'lucide-react';

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
        <aside className="w-64 bg-sidebar text-sidebar-fg h-screen fixed left-0 top-0 flex flex-col shadow-xl z-50">
            <div className="p-6 text-2xl font-bold border-b border-blue-800 flex items-center gap-2">
                <span>EduAsset</span>
            </div>
            <nav className="flex-1 p-4 space-y-2">
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
            <div className="p-4 border-t border-blue-800 text-sm text-blue-200">
                v1.0.0
            </div>
        </aside>
    );
}
