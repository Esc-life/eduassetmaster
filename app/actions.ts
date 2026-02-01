'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getData, updateData, appendData, addSheet, clearData } from '@/lib/google-sheets';
import { MOCK_DEVICES, MOCK_SOFTWARE, MOCK_CREDENTIALS } from '@/lib/mock-data';
import { Device, Software, Credential, Location } from '@/types';
// PDF parsing removed due to Vercel serverless environment incompatibility

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

export async function fetchAssetData() {
    try {
        const sheetId = await getUserSheetId();

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

            return { devices, software, credentials };

        } catch (error) {
            console.error('[fetchAssetData] Error:', error);
            return { devices: [], software: [], credentials: [] };
        }
    } catch (outerError) {
        console.error('[fetchAssetData] Critical error:', outerError);
        return { devices: [], software: [], credentials: [] };
    }
}

export async function fetchMapConfiguration() {
    const sheetId = await getUserSheetId();

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
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
    if (isGlobalMockMode && !sheetId) return { success: true };

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
            d.status || 'Active',
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
export async function updateDevice(deviceId: string, updates: Partial<Device>) {
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        const rows = await getData('Devices!A2:R', sheetId);
        if (!rows) return { success: false, error: 'No devices found' };

        const deviceIndex = rows.findIndex((row: any[]) => row[0] === deviceId);
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

        await updateData(`Devices!A${rowNumber}:R${rowNumber}`, [updatedRow], sheetId);
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
    const sheetId = await getUserSheetId();
    if (sheetId === 'NO_SHEET') return { success: false, error: '?ㅽ봽?덈뱶?쒗듃媛 ?곕룞?섏? ?딆븯?듬땲??' };
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
