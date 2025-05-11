import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const CLIENT_SECRETS_FILE = process.env.GOOGLE_CLIENT_SECRETS || '{}';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

let clientSecrets: any;
try {
  clientSecrets = JSON.parse(CLIENT_SECRETS_FILE);
} catch (e) {
  console.error('Error parsing client secrets:', e);
  clientSecrets = {};
}

const oauth2Client = new OAuth2Client(
  clientSecrets.web?.client_id,
  clientSecrets.web?.client_secret,
  clientSecrets.web?.redirect_uris?.[0]
);

export const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
};

export const getTokens = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

export const getUserInfo = async (accessToken: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2('v2');
  const userInfo = await oauth2.userinfo.get({ auth: oauth2Client });
  return userInfo.data;
};

export const getGmailMessages = async (accessToken: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 20,
    labelIds: ['INBOX']
  });

  const messages = response.data.messages || [];
  const detailedMessages = await Promise.all(
    messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers = msg.data.payload?.headers || [];
      return {
        id: msg.data.id,
        from: headers.find(h => h.name === 'From')?.value || 'Unknown',
        subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
        date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
        snippet: msg.data.snippet || ''
      };
    })
  );

  return detailedMessages;
}; 