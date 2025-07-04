import { google } from 'googleapis';
import { getAccessToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

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
          id: draftId,
          format: 'full'
        });
        return Response.json({ messages: [draft.data.message] });
      }

      // List all drafts
      const draftsList = await gmail.users.drafts.list({
        userId: 'me',
        maxResults,
        pageToken: pageToken || undefined
      });

      if (!draftsList.data.drafts) {
        return Response.json({ messages: [] });
      }

      // Fetch full content for each draft
      const draftsPromises = draftsList.data.drafts.map(draft =>
        gmail.users.drafts.get({
          userId: 'me',
          id: draft.id || '',
          format: 'full'
        })
      );

      const draftsResults = await Promise.all(draftsPromises);
      const messages = draftsResults.map(result => result.data.message);

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
        id: message.id || '',
        format: 'full'
      })
    );

    const messagesResults = await Promise.all(messagesPromises);
    const messages = messagesResults.map(result => result.data);

    return Response.json({
      messages,
      nextPageToken: response.data.nextPageToken
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return Response.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
} 