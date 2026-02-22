'use client';

import { useState, useRef, useEffect, ChangeEvent, Suspense } from 'react';
import { Camera, Upload, Check, AlertCircle, ArrowLeft, Loader2, ScanLine, MapPin, User, ImageIcon, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchAllZones, processScannedImage, getSystemEmail } from '@/app/actions';
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
    const [managerName, setManagerName] = useState('');
    const [isIdConfirmed, setIsIdConfirmed] = useState(false);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; device?: Device; text?: string } | null>(null);

    // Camera (WebRTC) States
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');

    const [systemEmail, setSystemEmail] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getSystemEmail().then(res => setSystemEmail(res.email));
    }, []);

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

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const handleConfirmId = async (overrideId?: string) => {
        const targetId = overrideId || managerId;
        if (!targetId.trim()) return;

        setIsZoneLoading(true);
        try {
            const res = await fetchAllZones(targetId);

            if (res.success && res.zones && res.zones.length > 0) {
                const sorted = [...res.zones].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                setZones(sorted);
                setIsIdConfirmed(true);
                if (!overrideId) localStorage.setItem('edu_asset_manager_id', targetId);
            } else if (!res.success) {
                if (res.error === 'PERMISSION_DENIED') {
                    alert(`[권한 부족] 해당 스프레드시트(${targetId})가 시스템 계정에 공유되지 않았습니다.\n\n해결 방법:\n1. 구글 시트 우측 상단 '공유' 클릭\n2. 아래 이메일을 '편집자'로 추가\n👉 ${systemEmail || '시스템 서비스 계정'}`);
                } else {
                    alert(`에러 발생: ${res.error || '데이터를 불러오는 중 오류가 발생했습니다.'}\n(ID: ${targetId})`);
                }
            } else {
                alert(`연결 실패: 구역 정보가 없습니다.\n(ID: ${targetId})\n\n시트 내 'Locations' 시트나 'Config' 시트에 구역 데이터가 등록되어 있는지 확인해 주세요.`);
            }
        } catch (error: any) {
            console.error('Zone fetch error:', error);
            alert(`데이터 요청 중 기술적인 오류가 발생했습니다: ${error.message || 'Unknown error'}`);
        } finally {
            setIsZoneLoading(false);
        }
    };

    const handleResetId = () => {
        stopCamera();
        setIsIdConfirmed(false);
        setZones([]);
        setSelectedZone('');
        setResult(null);
        setImagePreview(null);
        router.push('/scan');
    };

    // Camera Functions
    const startCamera = async () => {
        setCameraError('');
        setImagePreview(null);
        setResult(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            setIsCameraActive(true);
            // Small delay to ensure ref is mounted
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error(err);
            setCameraError('카메라 권한이 없거나 지원하지 않는 브라우저입니다. 파일 업로드를 이용해주세요.');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const captureImage = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.95);

            stopCamera();
            setImagePreview(base64);
            handleProcess(base64.split(',')[1]);
        }
    };

    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
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
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setImagePreview(compressedBase64);
                setResult(null);
                handleProcess(compressedBase64.split(',')[1]);
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
            // Look up zone name from the selected zone ID
            const zone = zones.find(z => z.id === selectedZone);
            const zoneName = zone ? zone.name : selectedZone;
            const response = await processScannedImage(base64Content, zoneName, managerId);
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
        startCamera();
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-20 select-none">
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

            <div className={`max-w-md mx-auto ${isCameraActive ? 'h-[calc(100vh-60px)] flex flex-col' : 'p-4 space-y-6'}`}>

                {/* 1. Manager ID Input */}
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
                            <input
                                type="text"
                                value={managerId}
                                onChange={(e) => setManagerId(e.target.value)}
                                placeholder="Spreadsheet ID 입력..."
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                            />
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

                {/* 2. Zone Selection & Camera */}
                {isIdConfirmed && (
                    <div className={`space-y-4 ${isCameraActive ? 'flex-1 flex flex-col min-h-0' : ''}`}>

                        {!isCameraActive && !imagePreview && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-blue-500" />
                                        설치 구역 선택 ({zones.length}곳)
                                    </label>
                                    <select
                                        value={selectedZone}
                                        onChange={(e) => setSelectedZone(e.target.value)}
                                        className={`w-full p-3 rounded-xl border bg-white dark:bg-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-base appearance-none ${!selectedZone ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`}
                                    >
                                        <option value="">-- 구역을 선택하세요 --</option>
                                        {zones.map((zone) => (
                                            <option key={zone.id} value={zone.id}>{zone.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={() => {
                                        if (!selectedZone) { alert('설치할 구역을 먼저 선택해주세요!'); return; }
                                        startCamera();
                                    }}
                                    className={`w-full py-6 rounded-2xl font-bold shadow-lg transition-all active:scale-95 flex flex-col items-center gap-2 border-2 ${selectedZone
                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent hover:shadow-blue-500/30'
                                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                                >
                                    <Camera className="w-8 h-8" />
                                    <span className="text-lg">카메라 촬영 시작</span>
                                </button>

                                <div className="text-center">
                                    <span className="text-xs text-gray-400">또는</span>
                                </div>

                                <button
                                    onClick={() => {
                                        if (!selectedZone) { alert('설치할 구역을 먼저 선택해주세요!'); return; }
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    갤러리에서 선택
                                </button>
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

                                {cameraError && (
                                    <p className="text-xs text-red-500 text-center bg-red-50 p-2 rounded-lg">{cameraError}</p>
                                )}
                            </div>
                        )}

                        {/* WebRTC Camera View with Overlay */}
                        {isCameraActive && (
                            <div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center backdrop-blur-xl">
                                {/* Video */}
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="absolute inset-0 w-full h-full object-cover"
                                />

                                {/* Dark Overlay with Clear Rect for Top Position */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {/* Top Shade (20%) - Reduced from 38% */}
                                    <div className="absolute top-0 left-0 right-0 h-[20%] bg-black/60 backdrop-blur-sm z-10"></div>

                                    {/* Bottom Shade (60%) - Increased from 38% for higher box position */}
                                    <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-start pt-6 text-white">
                                        <p className="font-medium text-shadow">물품 라벨을 사각형 안에 맞춰주세요</p>
                                        <p className="text-xs text-gray-300 mt-1">자동으로 초점이 맞춰집니다</p>
                                    </div>

                                    {/* Left Shade */}
                                    <div className="absolute top-[20%] bottom-[60%] left-0 w-[5%] bg-black/60 z-10"></div>

                                    {/* Right Shade */}
                                    <div className="absolute top-[20%] bottom-[60%] right-0 w-[5%] bg-black/60 z-10"></div>

                                    {/* Guide Box Border */}
                                    <div className="absolute top-[20%] bottom-[60%] left-[5%] right-[5%] border-2 border-white/80 rounded-xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)] z-0">
                                        {/* Corners */}
                                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-cyan-400 rounded-tl-sm -mt-0.5 -ml-0.5"></div>
                                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-cyan-400 rounded-tr-sm -mt-0.5 -mr-0.5"></div>
                                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-cyan-400 rounded-bl-sm -mb-0.5 -ml-0.5"></div>
                                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-cyan-400 rounded-br-sm -mb-0.5 -mr-0.5"></div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="absolute bottom-8 z-50 flex items-center justify-center gap-8 w-full px-8">
                                    <button
                                        onClick={stopCamera}
                                        className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={captureImage}
                                        className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform shadow-lg"
                                    >
                                        <div className="w-16 h-16 bg-white rounded-full"></div>
                                    </button>
                                    <div className="w-12"></div> {/* Spacer for center alignment */}
                                </div>
                            </div>
                        )}

                        {/* Result Preview (Captured) */}
                        {!isCameraActive && imagePreview && (
                            <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-800 animate-in fade-in">
                                <Image src={imagePreview} alt="Captured" fill className="object-cover" />

                                {isProcessing ? (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
                                        <p className="text-white font-bold animate-pulse">이미지 분석 중...</p>
                                    </div>
                                ) : (
                                    result && (
                                        <div className="absolute bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-2xl p-6 shadow-2xl border-t border-gray-200 dark:border-gray-800 animate-in slide-in-from-bottom-10">
                                            <div className="flex items-start gap-4">
                                                {result.success ? (
                                                    <div className="p-3 bg-green-100 text-green-600 rounded-full"><Check className="w-6 h-6" /></div>
                                                ) : (
                                                    <div className="p-3 bg-red-100 text-red-600 rounded-full"><AlertCircle className="w-6 h-6" /></div>
                                                )}
                                                <div className="flex-1">
                                                    <h3 className={`font-bold text-lg ${result.success ? 'text-green-700' : 'text-red-700'}`}>{result.success ? '등록 완료!' : '등록 실패'}</h3>
                                                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{result.message || result.error}</p>
                                                    {result.device && (
                                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm border">
                                                            <div className="grid grid-cols-[50px_1fr] gap-1">
                                                                <span className="text-gray-500">모델</span> <span className="font-bold">{result.device.model}</span>
                                                                <span className="text-gray-500">위치</span> <span className="font-bold text-blue-600">{result.device.installLocation}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* #21: Show OCR text and manual registration option on failure */}
                                                    {!result.success && result.text && (
                                                        <div className="mt-3 space-y-2">
                                                            <details className="text-xs">
                                                                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">인식된 텍스트 보기</summary>
                                                                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{result.text}</pre>
                                                            </details>
                                                            <Link href="/devices" className="block w-full py-2.5 bg-blue-600 text-white rounded-lg text-center text-sm font-bold hover:bg-blue-700 transition-colors">
                                                                기기 목록에서 직접 등록 →
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={handleRetake} className="w-full mt-6 py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">
                                                확인 / 다음 촬영
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx global>{`
                .text-shadow { text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
            `}</style>
        </div>
    );
}

export default function ScanPage() {
    return (
        <Suspense fallback={<div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>}>
            <ScanPageContent />
        </Suspense>
    );
}
