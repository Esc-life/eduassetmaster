import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Environment variables should be set in .env.local
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Handle Private Key newlines for Vercel/Node environment
const RAW_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
const PRIVATE_KEY = RAW_PRIVATE_KEY.includes('\\n')
    ? RAW_PRIVATE_KEY.replace(/\\n/g, '\n')
    : RAW_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

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
 * Fetch data from a specific range in the Google Sheet.
 * @param range The A1 notation of the range to fetch (e.g., 'Devices!A2:G')
 */
export async function getData(range: string) {
    try {
        if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
            console.warn('Google Sheets credentials are missing.');
            return [['Mock ID', 'Mock Category', 'Mock Model', '192.168.0.1', 'Active', '2024-01-01', 'Room 101']];
        }

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
        });
        return response.data.values || [];
    } catch (error: any) {
        if (error.code === 400 && error.message.includes('Unable to parse range')) {
            console.warn(`Sheet range ${range} not found.`);
            return null;
        }
        console.error('Error fetching data from Google Sheets:', error);
        throw error;
    }
}

// ... updateData ...

/**
 * Add a new sheet (tab) to the spreadsheet.
 * @param title The title of the new sheet.
 */
export async function addSheet(title: string) {
    try {
        if (!SPREADSHEET_ID) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: {
                            title,
                        }
                    }
                }]
            }
        });
        return response.data;
    } catch (error: any) {
        // Ignore if already exists (although usually we check before calling)
        if (error.message && error.message.includes('already exists')) {
            return;
        }
        console.error('Error adding sheet:', error);
        throw error;
    }
}

// ... updateData, appendData ...

/**
 * Update data in a specific range.
 * @param range The A1 notation of the range to update
 * @param values The 2D array of values to write
 */
export async function updateData(range: string, values: any[][]) {
    try {
        if (!SPREADSHEET_ID) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error updating data in Google Sheets:', error);
        throw error;
    }
}

/**
 * Append data to a sheet.
 * @param range The A1 notation of the range (e.g. 'Sheet1!A1') to search for a table.
 * @param values The 2D array of values to append.
 */
export async function appendData(range: string, values: any[][]) {
    try {
        if (!SPREADSHEET_ID) throw new Error('Spreadsheet ID is missing');

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error appending data to Google Sheets:', error);
        throw error;
    }
}
