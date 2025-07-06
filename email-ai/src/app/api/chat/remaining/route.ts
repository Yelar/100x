import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectToDatabase from '@/lib/mongodb';
import ChatUsage from '@/models/ChatUsage';
import { getAccessToken } from '@/lib/auth';

const DAILY_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    // Auth
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const queryEmail = url.searchParams.get('email');
    const cookieStore = await cookies();
    const email = queryEmail || cookieStore.get('user_email')?.value;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectToDatabase();

    const todayStr = new Date().toISOString().split('T')[0];
    const usage = await ChatUsage.findOne({ userEmail: email, date: todayStr });
    const remaining = Math.max(0, DAILY_LIMIT - (usage?.count || 0));

    return NextResponse.json({ limit: DAILY_LIMIT, remaining });
  } catch (error) {
    console.error('Chat remaining error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 