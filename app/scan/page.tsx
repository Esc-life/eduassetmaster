'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Camera, Upload, Check, AlertCircle, ArrowLeft, Loader2, ScanLine, MapPin, User, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchMapConfiguration, processScannedImage } from '@/app/actions';
import { Location, Device } from '@/types';
import Link from 'next/link';
import Image from 'next/image';

export default function ScanPage() {
    const router = useRouter();
    const [zones, setZones] = useState<Location[]>([]);
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [isZoneLoading, setIsZoneLoading] = useState(false);

    const [managerId, setManagerId] = useState('');
    const [isIdConfirmed, setIsIdConfirmed] = useState(false);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; device?: Device; text?: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load saved Manager ID
    useEffect(() => {
        const savedId = localStorage.getItem('edu_asset_manager_id');
        if (savedId) {
            setManagerId(savedId);
        }
    }, []);

    const handleConfirmId = async () => {
        if (!managerId.trim()) {
            alert('정보부장(관리자) ID를 입력해주세요.');
            return;
        }

        setIsZoneLoading(true);
        try {
            // Attempt to load map config using the provided ID
            const config = await fetchMapConfiguration(managerId);

            if (config && config.zones && config.zones.length > 0) {
                // Success
                const sorted = [...config.zones].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                setZones(sorted);
                setIsIdConfirmed(true);
                localStorage.setItem('edu_asset_manager_id', managerId);
            } else if (config && (!config.zones || config.zones.length === 0)) {
                // Valid sheet but no zones? Or invalid access returning empty default.
                // Assuming it's valid if no error thrown, just empty. Or system uses NO_SHEET logic.
                // Let's assume warning but allow proceed if user insists, but practically we need zones.
                const sorted = config.zones ? [...config.zones].sort((a, b) => a.name.localeCompare(b.name, 'ko')) : [];
                setZones(sorted);
                setIsIdConfirmed(true); // Allow anyway, maybe first time setup
                localStorage.setItem('edu_asset_manager_id', managerId);
                if (sorted.length === 0) alert('연결은 성공했으나 저장된 구역(Zone)이 없습니다. 관리자 페이지에서 먼저 배치도를 설정해주세요.');
            } else {
                alert('연결 실패: 유효하지 않은 ID이거나 접근 권한이 없습니다.');
            }
        } catch (error) {
            console.error('Config fetch error:', error);
            alert('서버 연결 중 오류가 발생했습니다.');
        } finally {
            setIsZoneLoading(false);
        }
    };

    const handleResetId = () => {
        setIsIdConfirmed(false);
        setZones([]);
        setSelectedZone('');
        // Don't clear managerId text for UX
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
                const MAX_SIZE = 1200; // Increased slightly for better OCR

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
            // Pass managerId (Sheet ID) to the server action
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
                    <h1 className="text-lg font-bold">기기 스캔 등록</h1>
                </div>
                {isIdConfirmed && (
                    <button onClick={handleResetId} className="text-xs text-gray-500 underline">
                        계정 변경
                    </button>
                )}
            </div>

            <div className="max-w-md mx-auto p-4 space-y-6">

                {/* 1. Manager ID Input */}
                {!isIdConfirmed && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-cyan-100 dark:border-cyan-900/30 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">관리자 확인</h2>
                                <p className="text-xs text-gray-500">데이터를 저장할 서버(구글 시트)를 불러옵니다.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-400">
                                    정보부장 ID (Spreadsheet ID)
                                </label>
                                <input
                                    type="text"
                                    value={managerId}
                                    onChange={(e) => setManagerId(e.target.value)}
                                    placeholder="예: 1xAbCdE..."
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-mono text-sm"
                                />
                                <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                                    * 구글 시트 URL에서 <code>/d/</code> 와 <code>/edit</code> 사이의 문자열입니다.
                                </p>
                            </div>
                            <button
                                onClick={handleConfirmId}
                                disabled={isZoneLoading || !managerId}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isZoneLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '구역 정보 불러오기'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Zone Selection (Visible only after ID confirmed) */}
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
                            <div className="relative aspect-[3/4] bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-center p-6 shadow-sm">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                                    <Camera className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">기기 촬영</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                                    기기의 <strong>물품명, 모델명, 관리번호</strong>가<br />잘 보이도록 촬영해주세요.
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
                                <p className="text-[10px] text-gray-400 mt-3">
                                    * 초점은 카메라 화면을 터치하여 맞춰주세요.
                                </p>
                            </div>
                        )}

                        {/* Preview & Processing */}
                        {imagePreview && (
                            <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-800">
                                <Image
                                    src={imagePreview}
                                    alt="Captured"
                                    fill
                                    className="object-contain"
                                />

                                {/* Overlay while processing */}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                                        <div className="relative w-64 h-1 overflow-hidden bg-gray-700 rounded-full mb-4">
                                            <div className="absolute inset-0 bg-green-500 animate-[scan_1.5s_ease-in-out_infinite]" />
                                        </div>
                                        <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                        <p className="text-white font-medium animate-pulse">AI가 기기 정보를 분석 중입니다...</p>
                                    </div>
                                )}

                                {/* Result Overlay */}
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
                                                    {result.success ? '위치 등록 완료!' : '인식 실패'}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
                                                    {result.message || result.error}
                                                </p>

                                                {result.device && (
                                                    <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm border border-gray-200 dark:border-gray-700">
                                                        <div className="grid grid-cols-[60px_1fr] gap-1">
                                                            <span className="text-gray-500">모델명</span>
                                                            <span className="font-medium truncate">{result.device.model}</span>
                                                            <span className="text-gray-500">제품명</span>
                                                            <span className="font-medium truncate">{result.device.name}</span>
                                                            <span className="text-gray-500">관리번호</span>
                                                            <span className="font-medium truncate">{result.device.id}</span>
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
