import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGmailMessages } from '@/lib/google';

export async function GET() {
  try {
    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;

    if (!accessTokenCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const emails = await getGmailMessages(accessTokenCookie);
    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
} 