import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getGmailMessages } from '@/lib/google';

export async function GET(request: Request) {
  try {
    // Get cookies as a plain object to avoid type issues
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const maxResults = parseInt(url.searchParams.get('maxResults') || '100', 10);
    
    try {
      // Get email metadata from Gmail
      const { emails, nextPageToken } = await getGmailMessages(accessToken, {
        query,
        maxResults
      });

      // Return the email context data
      return NextResponse.json({
        emailContext: emails,
        nextPageToken,
        query: query || null
      });
    } catch (error: any) {
      // Check if error is due to token expiration
      if (error?.response?.status === 401) {
        // Try to refresh the token
        const refreshResponse = await fetch(`${request.url.split('/api/')[0]}/api/auth/refresh`, {
          method: 'POST',
        });
        
        if (!refreshResponse.ok) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }
        
        // Get the new access token from cookies
        const newCookieStore = await cookies();
        const newAccessToken = newCookieStore.get('access_token')?.value;
        
        if (!newAccessToken) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }
        
        // Retry the request with new token
        const { emails, nextPageToken } = await getGmailMessages(newAccessToken, {
          query,
          maxResults
        });
        
        return NextResponse.json({
          emailContext: emails,
          nextPageToken,
          query: query || null
        });
      }
      
      // Re-throw if it's not a token expiration error
      throw error;
    }
  } catch (error) {
    console.error('Error fetching email context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email context' },
      { status: 500 }
    );
  }
} 