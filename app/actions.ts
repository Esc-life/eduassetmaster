'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getData, updateData, appendData, addSheet, clearData } from '@/lib/google-sheets';
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


export async function parsePdfAction(formData: FormData): Promise<{ success: boolean; text?: string; error?: string }> {
    // PDF parsing disabled on server due to Vercel compatibility issues
    return {
        success: false,
        error: 'PDF parsing is not available in the current deployment. Please use manual entry.'
    };
}

// Helper to check if we are in Mock Mode 
const isGlobalMockMode = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

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
        return {
            devices: (fbData.devices || []) as Device[],
            software: [] as Software[],
            credentials: [] as Credential[],
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

export async function fetchMapConfiguration(overrideSheetId?: string) {
    const appConfig = await _getAppConfig();

    // Firebase Branch
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.fetchMapConfiguration(appConfig.firebase);
    }

    const sheetId = overrideSheetId || appConfig?.sheet?.spreadsheetId || await getUserSheetId();

    if (sheetId === 'NO_SHEET') return { mapImage: null, zones: [] };
    if (isGlobalMockMode && !sheetId) return { mapImage: null, zones: [] };

    try {
        const rows = await getData('Config!A1:B2000', sheetId);
        if (!rows || rows.length === 0) return { mapImage: null, zones: [] };

        const configMap = new Map<string, string>();

        rows.forEach((row: any[]) => {
            if (row[0]) configMap.set(row[0], row[1]);
        });

        // Reconstruct MapImage
        let mapImage = '';
        const chunkKeys = Array.from(configMap.keys()).filter(k => k.startsWith('MapImage_'));

        if (chunkKeys.length > 0) {
            chunkKeys.sort((a, b) => {
                const idxA = parseInt(a.replace('MapImage_', '') || '0', 10);
                const idxB = parseInt(b.replace('MapImage_', '') || '0', 10);
                return idxA - idxB;
            });
            for (const key of chunkKeys) {
                mapImage += configMap.get(key) || '';
            }
        }
        if (!mapImage && configMap.has('MapImage')) {
            mapImage = configMap.get('MapImage') || '';
        }

        const zonesJson = configMap.get('MapZones');
        let zones: Location[] = zonesJson ? JSON.parse(zonesJson) : [];

        // Merge with Locations sheet
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

        return { mapImage: mapImage || null, zones };
    } catch (error) {
        // If sheet doesn't exist (Config tab missing), return empty
        return { mapImage: null, zones: [] };
    }
}

export async function saveMapConfiguration(mapImage: string | null, zones: Location[]) {
    const appConfig = await _getAppConfig();

    // Firebase Branch
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return fbActions.saveMapConfiguration(appConfig.firebase, mapImage, zones);
    }

    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃 ID媛 ?ㅼ젙?섏? ?딆븯?듬땲??' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let configRows = await getData('Config!A1', sheetId);
        if (configRows === null) {
            await addSheet('Config', sheetId);
        }

        const values = [
            ['Key', 'Value'],
            ['MapZones', JSON.stringify(zones)],
            ['LastUpdated', new Date().toISOString()]
        ];

        if (mapImage) {
            const CHUNK_SIZE = 40000;
            const totalChunks = Math.ceil(mapImage.length / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const chunk = mapImage.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                values.push([`MapImage_${i}`, chunk]);
            }
        } else {
            values.push(['MapImage_0', '']);
        }

        await updateData('Config!A1', values, sheetId);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save map config:', error);
        const errorMessage = error?.result?.error?.message || error?.message || String(error);
        return { success: false, error: errorMessage };
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
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃 ID媛 ?놁뒿?덈떎.' };
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
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
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
            const customName = existingMap.get(z.id) || '';
            values.push([z.id, z.name, customName]);
        });

        await updateData('Locations!A1', values, sheetId);
        return { success: true };
    } catch (error) {
        return { success: false, error };
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
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
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
                    const targetZone = mapConfig.zones.find((z: Location) => z.name === updates.installLocation);

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
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
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
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
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
        // 1. Google Vision API Call
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: imageBase64 },
                    features: [{ type: 'TEXT_DETECTION' }]
                }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            return { success: false, error: err.error?.message || 'Vision API call failed' };
        }

        const data = await response.json();
        const fullText = data.responses[0]?.fullTextAnnotation?.text || '';

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
    distributions: { locationName: string, quantity: number }[]
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
            const zone = mapConfig.zones.find((z: Location) => z.name === dist.locationName);
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

export async function getLoans() {
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return [];

    try {
        const rows = await getData('Loans!A2:J', sheetId);
        if (!rows) return [];

        return rows.map((r: any[]) => ({
            id: r[0],
            deviceId: r[1],
            deviceName: r[2],
            userId: r[3],
            userName: r[4],
            loanDate: r[5],
            dueDate: r[6],
            returnDate: r[7] || undefined,
            status: r[8] as any,
            notes: r[9] || ''
        }));
    } catch (e) {
        return [];
    }
}

export async function createLoan(deviceId: string, userId: string, userName: string, dueDate: string, notes: string = '') {
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '시트가 없습니다.' };

    try {
        const deviceRows = await getData('Devices!A2:R', sheetId);
        if (!deviceRows) return { success: false, error: 'Device DB Error' };

        const deviceIndex = deviceRows.findIndex((r: any[]) => r[0] === deviceId);
        if (deviceIndex === -1) return { success: false, error: '기기를 찾을 수 없습니다.' };

        const device = deviceRows[deviceIndex];
        if (device[4] !== '사용 가능') {
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
                updatedDevice[4] = returnCondition === 'Broken' ? '수리 필요' : '사용 가능';
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

        // 2. Update DeviceInstances Sheet (Location Name)
        try {
            const instRows = await getData('DeviceInstances!A2:F', sheetId);
            if (instRows) {
                const updates: { range: string, values: any[][] }[] = [];
                instRows.forEach((row: any[], idx: number) => {
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

        // 3. Update Devices Sheet (Install Location) - Enhanced Logic
        try {
            const devRows = await getData('Devices!A2:R', sheetId);
            const instRows = await getData('DeviceInstances!A2:F', sheetId); // Fetch instances for cross-check

            if (devRows) {
                const devUpdates: { range: string, values: any[][] }[] = [];

                // Find devices currently in this zone (via DeviceInstances)
                const deviceIdsInZone = new Set<string>();
                if (instRows) {
                    instRows.forEach((r: any[]) => {
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

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}
