'use client';

import { useState, useRef, useImperativeHandle, forwardRef, PropsWithChildren, useEffect } from 'react';
import { Upload } from 'lucide-react';

interface ImageUploaderProps {
    currentImage?: string;
    onImageUpload: (file: File, previewUrl: string) => void;
}

export interface ImageUploaderHandle {
    open: () => void;
}

export const ImageUploader = forwardRef<ImageUploaderHandle, PropsWithChildren<ImageUploaderProps>>(
    ({ currentImage, onImageUpload, children }, ref) => {
        const [preview, setPreview] = useState<string | null>(currentImage || null);
        const [isDragging, setIsDragging] = useState(false);
        const fileInputRef = useRef<HTMLInputElement>(null);

        // Sync local preview with prop update (Server Fetch)
        // This was the missing piece causing image to disappear on reload!
        useEffect(() => {
            if (currentImage) {
                setPreview(currentImage);
            }
        }, [currentImage]);

        useImperativeHandle(ref, () => ({
            open: () => {
                fileInputRef.current?.click();
            }
        }));

        const handleFile = (file: File) => {
            if (!file.type.startsWith('image/')) return;

            const url = URL.createObjectURL(file);
            setPreview(url);
            onImageUpload(file, url);
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) {
                handleFile(e.dataTransfer.files[0]);
            }
        };

        return (
            <div className="w-full h-full flex items-center justify-center">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />

                {!preview ? (
                    <div
                        className={`relative w-full aspect-[21/9] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging
                            ? 'border-primary bg-blue-50 dark:bg-blue-900/10'
                            : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="p-4 rounded-full bg-white dark:bg-gray-700 shadow-sm mb-3">
                            <Upload className="w-6 h-6 text-primary dark:text-blue-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            배치도 이미지 업로드
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Drag & drop or click to select (JPG, PNG)
                        </p>
                    </div>
                ) : (
                    <div className="relative h-full w-auto max-w-full rounded-xl overflow-hidden shadow-md bg-gray-100 dark:bg-gray-800 inline-block">
                        <img
                            src={preview}
                            alt="School Map Map"
                            className="h-full w-auto object-contain block mx-auto"
                        />
                        <div className="absolute inset-0 w-full h-full">
                            {children}
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

ImageUploader.displayName = 'ImageUploader';
