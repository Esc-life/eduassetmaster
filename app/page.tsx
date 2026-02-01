'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to devices page
        router.push('/devices');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
            </div>
        </div>
    );
}
