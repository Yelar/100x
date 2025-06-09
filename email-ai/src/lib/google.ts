import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { gmail_v1 } from 'googleapis';

const CLIENT_SECRETS_FILE = process.env.GOOGLE_CLIENT_SECRETS || '{}';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

interface ClientSecrets {
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
}

let clientSecrets: ClientSecrets;
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
  folder?: string;
}

export const getGmailMessages = async (accessToken: string, options: GetEmailsOptions = {}) => {
  const { pageToken, query, maxResults = 20, folder } = options;
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // List messages with search query if provided
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    pageToken,
    q: query, // Gmail search query
    labelIds: folder === 'sent' ? ['SENT'] : folder === 'spam' ? ['SPAM'] : ['INBOX'] // Use appropriate label for each folder
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
      
      // Helper function to decode base64 content
      const decodeBase64 = (data: string) => {
        try {
          // Decode base64 and handle UTF-8 encoding
          return Buffer.from(data, 'base64').toString('utf-8');
        } catch (e) {
          console.error('Error decoding base64:', e);
          return '';
        }
      };

      // Helper function to decode email subject
      const decodeSubject = (subject: string) => {
        try {
          // Handle encoded subjects (e.g., =?UTF-8?B?...?=)
          if (subject.startsWith('=?') && subject.includes('?B?')) {
            const match = subject.match(/=\?([^?]+)\?B\?([^?]+)\?=/);
            if (match) {
              const charset = match[1].toLowerCase() as BufferEncoding;
              const encoded = match[2];
              return Buffer.from(encoded, 'base64').toString(charset);
            }
          }
          return subject;
        } catch (e) {
          console.error('Error decoding subject:', e);
          return subject;
        }
      };

      // Helper function to process email parts recursively
      const processParts = (parts: gmail_v1.Schema$MessagePart[]): { body: string; contentType: string } => {
        let result = { body: '', contentType: '' };
        
        for (const part of parts) {
          // If this part has nested parts, process them
          if (part.parts) {
            const nestedResult = processParts(part.parts);
            if (nestedResult.body) {
              result = nestedResult;
              break;
            }
          }
          
          // Process the current part
          if (part.body?.data) {
            const content = decodeBase64(part.body.data);
            const mimeType = part.mimeType || '';
            
            // Prefer HTML over plain text
            if (mimeType === 'text/html' && !result.body) {
              result = { body: content, contentType: 'text/html' };
            } else if (mimeType === 'text/plain' && !result.body) {
              result = { body: content, contentType: 'text/plain' };
            }

            // Always prefer HTML over plain text - override if HTML is found
            if (mimeType === 'text/html') {
              result = { body: content, contentType: 'text/html' };
            } else if (mimeType === 'text/plain' && result.contentType !== 'text/html') {
              result = { body: content, contentType: 'text/plain' };
            }
          }
        }
        
        return result;
      };

      // Process the email parts - NO FORMATTING, just raw content
      if (parts.length > 0) {
        const result = processParts(parts);
        body = result.body;
      } else if (msg.data.payload?.body?.data) {
        body = decodeBase64(msg.data.payload.body.data);
      }

      if (!body) {
        body = msg.data.snippet || '';
      }

      return {
        id: msg.data.id,
        threadId: msg.data.threadId,
        from: headers.find(h => h.name === 'From')?.value || 'Unknown',
        subject: decodeSubject(headers.find(h => h.name === 'Subject')?.value || 'No Subject'),
        date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
        snippet: msg.data.snippet || '',
        body: body
      };
    })
  );

  return {
    messages: detailedMessages,
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

/**
 * Fetch a complete email thread with all messages
 */
export const getEmailThread = async (accessToken: string, threadId: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  });

  const messages = thread.data.messages || [];
  
  // Helper function to decode base64 content
  const decodeBase64 = (data: string) => {
    try {
      return Buffer.from(data, 'base64').toString('utf-8');
    } catch (e) {
      console.error('Error decoding base64:', e);
      return '';
    }
  };

  // Helper function to decode email subject
  const decodeSubject = (subject: string) => {
    try {
      if (subject.startsWith('=?') && subject.includes('?B?')) {
        const match = subject.match(/=\?([^?]+)\?B\?([^?]+)\?=/);
        if (match) {
          const charset = match[1].toLowerCase() as BufferEncoding;
          const encoded = match[2];
          return Buffer.from(encoded, 'base64').toString(charset);
        }
      }
      return subject;
    } catch (e) {
      console.error('Error decoding subject:', e);
      return subject;
    }
  };

  // Helper function to process email parts recursively
  const processParts = (parts: gmail_v1.Schema$MessagePart[]): { body: string; contentType: string } => {
    let result = { body: '', contentType: '' };
    
    for (const part of parts) {
      if (part.parts) {
        const nestedResult = processParts(part.parts);
        if (nestedResult.body) {
          result = nestedResult;
          break;
        }
      }
      
      if (part.body?.data) {
        const content = decodeBase64(part.body.data);
        const mimeType = part.mimeType || '';
        
        // Prefer HTML over plain text
        if (mimeType === 'text/html' && !result.body) {
          result = { body: content, contentType: 'text/html' };
        } else if (mimeType === 'text/plain' && !result.body) {
          result = { body: content, contentType: 'text/plain' };
        }

        // Always prefer HTML over plain text - override if HTML is found
        if (mimeType === 'text/html') {
          result = { body: content, contentType: 'text/html' };
        } else if (mimeType === 'text/plain' && result.contentType !== 'text/html') {
          result = { body: content, contentType: 'text/plain' };
        }
      }
    }
    
    return result;
  };

  const detailedMessages = await Promise.all(
    messages.map(async (message) => {
      const headers = message.payload?.headers || [];
      const parts = message.payload?.parts || [];
      
      let body = '';

      // Process the email parts - NO FORMATTING, just raw content
      if (parts.length > 0) {
        const result = processParts(parts);
        body = result.body;
      } else if (message.payload?.body?.data) {
        body = decodeBase64(message.payload.body.data);
      }

      if (!body) {
        body = message.snippet || '';
      }

      return {
        id: message.id,
        threadId: message.threadId,
        from: headers.find(h => h.name === 'From')?.value || 'Unknown',
        to: headers.find(h => h.name === 'To')?.value || 'Unknown',
        subject: decodeSubject(headers.find(h => h.name === 'Subject')?.value || 'No Subject'),
        date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
        snippet: message.snippet || '',
        body: body,
        internalDate: message.internalDate || '0'
      };
    })
  );

  // Sort messages by internal date (chronological order)
  detailedMessages.sort((a, b) => parseInt(a.internalDate) - parseInt(b.internalDate));

  return {
    threadId: thread.data.id,
    messages: detailedMessages,
    historyId: thread.data.historyId
  };
}; 