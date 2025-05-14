import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const CLIENT_SECRETS_FILE = process.env.GOOGLE_CLIENT_SECRETS || '{}';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
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

interface GetEmailsOptions {
  pageToken?: string;
  query?: string;
  maxResults?: number;
}

export const getGmailMessages = async (accessToken: string, options: GetEmailsOptions = {}) => {
  const { pageToken, query, maxResults = 20 } = options;
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // List messages with search query if provided
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken,
    q: query, // Gmail search query
    labelIds: query ? undefined : ['INBOX'] // Only filter by INBOX if not searching
  });

  const messages = response.data.messages || [];
  const detailedMessages = await Promise.all(
    messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });

      const headers = msg.data.payload?.headers || [];
      const parts = msg.data.payload?.parts || [];
      
      // Get the email body
      let body = '';
      if (msg.data.payload?.body?.data) {
        body = Buffer.from(msg.data.payload.body.data, 'base64').toString();
      } else if (parts.length > 0) {
        // Try to find HTML or plain text part
        const htmlPart = parts.find(part => part.mimeType === 'text/html');
        const textPart = parts.find(part => part.mimeType === 'text/plain');
        const selectedPart = htmlPart || textPart;
        
        if (selectedPart?.body?.data) {
          body = Buffer.from(selectedPart.body.data, 'base64').toString();
        }
      }

      // If no HTML content is found, convert plain text to HTML
      if (!body.includes('<')) {
        body = body
          .split('\n')
          .map(line => `<p>${line}</p>`)
          .join('');
      }

      return {
        id: msg.data.id,
        from: headers.find(h => h.name === 'From')?.value || 'Unknown',
        subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
        date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
        snippet: msg.data.snippet || '',
        body: body || msg.data.snippet || ''
      };
    })
  );

  return {
    emails: detailedMessages,
    nextPageToken: response.data.nextPageToken
  };
};

export const getEmailContent = async (accessToken: string, messageId: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  });

  const headers = msg.data.payload?.headers || [];
  const parts = msg.data.payload?.parts || [];
  
  // Get the email body
  let body = '';
  if (msg.data.payload?.body?.data) {
    body = Buffer.from(msg.data.payload.body.data, 'base64').toString();
  } else if (parts.length > 0) {
    // Try to find HTML or plain text part
    const htmlPart = parts.find(part => part.mimeType === 'text/html');
    const textPart = parts.find(part => part.mimeType === 'text/plain');
    const selectedPart = htmlPart || textPart;
    
    if (selectedPart?.body?.data) {
      body = Buffer.from(selectedPart.body.data, 'base64').toString();
    }
  }

  return {
    id: msg.data.id,
    from: headers.find(h => h.name === 'From')?.value || 'Unknown',
    subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
    date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
    snippet: msg.data.snippet || '',
    body: body || msg.data.snippet || ''
  };
};

/**
 * Fetch multiple email contents by IDs
 */
export const getBatchEmailContent = async (accessToken: string, messageIds: string[]) => {
  if (!messageIds.length) return [];
  
  oauth2Client.setCredentials({ access_token: accessToken });
  
  // Use Promise.all to fetch emails in parallel
  const emails = await Promise.all(
    messageIds.map(id => getEmailContent(accessToken, id))
  );
  
  return emails;
}; 