'use client';

import { useState, useRef, useEffect, ChangeEvent, Suspense } from 'react';
import { Camera, Upload, Check, AlertCircle, ArrowLeft, Loader2, ScanLine, MapPin, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchMapConfiguration, processScannedImage } from '@/app/actions';
import { Location, Device } from '@/types';
import Link from 'next/link';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

function ScanPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // States
    const [zones, setZones] = useState<Location[]>([]);
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [isZoneLoading, setIsZoneLoading] = useState(false);

    const [managerId, setManagerId] = useState('');
    const [managerName, setManagerName] = useState(''); // Display name from URL
    const [isIdConfirmed, setIsIdConfirmed] = useState(false);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; device?: Device; text?: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load & URL Params
    useEffect(() => {
        const urlId = searchParams.get('id');
        const urlName = searchParams.get('manager');

        if (urlId) {
            setManagerId(urlId);
            if (urlName) setManagerName(urlName);
            handleConfirmId(urlId);
        } else {
            const savedId = localStorage.getItem('edu_asset_manager_id');
            const savedName = localStorage.getItem('edu_asset_manager_name');
            if (savedId) {
                setManagerId(savedId);
                if (savedName) setManagerName(savedName);
            }
        }
    }, [searchParams]);

    const handleConfirmId = async (overrideId?: string) => {
        const targetId = overrideId || managerId;
        if (!targetId.trim()) return;

        setIsZoneLoading(true);
        try {
            const config = await fetchMapConfiguration(targetId);

            if (config && (config.zones || config.zones === undefined)) {
                // Success (zones might be empty array)
                const sorted = config.zones ? [...config.zones].sort((a, b) => a.name.localeCompare(b.name, 'ko')) : [];
                setZones(sorted);
                setIsIdConfirmed(true);

                // Save to local storage for convenience
                if (!overrideId) { // Only save if manually entered (optional preference)
                    localStorage.setItem('edu_asset_manager_id', targetId);
                }
                // If fetching config was possible, we assume ID is valid.
            } else {
                alert('연결 실패: 유효하지 않은 ID이거나 접근 권한이 없습니다.');
            }
        } catch (error) {
            console.error('Config fetch error:', error);
            // alert('서버 연결 중 오류가 발생했습니다.'); // Disable alert on auto-load to be less annoying
        } finally {
            setIsZoneLoading(false);
        }
    };

    const handleResetId = () => {
        setIsIdConfirmed(false);
        setZones([]);
        setSelectedZone('');
        setResult(null);
        setImagePreview(null);
        router.push('/scan'); // Clear URL params
    };

    // Handle Image Upload & Compress
    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1200;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setImagePreview(compressedBase64);
                setResult(null);

                const base64Content = compressedBase64.split(',')[1];
                handleProcess(base64Content);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleProcess = async (base64Content: string) => {
        if (!selectedZone) {
            alert('먼저 설치할 구역을 선택해주세요.');
            return;
        }

        setIsProcessing(true);
        try {
            const response = await processScannedImage(base64Content, selectedZone, managerId);
            setResult(response);
        } catch (error) {
            setResult({ success: false, error: '상세 처리 중 오류가 발생했습니다.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRetake = () => {
        setImagePreview(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold leading-none">기기 스캔 등록</h1>
                        {managerName && <p className="text-xs text-gray-500 mt-1">관리자: {managerName}</p>}
                    </div>
                </div>
                {isIdConfirmed && (
                    <button onClick={handleResetId} className="text-xs text-gray-500 underline px-2 py-1">
                        변경
                    </button>
                )}
            </div>

            <div className="max-w-md mx-auto p-4 space-y-6">

                {/* 1. Manager ID Input (Shown only if not confirmed) */}
                {!isIdConfirmed && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/30 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">관리자 연결</h2>
                                <p className="text-xs text-gray-500 break-keep">정보부장님이 공유한 스캔 링크로 접속하거나, 시트 ID를 직접 입력하세요.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-400">
                                    Spreadsheet ID
                                </label>
                                <input
                                    type="text"
                                    value={managerId}
                                    onChange={(e) => setManagerId(e.target.value)}
                                    placeholder="공유받은 ID 입력..."
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                />
                            </div>
                            <button
                                onClick={() => handleConfirmId()}
                                disabled={isZoneLoading || !managerId}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isZoneLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '연결하기'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Zone Selection */}
                {isIdConfirmed && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                설치 구역 선택 ({zones.length}곳)
                            </label>
                            <select
                                value={selectedZone}
                                onChange={(e) => setSelectedZone(e.target.value)}
                                disabled={isProcessing}
                                className={`w-full p-3 rounded-xl border bg-white dark:bg-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-base appearance-none ${!selectedZone ? 'border-blue-500/50 ring-2 ring-blue-500/10' : 'border-gray-200 dark:border-gray-700'}`}
                            >
                                <option value="">-- 구역을 선택하세요 --</option>
                                {zones.map((zone) => (
                                    <option key={zone.id} value={zone.name}>
                                        {zone.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Camera View */}
                        {!imagePreview && (
                            <div className="relative aspect-[3/4] bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center p-6 shadow-sm touch-manipulation">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                                    <Camera className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">기기 촬영</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed break-keep">
                                    물품 택(라벨)의 모델명과 번호가 잘 보이게 찍어주세요.
                                </p>

                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={!selectedZone}
                                />

                                <button
                                    onClick={() => {
                                        if (!selectedZone) {
                                            alert('상단의 드롭다운에서 설치할 구역을 먼저 선택해주세요!');
                                            return;
                                        }
                                        fileInputRef.current?.click();
                                    }}
                                    className={`w-full py-4 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${selectedZone
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'}`}
                                >
                                    <Camera className="w-5 h-5" />
                                    카메라 실행
                                </button>
                                <p className="text-[11px] text-gray-400 mt-3 break-keep">
                                    * 화면을 터치하여 초점을 맞춘 뒤 촬영하세요.
                                </p>
                            </div>
                        )}

                        {/* Preview */}
                        {imagePreview && (
                            <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-800">
                                <Image
                                    src={imagePreview}
                                    alt="Captured"
                                    fill
                                    className="object-contain"
                                />

                                {isProcessing && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                                        <div className="relative w-64 h-1 overflow-hidden bg-gray-700 rounded-full mb-4">
                                            <div className="absolute inset-0 bg-green-500 animate-[scan_1.5s_ease-in-out_infinite]" />
                                        </div>
                                        <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                        <p className="text-white font-medium animate-pulse">분석 중...</p>
                                    </div>
                                )}

                                {!isProcessing && result && (
                                    <div className="absolute bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-2xl p-5 shadow-2xl border-t border-gray-200 dark:border-gray-800 animate-in slide-in-from-bottom-10">
                                        <div className="flex items-start gap-4">
                                            {result.success ? (
                                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 shrink-0">
                                                    <Check className="w-6 h-6" />
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 shrink-0">
                                                    <AlertCircle className="w-6 h-6" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-bold text-lg ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                    {result.success ? '등록 완료!' : '인식 실패'}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap break-keep leading-snug">
                                                    {result.message || result.error}
                                                </p>

                                                {result.device && (
                                                    <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm border border-gray-200 dark:border-gray-700">
                                                        <div className="grid grid-cols-[60px_1fr] gap-y-1">
                                                            <span className="text-gray-500">모델</span>
                                                            <span className="font-medium truncate">{result.device.model}</span>
                                                            <span className="text-gray-500">이름</span>
                                                            <span className="font-medium truncate">{result.device.name}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleRetake}
                                            className="w-full mt-5 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
                                        >
                                            확인 / 다음 촬영
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes scan {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}

export default function ScanPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-500">페이지 로딩 중...</p>
            </div>
        </div>}>
            <ScanPageContent />
        </Suspense>
    );
}
