'use server';

/**
 * Server Actions Module
 * 
 * This file contains all server-side actions for the application.
 * It handles both Google Sheets and Firebase backends seamlessly.
 * 
 * Sections:
 *   1. Configuration & Helpers (line ~30)
 *   2. PDF & Asset Data (line ~70)
 *   3. Map Configuration (line ~200)
 *   4. Software & Accounts CRUD (line ~300)
 *   5. Zone Management (line ~510)
 *   6. Device CRUD & Distribution (line ~570)
 *   7. DeviceInstance CRUD (line ~790)
 *   8. System Config (line ~940)
 *   9. OCR & Scan Processing (line ~990)
 *  10. Loans Management (line ~1400)
 *  11. Backup & Restore (line ~1800)
 * 
 * TODO: Split into separate modules (devices-actions.ts, loans-actions.ts, etc.)
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getData as baseGetData,
    updateData as baseUpdateData,
    appendData as baseAppendData,
    addSheet as baseAddSheet,
    clearData as baseClearData,
    batchUpdateData as baseBatchUpdateData
} from '@/lib/google-sheets';
import { MOCK_DEVICES, MOCK_SOFTWARE, MOCK_CREDENTIALS } from '@/lib/mock-data';
import { Device, Software, Credential, Location, DeviceInstance } from '@/types';
import { cookies } from 'next/headers';
import * as fbActions from './firebase-actions';

// Helper to get App Config from Cookie
async function _getAppConfig() {
    try {
        const store = await Promise.resolve(cookies());
        const cookie = store.get('edu-asset-config');
        if (cookie?.value) {
            return JSON.parse(decodeURIComponent(cookie.value));
        }
    } catch (e) { }
    return null;
}

/**
 * Helper to get user-specific Sheets credentials.
 * Priority: 1. Cookie (Performance) 2. Spreadsheet (Reliability)
 */
async function _getSheetsCredentials(sheetId?: string) {
    const config = await _getAppConfig();

    // 1. Try Cookie
    const jsonFromCookie = config?.sheet?.serviceAccountJson;
    if (jsonFromCookie) {
        try { return JSON.parse(jsonFromCookie); } catch (e) { }
    }

    // 2. Try Spreadsheet (via Master Service Account)
    if (sheetId && sheetId !== 'NO_SHEET') {
        try {
            // We use baseGetData here to avoid recursion
            const rows = await baseGetData('SystemConfig!A2:B', sheetId);
            if (rows) {
                const credRow = rows.find((r: any[]) => r[0] === 'SERVICE_ACCOUNT_JSON');
                if (credRow && credRow[1]) {
                    return JSON.parse(credRow[1]);
                }
            }
        } catch (e) { }
    }
    return null;
}

// --- Dynamic Wrappers to inject credentials automatically ---
const getData = async (range: string, sheetId?: string) => {
    const targetId = sheetId || await getUserSheetId();
    const creds = await _getSheetsCredentials(targetId);
    return baseGetData(range, targetId, creds);
};

const updateData = async (range: string, values: any[][], sheetId?: string) => {
    const targetId = sheetId || await getUserSheetId();
    const creds = await _getSheetsCredentials(targetId);
    return baseUpdateData(range, values, targetId, creds);
};

const batchUpdateData = async (data: { range: string, values: any[][] }[], sheetId?: string) => {
    const targetId = sheetId || await getUserSheetId();
    const creds = await _getSheetsCredentials(targetId);
    return baseBatchUpdateData(data, targetId, creds);
};

const appendData = async (range: string, values: any[][], sheetId?: string) => {
    const targetId = sheetId || await getUserSheetId();
    const creds = await _getSheetsCredentials(targetId);
    return baseAppendData(range, values, targetId, creds);
};

const addSheet = async (title: string, sheetId?: string) => {
    const targetId = sheetId || await getUserSheetId();
    const creds = await _getSheetsCredentials(targetId);
    return baseAddSheet(title, targetId, creds);
};

const clearData = async (range: string, sheetId?: string) => {
    const targetId = sheetId || await getUserSheetId();
    const creds = await _getSheetsCredentials(targetId);
    return baseClearData(range, targetId, creds);
};


export async function parsePdfAction(formData: FormData): Promise<{ success: boolean; text?: string; error?: string }> {
    // PDF parsing disabled on server due to Vercel compatibility issues
    return {
        success: false,
        error: 'PDF parsing is not available in the current deployment. Please use manual entry.'
    };
}

// Helper to check if we are in Mock Mode 
const isGlobalMockMode = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// #14: Structured error helper for consistent error responses
function createActionError(code: string, message: string) {
    return { success: false as const, error: message, errorCode: code };
}

// #23: Session verification helper for write operations
async function requireSession() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        throw new Error('UNAUTHORIZED');
    }
    return session;
}

async function getUserSheetId() {
    try {
        const session = await getServerSession(authOptions);
        const id = (session?.user as any)?.spreadsheetId;

        if (session?.user && !id) {
            return 'NO_SHEET';
        }

        return id || undefined;
    } catch (error) {
        console.error('[getUserSheetId] Error:', error);
        return undefined;
    }
}

export async function fetchAssetData(overrideSheetId?: string) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        const fbData: any = await fbActions.fetchAssetData(appConfig.firebase);
        // Also fetch software and credentials from Firebase
        const [softwareList, credentialsList] = await Promise.all([
            fbActions.fetchSoftwareList(appConfig.firebase),
            fbActions.fetchAccountList(appConfig.firebase)
        ]);
        return {
            devices: (fbData.devices || []) as Device[],
            software: (softwareList || []) as any[],
            credentials: (credentialsList || []) as any[],
            deviceInstances: (fbData.instances || []) as DeviceInstance[]
        };
    }

    try {
        const sheetId = overrideSheetId || await getUserSheetId();

        // 1. Logged in but no sheet -> Empty Data (Don't show Admin data)
        if (sheetId === 'NO_SHEET') {
            return { devices: [], software: [], credentials: [] };
        }

        // 2. Global Mock (No creds at all)
        if (isGlobalMockMode && !sheetId) {
            return {
                devices: MOCK_DEVICES,
                software: MOCK_SOFTWARE,
                credentials: MOCK_CREDENTIALS,
            };
        }

        try {
            const deviceRows = await getData('Devices!A2:R', sheetId);
            const devices: Device[] = (deviceRows || []).map((row: any[]) => ({
                id: row[0],
                category: row[1] as any,
                model: row[2],
                ip: row[3],
                status: row[4] as any,
                purchaseDate: row[5],
                groupId: row[6],
                name: row[7],
                acquisitionDivision: row[8],
                quantity: row[9],
                unitPrice: row[10],
                totalAmount: row[11],
                serviceLifeChange: row[12],
                installLocation: row[13],
                osVersion: row[14],
                windowsPassword: row[15],
                userName: row[16],
                pcName: row[17],
            }));

            const swRows = await getData('Software!A2:D', sheetId);
            const software: Software[] = (swRows || []).map((row: any[]) => ({
                name: row[0],
                licenseKey: row[1],
                quantity: parseInt(row[2] || '0'),
                expiryDate: row[3],
            }));


            const credRows = await getData('Credentials!A2:D', sheetId);
            const credentials: Credential[] = (credRows || []).map((row: any[]) => ({
                serviceName: row[0],
                adminId: row[1],
                contact: row[2],
                note: row[3],
            }));

            // Fetch DeviceInstances
            const instanceRows = await getData('DeviceInstances!A2:F', sheetId);
            const deviceInstances: DeviceInstance[] = (instanceRows || []).map((row: any[]) => ({
                id: row[0],
                deviceId: row[1],
                locationId: row[2],
                locationName: row[3],
                quantity: parseInt(row[4] || '0'),
                notes: row[5],
            }));

            // Dynamic installLocation computation
            devices.forEach(d => {
                const myInst = deviceInstances.filter(i => i.deviceId === d.id);
                if (myInst.length > 0) {
                    d.installLocation = myInst.map(i => {
                        const qty = Number(i.quantity || 1);
                        return qty > 0 ? `${i.locationName}(${qty})` : i.locationName;
                    }).join(', ');
                }
            });

            return { devices, software, credentials, deviceInstances };

        } catch (error) {
            console.error('[fetchAssetData] Error:', error);
            return { devices: [], software: [], credentials: [], deviceInstances: [] };
        }
    } catch (outerError) {
        console.error('[fetchAssetData] Critical error:', outerError);
        return { devices: [], software: [], credentials: [] };
    }
}

export async function fetchMapConfiguration(mapId: string = 'default', overrideSheetId?: string) {
    const appConfig = await _getAppConfig();

    // Firebase Branch
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.fetchMapConfiguration(appConfig.firebase, mapId);
    }

    const sheetId = overrideSheetId || appConfig?.sheet?.spreadsheetId || await getUserSheetId();

    if (sheetId === 'NO_SHEET') return { mapImage: null, zones: [], updatedAt: null };
    if (isGlobalMockMode && !sheetId) return { mapImage: null, zones: [], updatedAt: null };

    try {
        const rows = await getData('Config!A1:B2000', sheetId);
        if (!rows || rows.length === 0) return { mapImage: null, zones: [], updatedAt: null };

        const configMap = new Map<string, string>();
        rows.forEach((row: any[]) => {
            if (row[0]) configMap.set(row[0], row[1]);
        });

        // Key naming: Map_Zones_{mapId}, Map_Image_{mapId}_{chunk}
        const zonesKey = mapId === 'default' ? 'MapZones' : `Map_Zones_${mapId}`;
        const imagePrefix = mapId === 'default' ? 'MapImage_' : `Map_Image_${mapId}_`;

        // Reconstruct MapImage
        let mapImage = '';
        const chunkKeys = Array.from(configMap.keys()).filter(k => k.startsWith(imagePrefix));

        if (chunkKeys.length > 0) {
            chunkKeys.sort((a, b) => {
                const idxA = parseInt(a.replace(imagePrefix, '') || '0', 10);
                const idxB = parseInt(b.replace(imagePrefix, '') || '0', 10);
                return idxA - idxB;
            });
            for (const key of chunkKeys) {
                mapImage += configMap.get(key) || '';
            }
        }

        // Legacy fallback
        if (!mapImage && mapId === 'default' && configMap.has('MapImage')) {
            mapImage = configMap.get('MapImage') || '';
        }

        const zonesJson = configMap.get(zonesKey);
        let zones: Location[] = zonesJson ? JSON.parse(zonesJson) : [];
        const updatedAt = configMap.get('LastUpdated') || null;

        // Merge with Locations sheet (Global names)
        try {
            const locRows = await getData('Locations!A:C', sheetId);
            if (locRows && locRows.length > 0) {
                const nameMap = new Map<string, string>();
                locRows.forEach((row: any[]) => {
                    if (row[0] && row[2]) nameMap.set(row[0], row[2]);
                });

                if (nameMap.size > 0) {
                    zones = zones.map(z => ({
                        ...z,
                        name: nameMap.get(z.id) || z.name
                    }));
                }
            }
        } catch (e) { }

        return { mapImage: mapImage || null, zones, updatedAt };
    } catch (error) {
        return { mapImage: null, zones: [], updatedAt: null };
    }
}

export async function saveMapConfiguration(mapImage: string | null, zones: Location[], mapId: string = 'default') {
    const appConfig = await _getAppConfig();

    // Firebase Branch
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.saveMapConfiguration(appConfig.firebase, mapImage, zones, mapId);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let configRows = await getData('Config!A1', sheetId);
        if (configRows === null) {
            await addSheet('Config', sheetId);
        }

        const zonesKey = mapId === 'default' ? 'MapZones' : `Map_Zones_${mapId}`;
        const imagePrefix = mapId === 'default' ? 'MapImage_' : `Map_Image_${mapId}_`;

        // 1. Fetch current config to merge or selectively clear
        const existingRows = await getData('Config!A1:B2000', sheetId) || [];
        const configMap = new Map<string, string>();
        existingRows.forEach(r => { if (r[0]) configMap.set(r[0], r[1]); });

        // 2. Remove chunks for THIS mapId only
        const keysToDelete = Array.from(configMap.keys()).filter(k => k.startsWith(imagePrefix) || k === zonesKey || k === 'MapImage');
        keysToDelete.forEach(k => configMap.delete(k));

        // 3. Add new data
        configMap.set(zonesKey, JSON.stringify(zones));
        configMap.set('LastUpdated', new Date().toISOString());

        // Update Floor List
        const floorListStr = configMap.get('Map_List') || 'default';
        const floors = new Set(floorListStr.split(','));
        floors.add(mapId);
        configMap.set('Map_List', Array.from(floors).join(','));

        if (mapImage) {
            const CHUNK_SIZE = 40000;
            const totalChunks = Math.ceil(mapImage.length / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const chunk = mapImage.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                configMap.set(`${imagePrefix}${i}`, chunk);
            }
        }

        const values = Array.from(configMap.entries());
        values.unshift(['Key', 'Value']);

        // Clear and Overwrite Config sheet
        await clearData('Config!A1:B2000', sheetId);
        await updateData('Config!A1', values, sheetId);

        return { success: true };
    } catch (error: any) {
        console.error('Failed to save map config:', error);
        const errorMessage = error?.result?.error?.message || error?.message || String(error);
        return { success: false, error: errorMessage };
    }
}

export async function fetchMapList() {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.fetchMapList(appConfig.firebase);
    }

    const sheetId = await getUserSheetId();
    if (!sheetId || sheetId === 'NO_SHEET') return ['default'];

    try {
        const rows = await getData('Config!A1:B100', sheetId);
        const listRow = rows?.find((r: any[]) => r[0] === 'Map_List');
        if (listRow && listRow[1]) {
            return listRow[1].split(',');
        }
    } catch (e) { }
    return ['default'];
}

export async function deleteMap(mapId: string) {
    if (mapId === 'default') return { success: false, error: '기본 배치도는 삭제할 수 없습니다.' };

    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.deleteMap(appConfig.firebase, mapId);
    }

    const sheetId = await getUserSheetId();
    try {
        const rows = await getData('Config!A1:B2000', sheetId) || [];
        const configMap = new Map<string, string>();
        rows.forEach(r => { if (r[0]) configMap.set(r[0], r[1]); });

        const zonesKey = `Map_Zones_${mapId}`;
        const imagePrefix = `Map_Image_${mapId}_`;

        const keysToDelete = Array.from(configMap.keys()).filter(k => k.startsWith(imagePrefix) || k === zonesKey);
        keysToDelete.forEach(k => configMap.delete(k));

        const floorListStr = configMap.get('Map_List') || 'default';
        const floors = new Set(floorListStr.split(','));
        floors.delete(mapId);
        configMap.set('Map_List', Array.from(floors).join(','));

        const values = Array.from(configMap.entries());
        values.unshift(['Key', 'Value']);

        await clearData('Config!A1:B2000', sheetId);
        await updateData('Config!A1', values, sheetId);
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Software Management ---

export async function getSoftwareList() {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.fetchSoftwareList(appConfig.firebase);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return [];
    if (isGlobalMockMode && !sheetId) return [];

    try {
        const rows = await getData('Software!A2:H', sheetId);
        const safeRows = rows || [];
        return safeRows.map((row: any[]) => ({
            id: row[0],
            name: row[1],
            type: row[2],
            version: row[3],
            licenseKey: row[4],
            purchaseDate: row[5],
            assignedTo: row[6],
            notes: row[7]
        }));
    } catch (error) {
        return [];
    }
}

export async function saveSoftware(item: any) {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.registerSoftware(appConfig.firebase, item);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let rows = await getData('Software!A:A', sheetId);

        if (rows === null) {
            await addSheet('Software', sheetId);
            await updateData('Software!A1', [['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes']], sheetId);
            rows = [];
        }

        const rowIndex = rows.findIndex((r: any[]) => r[0] === item.id);

        const rowData = [
            item.id,
            item.name,
            item.type,
            item.version || '',
            item.licenseKey || '',
            item.purchaseDate || '',
            item.assignedTo || '',
            item.notes || ''
        ];

        if (rowIndex >= 0) {
            await updateData(`Software!A${rowIndex + 1}`, [rowData], sheetId);
        } else {
            await appendData('Software!A1', [rowData], sheetId);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function deleteSoftware(id: string) {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.deleteSoftwareFromDB(appConfig.firebase, id);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        const rows = await getData('Software!A:A', sheetId);
        if (!rows) return { success: false, error: 'Sheet not found' };

        const rowIndex = rows.findIndex((r: any[]) => r[0] === id);
        if (rowIndex >= 0) {
            const allRows = await getData('Software!A:H', sheetId) || [];
            const newRows = allRows.filter((r: any[]) => r[0] !== id);
            await updateData('Software!A1', [['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes'], ...newRows.slice(1)], sheetId);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

// --- Account Management, etc. (Other functions also apply NO_SHEET check implicitly) ---
// (Due to file length, I am updating main functions. Account functions should be similar but for brevity assuming they follow pattern or user only testing map/software now)
// Let's include Account functions to be safe.

export async function getAccountList() {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.fetchAccountList(appConfig.firebase);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return [];
    if (isGlobalMockMode && !sheetId) return [];

    try {
        const rows = await getData('Accounts!A2:G', sheetId);
        const safeRows = rows || [];
        return safeRows.map((row: any[]) => ({
            id: row[0],
            serviceName: row[1],
            url: row[2],
            username: row[3],
            password: row[4],
            category: row[5],
            notes: row[6]
        }));
    } catch (error) {
        return [];
    }
}

export async function saveAccount(item: any) {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.saveAccountToDB(appConfig.firebase, item);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let rows = await getData('Accounts!A:A', sheetId);

        if (rows === null) {
            await addSheet('Accounts', sheetId);
            await updateData('Accounts!A1', [['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes']], sheetId);
            rows = [];
        }

        const rowIndex = rows.findIndex((r: any[]) => r[0] === item.id);
        const rowData = [
            item.id,
            item.serviceName,
            item.url || '',
            item.username || '',
            item.password || '',
            item.category || 'General',
            item.notes || ''
        ];

        if (rowIndex >= 0) {
            await updateData(`Accounts!A${rowIndex + 1}`, [rowData], sheetId);
        } else {
            await appendData('Accounts!A1', [rowData], sheetId);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function deleteAccount(id: string) {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.deleteAccountFromDB(appConfig.firebase, id);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        const allRows = await getData('Accounts!A:G', sheetId);
        if (!allRows) return { success: false, error: 'Sheet not found' };

        const newRows = allRows.filter((r: any[]) => r[0] !== id);
        await updateData('Accounts!A1', newRows.length > 0 ? newRows : [['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes']], sheetId);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function registerBulkDevices(devices: any[]) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.registerBulkDevicesToDB(appConfig.firebase, devices);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true, count: 0 };

    try {
        let rows = await getData('Devices!A:A', sheetId);

        if (rows === null) {
            await addSheet('Devices', sheetId);
            await updateData('Devices!A1', [['ID', 'Category', 'Model', 'IP', 'Status', 'PurchaseDate', 'Location', 'Name', 'AcquisitionDivision', 'Quantity', 'UnitPrice', 'TotalAmount', 'ServiceLifeChange', 'InstallLocation', 'OSVersion', 'WindowsPassword', 'UserName', 'PCName']], sheetId);
            rows = [];
        }

        // Prepare rows for appending
        const newRows = devices.map((d: any) => [
            d.id || crypto.randomUUID(),
            d.category || '기타',
            d.model || '',
            d.ip || '',
            d.status || '사용 가능',
            d.purchaseDate || '',
            d.groupId || '',
            d.name || '',
            d.acquisitionDivision || '전체',
            d.quantity || '1',
            d.unitPrice || '0',
            d.totalAmount || '0',
            d.serviceLifeChange || '',
            d.installLocation || '',
            d.osVersion || '',
            d.windowsPassword || '',
            d.userName || '',
            d.pcName || ''
        ]);

        await appendData('Devices!A1', newRows, sheetId);
        return { success: true, count: newRows.length };
    } catch (error) {
        console.error('Bulk Register Error:', error);
        return { success: false, error: String(error) };
    }
}

export async function syncZonesToSheet(zones: Location[]) {
    const appConfig = await _getAppConfig();

    // Firebase Branch
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.syncZonesToDB(appConfig.firebase, zones);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let existingMap = new Map<string, string>();
        let rows: any[][] | null = null;
        try {
            rows = await getData('Locations!A:C', sheetId);
        } catch (e) { }

        if (rows === null) {
            await addSheet('Locations', sheetId);
            rows = [];
        } else {
            rows.forEach((row: any[]) => {
                if (row[0] && row[2]) existingMap.set(row[0], row[2]);
            });
        }

        const values = [
            ['Zone ID', 'Auto Name', 'Custom Name (Edit Here)'],
        ];

        zones.forEach((z: Location) => {
            // If there was a previous custom name and it differs from auto name, keep it.
            // Otherwise, set custom name = current zone name for consistency.
            const prevCustom = existingMap.get(z.id) || '';
            const customName = prevCustom && prevCustom !== z.name ? prevCustom : z.name;
            values.push([z.id, z.name, customName]);
        });

        await updateData('Locations!A1', values, sheetId);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function deleteZonesFromLocations(zoneIds: string[]) {
    if (zoneIds.length === 0) return { success: true };

    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.deleteZonesFromLocations(appConfig.firebase, zoneIds);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '시트가 없습니다.' };

    try {
        // 1. Clear from Locations Sheet
        const locRows = await getData('Locations!A:C', sheetId);
        if (locRows && locRows.length > 1) {
            const header = locRows[0];
            const remaining = locRows.slice(1).filter(r => !zoneIds.includes(r[0]));
            await clearData('Locations!A1:C5000', sheetId);
            await updateData('Locations!A1', [header, ...remaining], sheetId);
        }

        // 2. Clear from DeviceInstances (Optional but recommended for consistency)
        const instRows = await getData('DeviceInstances!A:F', sheetId);
        if (instRows && instRows.length > 1) {
            const header = instRows[0];
            const remaining = instRows.slice(1).filter(r => !zoneIds.includes(r[2])); // Col C is LocationID
            await clearData('DeviceInstances!A1:F5000', sheetId);
            await updateData('DeviceInstances!A1', [header, ...remaining], sheetId);
        }

        return { success: true };
    } catch (e) {
        console.error('Failed to delete zones from locations:', e);
        return { success: false, error: String(e) };
    }
}


// Device Management Functions

// Device Management Functions
export async function updateDevice(deviceId: string, updates: Partial<Device>, overrideSheetId?: string) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.updateDevice(appConfig.firebase, deviceId, updates);
    }

    const sheetId = overrideSheetId || await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        const rows = await getData('Devices!A2:R', sheetId);
        if (!rows) return { success: false, error: 'No devices found' };

        const deviceIndex = rows.findIndex((row: any[]) => String(row[0]) === String(deviceId));
        if (deviceIndex === -1) return { success: false, error: 'Device not found' };

        const rowNumber = deviceIndex + 2;
        const currentDevice = rows[deviceIndex];

        const updatedRow = [
            currentDevice[0],
            updates.category !== undefined ? updates.category : currentDevice[1],
            updates.model !== undefined ? updates.model : currentDevice[2],
            updates.ip !== undefined ? updates.ip : currentDevice[3],
            updates.status !== undefined ? updates.status : currentDevice[4],
            updates.purchaseDate !== undefined ? updates.purchaseDate : currentDevice[5],
            updates.groupId !== undefined ? updates.groupId : currentDevice[6],
            updates.name !== undefined ? updates.name : currentDevice[7],
            updates.acquisitionDivision !== undefined ? updates.acquisitionDivision : currentDevice[8],
            updates.quantity !== undefined ? updates.quantity : currentDevice[9],
            updates.unitPrice !== undefined ? updates.unitPrice : currentDevice[10],
            updates.totalAmount !== undefined ? updates.totalAmount : currentDevice[11],
            updates.serviceLifeChange !== undefined ? updates.serviceLifeChange : currentDevice[12],
            updates.installLocation !== undefined ? updates.installLocation : currentDevice[13],
            updates.osVersion !== undefined ? updates.osVersion : currentDevice[14],
            updates.windowsPassword !== undefined ? updates.windowsPassword : currentDevice[15],
            updates.userName !== undefined ? updates.userName : currentDevice[16],
            updates.pcName !== undefined ? updates.pcName : currentDevice[17],
        ];

        await updateData(`Devices!A${rowNumber}`, [updatedRow], sheetId);

        // --- SYNC DeviceInstance if installLocation changed ---
        // --- SYNC DeviceInstance if installLocation changed (RESET / MOVE ALL) ---
        if (updates.installLocation !== undefined) {
            try {
                // Fetch all instances first
                const instanceRows = await getData('DeviceInstances!A2:F', sheetId);

                // Remove OLD instances for this device
                let otherInstances: any[][] = [];
                if (instanceRows) {
                    otherInstances = instanceRows.filter((r: any[]) => r[1] !== deviceId);
                    await clearData('DeviceInstances!A2:F', sheetId);
                    if (otherInstances.length > 0) {
                        await updateData('DeviceInstances!A2', otherInstances, sheetId);
                    }
                }

                // If new location is valid, create ONE instance with TOTAL quantity
                if (updates.installLocation && updates.installLocation.trim() !== '') {
                    const mapConfig = await fetchMapConfiguration(sheetId);
                    const targetZone = mapConfig.zones.find((z: Location) => (z.name || '').trim() === (updates.installLocation || '').trim());

                    const totalQty = updates.quantity !== undefined ? Number(updates.quantity) : Number(currentDevice[9] || 1);
                    const newId = `inst-${Date.now()}`;
                    const locId = targetZone ? targetZone.id : 'TEXT_ONLY';
                    const locName = updates.installLocation;

                    // Add Header if needed (lazy check)
                    const checkRows = await getData('DeviceInstances!A1', sheetId);
                    if (!checkRows) {
                        await addSheet('DeviceInstances', sheetId);
                        await updateData('DeviceInstances!A1', [['ID', 'DeviceID', 'LocationID', 'LocationName', 'Quantity', 'Notes']], sheetId);
                    }

                    await appendData('DeviceInstances!A1', [[newId, deviceId, locId, locName, totalQty, 'Moved via List Edit']], sheetId);
                }
            } catch (syncError) {
                console.warn('Failed to sync DeviceInstance:', syncError);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Update Device Error:', error);
        return { success: false, error: String(error) };
    }
}

export async function deleteDevice(deviceId: string) {
    // Session verification for destructive operation
    try { await requireSession(); } catch { return createActionError('AUTH_REQUIRED', '로그인이 필요합니다.'); }

    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.deleteDeviceFromDB(appConfig.firebase, deviceId);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        // 1. Delete related DeviceInstances
        try {
            const instRows = await getData('DeviceInstances!A2:F', sheetId);
            if (instRows) {
                const filtered = instRows.filter((r: any[]) => r[1] !== deviceId);
                await clearData('DeviceInstances!A2:F', sheetId);
                if (filtered.length > 0) {
                    await updateData('DeviceInstances!A2', filtered, sheetId);
                }
            }
        } catch (e) { /* DeviceInstances sheet may not exist */ }

        // 2. Delete the device itself
        const rows = await getData('Devices!A2:R', sheetId);
        if (!rows) return { success: false, error: 'No devices found' };

        const filteredRows = rows.filter((row: any[]) => row[0] !== deviceId);

        await clearData('Devices!A2:R', sheetId);
        if (filteredRows.length > 0) {
            await updateData('Devices!A2', filteredRows, sheetId);
        }
        return { success: true };
    } catch (error) {
        console.error('Delete Device Error:', error);
        return { success: false, error: String(error) };
    }
}

export async function deleteAllDevices() {
    // Session verification for destructive operation
    try { await requireSession(); } catch { return createActionError('AUTH_REQUIRED', '로그인이 필요합니다.'); }

    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.deleteAllDevicesFromDB(appConfig.firebase);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트 설정이 되어있지 않습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        await clearData('Devices!A2:R', sheetId);
        return { success: true };
    } catch (error) {
        console.error('Delete All Devices Error:', error);
        return { success: false, error: String(error) };
    }
}

export async function deleteBulkDevices(deviceIds: string[]) {
    // Session verification for destructive operation
    try { await requireSession(); } catch { return createActionError('AUTH_REQUIRED', '로그인이 필요합니다.'); }

    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.deleteBulkDevicesFromDB(appConfig.firebase, deviceIds);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        // 1. Delete related DeviceInstances
        try {
            const instRows = await getData('DeviceInstances!A2:F', sheetId);
            if (instRows) {
                const filtered = instRows.filter((r: any[]) => !deviceIds.includes(r[1]));
                await clearData('DeviceInstances!A2:F', sheetId);
                if (filtered.length > 0) {
                    await updateData('DeviceInstances!A2', filtered, sheetId);
                }
            }
        } catch (e) { /* DeviceInstances sheet may not exist */ }

        // 2. Delete devices
        const rows = await getData('Devices!A2:R', sheetId);
        if (!rows) return { success: true };

        const filteredRows = rows.filter((row: any[]) => !deviceIds.includes(row[0]));

        await clearData('Devices!A2:R', sheetId);
        if (filteredRows.length > 0) {
            await updateData('Devices!A2', filteredRows, sheetId);
        }
        return { success: true };
    } catch (error) {
        console.error('Delete Bulk Devices Error:', error);
        return { success: false, error: String(error) };
    }
}

// ==================== DeviceInstance CRUD ====================

/**
 * Create a new DeviceInstance (deploy device to a location)
 */
export async function createDeviceInstance(instance: Omit<DeviceInstance, 'id'>) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.createDeviceInstance(appConfig.firebase, instance);
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const sheetId = await getUserSheetId();
        if (sheetId === 'NO_SHEET') return { success: false, error: 'No spreadsheet configured' };
        if (isGlobalMockMode && !sheetId) return { success: true, id: 'mock-inst-' + Date.now() };

        // Quantity Validation
        const check = await checkQuantityLimit(instance.deviceId, instance.quantity, sheetId);
        if (!check.valid) return { success: false, error: check.error };

        const existingData = await getData('DeviceInstances!A1', sheetId);
        if (existingData === null) {
            await addSheet('DeviceInstances', sheetId);
            await updateData('DeviceInstances!A1', [['ID', 'DeviceID', 'LocationID', 'LocationName', 'Quantity', 'Notes']], sheetId);
        }

        const instanceId = `inst-${Date.now()}`;
        const newRow = [
            instanceId,
            instance.deviceId,
            instance.locationId,
            instance.locationName,
            instance.quantity,
            instance.notes || ''
        ];

        await appendData('DeviceInstances!A1', [newRow], sheetId);

        // Sync
        await syncDeviceLocationString(instance.deviceId, sheetId);

        return { success: true, id: instanceId };
    } catch (error) {
        console.error('Create DeviceInstance Error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Update an existing DeviceInstance
 */
export async function updateDeviceInstance(instanceId: string, updates: Partial<DeviceInstance>) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.updateDeviceInstance(appConfig.firebase, instanceId, updates);
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const sheetId = await getUserSheetId();
        if (sheetId === 'NO_SHEET') return { success: false, error: 'No spreadsheet configured' };
        if (isGlobalMockMode && !sheetId) return { success: true };

        const rows = await getData('DeviceInstances!A2:F', sheetId);
        if (!rows) return { success: false, error: 'No instances found' };

        const rowIndex = rows.findIndex((row: any[]) => row[0] === instanceId);
        if (rowIndex === -1) return { success: false, error: 'Instance not found' };

        const existing = rows[rowIndex];

        // Quantity Validation
        if (updates.quantity !== undefined && updates.quantity !== existing[4]) {
            const check = await checkQuantityLimit(existing[1], updates.quantity, sheetId, instanceId);
            if (!check.valid) return { success: false, error: check.error };
        }

        const updated = [
            existing[0], // ID (unchanged)
            updates.deviceId ?? existing[1],
            updates.locationId ?? existing[2],
            updates.locationName ?? existing[3],
            updates.quantity ?? existing[4],
            updates.notes ?? existing[5],
        ];

        await updateData(`DeviceInstances!A${rowIndex + 2}`, [updated], sheetId);

        // Sync
        await syncDeviceLocationString(existing[1], sheetId);

        return { success: true };
    } catch (error) {
        console.error('Update DeviceInstance Error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Delete a DeviceInstance
 */
export async function deleteDeviceInstance(instanceId: string) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.deleteDeviceInstance(appConfig.firebase, instanceId);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const sheetId = await getUserSheetId();
        if (sheetId === 'NO_SHEET') return { success: false, error: 'No spreadsheet configured' };
        if (isGlobalMockMode && !sheetId) return { success: true };

        const rows = await getData('DeviceInstances!A2:F', sheetId);
        if (!rows) return { success: true };

        const targetRow = rows.find((row: any[]) => row[0] === instanceId);
        if (!targetRow) return { success: true };

        const deviceId = targetRow[1]; // Save deviceId for sync

        const filteredRows = rows.filter((row: any[]) => row[0] !== instanceId);

        await clearData('DeviceInstances!A2:F', sheetId);
        if (filteredRows.length > 0) {
            await updateData('DeviceInstances!A2', filteredRows, sheetId);
        }

        // Sync
        await syncDeviceLocationString(deviceId, sheetId);

        return { success: true };
    } catch (error) {
        console.error('Delete DeviceInstance Error:', error);
        return { success: false, error: String(error) };
    }
}

// --- System Configuration ---

export async function fetchSystemConfig(overrideSheetId?: string) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.fetchSystemConfig(appConfig.firebase);
    }

    const sheetId = overrideSheetId || await getUserSheetId();
    if (sheetId === 'NO_SHEET') return {};

    try {
        const rows = await getData('SystemConfig!A2:B', sheetId);
        if (!rows) {
            // Create if not exists with Header
            await addSheet('SystemConfig', sheetId);
            await updateData('SystemConfig!A1', [['Key', 'Value']], sheetId);
            return {};
        }
        const config: Record<string, string> = {};
        rows.forEach((r: string[]) => {
            if (r[0]) config[r[0]] = r[1] || '';
        });
        return config;
    } catch (e) {
        return {};
    }
}

export async function saveSystemConfig(config: Record<string, string>) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.saveSystemConfig(appConfig.firebase, config);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: 'No sheet connected' };

    try {
        const current = await fetchSystemConfig(sheetId);
        const merged = { ...current, ...config };

        const rows = Object.entries(merged).map(([k, v]) => [k, v]);

        if (rows.length > 0) {
            await updateData('SystemConfig!A2', rows, sheetId);
        }
        return { success: true };
    } catch (e) {
        console.error('SystemConfig save error:', e);
        return { success: false, error: String(e) };
    }
}

// --- OCR & Auto Assign ---

export async function processScannedImage(imageBase64: string, locationName: string, overrideSheetId?: string) {
    // 1. Get Configuration (API Key)
    const config = await fetchSystemConfig(overrideSheetId);
    // Use user-provided key first, fallback to env key
    const apiKey = config['GOOGLE_VISION_KEY'] || process.env.GOOGLE_VISION_KEY;

    if (!apiKey) {
        return { success: false, error: 'Google Vision API Key가 설정되지 않았습니다. 관리자 설정에서 키를 등록해주세요.' };
    }

    try {
        // 1. Gemini Vision API Call (Text Extraction)
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: '이 이미지에서 보이는 모든 텍스트를 정확하게 추출해주세요. 모델명, 관리번호, 일련번호 등이 포함될 수 있습니다. 텍스트만 줄바꿈으로 구분하여 출력해주세요. 추가 설명이나 마크다운 형식은 사용하지 마세요.'
                            },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: imageBase64
                                }
                            }
                        ]
                    }]
                })
            }
        );

        if (!geminiResponse.ok) {
            const err = await geminiResponse.json();
            return { success: false, error: err.error?.message || 'Gemini Vision API call failed' };
        }

        const geminiData = await geminiResponse.json();
        const fullText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!fullText) {
            return { success: false, error: '이미지에서 텍스트를 찾을 수 없습니다.' };
        }

        // 2. Fetch Devices to match
        // Need to import fetchAssetData or define it here? It's exported in this file.
        // Since we are inside the module, we can call fetchAssetData directly if it's defined in scope.
        // It is exported, so it's available.
        const { devices } = (await fetchAssetData(overrideSheetId)) as { devices: Device[] };

        if (!devices || devices.length === 0) {
            return { success: false, error: '매칭할 기기 데이터가 없습니다. 엑셀 데이터를 먼저 확인해주세요.', text: fullText };
        }

        // 3. Smart Matching Logic
        // Clean text: Remove ALL non-alphanumeric chars (including hyphens, underscores) to handle OCR errors better
        const normalize = (s: string) => s.replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase();
        const cleanText = normalize(fullText);
        let matchedDevice: Device | null = null;

        for (const device of devices) {
            if (!device) continue;

            // Check Model, ID, and Name. Filter out short strings to avoid false positives.
            // Priority: Model > ID > Name
            const targets = [device.model, device.id];

            // Name is risky if it's generic like "Monitor", so only use if it's specific (e.g. includes digits)
            if (device.name && /\d/.test(device.name)) {
                targets.push(device.name);
            }

            for (const target of targets) {
                if (!target || target.length < 5) continue;

                const cleanTarget = normalize(target);
                // Ensure target is robust enough after normalization
                if (cleanTarget.length >= 5 && cleanText.includes(cleanTarget)) {
                    matchedDevice = device;
                    break;
                }
            }

            if (matchedDevice) break;
        }

        if (matchedDevice) {
            // 4. Update Location
            if (matchedDevice.installLocation === locationName) {
                return { success: true, message: '이미 해당 장소에 등록된 기기입니다.', device: matchedDevice, text: fullText };
            }

            // We use updateDevice which handles DeviceInstance sync internally now!
            await updateDevice(matchedDevice.id, { installLocation: locationName }, overrideSheetId);

            return {
                success: true,
                message: '기기 위치가 업데이트되었습니다.',
                device: matchedDevice,
                text: fullText
            };
        } else {
            const debugText = fullText.length > 30 ? fullText.substring(0, 30).replace(/\n/g, ' ') + '...' : fullText.replace(/\n/g, ' ');
            return {
                success: false,
                error: `일치하는 기기를 찾을 수 없습니다.\n[인식실패] OCR: "${debugText}"`,
                text: fullText
            };
        }

    } catch (e) {
        console.error('OCR Process Error:', e);
        return { success: false, error: '처리 중 오류가 발생했습니다: ' + String(e) };
    }
}

export async function recognizeZoneNamesWithAI(imageBase64: string, zones: any[], imageWidth?: number, imageHeight?: number) {
    console.log('[AI] Starting Zone Name Recognition...');
    const config = await fetchSystemConfig();
    const apiKey = config['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('Gemini API Key missing, falling back to OCR...');
        return await recognizeZoneNamesWithOCR(imageBase64, zones, 'API Key 누락', imageWidth, imageHeight);
    }

    try {
        // Build zone position descriptions for the prompt
        const zoneDescriptions = zones.map((z, i) =>
            `Zone ${i + 1}: 위치(x:${z.pinX.toFixed(1)}%, y:${z.pinY.toFixed(1)}%, w:${(z.width || 5).toFixed(1)}%, h:${(z.height || 5).toFixed(1)}%)`
        ).join('\n');

        const prompt = `이 건물 배치도(평면도) 이미지를 분석하여 각 구역의 이름을 정확하게 추출해주세요.

아래는 이미지에서 감지된 구역들의 위치 정보입니다 (이미지 좌상단 기준 백분율 좌표):
${zoneDescriptions}

각 구역 위치(사각형 영역) "내부"에 적힌 교실/공간 이름을 읽어주세요. 
박스 바깥에 있는 '1층', '2층', '5층' 같은 층수 표시나 구역 번호는 무시하고, 실제 공간 이름(예: 과학실, 1-1)만 추출하세요.

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 설명은 생략하세요:
[{"index":0,"name":"교실이름"},{"index":1,"name":"교실이름"},...]

규칙:
- index는 제공된 목록의 순서(0부터 시작)와 정확히 일치해야 합니다.
- 텍스트가 세로/가로 혼용되어 있어도 문맥에 맞게 읽으세요. (예: "전", "담", "실" -> "전담실")
- 박스 내부에 텍스트가 없으면 "분석 불가"라고 적으세요.
- 학교 특성상 "Wee 클래스", "방과후실", "돌봄교실" 등이 많으므로 오타에 주의하세요.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: imageBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2048
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.json();
            console.warn('Gemini blocked or failed, trying OCR fallback:', err.error?.message);
            return await recognizeZoneNamesWithOCR(imageBase64, zones, err.error?.message, imageWidth, imageHeight);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response (Gemini may wrap in ```json ... ```)
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.warn('Gemini response not parseable, trying OCR fallback:', rawText);
            return await recognizeZoneNamesWithOCR(imageBase64, zones, 'JSON 파싱 실패', imageWidth, imageHeight);
        }

        const parsed: { index: number, name: string }[] = JSON.parse(jsonMatch[0]);
        let changed = false;
        const updatedZones = zones.map((z, i) => {
            const match = parsed.find(p => p.index === i);
            if (match && match.name && match.name.trim() && match.name !== "분석 불가" && match.name !== z.name) {
                changed = true;
                return { ...z, name: match.name.trim() };
            }
            return z;
        });

        if (!changed) {
            console.warn('Gemini returned results but no names were changed, trying OCR fallback...');
            return await recognizeZoneNamesWithOCR(imageBase64, zones, 'Gemini가 새로운 이름을 감지하지 못했습니다.', imageWidth, imageHeight);
        }

        return { success: true, zones: updatedZones, message: 'AI(Gemini)로 구역 식별 완료' };
    } catch (e) {
        const geminiError = String(e).includes('blocked') ? 'Gemini API 차단됨' : String(e);
        console.error('Gemini error, trying OCR fallback:', e);
        return await recognizeZoneNamesWithOCR(imageBase64, zones, geminiError, imageWidth, imageHeight);
    }
}

// Fallback: Use basic Google Vision OCR to find text near zones
async function recognizeZoneNamesWithOCR(imageBase64: string, zones: any[], previousError?: string, imageWidth?: number, imageHeight?: number) {
    console.log('[AI Fallback] Attempting Legacy OCR recognition...');
    const config = await fetchSystemConfig();
    const apiKey = config['GOOGLE_VISION_KEY'] || process.env.GOOGLE_VISION_KEY;
    if (!apiKey) return { success: false, error: 'OCR Fallback: API Key가 없습니다.', zones };

    try {
        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: { content: imageBase64 },
                        features: [{ type: 'TEXT_DETECTION' }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const err = await response.json();
            return { success: false, error: `Vision API 오류: ${err.error?.message || response.statusText}`, zones };
        }

        const data = await response.json();
        const annotations = data.responses[0]?.textAnnotations;

        if (!annotations || annotations.length === 0) {
            return { success: false, error: '이미지에서 텍스트를 찾을 수 없습니다.', zones };
        }

        // 1. Determine Image Dimensions
        let imgW = imageWidth || 0;
        let imgH = imageHeight || 0;

        // Fallback: Infer from full annotation bounding poly if client didn't provide
        if (!imgW || !imgH) {
            const fullPoly = annotations[0].boundingPoly?.vertices;
            if (fullPoly) {
                fullPoly.forEach((v: any) => {
                    if (v.x > imgW) imgW = v.x;
                    if (v.y > imgH) imgH = v.y;
                });
            }
        }

        if (imgW === 0 || imgH === 0) {
            return { success: false, error: '이미지 크기를 분석할 수 없어 위치 매칭에 실패했습니다.', zones };
        }

        // 2. Proximity Matching: Match text blocks with intelligence
        const textBlocks = annotations.slice(1);
        const zoneMatches = new Map<string, { text: string, x: number, y: number, h: number }[]>();

        textBlocks.forEach((block: any) => {
            const text = block.description?.trim();
            if (!text || text.length < 1) return;

            const vertices = block.boundingPoly.vertices;
            const xCoords = vertices.map((v: any) => v.x || 0);
            const yCoords = vertices.map((v: any) => v.y || 0);

            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const minY = Math.min(...yCoords);
            const maxY = Math.max(...yCoords);

            const blockHeight = maxY - minY;
            const blockHeightPct = (blockHeight / imgH) * 100;

            const avgX = ((minX + maxX) / 2 / imgW) * 100;
            const avgY = ((minY + maxY) / 2 / imgH) * 100;

            zones.forEach(zone => {
                const zW = zone.width || 5;
                const zH = zone.height || 5;

                // CRITICAL: Strict Inside Matching (Reduced padding to 0.2%)
                // This prevents picking up "1층", "2층" labels or text from adjacent rooms
                const isInsideX = avgX >= zone.pinX + 0.2 && avgX <= zone.pinX + zW - 0.2;
                const isInsideY = avgY >= zone.pinY + 0.2 && avgY <= zone.pinY + zH - 0.2;

                if (isInsideX && isInsideY) {
                    const list = zoneMatches.get(zone.id) || [];
                    list.push({ text, x: avgX, y: avgY, h: blockHeightPct });
                    zoneMatches.set(zone.id, list);
                }
            });
        });

        // 3. Update zones with names found inside them (Line-Level Grouping)
        const updatedZones = zones.map(zone => {
            const matches = zoneMatches.get(zone.id);
            if (matches && matches.length > 0) {
                // Determine rows to prevent vertical jitter ("실전담" -> "전담실")
                const rows: { text: string, x: number, y: number }[][] = [];
                matches.sort((a, b) => a.y - b.y);

                matches.forEach(m => {
                    let placed = false;
                    for (const row of rows) {
                        const rowY = row[0].y;
                        const tolerance = m.h * 0.5; // 50% height tolerance
                        if (Math.abs(m.y - rowY) < tolerance) {
                            row.push(m);
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) rows.push([m]);
                });

                const combined = rows.map(row => {
                    return row.sort((a, b) => a.x - b.x).map(m => m.text).join(' ');
                }).join(' ');

                // OCR Typos & Formatting
                let cleaned = combined
                    .replace(/Vee/gi, 'Wee')
                    .replace(/에어\s*벨/g, '에어벨')
                    .replace(/방과\s*후/g, '방과후')
                    .replace(/조\s*회\s*대/g, '조회대')
                    .replace(/휴\s*게\s*실/g, '휴게실');

                if (/^[가-힣0-9\s\(\)]+$/.test(cleaned) && cleaned.length < 10) {
                    cleaned = cleaned.replace(/\s+/g, '');
                }

                if (cleaned.length >= 1) {
                    return { ...zone, name: cleaned.trim() };
                }
            }
            return zone;
        });

        const changeCount = updatedZones.filter((z, i) => z.name !== zones[i].name).length;
        if (changeCount === 0) {
            const errorMsg = previousError ? `인식 실패 (${previousError} & OCR 결과 없음)` : '구역 내에서 공간 이름을 찾지 못했습니다.';
            return { success: false, error: errorMsg, zones };
        }

        return { success: true, zones: updatedZones, message: `Legacy OCR: ${changeCount}개 구역 식별됨 (정밀)` };

    } catch (e) {
        console.error('OCR Fallback Logic Error:', e);
        const errorMsg = previousError ? `시스템 오류 (${previousError} & OCR 에러)` : 'Legacy OCR 처리 중 오류가 발생했습니다.';
        return { success: false, error: errorMsg, zones };
    }
}

export async function getMySheetId() {
    return await getUserSheetId();
}

// --- Helper Functions ---

async function checkQuantityLimit(deviceId: string, addQty: number, sheetId: string, excludeInstanceId?: string) {
    try {
        const deviceRows = await getData('Devices!A2:R', sheetId);
        const deviceRow = deviceRows?.find((r: any[]) => String(r[0]) === String(deviceId));
        if (!deviceRow) return { valid: false, error: 'Device not found' };

        const totalQty = parseInt(deviceRow[9] || '1'); // Column J

        const instanceRows = await getData('DeviceInstances!A2:F', sheetId) || [];
        let currentUsed = 0;

        instanceRows.forEach((r: any[]) => {
            if (r[1] === deviceId) {
                if (excludeInstanceId && r[0] === excludeInstanceId) return;
                currentUsed += parseInt(r[4] || '1');
            }
        });

        if (currentUsed + addQty > totalQty) {
            return {
                valid: false,
                error: `수량 초과! 전체 ${totalQty}개 중 현재 ${currentUsed}개가 배치되어 있습니다. (남은 수량: ${Math.max(0, totalQty - currentUsed)})`
            };
        }
        return { valid: true };
    } catch (e) {
        return { valid: false, error: String(e) };
    }
}

export async function syncDeviceLocationString(deviceId: string, sheetId: string) {
    try {
        const instanceRows = await getData('DeviceInstances!A2:F', sheetId);
        let locationSummary = '';

        if (instanceRows) {
            const myInstances = instanceRows.filter((r: any[]) => r[1] === deviceId);
            if (myInstances.length > 0) {
                locationSummary = myInstances.map((r: any[]) => {
                    const locName = r[3];
                    const qty = parseInt(r[4] || '1');
                    return qty > 0 ? `${locName}(${qty})` : locName;
                }).join(', ');
            }
        }

        const deviceRows = await getData('Devices!A2:R', sheetId);
        if (!deviceRows) return;

        const deviceIndex = deviceRows.findIndex((r: any[]) => String(r[0]) === String(deviceId));
        if (deviceIndex === -1) return;

        const rowNumber = deviceIndex + 2;
        const currentDevice = deviceRows[deviceIndex];

        // Column 13 (N) is installLocation
        if (currentDevice[13] !== locationSummary) {
            const updatedRow = [...currentDevice];
            updatedRow[13] = locationSummary;
            await updateData(`Devices!A${rowNumber}`, [updatedRow], sheetId);
        }
    } catch (e) {
        console.error('Sync Location String Error:', e);
    }
}

export async function getDeviceInstances(deviceId: string) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.getDeviceInstances(appConfig.firebase, deviceId);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return [];

    try {
        const rows = await getData('DeviceInstances!A2:F', sheetId);
        if (!rows) return [];

        return rows
            .filter((r: any[]) => r[1] === deviceId)
            .map((r: any[]) => ({
                id: r[0],
                deviceId: r[1],
                locationId: r[2],
                locationName: r[3],
                quantity: parseInt(r[4] || '1'),
                notes: r[5] || ''
            }));
    } catch (e) {
        return [];
    }
}

export async function updateDeviceWithDistribution(
    deviceId: string,
    deviceUpdates: Partial<Device>,
    distributions: { locationId?: string, locationName: string, quantity: number }[]
) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.updateDeviceWithDistribution(appConfig.firebase, deviceId, deviceUpdates, distributions);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: 'No Sheet' };

    try {
        const deviceRows = await getData('Devices!A2:R', sheetId);
        if (!deviceRows) return { success: false, error: 'Device DB Error' };

        const deviceIndex = deviceRows.findIndex((r: any[]) => r[0] === deviceId);
        if (deviceIndex === -1) return { success: false, error: 'Device not found' };

        const currentDevice = deviceRows[deviceIndex];
        const updatedRow = [...currentDevice];

        if (deviceUpdates.category !== undefined) updatedRow[1] = deviceUpdates.category;
        if (deviceUpdates.model !== undefined) updatedRow[2] = deviceUpdates.model;
        if (deviceUpdates.ip !== undefined) updatedRow[3] = deviceUpdates.ip;
        if (deviceUpdates.status !== undefined) updatedRow[4] = deviceUpdates.status;
        if (deviceUpdates.purchaseDate !== undefined) updatedRow[5] = deviceUpdates.purchaseDate;
        if (deviceUpdates.groupId !== undefined) updatedRow[6] = deviceUpdates.groupId;
        if (deviceUpdates.name !== undefined) updatedRow[7] = deviceUpdates.name;
        if (deviceUpdates.acquisitionDivision !== undefined) updatedRow[8] = deviceUpdates.acquisitionDivision;
        if (deviceUpdates.quantity !== undefined) updatedRow[9] = deviceUpdates.quantity;
        if (deviceUpdates.unitPrice !== undefined) updatedRow[10] = deviceUpdates.unitPrice;
        if (deviceUpdates.totalAmount !== undefined) updatedRow[11] = deviceUpdates.totalAmount;
        if (deviceUpdates.serviceLifeChange !== undefined) updatedRow[12] = deviceUpdates.serviceLifeChange;
        if (deviceUpdates.osVersion !== undefined) updatedRow[14] = deviceUpdates.osVersion;
        if (deviceUpdates.windowsPassword !== undefined) updatedRow[15] = deviceUpdates.windowsPassword;
        if (deviceUpdates.userName !== undefined) updatedRow[16] = deviceUpdates.userName;
        if (deviceUpdates.pcName !== undefined) updatedRow[17] = deviceUpdates.pcName;

        await updateData(`Devices!A${deviceIndex + 2}`, [updatedRow], sheetId);

        const instanceRows = await getData('DeviceInstances!A2:F', sheetId);
        const mapConfig = await fetchMapConfiguration(sheetId);

        let otherInstances: any[][] = [];
        if (instanceRows) {
            otherInstances = instanceRows.filter((r: any[]) => r[1] !== deviceId);
        }

        const newInstanceRows = distributions.map(dist => {
            let zone = null;
            if (dist.locationId && dist.locationId !== 'TEXT_ONLY') {
                zone = mapConfig.zones.find((z: Location) => z.id === dist.locationId);
            }
            if (!zone) {
                zone = mapConfig.zones.find((z: Location) => (z.name || '').trim() === (dist.locationName || '').trim());
            }
            return [
                `inst-${Math.random().toString(36).substr(2, 9)}`,
                deviceId,
                zone ? zone.id : 'TEXT_ONLY',
                dist.locationName,
                dist.quantity,
                'Distributed from Modal'
            ];
        });

        await clearData('DeviceInstances!A2:F', sheetId);

        const allInstances = [...otherInstances, ...newInstanceRows];
        if (allInstances.length > 0) {
            await updateData('DeviceInstances!A2', allInstances, sheetId);
        }

        await syncDeviceLocationString(deviceId, sheetId);

        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: String(e) };
    }
}

// --- Loan Management ---

export interface LoanRecord {
    id: string;
    deviceId: string;
    deviceName: string;
    userId: string;
    userName: string;
    loanDate: string;
    dueDate: string;
    returnDate?: string;
    status: 'Active' | 'Returned' | 'Overdue';
    notes?: string;
}

export async function getLoans(): Promise<LoanRecord[]> {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return (await fbActions.fetchLoans(appConfig.firebase)) as LoanRecord[];
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return [];

    try {
        const rows = await getData('Loans!A2:J', sheetId);
        if (!rows) return [];

        const today = new Date().toISOString().split('T')[0];
        return rows.map((r: any[]) => {
            let status = r[8] as string;
            // #20: Auto-detect overdue loans
            if (status === 'Active' && r[6] && r[6] < today) {
                status = 'Overdue';
            }
            return {
                id: r[0],
                deviceId: r[1],
                deviceName: r[2],
                userId: r[3],
                userName: r[4],
                loanDate: r[5],
                dueDate: r[6],
                returnDate: r[7] || undefined,
                status: status as any,
                notes: r[9] || ''
            };
        });
    } catch (e) {
        return [];
    }
}

export async function createLoan(deviceId: string, userId: string, userName: string, dueDate: string, notes: string = '') {
    // Session verification
    try { await requireSession(); } catch { return createActionError('AUTH_REQUIRED', '로그인이 필요합니다.'); }

    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.createLoanToDB(appConfig.firebase, deviceId, userId, userName, dueDate, notes);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '시트가 없습니다.' };

    try {
        let deviceRows = await getData('Devices!A2:R', sheetId);
        if (!deviceRows) {
            // Retry once
            await new Promise(r => setTimeout(r, 1000));
            deviceRows = await getData('Devices!A2:R', sheetId);
        }
        if (!deviceRows) return { success: false, error: 'Device DB Error (기기 목록 호출 실패 - 데이터 없음)' };

        // Check & Create Loans Sheet if missing
        const loanCheck = await getData('Loans!A1', sheetId);
        if (!loanCheck) {
            await addSheet('Loans', sheetId);
            await updateData('Loans!A1', [['ID', 'DeviceID', 'DeviceName', 'UserID', 'UserName', 'LoanDate', 'DueDate', 'ReturnDate', 'Status', 'Notes']], sheetId);
        }

        const deviceIndex = deviceRows.findIndex((r: any[]) => r[0] === deviceId);
        if (deviceIndex === -1) return { success: false, error: '기기를 찾을 수 없습니다.' };

        const device = deviceRows[deviceIndex];
        if (device[4] === '고장/폐기' || device[4] === '분실' || device[4] === '대여중') {
            return { success: false, error: `기기가 대여 가능한 상태가 아닙니다. (현재 상태: ${device[4]})` };
        }

        const updatedRow = [...device];
        updatedRow[4] = '대여중';

        // Update user info in device table (optional but good for sync)
        updatedRow[16] = userName;

        await updateData(`Devices!A${deviceIndex + 2}`, [updatedRow], sheetId);

        const loanId = `loan-${Date.now()}`;
        const loanDate = new Date().toISOString().split('T')[0];
        const newLoanRow = [
            loanId,
            deviceId,
            device[7], // Name
            userId,
            userName,
            loanDate,
            dueDate,
            '',
            'Active',
            notes
        ];

        await appendData('Loans!A1', [newLoanRow], sheetId);

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function returnLoan(loanId: string, returnCondition: string = 'Good') {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.returnLoanInDB(appConfig.firebase, loanId, returnCondition);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false };

    try {
        const loanRows = await getData('Loans!A2:J', sheetId);
        if (!loanRows) return { success: false, error: 'Loan DB Error' };

        const loanIndex = loanRows.findIndex((r: any[]) => r[0] === loanId);
        if (loanIndex === -1) return { success: false, error: '대여 기록을 찾을 수 없습니다.' };

        const loan = loanRows[loanIndex];
        const deviceId = loan[1];

        const updatedLoan = [...loan];
        updatedLoan[7] = new Date().toISOString().split('T')[0];
        updatedLoan[8] = 'Returned';

        await updateData(`Loans!A${loanIndex + 2}`, [updatedLoan], sheetId);

        const deviceRows = await getData('Devices!A2:R', sheetId);
        if (deviceRows) {
            const deviceIndex = deviceRows.findIndex((r: any[]) => r[0] === deviceId);

            if (deviceIndex !== -1) {
                const device = deviceRows[deviceIndex];
                const updatedDevice = [...device];
                updatedDevice[4] = returnCondition === 'Broken' ? '수리/점검' : '사용 가능';
                updatedDevice[16] = ''; // Clear User Name

                await updateData(`Devices!A${deviceIndex + 2}`, [updatedDevice], sheetId);
            }
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- User Management ---

export async function changePassword(current: string, newPass: string) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) return { success: false, error: '로그인이 필요합니다.' };

    const email = session.user.email;
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '연결된 시트가 없습니다.' };

    try {
        let rows = await getData('Users!A:E', sheetId);

        // If Users sheet doesn't exist, create it
        if (!rows) {
            await addSheet('Users', sheetId);
            await updateData('Users!A1', [['ID', 'Name', 'Email', 'Password', 'Role']], sheetId);
            rows = [];
        }

        const userIndex = rows.findIndex((r: any[]) => r[2] === email);

        if (userIndex === -1) {
            // User not found. If current password matches '1234' (Default Admin), create user.
            if (current === '1234') {
                const newUser = [
                    'User-' + Date.now(),
                    'Admin User',
                    email,
                    newPass,
                    'admin'
                ];
                await appendData('Users!A1', [newUser], sheetId);
                return { success: true };
            }
            return { success: false, error: '사용자를 찾을 수 없습니다.' };
        }

        const userRow = rows[userIndex];

        // Check current password (Index 3)
        if (userRow[3] !== current) {
            return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
        }

        const updatedRow = [...userRow];
        updatedRow[3] = newPass;

        // Row number is index + 1
        await updateData(`Users!A${userIndex + 1}`, [updatedRow], sheetId);

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Zone & Device Status Management ---

export async function setDevicesStatus(deviceIds: string[], status: string) {
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '시트가 없습니다.' };

    try {
        const rows = await getData('Devices!A2:R', sheetId);
        if (!rows) return { success: false, error: 'Devices not found' };

        const updates: { range: string, values: any[][] }[] = [];

        rows.forEach((row: any[], idx: number) => {
            // row[0] is ID
            if (deviceIds.includes(row[0])) {
                const newRow = [...row];
                newRow[4] = status; // Status Column (E, Index 4)
                updates.push({ range: `Devices!A${idx + 2}`, values: [newRow] });
            }
        });

        for (const up of updates) {
            await updateData(up.range, up.values, sheetId);
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function updateZoneName(zoneId: string, oldName: string, newName: string) {
    // 0. Check Firebase Mode
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.updateZoneName(appConfig.firebase, zoneId, oldName, newName);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '시트가 없습니다.' };

    try {
        // 1. Update Locations Sheet (Custom Name)
        let locRows = null;
        try { locRows = await getData('Locations!A:C', sheetId); } catch (e) { }

        if (locRows) {
            const rowIndex = locRows.findIndex((r: any[]) => r[0] === zoneId);
            if (rowIndex !== -1) {
                const updatedRow = [...locRows[rowIndex]];
                updatedRow[2] = newName;
                await updateData(`Locations!A${rowIndex + 1}`, [updatedRow], sheetId);
            } else {
                await appendData('Locations!A1', [[zoneId, oldName, newName]], sheetId);
            }
        } else {
            // Create Sheet if missing
            await addSheet('Locations', sheetId);
            await updateData('Locations!A1', [['Zone ID', 'Auto Name', 'Custom Name'], [zoneId, oldName, newName]], sheetId);
        }

        // 2. Update DeviceInstances Sheet (Location Name) & collect data for Devices update
        let cachedInstRows: any[][] | null = null;
        try {
            cachedInstRows = await getData('DeviceInstances!A2:F', sheetId);
            if (cachedInstRows) {
                const updates: { range: string, values: any[][] }[] = [];
                cachedInstRows.forEach((row: any[], idx: number) => {
                    if (row[2] === zoneId || (oldName && row[3] === oldName)) {
                        const newRow = [...row];
                        newRow[3] = newName;
                        updates.push({ range: `DeviceInstances!A${idx + 2}`, values: [newRow] });
                    }
                });
                for (const up of updates) {
                    await updateData(up.range, up.values, sheetId);
                }
            }
        } catch (e) { console.log('Instance update skipped', e); }

        // 3. Update Devices Sheet (Install Location) - Reuses cachedInstRows (#17 optimization)
        try {
            const devRows = await getData('Devices!A2:R', sheetId);

            if (devRows) {
                const devUpdates: { range: string, values: any[][] }[] = [];

                // Find devices currently in this zone (via DeviceInstances)
                const deviceIdsInZone = new Set<string>();
                if (cachedInstRows) {
                    cachedInstRows.forEach((r: any[]) => {
                        if (r[2] === zoneId) deviceIdsInZone.add(r[1]); // r[1] is DeviceID
                    });
                }

                devRows.forEach((row: any[], idx: number) => {
                    const devId = row[0];
                    const currentLocName = row[13];
                    const currentGroupId = row[6];

                    // Criteria: 
                    // 1. Device ID is in the affected zone (via Instances)
                    // 2. Install Location matches oldName (Legacy/Exact string match)
                    // 3. GroupID matches zoneId (Direct link)
                    if (
                        deviceIdsInZone.has(devId) ||
                        currentGroupId === zoneId ||
                        (oldName && currentLocName === oldName)
                    ) {
                        const newRow = [...row];
                        newRow[13] = newName; // Update Install Location Name column
                        devUpdates.push({ range: `Devices!A${idx + 2}`, values: [newRow] });
                    }
                });

                for (const up of devUpdates) {
                    await updateData(up.range, up.values, sheetId);
                }
            }
        } catch (e) { console.log('Device update skipped', e); }

        // 4. Update MapZones JSON in Config Sheet
        try {
            const configRows = await getData('Config!A1:B2000', sheetId);
            if (configRows) {
                const zoneRowIdx = configRows.findIndex((r: any[]) => r[0] === 'MapZones');
                if (zoneRowIdx !== -1 && configRows[zoneRowIdx][1]) {
                    const zonesJson: any[] = JSON.parse(configRows[zoneRowIdx][1]);
                    const updatedZones = zonesJson.map((z: any) => {
                        if (z.id === zoneId) return { ...z, name: newName };
                        return z;
                    });
                    await updateData(`Config!A${zoneRowIdx + 1}`, [['MapZones', JSON.stringify(updatedZones)]], sheetId);
                }
            }
        } catch (e) { console.log('MapZones JSON update skipped', e); }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function getServerType() {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase') {
        return 'firebase';
    }
    return 'google-sheets';
}

export async function deleteMyAccount() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) return { success: false, error: '로그인이 필요합니다.' };

    const email = session.user.email;
    const appConfig = await _getAppConfig();

    // Firebase mode
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.deleteEntireUserData(appConfig.firebase, email);
    }

    // Google Sheets mode
    const sheetId = await getUserSheetId();

    try {
        // 1. Clear all data in user's spreadsheet
        if (sheetId && sheetId !== 'NO_SHEET') {
            const sheetsToClean = ['Devices', 'DeviceInstances', 'Software', 'Accounts', 'Config', 'Locations', 'Credentials', 'Loans', 'SystemConfig'];
            for (const sheet of sheetsToClean) {
                try { await clearData(`${sheet}!A2:Z`, sheetId); } catch (e) { /* sheet may not exist */ }
            }
        }

        // 2. Remove user from master Users sheet
        const masterRows = await getData('Users!A:F');
        if (masterRows) {
            const idx = masterRows.findIndex((r: any[]) => r[2] === email);
            if (idx >= 0) {
                // Clear the user row in master sheet
                const emptyRow = masterRows[idx].map(() => '');
                await updateData(`Users!A${idx + 1}`, [emptyRow]);
            }
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Backup & Restore (Cross-platform) ---

export async function exportAllData() {
    const appConfig = await _getAppConfig();
    const serverType = appConfig?.dbType === 'firebase' ? 'firebase' : 'google-sheets';

    try {
        // Fetch all data using existing unified functions
        const assetData: any = await fetchAssetData();
        const mapConfig: any = await fetchMapConfiguration();
        const systemConfig = await fetchSystemConfig();
        const loans = await getLoans();
        const softwareList = await getSoftwareList();
        const accountList = await getAccountList();

        return {
            success: true,
            backup: {
                exportDate: new Date().toISOString(),
                sourceType: serverType,
                version: '1.0',
                data: {
                    devices: assetData.devices || [],
                    deviceInstances: assetData.deviceInstances || [],
                    software: softwareList || [],
                    credentials: accountList || [],
                    loans: loans || [],
                    locations: mapConfig.zones || [],
                    systemConfig: systemConfig || {},
                    mapImage: mapConfig.mapImage || null
                }
            }
        };
    } catch (e) {
        console.error('Export Error:', e);
        return { success: false, error: String(e) };
    }
}

export async function importAllData(backup: any) {
    if (!backup || !backup.data) {
        return { success: false, error: '유효하지 않은 백업 파일입니다.' };
    }

    const appConfig = await _getAppConfig();

    // Session verification for destructive import operation
    try { await requireSession(); } catch { return createActionError('AUTH_REQUIRED', '로그인이 필요합니다.'); }

    const importData = backup.data;

    try {
        // Firebase mode
        if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
            // Clear existing data only (preserve User account)
            await fbActions.clearAllCollectionData(appConfig.firebase);

            // Import all data
            return await fbActions.importBulkData(appConfig.firebase, {
                devices: importData.devices || [],
                deviceInstances: importData.deviceInstances || [],
                software: importData.software || [],
                credentials: importData.credentials || [],
                loans: importData.loans || [],
                locations: importData.locations || [],
                systemConfig: importData.systemConfig || {}
            });
        }

        // Google Sheets mode
        const sheetId = await getUserSheetId();
        if (!sheetId || sheetId === 'NO_SHEET') {
            return { success: false, error: '시트 ID를 찾을 수 없습니다.' };
        }

        // 1. Clear existing data
        const sheetsToClear = ['Devices', 'DeviceInstances', 'Software', 'Credentials', 'Loans', 'Locations', 'Config', 'SystemConfig'];
        for (const sheet of sheetsToClear) {
            try { await clearData(`${sheet}!A2:Z`, sheetId); } catch (e) { /* sheet may not exist */ }
        }

        // 2. Import Devices
        if (importData.devices?.length > 0) {
            const deviceRows = importData.devices.map((d: any) => [
                d.id || '', d.category || '', d.model || '', d.ip || '', d.status || '사용 가능',
                d.purchaseDate || '', d.groupId || '', d.name || '', d.acquisitionDivision || '',
                d.quantity || '', d.unitPrice || '', d.totalAmount || '', d.serviceLifeChange || '',
                d.installLocation || '', d.osVersion || '', d.windowsPassword || '',
                d.userName || '', d.pcName || ''
            ]);
            await appendData('Devices!A2', deviceRows, sheetId);
        }

        // 3. Import DeviceInstances
        if (importData.deviceInstances?.length > 0) {
            try { await addSheet('DeviceInstances', sheetId); } catch (e) { /* already exists */ }
            try { await updateData('DeviceInstances!A1', [['ID', 'DeviceID', 'LocationID', 'LocationName', 'Quantity', 'Notes']], sheetId); } catch (e) { }
            const instRows = importData.deviceInstances.map((i: any) => [
                i.id || '', i.deviceId || '', i.locationId || '', i.locationName || '',
                String(i.quantity || 0), i.notes || ''
            ]);
            await appendData('DeviceInstances!A2', instRows, sheetId);
        }

        // 4. Import Software
        if (importData.software?.length > 0) {
            try { await addSheet('Software', sheetId); } catch (e) { }
            try { await updateData('Software!A1', [['Name', 'LicenseKey', 'Quantity', 'ExpiryDate']], sheetId); } catch (e) { }
            const swRows = importData.software.map((s: any) => [
                s.name || '', s.licenseKey || '', String(s.quantity || 0), s.expiryDate || ''
            ]);
            await appendData('Software!A2', swRows, sheetId);
        }

        // 5. Import Credentials (Accounts)
        if (importData.credentials?.length > 0) {
            try { await addSheet('Credentials', sheetId); } catch (e) { }
            try { await updateData('Credentials!A1', [['ServiceName', 'AdminID', 'Contact', 'Note']], sheetId); } catch (e) { }
            const credRows = importData.credentials.map((c: any) => [
                c.serviceName || '', c.adminId || '', c.contact || '', c.note || ''
            ]);
            await appendData('Credentials!A2', credRows, sheetId);
        }

        // 6. Import Loans
        if (importData.loans?.length > 0) {
            try { await addSheet('Loans', sheetId); } catch (e) { }
            try { await updateData('Loans!A1', [['ID', 'DeviceID', 'DeviceName', 'UserID', 'UserName', 'LoanDate', 'DueDate', 'ReturnDate', 'Status', 'Notes']], sheetId); } catch (e) { }
            const loanRows = importData.loans.map((l: any) => [
                l.id || '', l.deviceId || '', l.deviceName || '', l.userId || '', l.userName || '',
                l.loanDate || '', l.dueDate || '', l.returnDate || '', l.status || '', l.notes || ''
            ]);
            await appendData('Loans!A2', loanRows, sheetId);
        }

        // 7. Import Locations
        if (importData.locations?.length > 0) {
            try { await addSheet('Locations', sheetId); } catch (e) { }
            try { await updateData('Locations!A1', [['Zone ID', 'Auto Name', 'Custom Name']], sheetId); } catch (e) { }
            const locRows = importData.locations.map((loc: any) => [
                loc.id || '', loc.name || '', loc.name || ''  // Use name for both Auto Name and Custom Name
            ]);
            await appendData('Locations!A2', locRows, sheetId);
        }

        // 8. Import SystemConfig (except MapImage chunks)
        if (importData.systemConfig) {
            try { await addSheet('SystemConfig', sheetId); } catch (e) { }
            try { await updateData('SystemConfig!A1', [['Key', 'Value']], sheetId); } catch (e) { }
            const configRows: string[][] = [];
            for (const [key, value] of Object.entries(importData.systemConfig)) {
                if (key && !key.startsWith('MapImage')) {
                    configRows.push([key, String(value)]);
                }
            }
            if (configRows.length > 0) {
                await updateData('SystemConfig!A2', configRows, sheetId);
            }
        }

        // 9. Import MapImage (#24)
        if (importData.mapImage) {
            try {
                await saveMapConfiguration(importData.mapImage, importData.locations || []);
            } catch (e) {
                console.warn('MapImage import warning:', e);
            }
        }

        return { success: true };
    } catch (e) {
        console.error('Import Error:', e);
        return { success: false, error: String(e) };
    }
}

/**
 * Batch Update Zone Names for High Performance
 */
export async function batchUpdateZoneNames(changes: { zoneId: string, oldName: string, newName: string }[]) {
    if (changes.length === 0) return { success: true };

    console.log(`[BatchUpdate] Processing ${changes.length} name changes...`);
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.batchUpdateZoneNames(appConfig.firebase, changes);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '시트가 없습니다.' };

    try {
        // 1. Prepare Batch Updates for Locations
        let locRows = null;
        try { locRows = await getData('Locations!A:C', sheetId); } catch (e) { }

        const locUpdates: { range: string, values: any[][] }[] = [];
        if (locRows) {
            changes.forEach(change => {
                const rowIndex = locRows.findIndex((r: any[]) => r[0] === change.zoneId);
                if (rowIndex !== -1) {
                    const updatedRow = [...locRows[rowIndex]];
                    updatedRow[2] = change.newName;
                    locUpdates.push({ range: `Locations!A${rowIndex + 1}`, values: [updatedRow] });
                }
            });
        }

        // 2. Prepare Batch Updates for DeviceInstances & Devices
        const instanceUpdates: { range: string, values: any[][] }[] = [];
        const deviceUpdates: { range: string, values: any[][] }[] = [];

        try {
            const instRows = await getData('DeviceInstances!A2:F', sheetId);
            const devRows = await getData('Devices!A2:R', sheetId);

            if (instRows) {
                instRows.forEach((row: any[], idx: number) => {
                    const change = changes.find(c => c.zoneId === row[2] || (c.oldName && row[3] === c.oldName));
                    if (change) {
                        const newRow = [...row];
                        newRow[3] = change.newName;
                        instanceUpdates.push({ range: `DeviceInstances!A${idx + 2}`, values: [newRow] });
                    }
                });
            }

            if (devRows && instRows) {
                devRows.forEach((row: any[], idx: number) => {
                    const devId = row[0];
                    const zoneIdOfDevice = instRows.find(ir => ir[1] === devId)?.[2];
                    const change = changes.find(c => c.zoneId === zoneIdOfDevice || c.zoneId === row[6] || (c.oldName && row[13] === c.oldName));

                    if (change) {
                        const newRow = [...row];
                        newRow[13] = change.newName;
                        deviceUpdates.push({ range: `Devices!A${idx + 2}`, values: [newRow] });
                    }
                });
            }
        } catch (e) { console.warn('Bulk name update sync skipped some steps:', e); }

        // 3. Execute all updates in one batch call
        const finalBatch = [...locUpdates, ...instanceUpdates, ...deviceUpdates];
        if (finalBatch.length > 0) {
            await batchUpdateData(finalBatch, sheetId);
        }

        return { success: true };
    } catch (e) {
        console.error('Batch update failed:', e);
        return { success: false, error: String(e) };
    }
}

