/* eslint-disable @typescript-eslint/no-explicit-any */
import { google } from 'googleapis';
import { getAccessToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface Email {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  internalDate?: string;
  attachments?: Attachment[];
  starred?: boolean;
}

function parseGmailMessage(msg: any): Email {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) => {
    return headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  };
  const from = getHeader('From');
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  const snippet = msg.snippet || '';

  // Try to get the HTML or plain text body
  let bodyData: string | undefined;
  if (msg.payload?.parts) {
    // Prefer HTML part
    const htmlPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/html');
    const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
    bodyData = htmlPart?.body?.data || textPart?.body?.data;
  } else {
    bodyData = msg.payload?.body?.data;
  }

  let body = '';
  if (bodyData) {
    try {
      body = Buffer.from(bodyData, 'base64').toString('utf-8');
    } catch {
      body = '';
    }
  }

  // Attachments
  const attachments: Attachment[] = [];
  const traverseParts = (parts: any[]) => {
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
        });
      }
      if (part.parts) {
        traverseParts(part.parts);
      }
    }
  };
  if (msg.payload?.parts) {
    traverseParts(msg.payload.parts);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    from,
    subject,
    date,
    snippet,
    body,
    internalDate: msg.internalDate,
    attachments: attachments.length ? attachments : undefined,
    starred: (msg.labelIds || []).includes('STARRED'),
  };
}

export async function GET(req: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const url = new URL(req.url);
    const folder = url.searchParams.get('folder');
    const draftId = url.searchParams.get('id');
    const pageToken = url.searchParams.get('pageToken');
    const maxResults = 20;

    if (folder === 'drafts') {
      // If specific draft ID is requested
      if (draftId) {
        const draft = await gmail.users.drafts.get({
          userId: 'me',
          id: draftId as string,
          format: 'full'
        });
        return Response.json({ messages: [parseGmailMessage(draft.data.message)] });
      }

      // List all drafts
      const draftsList = await gmail.users.drafts.list({
        userId: 'me',
        maxResults
      });

      if (!draftsList.data.drafts) {
        return Response.json({ messages: [] });
      }

      // Fetch full content for each draft
      const draftsPromises = draftsList.data.drafts.map(draft =>
        gmail.users.drafts.get({
          userId: 'me',
          id: draft.id as string,
          format: 'full'
        })
      );

      const draftsResults = await Promise.all(draftsPromises);
      const messages = draftsResults.map(result => parseGmailMessage(result.data.message));

      return Response.json({
        messages,
        nextPageToken: draftsList.data.nextPageToken
      });
    }

    // Handle other folders (inbox, sent, etc.)
    const labelId = folder === 'sent' ? 'SENT' : 'INBOX';
    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults,
      pageToken: pageToken || undefined
    });

    if (!response.data.messages) {
      return Response.json({ messages: [] });
    }

    const messagesPromises = response.data.messages.map(message =>
      gmail.users.messages.get({
        userId: 'me',
        id: message.id as string,
        format: 'full'
      })
    );

    const messagesResults = await Promise.all(messagesPromises);
    const messages = messagesResults.map(result => parseGmailMessage(result.data));

    return Response.json({
      messages,
      nextPageToken: response.data.nextPageToken
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return Response.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
} 