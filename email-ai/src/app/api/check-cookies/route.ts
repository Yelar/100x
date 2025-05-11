import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
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
} 