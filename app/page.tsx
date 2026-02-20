'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AssetMapViewer } from '@/components/map/AssetMapViewer';
import { AssetDetailModal } from '@/components/map/AssetMapComponents';
import { ImageUploader, ImageUploaderHandle } from '@/components/map/ImageUploader';
import { Device, Location, DeviceInstance } from '@/types';
import { MOCK_DEVICES, MOCK_SOFTWARE } from '@/lib/mock-data';
import { useOCR } from '@/hooks/useOCR';
import { DeleteConfirmModal } from '@/components/devices/DeleteConfirmModal';
import Link from 'next/link';
import { Image as ImageIcon, PlusCircle, Check, Trash2, MousePointer2, ScanSearch, Loader2, Save, Minus, RotateCcw, FileSpreadsheet, ScanLine, Edit3, Settings, MoreHorizontal, CheckSquare, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMapConfiguration, saveMapConfiguration, syncZonesToSheet, fetchAssetData, updateDevice, createDeviceInstance, deleteDeviceInstance, updateZoneName } from '@/app/actions';
import { DeviceEditModal } from '@/components/devices/DeviceEditModal';
import { ZoneEditModal } from '@/components/map/ZoneEditModal';
import { ZoneBatchEditModal } from '@/components/map/ZoneBatchEditModal';

// Mock pin locations linked to mock devices (Initial State) by default empty
const INITIAL_PINS: Location[] = [];

export default function Home() {
  const [mapImage, setMapImage] = useState<string>();
  const [mapFile, setMapFile] = useState<File>();
  const [pins, setPins] = useState<Location[]>(INITIAL_PINS);
  const [selectedPin, setSelectedPin] = useState<Location | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]); // Real devices
  const [deviceInstances, setDeviceInstances] = useState<DeviceInstance[]>([]); // Device instances
  const [editDevice, setEditDevice] = useState<Device | null>(null); // For editing
  const [isLoadingMap, setIsLoadingMap] = useState(true); // Server Data Fetching
  const [isMapLoading, setIsMapLoading] = useState(false); // Image Rendering
  const [isLoadingMessage, setIsLoadingMessage] = useState<string | null>(null);
  const [showDeleteMapModal, setShowDeleteMapModal] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const uploaderRef = useRef<ImageUploaderHandle>(null);

  // AI OCR State
  const { detectStructure, recognizeZoneNames, isScanning, progress, statusText } = useOCR();
  const [ocrResults, setOcrResults] = useState<Location[]>([]);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  // Multi-Selection State (Merged into Editing Mode)
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set());
  const [editingZone, setEditingZone] = useState<Location | null>(null); // For zone editing
  const [lastSelectedPin, setLastSelectedPin] = useState<Location | null>(null);

  const [showZoneMenu, setShowZoneMenu] = useState(false);

  // 1. Statistics Calculation
  const stats = useMemo(() => {
    const total = pins.length;
    // Count zones with actual device instances
    const zonesWithDevices = pins.filter(pin => {
      return deviceInstances.some(inst => inst.locationId === pin.id);
    }).length;

    return {
      totalZones: total,
      withDevices: zonesWithDevices,
      empty: total - zonesWithDevices
    };
  }, [pins, deviceInstances]);

  // 2. Load Map Image, Zones, and Devices (Server Only)
  useEffect(() => {
    // Clear legacy local storage to ensure clean state
    if (typeof window !== 'undefined') {
      localStorage.removeItem('school_map_image');
      localStorage.removeItem('school_map_zones');
    }

    const loadMapData = async () => {
      setIsLoadingMap(true);
      try {
        const { mapImage: serverImage, zones: serverZones } = await fetchMapConfiguration();
        const { devices: serverDevices, deviceInstances: serverInstances } = await fetchAssetData();

        // localStorage logic removed to prevent data leak between accounts
        const imageToLoad = serverImage;

        // If there's an image, wait for it to load before hiding spinner
        if (imageToLoad) {
          setMapImage(imageToLoad);
          setIsMapLoading(true); // Trigger visual loading (waits for AssetMapViewer onLoad)
        } else {
          setMapImage(undefined);
          setIsMapLoading(false);
        }

        setIsLoadingMap(false); // Data fetch done, allow rendering

        if (serverZones) setPins(serverZones);
        else setPins([]);

        if (serverDevices) setDevices(serverDevices);
        else setDevices([]);

        if (serverInstances) setDeviceInstances(serverInstances);
        else setDeviceInstances([]);

      } catch (error) {
        console.error('Error loading map data:', error);
        setIsLoadingMap(false);
      }
    };
    loadMapData();
  }, []);

  const handleImageUpload = (file: File, url: string) => {
    setMapFile(file); // Save file instance for OCR
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // localStorage removed
      setMapImage(base64String);
      // Ensure we have the map image
      const currentImage = base64String;
      console.log(`[Client] Saving Image...`);
      saveMapConfiguration(currentImage, pins)
        .then(res => console.log('[Client] Server Save Result:', res));
    };
    reader.readAsDataURL(file);
  };

  const savePins = (newPins: Location[]) => {
    setPins(newPins);
    // localStorage removed

    // Ensure we have the map image
    const currentImage = mapImage;
    console.log(`[Client] Saving Pins: ${newPins.length} zones.`);

    // Sync to Server
    saveMapConfiguration(currentImage || null, newPins)
      .then(res => {
        console.log('[Client] Server Save Result:', res);
        if (!res.success) {
          alert(`[저장 실패] 서버에 데이터가 저장되지 않았습니다.\n원인: ${res.error}\n\n잠시 후 다시 시도하거나 네트워크를 확인해주세요.`);
        }
      })
      .catch(e => alert(`[통신 오류] 서버와 연결할 수 없습니다: ${e}`));
  };

  const toggleZoneSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedZoneIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (pins.length === 0) return;
    if (selectedZoneIds.size === pins.length) {
      setSelectedZoneIds(new Set()); // Deselect All
    } else {
      const allIds = new Set(pins.map(p => p.id));
      setSelectedZoneIds(allIds);
    }
  };

  const handleZoneClick = (pin: Location, e: React.MouseEvent) => {
    // In Editing Mode, clicking toggles selection (for deletion)
    if (isEditing) {
      toggleZoneSelection(pin.id, e);
    } else {
      // In View Mode, show details
      setSelectedPin(pin);
    }
  };

  const handleZoneDoubleClick = (pin: Location) => {
    if (isEditing) {
      setEditingZone(pin);
    }
  };

  const handleZoneSave = (zoneId: string, updates: Partial<Location>) => {
    // 1. Update State Optimistically
    const newPins = pins.map(p =>
      p.id === zoneId ? { ...p, ...updates } : p
    );
    savePins(newPins);
    setEditingZone(null);

    // 2. Background Sync (Google Sheet) - Non-blocking
    if (updates.name) {
      const targetPin = pins.find(p => p.id === zoneId);
      if (targetPin && targetPin.name !== updates.name) {
        // Fire and forget (or catch error)
        updateZoneName(zoneId, targetPin.name, updates.name)
          .catch(err => console.error('Failed to update sheet name:', err));
      }
    }
  };

  const deleteSelectedZones = () => {
    if (selectedZoneIds.size === 0) return;
    if (confirm(`선택한 ${selectedZoneIds.size}개의 구역을 삭제하시겠습니까?`)) {
      const newPins = pins.filter(p => !selectedZoneIds.has(p.id));
      savePins(newPins);
      setSelectedZoneIds(new Set());
    }
  };

  // AI Structure Detection Handler
  const handleAIScan = async () => {
    if (!mapFile) {
      alert('분석할 이미지가 없습니다. 이미지를 먼저 업로드해주세요.');
      return;
    }

    const results = await detectStructure(mapFile);
    if (results.length > 0) {
      setOcrResults(results);
      setShowOCRModal(true);
    } else {
      alert("구역 구조를 찾지 못했습니다. 이미지가 너무 흐릿하거나 복잡할 수 있습니다.");
    }
  };

  // Helper to convert Base64 to File
  const base64ToFile = async (base64: string, filename: string): Promise<File> => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  // AI Name Recognition Handler
  const handleAutoNameZones = async (shouldClose = true) => {
    let targetFile = mapFile;

    // Make sure we have a file, even if retrieved from server/localstorage as base64
    if (!targetFile && mapImage) {
      try {
        targetFile = await base64ToFile(mapImage, 'restored_map.png');
      } catch (e) {
        console.error("Failed to convert base64 to file", e);
        alert("이미지 복원 중 오류가 발생했습니다. 이미지를 다시 업로드해주세요.");
        return;
      }
    }

    if (!targetFile) {
      alert("분석할 이미지가 없습니다.");
      return;
    }

    if (pins.length === 0) {
      alert("이름을 찾을 구역이 없습니다. 먼저 구역을 생성해주세요.");
      return;
    }

    const confirmRun = confirm(`현재 ${pins.length}개 구역의 이름을 AI로 다시 읽어오시겠습니까?\n기존 이름은 덮어쓰여집니다.`);
    if (!confirmRun) return;

    try {
      const updatedPins = await recognizeZoneNames(targetFile, pins);
      // Use handleBatchSave to sync names to all DB locations
      await handleBatchSave(updatedPins);
      alert("이름 추출이 완료되었습니다. 결과가 마음에 들지 않으면 목록에서 수정해주세요.");
    } catch (error) {
      alert("이름 추출 실패: " + (error as Error).message);
    }
  };

  // Batch Save Handler (Sync to DB)
  const handleBatchSave = async (newZones: Location[]) => {
    setIsLoadingMessage('구역 이름을 수정하는 중입니다...');
    const oldPins = pins;
    savePins(newZones);

    try {
      // 1. Find zones whose names changed and call updateZoneName for each
      const nameChanges: { zoneId: string, oldName: string, newName: string }[] = [];
      newZones.forEach(nz => {
        const oldZone = oldPins.find(op => op.id === nz.id);
        if (oldZone && oldZone.name !== nz.name && nz.name.trim()) {
          nameChanges.push({ zoneId: nz.id, oldName: oldZone.name, newName: nz.name });
        }
      });

      // 2. Apply each name change (updates DeviceInstances, Devices, Locations, MapZones JSON)
      for (const change of nameChanges) {
        await updateZoneName(change.zoneId, change.oldName, change.newName);
      }

      // 3. Also sync the full zone list to Locations sheet/collection
      const res = await syncZonesToSheet(newZones);
      if (!res.success) {
        console.warn('Locations sync warning:', res.error);
      }
    } catch (e) {
      alert(`DB 동기화 오류: ${e}`);
    } finally {
      setIsLoadingMessage(null);
    }
    setShowNameModal(false);
  };

  const handleSyncZones = async () => {
    const confirmSync = confirm("현재 구역 목록을 구글 시트(Locations 탭)로 내보내시겠습니까?\n내보낸 후 시트에서 이름을 수정하고 새로고침하면 반영됩니다.");
    if (confirmSync) {
      const res = await syncZonesToSheet(pins);
      if (res.success) alert("성공적으로 내보냈습니다. 구글 시트의 'Locations' 탭을 확인하세요.");
      else alert("내보내기 실패. 구글 시트 접근 권한이나 'Locations' 탭 생성 여부를 확인하세요.");
    }
  };

  const handleDeleteMap = async () => {
    try {
      await saveMapConfiguration(null, []);
      setMapImage(undefined);
      setPins([]);
      setIsEditing(false);
      setIsMapLoading(false);
      alert("배치도가 삭제되었습니다.");
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류 발생: " + e);
      throw e;
    }
  };

  const confirmStructureUpdate = () => {
    // Advanced Merge with De-duplication (Center Point Distance Check)
    // We want to avoid deleting unique rooms just because they overlap with a larger zone.
    const mergedPins = [...pins];
    let addedCount = 0;

    ocrResults.forEach(newPin => {
      // Calculate center of new pin
      const newCX = newPin.pinX + (newPin.width || 0) / 2;
      const newCY = newPin.pinY + (newPin.height || 0) / 2;

      const isDuplicate = mergedPins.some(existing => {
        const exCX = existing.pinX + (existing.width || 0) / 2;
        const exCY = existing.pinY + (existing.height || 0) / 2;

        // Calculate Euclidean distance between centers
        const dist = Math.sqrt(Math.pow(newCX - exCX, 2) + Math.pow(newCY - exCY, 2));

        // If centers are very close (less than 1% of map dimension), consider it duplicate
        return dist < 1.0;
      });

      if (!isDuplicate) {
        mergedPins.push(newPin);
        addedCount++;
      }
    });

    savePins(mergedPins);
    setShowOCRModal(false);
    setOcrResults([]);
    setIsEditing(true);

    if (addedCount > 0) {
      alert(`${addedCount}개의 구역이 추가되었습니다.`);
    } else {
      alert("모든 구역이 이미 존재하여 추가되지 않았습니다.");
    }
  };

  // Zoom Handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));
  const handleZoomReset = () => setZoom(100);

  return (
    <div className="space-y-6 flex flex-col items-center pb-20">
      <div className="w-full flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          학교 배치도 (Main Campus)
        </h1>
        <div className="flex flex-wrap items-center w-full gap-2">
          {isScanning ? (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusText}
            </div>
          ) : mapImage ? (
            <div className="flex flex-wrap items-center justify-end w-full gap-2">
              {/* 1. AI Structure Detection */}
              <button
                onClick={handleAIScan}
                className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-violet-700 transition-colors whitespace-nowrap"
              >
                <ScanSearch className="w-4 h-4" />
                1. AI 구역 인식
              </button>

              {/* 2. Edit Mode Toggle */}
              <button
                onClick={() => {
                  setIsEditing(!isEditing);
                  setSelectedZoneIds(new Set());
                }}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isEditing
                  ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300 shadow-inner'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:border-amber-200'
                  }`}
              >
                {isEditing ? (
                  <>
                    <Check className="w-4 h-4" />
                    2. 편집 완료
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    2. 구역 편집
                  </>
                )}
              </button>

              {/* 3. Name Management */}
              <button
                onClick={() => setShowNameModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                3. 이름 관리
              </button>

              {/* Selection Actions (Only in Edit Mode) */}
              {isEditing && selectedZoneIds.size > 0 && (
                <button
                  onClick={deleteSelectedZones}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors animate-in fade-in whitespace-nowrap border border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  선택 삭제 ({selectedZoneIds.size})
                </button>
              )}

              {isEditing && (
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap border border-blue-200"
                >
                  <CheckSquare className="w-4 h-4" />
                  전체 선택
                </button>
              )}

              {/* 4. Delete Map */}
              <button
                onClick={() => setShowDeleteMapModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 text-red-500 border border-red-200 dark:border-red-800 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                4. 배치도 삭제
              </button>
            </div>
          ) : (
            <div className="ml-auto">
              <button
                onClick={() => uploaderRef.current?.open()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm text-sm font-medium"
              >
                배치도 업로드
              </button>
            </div>
          )}
        </div>

        {/* Edit Mode Banner */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="w-full bg-orange-50/90 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800/30 overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-6 text-sm text-orange-800 dark:text-orange-200">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" />
                  <span><strong>생성:</strong> 빈 공간 드래그</span>
                </div>
                <div className="w-px h-3 bg-orange-200 dark:bg-orange-700" />
                <div className="flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4" />
                  <span><strong>선택:</strong> 클릭</span>
                </div>
                <div className="w-px h-3 bg-orange-200 dark:bg-orange-700" />
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span><strong>삭제:</strong> 선택 후 헤더의 '선택 삭제' 버튼 클릭</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 w-full max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden relative" ref={mapContainerRef}>
          {(isLoadingMap || isMapLoading || isLoadingMessage) && (
            <div className="absolute inset-0 bg-white dark:bg-gray-900 z-50 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-900 dark:text-white font-medium">
                  {isLoadingMessage || (isLoadingMap ? '배치도 데이터를 불러오는 중...' : '이미지 렌더링 중...')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">잠시만 기다려주세요</p>
              </div>
            </div>
          )}

          {!isLoadingMap && !mapImage ? (
            <ImageUploader ref={uploaderRef} currentImage={mapImage} onImageUpload={handleImageUpload} />
          ) : (
            // Render map viewer but keep it hidden/under loader until onImageLoad fires
            <>
              <AssetMapViewer
                imageSrc={mapImage || ''}
                zoom={zoom}
                pins={pins}
                selectedPin={selectedPin}
                isEditing={isEditing}
                selectedZoneIds={selectedZoneIds}
                onPinClick={handleZoneClick}
                onImageLoad={() => setIsMapLoading(false)}
                onBgClick={() => {
                  setSelectedPin(null);
                  // Keep selections in edit mode to prevent accidental clearing
                  // if (isEditing) setSelectedZoneIds(new Set()); 
                }}
                onPinMove={(id: string, x: number, y: number) => {
                  const newPins = pins.map(p => p.id === id ? { ...p, pinX: x, pinY: y } : p);
                  savePins(newPins);
                }}
                onPinResize={(id: string, w: number, h: number) => {
                  const newPins = pins.map(p => p.id === id ? { ...p, width: w, height: h } : p);
                  savePins(newPins);
                }}
                onZoneCreate={(rect: { x: number, y: number, w: number, h: number }) => {
                  const newPin: Location = {
                    id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    name: `구역 ${pins.length + 1}`,
                    pinX: rect.x,
                    pinY: rect.y,
                    width: rect.w,
                    height: rect.h,
                    type: 'Classroom'
                  };
                  savePins([...pins, newPin]);
                }}
                onZoneDoubleClick={handleZoneDoubleClick}
              />
            </>
          )}

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
            <button onClick={handleZoomIn} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
              <PlusCircle className="w-5 h-5" />
            </button>
            <button onClick={handleZoomReset} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={handleZoomOut} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
              <Minus className="w-5 h-5" />
            </button>
          </div>

          {/* Asset Details Modal */}
          <AnimatePresence>
            {selectedPin && !isEditing && (
              <AssetDetailModal
                isOpen={!!selectedPin}
                onClose={() => setSelectedPin(null)}
                zone={selectedPin}
                deviceInstances={deviceInstances.filter(inst => inst.locationId === selectedPin.id)}
                allDeviceInstances={deviceInstances}
                allDevices={devices}
                onEditDevice={(device) => {
                  setLastSelectedPin(selectedPin);
                  setEditDevice(device);
                  setSelectedPin(null);
                }}
                onAssignDevice={async (deviceId, zoneId, zoneName, quantity) => {
                  const result = await createDeviceInstance({
                    deviceId,
                    locationId: zoneId,
                    locationName: zoneName,
                    quantity,
                    notes: ''
                  }) as any;

                  if (result.success) {
                    const { devices: updatedDevices, deviceInstances: updatedInstances } = await fetchAssetData();
                    if (updatedDevices) setDevices(updatedDevices);
                    if (updatedInstances) setDeviceInstances(updatedInstances);
                  } else {
                    throw new Error(result.error);
                  }
                }}
                onRemoveInstance={async (instanceId) => {
                  const result = await deleteDeviceInstance(instanceId);
                  if (result.success) {
                    const { deviceInstances: updatedInstances } = await fetchAssetData();
                    if (updatedInstances) setDeviceInstances(updatedInstances);
                  } else {
                    throw new Error(result.error || 'Failed to remove instance');
                  }
                }}
              />
            )}
          </AnimatePresence>

          {/* Device Edit Modal (from map) */}
          <DeviceEditModal
            isOpen={!!editDevice}
            device={editDevice}
            onClose={() => {
              setEditDevice(null);
              if (lastSelectedPin) {
                setSelectedPin(lastSelectedPin);
                setLastSelectedPin(null);
              }
            }}
            onSave={async (updates) => {
              if (!editDevice) return;

              if (Object.keys(updates).length > 0) {
                const result = await updateDevice(editDevice.id, updates);
                if (!result.success) {
                  alert('수정 실패: ' + result.error);
                  return;
                }
              }

              const { devices: updatedDevices, deviceInstances: updatedInstances } = await fetchAssetData();
              if (updatedDevices) setDevices(updatedDevices);
              if (updatedInstances) setDeviceInstances(updatedInstances);

              // alert('저장되었습니다.'); // Optional feedback
              setEditDevice(null);
              if (lastSelectedPin) {
                setSelectedPin(lastSelectedPin);
                setLastSelectedPin(null);
              }
            }}
            zones={pins}
          />

          {/* Zone Edit Modal */}
          <ZoneEditModal
            isOpen={!!editingZone}
            zone={editingZone}
            onClose={() => setEditingZone(null)}
            onSave={handleZoneSave}
          />

          {/* AI Result Confirmation Modal (Structure) */}
          {showOCRModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-sm w-full"
              >
                <h3 className="text-lg font-bold mb-2">구역 찾기 완료</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                  {ocrResults.length}개의 구역 구조를 찾았습니다.<br />
                  적용 후 [구역 편집] 모드에서 불필요한 구역을 정리해주세요.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowOCRModal(false); setOcrResults([]); }} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
                  <button onClick={confirmStructureUpdate} className="px-4 py-2 bg-primary text-white rounded-lg">적용 및 편집</button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Zone Batch Edit Modal */}
          <ZoneBatchEditModal
            isOpen={showNameModal}
            zones={pins}
            onClose={() => setShowNameModal(false)}
            onSave={handleBatchSave}
            onAutoDetect={() => handleAutoNameZones(false)}
            isScanning={isScanning}
          />
          <DeleteConfirmModal
            isOpen={showDeleteMapModal}
            type="single"
            deviceName="현재 배치도"
            validationText="배치도 삭제"
            onClose={() => setShowDeleteMapModal(false)}
            onConfirm={handleDeleteMap}
          />
        </div>

        {/* Footer Stats */}
        <div className="flex gap-8 text-center bg-gray-50 dark:bg-gray-800/50 py-4 px-8 rounded-2xl justify-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalZones}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Total Zones</div>
          </div>
          <div className="w-px bg-gray-200 dark:bg-gray-700" />
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.withDevices}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Assigned</div>
          </div>
          <div className="w-px bg-gray-200 dark:bg-gray-700" />
          <div>
            <div className="text-2xl font-bold text-orange-500 dark:text-orange-400">{stats.empty}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Empty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
