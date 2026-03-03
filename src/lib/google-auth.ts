import { google, Auth } from 'googleapis';

let cachedAuth: Auth.GoogleAuth | null = null;

function getServiceAccountCredentials(): object | null {
  const keyData = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyData) {
    return null;
  }

  try {
    return JSON.parse(keyData);
  } catch {
    try {
      const decoded = Buffer.from(keyData, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      console.error('Google Auth: Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY');
      return null;
    }
  }
}

export function getGoogleAuth(scopes: string[]): Auth.GoogleAuth | null {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    console.log('Google Auth: No service account key configured — Google integrations disabled');
    return null;
  }

  if (!cachedAuth) {
    cachedAuth = new google.auth.GoogleAuth({
      credentials: credentials as any,
      scopes,
    });
  }

  return cachedAuth;
}

export function getGmailClient(senderEmail?: string) {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credentials as any,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    clientOptions: senderEmail ? { subject: senderEmail } : undefined,
  });

  return google.gmail({ version: 'v1', auth });
}

export function getSheetsClient() {
  const auth = getGoogleAuth([
    'https://www.googleapis.com/auth/spreadsheets',
  ]);

  if (!auth) return null;

  return google.sheets({ version: 'v4', auth });
}

export function isGoogleConfigured(): boolean {
  return !!getServiceAccountCredentials();
}
