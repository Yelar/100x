import { NextResponse } from 'next/server';
import { getTokens, getUserInfo } from '@/lib/google';

export async function GET(request: Request) {
  try {
    // Get the code from URL parameters
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'No authentication code provided');
      return NextResponse.redirect(loginUrl);
    }

    // Get tokens from Google
    const tokens = await getTokens(code);
     
    // Get user info
    const userInfo = await getUserInfo(tokens.access_token!);

    // Create redirect response
    const redirectUrl = new URL('/dashboard', request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Set cookies for authentication
    response.cookies.set('access_token', tokens.access_token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 // 1 hour, matching Google's typical expiry
    });

    if (tokens.refresh_token) {
      response.cookies.set('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      });
    }

    response.cookies.set('user_email', userInfo.email!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    // Store user info in a temporary cookie to be read by client
    response.cookies.set('temp_user_info', JSON.stringify(userInfo), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 // 1 minute, just enough time to read it
    });

    return response;
  } catch (error) {
    console.error('Auth callback error:', error);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Authentication failed');
    return NextResponse.redirect(loginUrl);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'No authentication code provided' },
        { status: 400 }
      );
    }

    // Get tokens from Google
    const tokens = await getTokens(code);
    
    // Get user info
    const userInfo = await getUserInfo(tokens.access_token!);

    // Create response with cookies
    const response = NextResponse.json({
      user_info: userInfo,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

    // Set cookies on the response
    response.cookies.set('access_token', tokens.access_token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 // 1 hour, matching Google's typical expiry
    });

    if (tokens.refresh_token) {
      response.cookies.set('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      });
    }

    response.cookies.set('user_email', userInfo.email!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    return response;
  } catch (error) {
    console.error('Error in callback:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 