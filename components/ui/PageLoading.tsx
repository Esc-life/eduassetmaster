'use client';

import { Loader2 } from 'lucide-react';

interface PageLoadingProps {
    message?: string;
}

export default function PageLoading({ message = '데이터를 불러오는 중입니다...' }: PageLoadingProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">{message}</p>
        </div>
    );
}
