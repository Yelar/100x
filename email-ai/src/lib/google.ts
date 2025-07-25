import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getGravatarUrl } from './utils';

const CLIENT_SECRETS_FILE = process.env.GOOGLE_CLIENT_SECRETS || '{}';
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
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

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded data for inline viewing
}

// interface Email {
//   id: string;
//   threadId?: string;
//   from: string;
//   subject: string;
//   date: string;
//   snippet: string;
//   body: string;
//   internalDate?: string;
//   attachments?: Attachment[];
//   starred?: boolean;
// }

// interface EmailThread {
//   threadId: string;
//   messages: Email[];
//   historyId: string;
//   nextPageToken?: string;
// }

// interface EmailSummary {
//   individual_summaries: Array<{
//     categories: Record<string, string[]>;
//   }>;
// }

export const getGmailMessages = async (accessToken: string, options: GetEmailsOptions = {}) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  let query = options.query || '';

  // Only add folder if it's not already in the query
  if (options.folder && !query.includes('in:')) {
    query = `in:${options.folder} ${query}`;
  }

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query.trim(),
    maxResults: options.maxResults || 20,
    pageToken: options.pageToken,
  });

  const messages = response.data.messages || [];

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

  // Helper function to extract attachments from message parts
  const extractAttachments = (parts: gmail_v1.Schema$MessagePart[]): Attachment[] => {
    const attachments: Attachment[] = [];
    
    const processParts = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        // Check if this part has nested parts
        if (part.parts) {
          processParts(part.parts);
        }
        
        // Check if this part is an attachment
        if (part.filename && part.filename.length > 0) {
          const attachment: Attachment = {
            id: part.body?.attachmentId || part.partId || '',
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body?.size || 0
          };
          attachments.push(attachment);
        }
      }
    };
    
    processParts(parts);
    return attachments;
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
      
      // Process the current part (skip if it's an attachment)
      if (part.body?.data && (!part.filename || part.filename.length === 0)) {
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
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });

      const headers = msg.data.payload?.headers || [];
      const parts = msg.data.payload?.parts || [];
      let body = '';

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

      // Extract attachments
      const attachments = parts.length > 0 ? extractAttachments(parts) : [];

      const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';

      return {
        id: msg.data.id,
        threadId: msg.data.threadId,
        from: fromHeader,
        subject: decodeSubject(headers.find(h => h.name === 'Subject')?.value || 'No Subject'),
        date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
        snippet: msg.data.snippet || '',
        body: body,
        internalDate: msg.data.internalDate || '0',
        attachments: attachments.length > 0 ? attachments : undefined,
        starred: msg.data.labelIds?.includes('STARRED') || false,
        avatar: getGravatarUrl(fromHeader)
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
    body: body || msg.data.snippet || '',
    starred: msg.data.labelIds?.includes('STARRED') || false
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

      const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';

      return {
        id: message.id,
        threadId: message.threadId,
        from: fromHeader,
        to: headers.find(h => h.name === 'To')?.value || 'Unknown',
        subject: decodeSubject(headers.find(h => h.name === 'Subject')?.value || 'No Subject'),
        date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
        snippet: message.snippet || '',
        body: body,
        internalDate: message.internalDate || '0',
        attachments: (message.payload?.parts || []).some(p => p.filename) ? [] : undefined, // Placeholder
        starred: message.labelIds?.includes('STARRED') || false,
        avatar: getGravatarUrl(fromHeader)
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

/**
 * Fetch an email attachment by message ID and attachment ID
 */
export const getEmailAttachment = async (accessToken: string, messageId: string, attachmentId: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId
  });

  return {
    data: attachment.data.data, // base64 encoded data
    size: attachment.data.size
  };
};

/**
 * Star or unstar an email
 */
export const starEmail = async (accessToken: string, messageId: string, star: boolean = true) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const labelsToAdd = star ? ['STARRED'] : [];
  const labelsToRemove = star ? [] : ['STARRED'];

  const response = await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: labelsToAdd,
      removeLabelIds: labelsToRemove
    }
  });

  return response.data;
};

/**
 * Delete an email (move to trash)
 */
export const deleteEmail = async (accessToken: string, messageId: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.trash({
    userId: 'me',
    id: messageId
  });

  return response.data;
};

/**
 * Permanently delete an email
 */
export const permanentlyDeleteEmail = async (accessToken: string, messageId: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.delete({
    userId: 'me',
    id: messageId
  });

  return response.data;
};

/**
 * Restore an email from trash
 */
export const restoreEmail = async (accessToken: string, messageId: string) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.untrash({
    userId: 'me',
    id: messageId
  });

  return response.data;
};