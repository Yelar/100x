import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const CLIENT_SECRETS_FILE = process.env.GOOGLE_CLIENT_SECRETS || '{}';

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

export async function POST(request: Request) {
  try {
    const cookiesList = await cookies();
    const accessToken = cookiesList.get('access_token')?.value;
    const userEmail = cookiesList.get('user_email')?.value;

    if (!accessToken || !userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, subject, content, originalMessageId } = body;

    if (!to || !subject || !content || !originalMessageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get the original message to extract threading information
    const originalMessage = await gmail.users.messages.get({
      userId: 'me',
      id: originalMessageId,
      format: 'full'
    });

    const headers = originalMessage.data.payload?.headers || [];
    const originalThreadId = originalMessage.data.threadId;
    
    // Extract necessary headers for threading
    const messageIdHeader = headers.find(h => h.name === 'Message-ID')?.value;
    const referencesHeader = headers.find(h => h.name === 'References')?.value;
    
    // Build References header for threading
    let references = '';
    if (referencesHeader) {
      references = `${referencesHeader} ${messageIdHeader}`;
    } else if (messageIdHeader) {
      references = messageIdHeader;
    }

    // Encode subject line for non-ASCII characters
    const encodeSubject = (subject: string) => {
      if (/[^\x00-\x7F]/.test(subject)) {
        const encoded = Buffer.from(subject).toString('base64');
        return `=?UTF-8?B?${encoded}?=`;
      }
      return subject;
    };

    // Create proper email with base64 encoding for the entire message
    const rawEmail = [
      `From: ${userEmail}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@gmail.com>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
    ];

    // Add threading headers for proper conversation threading
    if (messageIdHeader) {
      rawEmail.push(`In-Reply-To: ${messageIdHeader}`);
    }
    if (references) {
      rawEmail.push(`References: ${references}`);
    }

    rawEmail.push(''); // Empty line before content
    rawEmail.push(content);

    const emailMessage = rawEmail.join('\r\n');
    const encodedEmail = Buffer.from(emailMessage).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
          threadId: originalThreadId, // This ensures it's sent as part of the same thread
        },
      });

      return NextResponse.json({
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
      });
    } catch (error: unknown) {
      // Handle token refresh if needed
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && typeof error.response === 'object' && 
          'status' in error.response && error.response.status === 401) {
        
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
          method: 'POST',
        });

        if (!refreshResponse.ok) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }

        const newCookiesList = await cookies();
        const newAccessToken = newCookiesList.get('access_token')?.value;

        if (!newAccessToken) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }

        oauth2Client.setCredentials({
          access_token: newAccessToken,
        });

        const retryResponse = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail,
            threadId: originalThreadId,
          },
        });

        return NextResponse.json({
          success: true,
          messageId: retryResponse.data.id,
          threadId: retryResponse.data.threadId,
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error sending threaded reply:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
} 