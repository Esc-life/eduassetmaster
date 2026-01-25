import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Environment variables should be set in .env.local
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Handle Private Key newlines
const RAW_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
let PRIVATE_KEY = RAW_PRIVATE_KEY;

if (PRIVATE_KEY.startsWith('"') && PRIVATE_KEY.endsWith('"')) {
    PRIVATE_KEY = PRIVATE_KEY.slice(1, -1);
}
PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');

if (!PRIVATE_KEY.includes('-----BEGIN PRIVATE KEY-----')) {
    console.warn('Warning: Private Key might be malformed or missing headers.');
}
const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Initialize Auth
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: SERVICE_ACCOUNT_EMAIL,
        private_key: PRIVATE_KEY,
    },
    scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Fetch data from a specific range.
 */
export async function getData(range: string, spreadsheetId?: string) {
    try {
        const targetSheetId = spreadsheetId || DEFAULT_SPREADSHEET_ID;
        if (!targetSheetId || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
            console.warn('Google Sheets credentials are missing.');
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
        throw error;
    }
}

/**
 * Update data in a specific range.
 */
export async function updateData(range: string, values: any[][], spreadsheetId?: string) {
    try {
        const targetSheetId = spreadsheetId || DEFAULT_SPREADSHEET_ID;
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
        throw error;
    }
}

/**
 * Append data to a sheet.
 */
export async function appendData(range: string, values: any[][], spreadsheetId?: string) {
    try {
        const targetSheetId = spreadsheetId || DEFAULT_SPREADSHEET_ID;
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
        throw error;
    }
}

/**
 * Add a new sheet (tab) if it doesn't exist.
 */
export async function addSheet(title: string, spreadsheetId?: string) {
    try {
        const targetSheetId = spreadsheetId || DEFAULT_SPREADSHEET_ID;
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
        throw error;
    }
}

/**
 * Initialize a new user's spreadsheet with required sheets and headers.
 * Safe to run multiple times (idempotent logic).
 */
export async function initializeUserSheet(spreadsheetId: string) {
    const REQUIRED_SHEETS = [
        { title: 'Devices', header: ['ID', 'Category', 'Model', 'IP', 'Status', 'PurchaseDate', 'Location', 'Name'] },
        { title: 'Software', header: ['ID', 'Name', 'Type', 'Version', 'License', 'Date', 'Assigned To', 'Notes'] },
        { title: 'Accounts', header: ['ID', 'Service', 'URL', 'Username', 'Password', 'Category', 'Notes'] },
        { title: 'Config', header: ['Key', 'Value'] },
        { title: 'Locations', header: ['Zone ID', 'Auto Name', 'Custom Name'] },
        { title: 'Credentials', header: ['Service', 'Admin ID', 'Contact', 'Note'] }
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
