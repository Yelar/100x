import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

async function generateEmailContent(prompt: string, userName: string) {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are an AI email assistant. Generate ONLY the main body of the email. Do NOT include a subject line, greeting, signature, or any explanations. Output only the main email content, ready to be pasted into the email body.',
      },
      {
        role: 'user',
        content: `My name is ${userName}. Please consider this when generating the email body.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: 'compound-beta-mini',
    temperature: 0.7,
    max_tokens: 1000,
  });
  return (completion.choices[0]?.message?.content || '').trim();
}

async function generateSubjectLine(prompt: string, userName: string) {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are an AI email assistant. Return ONLY the subject line, nothing else. Do not include any explanations, preambles, or extra text. The subject line should be clear, concise, and professional.',
      },
      {
        role: 'user',
        content: `My name is ${userName}. Please consider this when generating the subject line.`,
      },
      {
        role: 'user',
        content: `Generate a subject line for an email about: ${prompt}`,
      },
    ],
    model: 'compound-beta-mini',
    temperature: 0.7,
    max_tokens: 100,
  });
  return (completion.choices[0]?.message?.content || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, type, userName } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (type === 'subject') {
      const subject = await generateSubjectLine(prompt, userName || '');
      return NextResponse.json({ subject });
    } else if (type === 'content') {
      const content = await generateEmailContent(prompt, userName || '');
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