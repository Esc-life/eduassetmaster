'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getData, updateData, appendData, addSheet } from '@/lib/google-sheets';
import { MOCK_DEVICES, MOCK_SOFTWARE, MOCK_CREDENTIALS } from '@/lib/mock-data';
import { Device, Software, Credential, Location } from '@/types';

// Helper to check if we are in Mock Mode 
// (Mock only if Creds Missing AND User has no personal sheet)
const isGlobalMockMode = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

async function getUserSheetId() {
    const session = await getServerSession(authOptions);
    return (session?.user as any)?.spreadsheetId || undefined;
}

export async function fetchAssetData() {
    const sheetId = await getUserSheetId();

    // Fallback to Mock if no sheet available at all
    if (isGlobalMockMode && !sheetId) {
        console.log('Serving Mock Asset Data (No Creds/Sheet)...');
        return {
            devices: MOCK_DEVICES,
            software: MOCK_SOFTWARE,
            credentials: MOCK_CREDENTIALS,
        };
    }

    try {
        const deviceRows = await getData('Devices!A2:H', sheetId);
        const devices: Device[] = (deviceRows || []).map((row) => ({
            id: row[0],
            category: row[1] as any,
            model: row[2],
            ip: row[3],
            status: row[4] as any,
            purchaseDate: row[5],
            groupId: row[6],
            name: row[7],
        }));

        const swRows = await getData('Software!A2:D', sheetId);
        const software: Software[] = (swRows || []).map((row) => ({
            name: row[0],
            licenseKey: row[1],
            quantity: parseInt(row[2] || '0'),
            expiryDate: row[3],
        }));

        const credRows = await getData('Credentials!A2:D', sheetId);
        const credentials: Credential[] = (credRows || []).map((row) => ({
            serviceName: row[0],
            adminId: row[1],
            contact: row[2],
            note: row[3],
        }));

        return { devices, software, credentials };

    } catch (error) {
        console.error('Fetch Error:', error);
        return {
            devices: MOCK_DEVICES,
            software: MOCK_SOFTWARE,
            credentials: MOCK_CREDENTIALS,
        };
    }
}

export async function fetchMapConfiguration() {
    const sheetId = await getUserSheetId();
    if (isGlobalMockMode && !sheetId) return { mapImage: null, zones: [] };

    try {
        console.log(`[fetchMapConfiguration] Using SheetID: ${sheetId || 'Default Env'}`);
        const rows = await getData('Config!A1:B2000', sheetId);

        if (!rows || rows.length === 0) return { mapImage: null, zones: [] };

        const configMap = new Map<string, string>();
        rows.forEach(row => {
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
                locRows.forEach(row => {
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
        console.error('Fetch Map Error:', error);
        return { mapImage: null, zones: [] };
    }
}

export async function saveMapConfiguration(mapImage: string | null, zones: Location[]) {
    const sheetId = await getUserSheetId();
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
    if (isGlobalMockMode && !sheetId) return [];

    try {
        const rows = await getData('Software!A2:H', sheetId);
        const safeRows = rows || [];
        return safeRows.map(row => ({
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
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let rows = await getData('Software!A:A', sheetId);

        if (rows === null) {
            await addSheet('Software', sheetId);
            await updateData('Software!A1', [['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes']], sheetId);
            rows = [];
        }

        const rowIndex = rows.findIndex(r => r[0] === item.id);

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
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        const rows = await getData('Software!A:A', sheetId);
        if (!rows) return { success: false, error: 'Sheet not found' };

        const rowIndex = rows.findIndex(r => r[0] === id);
        if (rowIndex >= 0) {
            const allRows = await getData('Software!A:H', sheetId) || [];
            const newRows = allRows.filter(r => r[0] !== id);
            // Note: This rewrite approach is simple but expensive for large data.
            await updateData('Software!A1', [['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes'], ...newRows.slice(1)], sheetId);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

// --- Account Management ---

export async function getAccountList() {
    const sheetId = await getUserSheetId();
    if (isGlobalMockMode && !sheetId) return [];

    try {
        const rows = await getData('Accounts!A2:G', sheetId);
        const safeRows = rows || [];
        return safeRows.map(row => ({
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
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        let rows = await getData('Accounts!A:A', sheetId);

        if (rows === null) {
            await addSheet('Accounts', sheetId);
            await updateData('Accounts!A1', [['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes']], sheetId);
            rows = [];
        }

        const rowIndex = rows.findIndex(r => r[0] === item.id);

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
    if (isGlobalMockMode && !sheetId) return { success: true };

    try {
        const allRows = await getData('Accounts!A:G', sheetId);
        if (!allRows) return { success: false, error: 'Sheet not found' };

        const newRows = allRows.filter(r => r[0] !== id);
        await updateData('Accounts!A1', newRows.length > 0 ? newRows : [['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes']], sheetId);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function syncZonesToSheet(zones: Location[]) {
    const sheetId = await getUserSheetId();
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
            rows.forEach(row => {
                if (row[0] && row[2]) existingMap.set(row[0], row[2]);
            });
        }

        const values = [
            ['Zone ID', 'Auto Name', 'Custom Name (Edit Here)'],
        ];

        zones.forEach(z => {
            const customName = existingMap.get(z.id) || '';
            values.push([z.id, z.name, customName]);
        });

        await updateData('Locations!A1', values, sheetId);
        return { success: true };
    } catch (error) {
        console.error('Failed to sync zones:', error);
        return { success: false, error };
    }
}
