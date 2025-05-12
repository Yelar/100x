import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGmailMessages } from '@/lib/google';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pageToken = url.searchParams.get('pageToken');
    const query = url.searchParams.get('q');
    const maxResults = url.searchParams.get('maxResults');

    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;

    if (!accessTokenCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    try {
      const result = await getGmailMessages(accessTokenCookie, {
        pageToken: pageToken || undefined,
        query: query || undefined,
        maxResults: maxResults ? parseInt(maxResults) : undefined
      });
      return NextResponse.json(result);
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
        const result = await getGmailMessages(newAccessToken, {
          pageToken: pageToken || undefined,
          query: query || undefined,
          maxResults: maxResults ? parseInt(maxResults) : undefined
        });
        return NextResponse.json(result);
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