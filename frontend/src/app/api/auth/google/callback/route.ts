import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8000';

export async function GET(request: Request) {
  try {
    // Get the code from URL parameters
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return NextResponse.json( 
        { error: 'No authentication code provided' },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/auth/google/callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      }
    ); 

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      throw new Error(`Backend error: ${errorText}`);
    }

    const data = await backendResponse.json();

    if (!data.access_token || !data.user_info) {
      throw new Error('Invalid response data structure from backend');
    }

    // For GET requests, we'll redirect to the dashboard with the data
    const redirectUrl = new URL('/dashboard', request.url);
    const response = NextResponse.redirect(redirectUrl);
    
    // Set cookies for authentication
    response.cookies.set('access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    if (data.refresh_token) {
      response.cookies.set('refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      });
    }

    // Add script to store user info in localStorage
    const script = `
      <script>
        window.localStorage.setItem('user_info', '${JSON.stringify(data.user_info)}');
        window.location.href = '${redirectUrl}';
      </script>
    `;
    
    return new NextResponse(script, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    // Redirect to login page with error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Authentication failed');
    return NextResponse.redirect(loginUrl);
  }
}

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'No authentication code provided' },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/auth/google/callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      }
    );

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      throw new Error(`Backend error: ${errorText}`);
    }

    const data = await backendResponse.json();

    if (!data.access_token || !data.user_info) {
      throw new Error('Invalid response data structure from backend');
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 