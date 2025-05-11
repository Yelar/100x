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

    try {
      const emails = await getGmailMessages(accessTokenCookie);
      return NextResponse.json({ emails });
    } catch (error: any) {
      // Check if error is due to token expiration
      if (error?.response?.status === 401) {
        // Try to refresh the token
        const refreshResponse = await fetch('http://localhost:3000/api/auth/refresh', {
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
        const emails = await getGmailMessages(newAccessToken);
        return NextResponse.json({ emails });
      }

      throw error; // Re-throw if it's not a token expiration error
    }
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
} 