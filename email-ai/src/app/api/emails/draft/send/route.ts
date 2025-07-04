import { google } from 'googleapis';
import { getAccessToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

export async function POST(req: NextRequest) {
  try {
    const { draftId } = await req.json();
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Send the draft
    const result = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: {
        id: draftId
      }
    });

    return Response.json(result.data);
  } catch (error) {
    console.error('Error sending draft:', error);
    return Response.json({ error: 'Failed to send draft' }, { status: 500 });
  }
} 