import { useState, useCallback } from 'react';
import { Location } from '@/types';
import { recognizeZoneNamesWithAI } from '@/app/actions';

declare global {
    interface Window {
        cv: any;
    }
}

interface UseOCRResult {
    scanImage: (imageFile: File) => Promise<Location[]>; // Legacy alias
    detectStructure: (imageFile: File) => Promise<Location[]>;
    recognizeZoneNames: (imageFile: File, zones: Location[]) => Promise<Location[]>;
    isScanning: boolean;
    progress: number;
    statusText: string;
}

export const useOCR = (): UseOCRResult => {
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');

    const waitForOpenCV = async () => {
        let attempts = 0;
        while (!window.cv && attempts < 20) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }
        if (!window.cv) throw new Error("OpenCV not loaded");
    };

    // 1. Structure Detection (OpenCV Only) - Fast, creates new zones
    const detectStructure = useCallback(async (imageFile: File): Promise<Location[]> => {
        setIsScanning(true);
        setProgress(0);
        setStatusText('Initializing Geometry Engine...');

        try {
            await waitForOpenCV();
            const cv = window.cv;

            // Load Image
            const imgUrl = URL.createObjectURL(imageFile);
            const imgElement = new Image();
            await new Promise<void>((resolve) => {
                imgElement.onload = () => resolve();
                imgElement.src = imgUrl;
            });

            const naturalW = imgElement.naturalWidth;
            const naturalH = imgElement.naturalHeight;

            // Pre-processing
            setStatusText('Analyzing Floor Plan Structures...');
            const src = cv.imread(imgElement);
            const dst = new cv.Mat();
            const scaleFactor = 2.0; // Upscale for better contour detection
            const dsize = new cv.Size(naturalW * scaleFactor, naturalH * scaleFactor);
            cv.resize(src, dst, dsize, 0, 0, cv.INTER_CUBIC);
            cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
            cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

            // Morphological ops
            const roomMat = dst.clone();
            const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
            cv.bitwise_not(roomMat, roomMat);
            cv.morphologyEx(roomMat, roomMat, cv.MORPH_CLOSE, kernel);
            const dilateKernel = cv.Mat.ones(3, 3, cv.CV_8U);
            cv.dilate(roomMat, roomMat, dilateKernel);

            // Find Contours
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(roomMat, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

            const newZones: Location[] = [];
            const minArea = (naturalW * scaleFactor * naturalH * scaleFactor) * 0.0005; // 0.05% (Smaller rooms)
            const maxArea = (naturalW * scaleFactor * naturalH * scaleFactor) * 0.05;   // 5% (Ignore huge outer walls)

            for (let i = 0; i < contours.size(); ++i) {
                const cnt = contours.get(i);
                const rect = cv.boundingRect(cnt);
                const area = rect.width * rect.height;

                if (area > minArea && area < maxArea) {
                    const aspect = rect.width / rect.height;
                    if (aspect > 0.3 && aspect < 3.5) {
                        newZones.push({
                            id: `zone-${Date.now()}-${i}`,
                            name: `구역 ${newZones.length + 1}`, // Default name
                            pinX: (rect.x / scaleFactor / naturalW) * 100,
                            pinY: (rect.y / scaleFactor / naturalH) * 100,
                            width: (rect.width / scaleFactor / naturalW) * 100,
                            height: (rect.height / scaleFactor / naturalH) * 100,
                            type: 'Classroom'
                        });
                    }
                }
                cnt.delete();
            }

            console.log(`OpenCV: Detected ${newZones.length} structures.`);

            // Cleanup
            src.delete(); dst.delete(); roomMat.delete(); contours.delete(); hierarchy.delete(); kernel.delete(); dilateKernel.delete();

            return newZones;

        } catch (error) {
            console.error('Detection Error:', error);
            setStatusText('Error: ' + (error as Error).message);
            return [];
        } finally {
            setIsScanning(false);
            setProgress(100);
        }
    }, []);

    // 2. AI Zone Name Recognition (Gemini Vision - Server Side)
    const recognizeZoneNames = useCallback(async (imageFile: File, zones: Location[]): Promise<Location[]> => {
        setIsScanning(true);
        setProgress(0);
        setStatusText('Gemini Vision으로 구역 이름 분석 중...');

        try {
            // Convert File to base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data URL prefix (data:image/png;base64,...)
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });

            setProgress(30);
            setStatusText('서버에 이미지 전송 중...');

            // Call server action
            const result = await recognizeZoneNamesWithAI(base64, zones.map(z => ({
                id: z.id,
                pinX: z.pinX,
                pinY: z.pinY,
                width: z.width,
                height: z.height,
                name: z.name
            })));

            setProgress(90);

            if (result.success && result.zones) {
                setStatusText(`${result.zones.filter((z: any, i: number) => z.name !== zones[i]?.name).length}개 구역 이름 인식 완료`);
                return result.zones as Location[];
            } else {
                console.warn('Gemini zone recognition failed:', result.error);
                setStatusText('인식 실패: ' + (result.error || ''));
                return zones; // Return original zones unchanged
            }

        } catch (error) {
            console.error('AI Zone Name Error:', error);
            setStatusText('Error: ' + (error as Error).message);
            return zones;
        } finally {
            setIsScanning(false);
            setProgress(100);
        }
    }, []);

    return {
        detectStructure,
        recognizeZoneNames,
        scanImage: detectStructure, // Alias for legacy calls if any
        isScanning,
        progress,
        statusText
    };
};
