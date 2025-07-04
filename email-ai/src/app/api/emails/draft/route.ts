import { google } from 'googleapis';
import { getAccessToken } from '@/lib/auth';
import { OAuth2Client } from 'google-auth-library';
import { NextRequest } from 'next/server';

/*
 Route: /api/emails/draft
 Methods:
   GET      -> returns the authenticated user's draft list
   DELETE   -> deletes a single draft (expects JSON body { draftId: string })
*/

export async function GET() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const draftsList = await gmail.users.drafts.list({
      userId: 'me',
      maxResults: 100,
    });

    const drafts = draftsList.data.drafts || [];

    // Fetch the full draft details in parallel
    const draftDetails = await Promise.all(
      drafts.map(async (draft) => {
        const result = await gmail.users.drafts.get({
          userId: 'me',
          id: draft.id as string,
          format: 'full',
        });
        return result.data;
      })
    );

    return Response.json({ drafts: draftDetails });
  } catch (error) {
    console.error('Error listing drafts:', error);
    return Response.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { draftId } = await req.json();

    if (!draftId) {
      return Response.json({ error: 'draftId is required' }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId as string,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return Response.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
} 