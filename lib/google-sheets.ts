import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Lazy Load Sheets Client
let sheetsInstance: any = null;

function getSheetsClient() {
    if (sheetsInstance) return sheetsInstance;

    const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const RAW_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';

    if (!SERVICE_ACCOUNT_EMAIL || !RAW_PRIVATE_KEY) {
        console.warn('[GoogleSheets] Credentials missing in environment variables.');
        return null;
    }

    let PRIVATE_KEY = RAW_PRIVATE_KEY;
    if (PRIVATE_KEY.startsWith('"') && PRIVATE_KEY.endsWith('"')) {
        PRIVATE_KEY = PRIVATE_KEY.slice(1, -1);
    }
    PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');
    console.log('[GoogleSheets DEBUG] Key length:', PRIVATE_KEY.length, '| Starts:', PRIVATE_KEY.substring(0, 30));

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: SERVICE_ACCOUNT_EMAIL,
                private_key: PRIVATE_KEY,
            },
            scopes: SCOPES,
        });

        sheetsInstance = google.sheets({ version: 'v4', auth });
        return sheetsInstance;
    } catch (error) {
        console.error('[GoogleSheets] Failed to create auth client:', error);
        return null;
    }
}

/**
 * Fetch data from a specific range.
 */
export async function getData(range: string, spreadsheetId?: string) {
    try {
        const sheets = getSheetsClient();
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
        console.error('Error fetching data from Google Sheets:', error);
        return null;
    }
}

/**
 * Update data in a specific range.
 */
export async function updateData(range: string, values: any[][], spreadsheetId?: string) {
    try {
        const sheets = getSheetsClient();
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
    } catch (error) {
        console.error('Error updating data:', error);
        return { success: false, error };
    }
}

/**
 * Clear data in a specific range.
 */
export async function clearData(range: string, spreadsheetId?: string) {
    try {
        const sheets = getSheetsClient();
        if (!sheets) throw new Error('Google Sheets Client initialization failed');

        const targetSheetId = spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
        if (!targetSheetId) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.clear({
            spreadsheetId: targetSheetId,
            range,
        });
        return response.data;
    } catch (error) {
        console.error('Error clearing data:', error);
        return { success: false, error };
    }
}

/**
 * Append data to a sheet.
 */
export async function appendData(range: string, values: any[][], spreadsheetId?: string) {
    try {
        const sheets = getSheetsClient();
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
    } catch (error) {
        console.error('Error appending data:', error);
        return { success: false, error };
    }
}

/**
 * Add a new sheet (tab) if it doesn't exist.
 */
export async function addSheet(title: string, spreadsheetId?: string) {
    try {
        const sheets = getSheetsClient();
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
        console.error('Error adding sheet:', error);
        return { success: false, error };
    }
}

/**
 * Initialize a new user's spreadsheet with required sheets and headers.
 * Safe to run multiple times (idempotent logic).
 */
export async function initializeUserSheet(spreadsheetId: string) {
    const REQUIRED_SHEETS = [
        { title: 'Devices', header: ['ID', 'Category', 'Model', 'IP', 'Status', 'PurchaseDate', 'Location', 'Name', 'AcquisitionDivision', 'Quantity', 'UnitPrice', 'TotalAmount', 'ServiceLifeChange', 'InstallLocation', 'OSVersion', 'WindowsPassword', 'UserName', 'PCName'] },
        { title: 'DeviceInstances', header: ['ID', 'DeviceID', 'LocationID', 'LocationName', 'Quantity', 'Notes'] },
        { title: 'Software', header: ['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes'] },
        { title: 'Accounts', header: ['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes'] },
        { title: 'Config', header: ['Key', 'Value'] },
        { title: 'Locations', header: ['Zone ID', 'Auto Name', 'Custom Name'] },
        { title: 'Credentials', header: ['Service', 'Admin ID', 'Contact', 'Note'] },
        { title: 'Loans', header: ['ID', 'DeviceID', 'DeviceName', 'UserID', 'UserName', 'LoanDate', 'DueDate', 'ReturnDate', 'Status', 'Notes'] }
    ];

    console.log(`[Init] Checking sheets for ${spreadsheetId}...`);

    for (const sheet of REQUIRED_SHEETS) {
        try {
            // Check if sheet exists by trying to read A1
            const check = await getData(`${sheet.title}!A1`, spreadsheetId);

            if (check === null) {
                // Sheet does not exist, create it
                console.log(`[Init] Creating sheet: ${sheet.title}`);
                await addSheet(sheet.title, spreadsheetId);
                // Add Header
                await updateData(`${sheet.title}!A1`, [sheet.header], spreadsheetId);
            } else if (check.length === 0) {
                // Sheet exists but is empty, add header
                console.log(`[Init] Sheet ${sheet.title} exists but empty. Adding header.`);
                await updateData(`${sheet.title}!A1`, [sheet.header], spreadsheetId);
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
