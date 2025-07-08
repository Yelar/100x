import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    const existing = await prisma.waitlist.findUnique({ where: { email } });
    if (existing) {
        console.log('Already on waitlist');
      return NextResponse.json({ message: 'Already on waitlist' }, { status: 200 });
    }
    await prisma.waitlist.create({ data: { email } });
    return NextResponse.json({ message: 'Added to waitlist' }, { status: 201 });
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 