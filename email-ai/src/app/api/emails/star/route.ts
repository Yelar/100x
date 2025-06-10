import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { starEmail } from '@/lib/google';

export async function POST(request: Request) {
  try {
    const { messageId, star } = await request.json();

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      );
    }

    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;

    if (!accessTokenCookie) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await starEmail(accessTokenCookie, messageId, star);

    return NextResponse.json({
      success: true,
      starred: star,
      result
    });
  } catch (error) {
    console.error('Error starring/unstarring email:', error);
    return NextResponse.json(
      { error: 'Failed to update star status' },
      { status: 500 }
    );
  }
}