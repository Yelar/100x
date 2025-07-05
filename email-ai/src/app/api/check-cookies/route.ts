import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Apply default rate limiting
    const rateLimitResponse = await applyRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const cookiesList = await cookies();
    const allCookies = cookiesList.getAll().map(cookie => cookie.name);
    
    return NextResponse.json({
      availableCookies: allCookies,
      refreshToken: cookiesList.get('refresh_token') || 
                   cookiesList.get('jwt_refresh_token') ||
                   cookiesList.get('refreshToken') ? 'present' : 'not found',
      accessToken: cookiesList.get('access_token') || 
                  cookiesList.get('jwt_access_token') ||
                  cookiesList.get('accessToken') ? 'present' : 'not found'
    });
  } catch (error) {
    console.error('Error checking cookies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 