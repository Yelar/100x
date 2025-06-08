import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    await connectToDatabase();
    const Waitlist = mongoose.connection.collection('waitlist');
    const count = await Waitlist.countDocuments();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Waitlist count error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 