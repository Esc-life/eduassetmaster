'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AssetMapViewer } from '@/components/map/AssetMapViewer';
import { ImageUploader, ImageUploaderHandle } from '@/components/map/ImageUploader';
import { Device, Location } from '@/types';
import { fetchMapConfiguration, saveMapConfiguration, fetchAssetData, updateDevice } from '@/app/actions';
import { useOCR } from '@/hooks/useOCR';
import { MapPin, GripVertical, Monitor, Laptop, Tablet, Smartphone, Search, ArrowRightLeft, Upload } from 'lucide-react';

const INITIAL_PINS: Location[] = [];

export default function Dashboard() {
  // -------------------------------------------------------------------------
  // 1. Data & State
  // -------------------------------------------------------------------------
  const [mapImage, setMapImage] = useState<string>();
  const [mapFile, setMapFile] = useState<File>();
  const [pins, setPins] = useState<Location[]>(INITIAL_PINS);
  const [devices, setDevices] = useState<Device[]>([]);

  // Panel State
  const [activePanel, setActivePanel] = useState<1 | 2>(1);
  const [panel1ZoneId, setPanel1ZoneId] = useState<string | null>(null);
  const [panel2ZoneId, setPanel2ZoneId] = useState<string | null>(null);

  // Editing / Map State
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set());

  const { detectStructure, recognizeZoneNames, isScanning } = useOCR();
  const uploaderRef = useRef<ImageUploaderHandle>(null);

  // -------------------------------------------------------------------------
  // 2. Initial Data Loading
  // -------------------------------------------------------------------------
  useEffect(() => {
    const loadAll = async () => {
      // Load Map
      const { mapImage: serverImage, zones: serverZones } = await fetchMapConfiguration();
      const localImage = localStorage.getItem('school_map_image');
      const localZones = localStorage.getItem('school_map_zones');

      if (serverImage) setMapImage(serverImage);
      else if (localImage) setMapImage(localImage);

      if (serverZones.length > 0) setPins(serverZones);
      else if (localZones) setPins(JSON.parse(localZones));

      // Load Devices
      try {
        const assetData = await fetchAssetData();
        setDevices(assetData.devices);
      } catch (err) {
        console.error("Failed to load devices", err);
      }
    };
    loadAll();
  }, []);

  // -------------------------------------------------------------------------
  // 3. Handlers
  // -------------------------------------------------------------------------
  const handleImageUpload = (file: File, url: string) => {
    setMapFile(file);
    setMapImage(url);
    localStorage.setItem('school_map_image', url);
    saveMapConfiguration(url, pins);
  };

  const savePins = (newPins: Location[]) => {
    setPins(newPins);
    localStorage.setItem('school_map_zones', JSON.stringify(newPins));
    saveMapConfiguration(mapImage || null, newPins);
  };

  // Main Interaction: Clicking a zone
  const handleZoneClick = (pin: Location, e: React.MouseEvent) => {
    // If in editing mode, toggle selection
    if (isEditing) {
      e.stopPropagation();
      setSelectedZoneIds(prev => {
        const next = new Set(prev);
        if (next.has(pin.id)) next.delete(pin.id);
        else next.add(pin.id);
        return next;
      });
      return;
    }

    // Dashboard Mode: Update Active Panel
    if (activePanel === 1) {
      setPanel1ZoneId(pin.id);
    } else {
      setPanel2ZoneId(pin.id);
    }
  };

  // Drag and Drop (Device Move)
  const handleDropDevice = async (deviceId: string, targetZoneId: string) => {
    const targetZone = pins.find(p => p.id === targetZoneId);
    if (!targetZone) return;

    // Optimistic Update
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, groupId: targetZoneId, installationLocation: targetZone.name } : d
    ));

    // Server Update
    await updateDevice(deviceId, { groupId: targetZoneId, installationLocation: targetZone.name });
  };

  // Map Editing Handlers
  const handleZoneCreate = (rect: { x: number, y: number, w: number, h: number }) => {
    const newPin: Location = {
      id: crypto.randomUUID(),
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      name: '새 구역',
      type: 'Classroom'
    };
    savePins([...pins, newPin]);
  };

  const handlePinMove = (id: string, x: number, y: number) => {
    savePins(pins.map(p => p.id === id ? { ...p, x, y } : p));
  };

  const handlePinResize = (id: string, w: number, h: number) => {
    savePins(pins.map(p => p.id === id ? { ...p, w, h } : p));
  };

  // Filter devices for panels
  const panel1Devices = useMemo(() =>
    devices.filter(d => d.groupId === panel1ZoneId),
    [devices, panel1ZoneId]);

  const panel2Devices = useMemo(() =>
    devices.filter(d => d.groupId === panel2ZoneId),
    [devices, panel2ZoneId]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Left: Map Area using AssetMapViewer directly if image exists */}
      <div className="flex-1 relative flex flex-col border-r border-gray-200 dark:border-gray-800">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors ${isEditing ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
          >
            {isEditing ? '편집 종료' : '구역 편집'}
          </button>
          <button
            onClick={() => uploaderRef.current?.open()}
            className="px-3 py-1.5 bg-white text-gray-700 rounded-md text-sm font-medium shadow-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            배치도 변경
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-900/50">
          {mapImage ? (
            <AssetMapViewer
              imageSrc={mapImage}
              zoom={zoom}
              pins={pins}
              highlightedZoneIds={[panel1ZoneId, panel2ZoneId].filter(Boolean) as string[]}
              isEditing={isEditing}
              selectedZoneIds={selectedZoneIds}
              onPinClick={handleZoneClick}
              onBgClick={() => {
                if (isEditing) setSelectedZoneIds(new Set());
              }}
              onPinMove={handlePinMove}
              onPinResize={handlePinResize}
              onZoneCreate={handleZoneCreate}
            />
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <ImageUploader
                ref={uploaderRef}
                onImageUpload={handleImageUpload}
              />
            </div>
          )}
        </div>

        {/* Hidden Uploader for "Change Map" button */}
        <div className="hidden">
          <ImageUploader ref={uploaderRef} onImageUpload={handleImageUpload} />
        </div>
      </div>

      {/* Right: Dashboard Panels */}
      <div className="w-[400px] flex flex-col bg-white dark:bg-gray-900 shadow-xl z-20">
        <DevicePanel
          title="1번 영역"
          active={activePanel === 1}
          zoneName={pins.find(p => p.id === panel1ZoneId)?.name}
          zoneId={panel1ZoneId}
          devices={panel1Devices}
          onActivate={() => setActivePanel(1)}
          onDropDevice={handleDropDevice}
          color="blue"
        />
        <div className="h-px bg-gray-200 dark:bg-gray-800" />
        <DevicePanel
          title="2번 영역"
          active={activePanel === 2}
          zoneName={pins.find(p => p.id === panel2ZoneId)?.name}
          zoneId={panel2ZoneId}
          devices={panel2Devices}
          onActivate={() => setActivePanel(2)}
          onDropDevice={handleDropDevice}
          color="orange"
        />
      </div>
    </div>
  );
}

function DevicePanel({
  title, active, zoneName, zoneId, devices, onActivate, onDropDevice, color
}: {
  title: string;
  active: boolean;
  zoneName?: string;
  zoneId: string | null;
  devices: Device[];
  onActivate: () => void;
  onDropDevice: (deviceId: string, targetZoneId: string) => void;
  color: 'blue' | 'orange';
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const deviceId = e.dataTransfer.getData('deviceId');
    if (deviceId && zoneId) {
      onDropDevice(deviceId, zoneId);
    }
  };

  const activeBgClass = active
    ? (color === 'blue' ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-orange-50/30 dark:bg-orange-900/10')
    : 'hover:bg-gray-50 dark:hover:bg-gray-800';

  const ringClass = isDraggingOver
    ? (color === 'blue' ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : 'ring-2 ring-inset ring-orange-500 bg-orange-50')
    : '';

  const activeIndicatorClass = color === 'blue' ? 'bg-blue-500' : 'bg-orange-500';
  const activeTitleClass = active
    ? (color === 'blue' ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400')
    : 'text-gray-500';

  const countBadgeClass = color === 'blue'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';

  return (
    <div
      className={`flex-1 flex flex-col transition-colors cursor-pointer relative ${activeBgClass} ${ringClass}`}
      onClick={onActivate}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Active Indicator */}
      {active && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeIndicatorClass}`} />
      )}

      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h3 className={`font-semibold text-lg ${activeTitleClass}`}>
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-gray-200">
              {zoneName || '구역을 선택하세요'}
            </span>
          </div>
        </div>
        {zoneName && (
          <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${countBadgeClass}`}>
            {devices.length} 기기
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
        {!zoneId ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">맵에서 구역을 클릭하여<br />기기 목록을 확인하세요</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
            <p className="text-sm">설치된 기기가 없습니다</p>
            <p className="text-xs mt-1">다른 영역에서 기기를 드래그하여<br />여기로 이동시킬 수 있습니다</p>
          </div>
        ) : (
          devices.map(device => (
            <div
              key={device.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('deviceId', device.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="font-medium text-gray-900 dark:text-gray-200 truncate pr-2">
                  {device.model}
                </div>
                <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100" />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <span>{device.category}</span>
                <span className="text-gray-300">|</span>
                <span>{device.name}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
