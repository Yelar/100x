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

    // Handle both JSON and FormData
    const contentType = request.headers.get('content-type') || '';
    let to: string, subject: string, content: string;
    let attachments: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      to = formData.get('to') as string;
      subject = formData.get('subject') as string;
      content = formData.get('content') as string;
      
      // Get attachments
      const attachmentFiles = formData.getAll('attachments') as File[];
      attachments = attachmentFiles.filter(file => file.size > 0);
    } else {
      const body = await request.json();
      to = body.to;
      subject = body.subject;
      content = body.content;
    }

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

    // Function to create email with attachments
    const createMimeMessage = async () => {
      const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(36)}`;
      
      const emailLines = [
        `From: ${userEmail}`,
        `To: ${to}`,
        `Subject: ${encodeSubject(subject)}`,
        'MIME-Version: 1.0'
      ];

      if (attachments.length > 0) {
        emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        emailLines.push('');
        
        // Add the main content part
        emailLines.push(`--${boundary}`);
        emailLines.push('Content-Type: text/html; charset=UTF-8');
        emailLines.push('Content-Transfer-Encoding: base64');
        emailLines.push('');
        emailLines.push(Buffer.from(content).toString('base64'));
        emailLines.push('');
        
        // Add attachments
        for (const attachment of attachments) {
          const buffer = await attachment.arrayBuffer();
          const base64Data = Buffer.from(buffer).toString('base64');
          
          emailLines.push(`--${boundary}`);
          emailLines.push(`Content-Type: ${attachment.type || 'application/octet-stream'}`);
          emailLines.push('Content-Transfer-Encoding: base64');
          emailLines.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
          emailLines.push('');
          
          // Split base64 data into 76-character lines (RFC requirement)
          const lines = base64Data.match(/.{1,76}/g) || [];
          emailLines.push(...lines);
          emailLines.push('');
        }
        
        emailLines.push(`--${boundary}--`);
      } else {
        emailLines.push('Content-Type: text/html; charset=UTF-8');
        emailLines.push('Content-Transfer-Encoding: base64');
        emailLines.push('');
        emailLines.push(Buffer.from(content).toString('base64'));
      }

      return emailLines.join('\r\n');
    };

    const email = await createMimeMessage();
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
        attachmentCount: attachments.length,
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
          attachmentCount: attachments.length,
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