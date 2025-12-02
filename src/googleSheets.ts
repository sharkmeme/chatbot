
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// This interface should match the one in the frontend's types.ts
// I've added the new fields to match your requested sheet columns.
interface LeadData {
    name: string;
    email: string;
    phone: string;
    interest: string; // Mapped to project_type
    budget: string;
    customerType: string;
    usecase: string;
    otherInfo: string; // Mapped to notes
    company?: string;
    website?: string;
}

// --- Google Sheets Authentication ---

const getAuth = (): JWT => {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set.');
  }

  // Parse the JSON string from the environment variable
  const credentials = JSON.parse(serviceAccountJson);

  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

// --- Main Function to Append Lead ---

export const appendLeadToSheet = async (leadData: LeadData): Promise<void> => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID environment variable not set.');
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Prepare the row in the exact order you specified
  const newRow = [
    new Date().toISOString(),
    leadData.name || 'Not provided',
    leadData.email || 'Not provided',
    leadData.company || 'Not provided',
    leadData.website || 'Not provided',
    leadData.phone || 'Not provided',
    leadData.interest || 'Not provided', // Mapping 'interest' to 'project_type'
    leadData.budget || 'Not provided',
    leadData.otherInfo || 'Not provided', // Mapping 'otherInfo' to 'notes'
    JSON.stringify(leadData), // The full raw JSON
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Leads!A1', // Assumes your sheet is named "Leads"
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [newRow],
      },
    });
  } catch (err) {
    console.error('Google Sheets API Error:', err);
    throw new Error('Failed to append row to Google Sheet.');
  }
};
