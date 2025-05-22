import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBatchEmailContent } from '@/lib/google';

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
    
    // Get the email IDs from the request body
    const { emailIds } = await request.json();
    
    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or missing emailIds in request body' },
        { status: 400 }
      );
    }
    
    // Limit the number of emails to fetch to prevent abuse
    const limitedIds = emailIds.slice(0, 30);

    try {
      // Fetch the content of the specified emails
      const emailContents = await getBatchEmailContent(accessTokenCookie, limitedIds);

      return NextResponse.json({ 
        emailContents,
        requestedCount: emailIds.length,
        fetchedCount: emailContents.length 
      });
    } catch (error: unknown) {
      // Check if error is due to token expiration
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && typeof error.response === 'object' && 
          'status' in error.response && error.response.status === 401) {
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
        const newCookiesList = await cookies();
        const newAccessToken = newCookiesList.get('access_token')?.value;

        if (!newAccessToken) {
          return NextResponse.json(
            { error: 'Token refresh failed' },
            { status: 401 }
          );
        }

        // Retry the request with new token
        const emailContents = await getBatchEmailContent(newAccessToken, limitedIds);

        return NextResponse.json({ 
          emailContents,
          requestedCount: emailIds.length,
          fetchedCount: emailContents.length 
        });
      }

      throw error; // Re-throw if it's not a token expiration error
    }
  } catch (error) {
    console.error('Error fetching email content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email content' },
      { status: 500 }
    );
  }
} 