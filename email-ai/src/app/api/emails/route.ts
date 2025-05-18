import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGmailMessages } from '@/lib/google';

interface GmailError {
  response?: {
    status?: number;
  };
  message?: string;
}

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
      const { messages, nextPageToken } = await getGmailMessages(accessTokenCookie, {
        pageToken: pageToken || undefined,
        query: query || undefined,
        maxResults: maxResults ? parseInt(maxResults) : undefined
      });
      return NextResponse.json({ messages, nextPageToken });
    } catch (error: unknown) {
      // Check if error is due to token expiration
      const gmailError = error as GmailError;
      if (gmailError?.response?.status === 401) {
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
        const { messages, nextPageToken } = await getGmailMessages(newAccessToken, {
          pageToken: pageToken || undefined,
          query: query || undefined,
          maxResults: maxResults ? parseInt(maxResults) : undefined
        });
        return NextResponse.json({ messages, nextPageToken });
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