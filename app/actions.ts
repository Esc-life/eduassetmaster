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
    if (sheetId === 'NO_SHEET') return { success: false, error: '스프레드시트가 연동되지 않았습니다.' };
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

// --- Gemini Vision: Floor Plan Zone Name Recognition ---
export async function recognizeZoneNamesWithAI(imageBase64: string, zones: { id: string, pinX: number, pinY: number, width?: number, height?: number, name: string }[]) {
    const config = await fetchSystemConfig();
    const apiKey = config['GOOGLE_VISION_KEY'] || process.env.GOOGLE_VISION_KEY;

    if (!apiKey) {
        return { success: false, error: 'API Key가 설정되지 않았습니다.', zones };
    }

    try {
        // Build zone position descriptions for the prompt
        const zoneDescriptions = zones.map((z, i) =>
            `Zone ${i + 1}: 위치(x:${z.pinX.toFixed(1)}%, y:${z.pinY.toFixed(1)}%, w:${(z.width || 5).toFixed(1)}%, h:${(z.height || 5).toFixed(1)}%)`
        ).join('\n');

        const prompt = `이 건물 배치도(평면도) 이미지를 분석해주세요.

아래는 이미지에서 감지된 구역들의 위치 정보입니다 (이미지 좌상단 기준 백분율 좌표):
${zoneDescriptions}

각 구역 위치에 해당하는 교실/공간 이름을 읽어주세요.
반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
[{"index":0,"name":"교실이름"},{"index":1,"name":"교실이름"},...]

규칙:
- index는 0부터 시작합니다.
- 해당 위치에서 텍스트를 읽을 수 없으면 name을 빈 문자열로 설정하세요.
- 텍스트가 잘려있어도 추론할 수 있다면 추론해서 이름을 완성하세요.
- "1-1", "과학실", "교무실" 등 한국어 학교 구역명일 가능성이 높습니다.`;

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
            return { success: false, error: err.error?.message || 'Gemini API call failed', zones };
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response (Gemini may wrap in ```json ... ```)
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.warn('Gemini zone name response not parseable:', rawText);
            return { success: false, error: '응답을 파싱할 수 없습니다.', zones };
        }

        const parsed: { index: number, name: string }[] = JSON.parse(jsonMatch[0]);
        const updatedZones = zones.map((z, i) => {
            const match = parsed.find(p => p.index === i);
            if (match && match.name && match.name.trim()) {
                return { ...z, name: match.name.trim() };
            }
            return z;
        });

        return { success: true, zones: updatedZones };
    } catch (e) {
        console.error('Gemini Zone Recognition Error:', e);
        return { success: false, error: String(e), zones };
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

export async function getLoans() {
    const appConfig = await _getAppConfig();
    if (appConfig?.dbType === 'firebase' && appConfig.firebase) {
        return await fbActions.fetchLoans(appConfig.firebase);
    }

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
            const sheetsToClean = ['Devices', 'DeviceInstances', 'Software', 'Accounts', 'Config', 'Locations', 'Credentials', 'Loans'];
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
        const sheetsToClear = ['Devices', 'DeviceInstances', 'Software', 'Credentials', 'Loans', 'Locations', 'Config'];
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
            try { await updateData('Locations!A1', [['ID', 'Name', 'Type']], sheetId); } catch (e) { }
            const locRows = importData.locations.map((loc: any) => [
                loc.id || '', loc.name || '', loc.type || 'Classroom'
            ]);
            await appendData('Locations!A2', locRows, sheetId);
        }

        // 8. Import SystemConfig (except MapImage chunks)
        if (importData.systemConfig) {
            try { await addSheet('Config', sheetId); } catch (e) { }
            const configRows: string[][] = [];
            for (const [key, value] of Object.entries(importData.systemConfig)) {
                if (key && !key.startsWith('MapImage')) {
                    configRows.push([key, String(value)]);
                }
            }
            if (configRows.length > 0) {
                await appendData('Config!A1', configRows, sheetId);
            }
        }

        return { success: true };
    } catch (e) {
        console.error('Import Error:', e);
        return { success: false, error: String(e) };
    }
}

