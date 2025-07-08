import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const email = cookieStore.get('user_email')?.value;

    // If no email cookie, we cannot determine the account to delete -> unauthorized
    if (!email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Delete related rows first to satisfy any FK / constraints
    await prisma.chatUsage.deleteMany({ where: { userEmail: email } });
    await prisma.waitlist.deleteMany({ where: { email } });

    // Delete user
    await prisma.user.delete({ where: { email } });

    // Clear auth cookies
    const response = NextResponse.json({ message: 'Account deleted' });
    const expire = { httpOnly: true, maxAge: 0, path: '/', sameSite: 'lax' as const };
    response.cookies.set('access_token', '', expire);
    response.cookies.set('refresh_token', '', expire);
    response.cookies.set('user_email', '', expire);
    response.cookies.set('temp_user_info', '', { ...expire, httpOnly: false });

    return response;
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 