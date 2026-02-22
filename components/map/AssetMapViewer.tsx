'use client';

import { useRef, useState, useEffect } from 'react';
import { Location } from '@/types';
import { AssetZone } from './AssetMapComponents';

interface AssetMapViewerProps {
    imageSrc: string;
    zoom: number;
    pins: Location[];
    selectedPin: Location | null;
    isEditing: boolean;
    selectedZoneIds: Set<string>;
    onPinClick: (pin: Location, e: React.MouseEvent) => void;
    onBgClick: () => void;
    onPinMove: (id: string, x: number, y: number) => void;
    onPinResize: (id: string, w: number, h: number) => void;
    onZoneCreate: (rect: { x: number, y: number, w: number, h: number }) => void;
    onZoneDoubleClick?: (pin: Location) => void;
    onImageLoad?: () => void;
}

export function AssetMapViewer({
    imageSrc,
    zoom,
    pins,
    selectedPin,
    isEditing,
    selectedZoneIds,
    onPinClick,
    onBgClick,
    onPinMove,
    onPinResize,
    onZoneCreate,
    onZoneDoubleClick,
    onImageLoad,
}: AssetMapViewerProps) {
    const mapWrapperRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const [currentDrag, setCurrentDrag] = useState<{ startX: number, startY: number, curX: number, curY: number } | null>(null);

    // Handle zone creation drag
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isEditing || !mapRef.current) return;
        // If clicking on a zone, let the zone handler take over (propagation stopped there)

        const rect = mapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onBgClick(); // Clear selection
        setCurrentDrag({ startX: x, startY: y, curX: x, curY: y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!currentDrag || !mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setCurrentDrag({ ...currentDrag, curX: x, curY: y });
    };

    const handleMouseUp = () => {
        if (currentDrag) {
            const minX = Math.min(currentDrag.startX, currentDrag.curX);
            const minY = Math.min(currentDrag.startY, currentDrag.curY);
            const w = Math.abs(currentDrag.curX - currentDrag.startX);
            const h = Math.abs(currentDrag.curY - currentDrag.startY);

            if (w > 2 && h > 2) { // Min Size Threshold
                onZoneCreate({ x: minX, y: minY, w, h });
            }
            setCurrentDrag(null);
        }
    };

    return (
        <div
            ref={mapWrapperRef}
            className="w-full h-[600px] overflow-auto bg-gray-100 dark:bg-gray-900 relative custom-scrollbar cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => {
                // Allow panning if middle click or spacebar held (omitted for simplicity here)
                // Actually, standard overflow-auto handles local scroll.
            }}
        >
            <div
                className="relative origin-top-left transition-transform duration-200 ease-out"
                style={{
                    width: `${zoom}%`,
                    minWidth: '800px', // Ensure map is legible on mobile
                    height: 'auto', // Image aspect ratio drives height
                    minHeight: '100%'
                }}
            >
                <img
                    src={imageSrc}
                    alt="Map"
                    className="w-full h-auto block select-none"
                    draggable={false}
                    onLoad={onImageLoad}
                    onError={(e) => {
                        console.error("AssetMapViewer: Failed to load map image. URL may be malformed or too long.", e);
                        onImageLoad?.(); // Clear loading state even on failure
                    }}
                />

                {/* Overlay for Zones */}
                <div
                    ref={mapRef}
                    className={`absolute inset-0 w-full h-full ${isEditing ? 'cursor-crosshair' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {pins.map(pin => (
                        <AssetZone
                            key={pin.id}
                            location={pin}
                            device={undefined} // Mock data handling moved to parent or simplified
                            onClick={(e) => onPinClick(pin, e)}
                            onDoubleClick={() => onZoneDoubleClick?.(pin)}
                            isSelected={selectedPin?.id === pin.id || selectedZoneIds.has(pin.id)}
                            isSelectMode={isEditing} // Reuse style logic
                        />
                    ))}

                    {currentDrag && (
                        <div
                            className="absolute border-2 border-primary bg-primary/20 z-50 pointer-events-none"
                            style={{
                                left: `${Math.min(currentDrag.startX, currentDrag.curX)}%`,
                                top: `${Math.min(currentDrag.startY, currentDrag.curY)}%`,
                                width: `${Math.abs(currentDrag.curX - currentDrag.startX)}%`,
                                height: `${Math.abs(currentDrag.curY - currentDrag.startY)}%`
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
