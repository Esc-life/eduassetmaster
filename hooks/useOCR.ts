import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { Location } from '@/types';

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

    // 2. Text Recognition (OCR) - Updates names of EXISTING zones
    const recognizeZoneNames = useCallback(async (imageFile: File, zones: Location[]): Promise<Location[]> => {
        setIsScanning(true);
        setProgress(0);
        setStatusText('Preparing OCR Engine...');

        try {
            // Load Image
            const imgUrl = URL.createObjectURL(imageFile);
            const imgElement = new Image();
            await new Promise<void>((resolve) => {
                imgElement.onload = () => resolve();
                imgElement.src = imgUrl;
            });

            const naturalW = imgElement.naturalWidth;
            const naturalH = imgElement.naturalHeight;
            const scaleFactor = 2.0; // Higher res for OCR

            // Prepare High-Res Gray Image for cropping
            await waitForOpenCV();
            const cv = window.cv;
            const src = cv.imread(imgElement);
            const srcResized = new cv.Mat();
            // Upscale
            const dsize = new cv.Size(naturalW * scaleFactor, naturalH * scaleFactor);
            cv.resize(src, srcResized, dsize, 0, 0, cv.INTER_CUBIC);
            // Grayscale
            const grayMat = new cv.Mat();
            cv.cvtColor(srcResized, grayMat, cv.COLOR_RGBA2GRAY, 0);

            const updatedZones = [...zones];
            let processedCount = 0;
            const cropCanvas = document.createElement('canvas');

            setStatusText(`Reading text from ${zones.length} zones...`);

            for (let i = 0; i < updatedZones.length; i++) {
                const zone = updatedZones[i];

                // Calculate ROI in the upscaled image coordinates
                const x = (zone.pinX / 100) * naturalW * scaleFactor;
                const y = (zone.pinY / 100) * naturalH * scaleFactor;
                const w = (zone.width! / 100) * naturalW * scaleFactor;
                const h = (zone.height! / 100) * naturalH * scaleFactor;

                // Safety check for bounds
                if (x < 0 || y < 0 || x + w > srcResized.cols || y + h > srcResized.rows) continue;

                const rect = new cv.Rect(x, y, w, h);
                const roi = grayMat.roi(rect);

                cropCanvas.width = w;
                cropCanvas.height = h;
                cv.imshow(cropCanvas, roi);

                // Run Tesseract on ROI
                const { data: { text } } = await Tesseract.recognize(cropCanvas, 'kor+eng', {
                    logger: () => { }
                });

                const cleanText = text.replace(/[^가-힣a-zA-Z0-9\- ]/g, '').trim();
                if (cleanText.length > 1) {
                    updatedZones[i] = { ...zone, name: cleanText };
                }

                roi.delete();
                processedCount++;
                setProgress(Math.round((processedCount / updatedZones.length) * 100));
            }

            src.delete(); srcResized.delete(); grayMat.delete();
            return updatedZones;

        } catch (error) {
            console.error('OCR Error:', error);
            setStatusText('Error: ' + (error as Error).message);
            return zones;
        } finally {
            setIsScanning(false);
            setProgress(100);
        }
    }, []);

    // For backward compatibility, default export can be detectStructure or we can rename
    return {
        detectStructure,
        recognizeZoneNames,
        scanImage: detectStructure, // Alias for legacy calls if any
        isScanning,
        progress,
        statusText
    };
};
