import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error in auth/google:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
} 