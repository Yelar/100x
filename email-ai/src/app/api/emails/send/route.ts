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

    let to, subject, content, mode, draftId;
    
    // Check if the request is FormData or JSON
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData
      const formData = await req.formData();
      to = formData.get('to') as string;
      subject = formData.get('subject') as string;
      content = formData.get('content') as string;
      mode = formData.get('mode') as string;
      draftId = formData.get('draftId') as string;
      
      // Handle attachments if present
      const attachments = formData.getAll('attachments') as File[];
      if (attachments.length > 0) {
        // For now, we'll just add attachment info to the content
        // In a full implementation, you'd want to properly handle file attachments
        const attachmentInfo = attachments.map(file => `[Attachment: ${file.name} (${file.size} bytes)]`).join('\n');
        content = content + '\n\n' + attachmentInfo;
      }
    } else {
      // Handle JSON
      const body = await req.json();
      to = body.to;
      subject = body.subject;
      content = body.content;
      mode = body.mode;
      draftId = body.draftId;
    }

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