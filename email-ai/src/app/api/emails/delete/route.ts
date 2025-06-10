import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteEmail, permanentlyDeleteEmail, restoreEmail } from '@/lib/google';

export async function POST(request: Request) {
  try {
    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;

    if (!accessTokenCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { messageId, action = 'trash' } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      );
    }

    let result;
    
    switch (action) {
      case 'trash':
        result = await deleteEmail(accessTokenCookie, messageId);
        break;
      case 'permanent':
        result = await permanentlyDeleteEmail(accessTokenCookie, messageId);
        break;
      case 'restore':
        result = await restoreEmail(accessTokenCookie, messageId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "trash", "permanent", or "restore"' },
          { status: 400 }
        );
    }

    return NextResponse.json({ 
      success: true, 
      action,
      messageId,
      result 
    });
  } catch (error) {
    console.error('Error deleting email:', error);
    return NextResponse.json(
      { error: 'Failed to delete email' },
      { status: 500 }
    );
  }
} 