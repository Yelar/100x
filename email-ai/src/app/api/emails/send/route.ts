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
    const { to, subject, content } = body;

    if (!to || !subject || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Encode subject line for non-ASCII characters
    const encodeSubject = (subject: string) => {
      // Check if subject contains non-ASCII characters
      if (/[^\x00-\x7F]/.test(subject)) {
        // Encode subject using MIME encoding
        const encoded = Buffer.from(subject).toString('base64');
        return `=?UTF-8?B?${encoded}?=`;
      }
      return subject;
    };

    // Construct the email message
    const emailLines = [
      `From: ${userEmail}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      content
    ];

    const email = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      return NextResponse.json({
        success: true,
        messageId: response.data.id,
      });
    } catch (error: unknown) {
      // Check if error is due to token expiration
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && typeof error.response === 'object' && 
          'status' in error.response && error.response.status === 401) {
        // Try to refresh the token
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
          method: 'POST',
        });

        if (!refreshResponse.ok) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }

        // Get the new access token from cookies
        const newCookiesList = await cookies();
        const newAccessToken = newCookiesList.get('access_token')?.value;

        if (!newAccessToken) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }

        // Retry the request with new token
        oauth2Client.setCredentials({
          access_token: newAccessToken,
        });

        const retryResponse = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedEmail,
          },
        });

        return NextResponse.json({
          success: true,
          messageId: retryResponse.data.id,
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
} 