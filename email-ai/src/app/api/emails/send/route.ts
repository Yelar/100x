import { google } from 'googleapis';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { applyRateLimit } from '@/lib/rate-limit';

// Helper function to encode email to base64URL format
function encodeEmail(to: string, subject: string, content: string) {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    content
  ];
  
  const emailContent = emailLines.join('\r\n');
  return Buffer.from(emailContent).toString('base64url').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    // Apply email rate limiting
    const rateLimitResponse = await applyRateLimit(req, 'email');
    if (rateLimitResponse) return rateLimitResponse;

    const { to, subject, content, mode, draftId } = await req.json();
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = encodeEmail(to, subject, content);

    if (mode === 'draft') {
      // Save as draft
      if (draftId) {
        // Update existing draft
        const draft = await gmail.users.drafts.update({
          userId: 'me',
          id: draftId,
          requestBody: {
            message: {
              raw
            }
          }
        });
        return Response.json(draft.data);
      } else {
        // Create new draft
        const draft = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw
            }
          }
        });
        return Response.json(draft.data);
      }
    } else {
      // Send email
      if (draftId) {
        // Send and delete draft
        await gmail.users.drafts.send({
          userId: 'me',
          requestBody: {
            id: draftId
          }
        });
      } else {
        // Send new email
        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw
          }
        });
      }
      return Response.json({ success: true });
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}