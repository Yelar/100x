import { NextRequest, NextResponse } from 'next/server';
import { generateEmailContent, generateSubjectLine } from '@/lib/groq';

export async function POST(req: NextRequest) {
  try {
    const { prompt, type } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (type === 'subject') {
      const subject = await generateSubjectLine(prompt);
      return NextResponse.json({ subject });
    } else if (type === 'content') {
      const content = await generateEmailContent(prompt);
      return NextResponse.json({ content });
    } else {
      return NextResponse.json(
        { error: 'Invalid generation type' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in generate API route:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
} 