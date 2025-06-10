import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEmailAttachment } from '@/lib/google';

interface GmailError {
  response?: {
    status?: number;
  };
  message?: string;
}

export async function GET(
  request: Request,
  { params }: { params: { messageId: string; attachmentId: string } }
) {
  try {
    const { messageId, attachmentId } = params;

    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;

    if (!accessTokenCookie) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const attachment = await getEmailAttachment(accessTokenCookie, messageId, attachmentId);
    
    if (!attachment || !attachment.data) {
      return NextResponse.json(
        { error: 'Attachment not found or empty' },
        { status: 404 }
      );
    }

    // Ensure the base64 data is properly formatted
    const base64Data = attachment.data.replace(/\s/g, '');
    const padding = base64Data.length % 4;
    const paddedBase64 = padding ? base64Data + '='.repeat(4 - padding) : base64Data;

    return NextResponse.json({
      data: paddedBase64,
      size: attachment.size
    });
  } catch (error) {
    console.error('Error fetching attachment:', error);
    const gmailError = error as GmailError;
    
    if (gmailError.response?.status === 401) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch attachment' },
      { status: 500 }
    );
  }
} 
