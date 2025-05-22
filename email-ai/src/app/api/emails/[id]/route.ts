import { NextRequest, NextResponse } from 'next/server';
import { getEmailContent } from '@/lib/google';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    // Use the existing function to fetch a single email by ID
    const email = await getEmailContent(accessToken, id);
    return NextResponse.json({ email });
  } catch (error: unknown) {
    console.error('Error fetching email by ID:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch email';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 