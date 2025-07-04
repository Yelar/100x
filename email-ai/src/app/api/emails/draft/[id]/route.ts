import { google } from 'googleapis';
import { getAccessToken } from '@/lib/auth';
import { OAuth2Client } from 'google-auth-library';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });
    
    const draft = await gmail.users.drafts.get({
      userId: 'me',
      id: params.id as string,
      format: 'full'
    });

    if (!draft.data) {
      return Response.json({ error: 'Draft not found' }, { status: 404 });
    }

    return Response.json({ draft: draft.data });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return Response.json({ error: 'Failed to fetch draft' }, { status: 500 });
  }
} 