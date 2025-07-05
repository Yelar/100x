import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Apply auth rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'auth');
    if (rateLimitResponse) return rateLimitResponse;

    const url = getAuthUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}