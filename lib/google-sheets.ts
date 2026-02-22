import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * Get Google Sheets client with optional credential override.
 */
function getSheetsClient(credentials?: { client_email: string, private_key: string }) {
    // If specific credentials are provided, always create a new instance for that request
    // (We don't cache user-specific instances to avoid memory leaks/concurrency issues)
    const SERVICE_ACCOUNT_EMAIL = credentials?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const RAW_PRIVATE_KEY = credentials?.private_key || process.env.GOOGLE_PRIVATE_KEY || '';

    if (!SERVICE_ACCOUNT_EMAIL || !RAW_PRIVATE_KEY) {
        console.warn('[GoogleSheets] Credentials missing.');
        return null;
    }

    let PRIVATE_KEY = RAW_PRIVATE_KEY;
    if (PRIVATE_KEY.startsWith('"') && PRIVATE_KEY.endsWith('"')) {
        PRIVATE_KEY = PRIVATE_KEY.slice(1, -1);
    }
    PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: SERVICE_ACCOUNT_EMAIL,
                private_key: PRIVATE_KEY,
            },
            scopes: SCOPES,
        });

        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('[GoogleSheets] Failed to create auth client:', error);
        return null;
    }
}

/**
 * Fetch data from a specific range.
 */
export async function getData(range: string, spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) return null;

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) {
            console.warn('Google Sheets ID missing.');
            return null;
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: targetSheetId,
            range,
        });
        return response.data.values || [];
    } catch (error: any) {
        if (error.code === 400 && error.message.includes('Unable to parse range')) {
            // Sheet might not exist
            return null;
        }
        if (error.code === 403 || error.message?.includes('permission')) {
            throw new Error('PERMISSION_DENIED');
        }
        console.error('Error fetching data from Google Sheets:', error);
        return null;
    }
}

/**
 * Update data in a specific range.
 */
export async function updateData(range: string, values: any[][], spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: targetSheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return response.data;
    } catch (error: any) {
        console.error('Error updating data:', error.message);
        throw error;
    }
}

/**
 * Update data in multiple ranges in a single call.
 */
export async function batchUpdateData(data: { range: string, values: any[][] }[], spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: targetSheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: data.map(item => ({
                    range: item.range,
                    values: item.values
                }))
            }
        });
        return response.data;
    } catch (error: any) {
        console.error('Error in batch update:', error.message);
        throw error;
    }
}

/**
 * Clear data in a specific range.
 */
export async function clearData(range: string, spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.clear({
            spreadsheetId: targetSheetId,
            range,
        });
        return response.data;
    } catch (error: any) {
        console.error('Error clearing data:', error.message);
        throw error;
    }
}

/**
 * Append data to a sheet.
 */
export async function appendData(range: string, values: any[][], spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: targetSheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return response.data;
    } catch (error: any) {
        console.error('Error appending data:', error.message);
        throw error;
    }
}

/**
 * Add a new sheet (tab) if it doesn't exist.
 */
export async function addSheet(title: string, spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: targetSheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title }
                    }
                }]
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.message && error.message.includes('already exists')) return;
        console.error('Error adding sheet:', error.message);
        throw error;
    }
}

/**
 * Initialize a new user's spreadsheet with required sheets and headers.
 * Safe to run multiple times (idempotent logic).
 */
export async function initializeUserSheet(spreadsheetId: string, credentials?: any) {
    const REQUIRED_SHEETS = [
        { title: 'Devices', header: ['ID', 'Category', 'Model', 'IP', 'Status', 'PurchaseDate', 'GroupID', 'Name', 'AcquisitionDivision', 'Quantity', 'UnitPrice', 'TotalAmount', 'ServiceLifeChange', 'InstallLocation', 'OSVersion', 'WindowsPassword', 'UserName', 'PCName'] },
        { title: 'DeviceInstances', header: ['ID', 'DeviceID', 'LocationID', 'LocationName', 'Quantity', 'Notes'] },
        { title: 'Software', header: ['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes'] },
        { title: 'Accounts', header: ['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes'] },
        { title: 'Config', header: ['Key', 'Value'] },
        { title: 'Locations', header: ['Zone ID', 'Auto Name', 'Custom Name'] },
        { title: 'Credentials', header: ['Service', 'Admin ID', 'Contact', 'Note'] },
        { title: 'Loans', header: ['ID', 'DeviceID', 'DeviceName', 'UserID', 'UserName', 'LoanDate', 'DueDate', 'ReturnDate', 'Status', 'Notes'] },
        { title: 'SystemConfig', header: ['Key', 'Value'] }
    ];

    console.log(`[Init] Checking sheets for ${spreadsheetId}...`);

    for (const sheet of REQUIRED_SHEETS) {
        try {
            // Check if sheet exists by trying to read A1
            const check = await getData(`${sheet.title}!A1`, spreadsheetId, credentials);

            if (check === null) {
                // Sheet does not exist, create it
                console.log(`[Init] Creating sheet: ${sheet.title}`);
                await addSheet(sheet.title, spreadsheetId, credentials);
                // Add Header
                await updateData(`${sheet.title}!A1`, [sheet.header], spreadsheetId, credentials);
            } else if (check.length === 0) {
                // Sheet exists but is empty, add header
                console.log(`[Init] Sheet ${sheet.title} exists but empty. Adding header.`);
                await updateData(`${sheet.title}!A1`, [sheet.header], spreadsheetId, credentials);
            }
        } catch (error: any) {
            console.error(`[Init] Failed to init ${sheet.title}:`, error.message);
            // If permission denied, we should stop and notify caller
            if (error.code === 403 || error.message.includes('permission')) {
                throw new Error('PERMISSION_DENIED');
            }
        }
    }
    return true;
}

/**
 * Delete a specific row by index (1-indexed).
 */
export async function deleteRowByIndex(sheetTitle: string, rowIndex: number, spreadsheetId?: string, credentials?: any) {
    try {
        const sheets = getSheetsClient(credentials);
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        // First, get the sheet ID (gid) for the given title
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: targetSheetId,
        });

        const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetTitle);
        if (!sheet || sheet.properties?.sheetId === undefined) {
            throw new Error(`Sheet with title "${sheetTitle}" not found`);
        }

        const gid = sheet.properties.sheetId;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: targetSheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: gid,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // 0-indexed
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting row:', error.message);
        throw error;
    }
}
