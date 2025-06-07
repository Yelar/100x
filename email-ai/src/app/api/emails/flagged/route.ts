import { NextResponse } from 'next/server';
import { flagEmailWithGroq } from '@/lib/groq';

// In-memory cache to simulate localStorage for demo purposes
const flaggedCache: { [id: string]: { flag: string, subject: string, snippet: string, sender: string, flaggedAt: number } } = {};

export async function POST(request: Request) {
  try {
    const { emails } = await request.json(); // [{ id, subject, snippet, sender }]
    if (!Array.isArray(emails)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Only keep the latest 20 flagged emails
    const sortedIds = Object.entries(flaggedCache)
      .sort((a, b) => b[1].flaggedAt - a[1].flaggedAt)
      .map(([id]) => id);
    for (const id of sortedIds.slice(20)) {
      delete flaggedCache[id];
    }

    // Map input emails to output in the same order
    const results = await Promise.all(emails.map(async (email: { id: string, subject: string, snippet: string, sender: string }) => {
      if (flaggedCache[email.id]) {
        return {
          id: email.id,
          subject: flaggedCache[email.id].subject,
          snippet: flaggedCache[email.id].snippet,
          sender: flaggedCache[email.id].sender,
          flag: flaggedCache[email.id].flag,
        };
      } else {
        const flag = await flagEmailWithGroq({ subject: email.subject, snippet: email.snippet, sender: email.sender });
        flaggedCache[email.id] = {
          flag,
          subject: email.subject,
          snippet: email.snippet,
          sender: email.sender,
          flaggedAt: Date.now(),
        };
        return {
          id: email.id,
          subject: email.subject,
          snippet: email.snippet,
          sender: email.sender,
          flag,
        };
      }
    }));

    return NextResponse.json({ flagged: results });
  } catch (error) {
    console.error('Error in flagged route:', error);
    return NextResponse.json({ error: 'Failed to flag emails' }, { status: 500 });
  }
} 
