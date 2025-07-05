import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEmailThread } from '@/lib/google';
import { applyRateLimit } from '@/lib/rate-limit';

interface GmailError {
  response?: {
    status?: number;
  };
  message?: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    // Apply default rate limiting
    const rateLimitResponse = await applyRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { threadId } = await context.params;
    
    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;

    if (!accessTokenCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    try {
      const threadData = await getEmailThread(accessTokenCookie, threadId);
      
      // Also return the main email data for easy access
      const mainEmail = threadData.messages && threadData.messages.length > 0 
        ? threadData.messages[0] 
        : null;
      
      return NextResponse.json({
        ...threadData,
        mainEmail
      });
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
        const threadData = await getEmailThread(newAccessToken, threadId);
        
        // Also return the main email data for easy access
        const mainEmail = threadData.messages && threadData.messages.length > 0 
          ? threadData.messages[0] 
          : null;
        
        return NextResponse.json({
          ...threadData,
          mainEmail
        });
      }

      throw error; // Re-throw if it's not a token expiration error
    }
  } catch (error) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
} 