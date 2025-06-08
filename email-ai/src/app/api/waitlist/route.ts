import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    await connectToDatabase();
    const Waitlist = mongoose.connection.collection('waitlist');
    const existing = await Waitlist.findOne({ email });
    if (existing) {
        console.log('Already on waitlist');
      return NextResponse.json({ message: 'Already on waitlist' }, { status: 200 });
    }
    await Waitlist.insertOne({ email, createdAt: new Date() });
    return NextResponse.json({ message: 'Added to waitlist' }, { status: 201 });
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 