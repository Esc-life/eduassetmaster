'use server';

import { getData, updateData, appendData, addSheet } from '@/lib/google-sheets';
import { MOCK_DEVICES, MOCK_SOFTWARE, MOCK_CREDENTIALS } from '@/lib/mock-data';
import { Device, Software, Credential, Location } from '@/types';

// Helper to check if we are in Mock Mode (missing creds)
// Check both EMAIL and SPREADSHEET_ID to be safe
const isMockMode = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SPREADSHEET_ID;

export async function fetchAssetData() {
    if (isMockMode) {
        console.log('Serving Mock Asset Data...');
        return {
            devices: MOCK_DEVICES,
            software: MOCK_SOFTWARE,
            credentials: MOCK_CREDENTIALS,
        };
    }

    try {
        // 1. Fetch Devices
        const deviceRows = await getData('Devices!A2:H');
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

        // 2. Fetch Software
        const swRows = await getData('Software!A2:D');
        const software: Software[] = (swRows || []).map((row) => ({
            name: row[0],
            licenseKey: row[1],
            quantity: parseInt(row[2] || '0'),
            expiryDate: row[3],
        }));

        // 3. Fetch Credentials
        const credRows = await getData('Credentials!A2:D');
        const credentials: Credential[] = (credRows || []).map((row) => ({
            serviceName: row[0],
            adminId: row[1],
            contact: row[2],
            note: row[3],
        }));

        return { devices, software, credentials };

    } catch (error) {
        console.error('Failed to fetch asset data from Sheets:', error);
        return {
            devices: MOCK_DEVICES,
            software: MOCK_SOFTWARE,
            credentials: MOCK_CREDENTIALS,
        };
    }
}

export async function fetchMapConfiguration() {
    if (isMockMode) {
        return { mapImage: null, zones: [] };
    }

    try {
        console.log('[fetchMapConfiguration] Fetching Config from Sheets (A1:B2000)...');
        // Fetch specific large range instead of open-ended A:B to prevent issues
        const rows = await getData('Config!A1:B2000');
        console.log(`[fetchMapConfiguration] Got ${rows ? rows.length : 0} rows.`);

        if (!rows || rows.length === 0) return { mapImage: null, zones: [] };

        const configMap = new Map<string, string>();
        rows.forEach(row => {
            if (row[0]) configMap.set(row[0], row[1]);
        });

        // Reconstruct MapImage from chunks (Robust Method)
        let mapImage = '';
        const chunkKeys = Array.from(configMap.keys()).filter(k => k.startsWith('MapImage_'));

        if (chunkKeys.length > 0) {
            // Sort keys numerically: MapImage_0, MapImage_1 ... MapImage_10
            chunkKeys.sort((a, b) => {
                const idxA = parseInt(a.replace('MapImage_', '') || '0', 10);
                const idxB = parseInt(b.replace('MapImage_', '') || '0', 10);
                return idxA - idxB;
            });

            console.log(`[fetchMapConfiguration] Found ${chunkKeys.length} chunks. Merging...`);
            for (const key of chunkKeys) {
                mapImage += configMap.get(key) || '';
            }
        }

        // Fallback or Legacy (ONLY if no chunks found)
        if (!mapImage && configMap.has('MapImage')) {
            mapImage = configMap.get('MapImage') || '';
            console.log('[fetchMapConfiguration] Loaded from legacy single cell.');
        }

        console.log(`[fetchMapConfiguration] Final Image Length: ${mapImage.length}`);

        const zonesJson = configMap.get('MapZones');
        let zones: Location[] = zonesJson ? JSON.parse(zonesJson) : [];

        // 4. Merge with 'Locations' Sheet (Custom Names)
        try {
            // Locations sheet might not exist
            const locRows = await getData('Locations!A:C');
            if (locRows && locRows.length > 0) {
                // Expected: Col A (ID), Col B (Auto Name), Col C (Custom Name)
                const nameMap = new Map<string, string>();
                locRows.forEach(row => {
                    if (row[0] && row[2]) nameMap.set(row[0], row[2]); // ID -> CustomName
                });

                if (nameMap.size > 0) {
                    zones = zones.map(z => ({
                        ...z,
                        name: nameMap.get(z.id) || z.name
                    }));
                    console.log(`[fetchMapConfiguration] Applied custom names to ${nameMap.size} zones.`);
                }
            }
        } catch (e) {
            console.warn('[fetchMapConfiguration] Locations sheet missing or empty. Skipping name merge.');
        }

        return { mapImage: mapImage || null, zones };
    } catch (error) {
        console.error('Failed to fetch map config:', error);
        return { mapImage: null, zones: [] };
    }
}

export async function saveMapConfiguration(mapImage: string | null, zones: Location[]) {
    if (isMockMode) {
        return { success: true };
    }

    try {
        // Ensure Config sheet exists
        let configRows = await getData('Config!A1');
        if (configRows === null) {
            await addSheet('Config');
        }

        const values = [
            ['Key', 'Value'],
            ['MapZones', JSON.stringify(zones)],
            ['LastUpdated', new Date().toISOString()]
        ];

        // Handle Image Chunking
        if (mapImage) {
            const CHUNK_SIZE = 40000;
            const totalChunks = Math.ceil(mapImage.length / CHUNK_SIZE);
            console.log(`[saveMapConfiguration] Splitting image (${mapImage.length} chars) into ${totalChunks} chunks.`);

            for (let i = 0; i < totalChunks; i++) {
                const chunk = mapImage.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                values.push([`MapImage_${i}`, chunk]);
            }
        } else {
            values.push(['MapImage_0', '']);
        }

        // Write to Sheet
        await updateData('Config!A1', values);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save map config:', error);
        // Return clear error message string for client debugging
        const errorMessage = error?.result?.error?.message || error?.message || String(error);
        return { success: false, error: errorMessage };
    }
}

// --- Software Management ---

export async function getSoftwareList() {
    if (isMockMode) return [];
    try {
        const rows = await getData('Software!A2:H');
        // Handle null (missing sheet) safely
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
    if (isMockMode) return { success: true };
    try {
        let rows = await getData('Software!A:A');

        // If sheet missing, create it
        if (rows === null) {
            await addSheet('Software');
            // Write Header
            await updateData('Software!A1', [['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes']]);
            rows = []; // Empty start
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
            await updateData(`Software!A${rowIndex + 1}`, [rowData]);
        } else {
            await appendData('Software!A1', [rowData]);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function deleteSoftware(id: string) {
    if (isMockMode) return { success: true };
    try {
        const rows = await getData('Software!A:A');
        if (!rows) return { success: false, error: 'Sheet not found' };

        const rowIndex = rows.findIndex(r => r[0] === id);
        if (rowIndex >= 0) {
            const allRows = await getData('Software!A:H') || [];
            const newRows = allRows.filter(r => r[0] !== id);
            await updateData('Software!A1', [['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes'], ...newRows.slice(1)]);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

// --- Account Management ---

export async function getAccountList() {
    if (isMockMode) return [];
    try {
        const rows = await getData('Accounts!A2:G');
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
    if (isMockMode) return { success: true };
    try {
        let rows = await getData('Accounts!A:A');

        // If sheet missing, create it
        if (rows === null) {
            await addSheet('Accounts');
            await updateData('Accounts!A1', [['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes']]);
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
            await updateData(`Accounts!A${rowIndex + 1}`, [rowData]);
        } else {
            await appendData('Accounts!A1', [rowData]);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function deleteAccount(id: string) {
    if (isMockMode) return { success: true };
    try {
        const allRows = await getData('Accounts!A:G');
        if (!allRows) return { success: false, error: 'Sheet not found' };

        const newRows = allRows.filter(r => r[0] !== id);
        await updateData('Accounts!A1', newRows.length > 0 ? newRows : [['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes']]);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function syncZonesToSheet(zones: Location[]) {
    if (isMockMode) return { success: true };

    try {
        // 1. Get existing data to preserve Custom Names
        let existingMap = new Map<string, string>();
        let rows: any[][] | null = null;
        try {
            rows = await getData('Locations!A:C');
        } catch (e) { }

        if (rows === null) {
            await addSheet('Locations');
            rows = [];
        } else {
            rows.forEach(row => {
                if (row[0] && row[2]) existingMap.set(row[0], row[2]);
            });
        }

        // 2. Build new rows
        const values = [
            ['Zone ID', 'Auto Name', 'Custom Name (Edit Here)'], // Header
        ];

        zones.forEach(z => {
            const customName = existingMap.get(z.id) || '';
            values.push([z.id, z.name, customName]);
        });

        // 3. Write
        await updateData('Locations!A1', values);
        return { success: true };
    } catch (error) {
        console.error('Failed to sync zones:', error);
        return { success: false, error };
    }
}
