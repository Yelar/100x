import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

async function generateEmailContent(prompt: string, userName: string, tone: string = 'professional') {
  const toneInstructions = {
    professional: 'Use a professional, respectful tone.',
    casual: 'Use a casual, friendly tone.',
    formal: 'Use a formal, official tone.',
    persuasive: 'Use a persuasive, compelling tone.',
    friendly: 'Use a warm, friendly tone.',
    urgent: 'Use an urgent, action-oriented tone.',
    apologetic: 'Use an apologetic, understanding tone.',
    confident: 'Use a confident, assertive tone.',
  };
  
  const toneInstruction = toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.professional;
  
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are rewriting email content. Take the user's existing email content and rewrite it in the specified tone. Do NOT write a response or answer to the content. Do NOT add greetings, closings, or signatures. Simply rewrite the exact same message in the requested tone. Keep the same meaning and intent, just change the style/tone. ${toneInstruction}`,
      },
      {
        role: 'user',
        content: `Rewrite this email content in the specified tone:`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    model: 'gemma2-9b-it',
    temperature: 0.7,
    max_tokens: 1000,
  });
  return (completion.choices[0]?.message?.content || '').trim();
}

async function generateSubjectLine(prompt: string, userName: string, tone: string = 'professional') {
  const toneInstructions = {
    professional: 'Use a professional, respectful tone.',
    casual: 'Use a casual, friendly tone.',
    formal: 'Use a formal, official tone.',
    persuasive: 'Use a persuasive, compelling tone.',
    friendly: 'Use a warm, friendly tone.',
    urgent: 'Use an urgent, action-oriented tone.',
    apologetic: 'Use an apologetic, understanding tone.',
    confident: 'Use a confident, assertive tone.',
  };
  
  const toneInstruction = toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.professional;
  
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `Generate ONLY the email subject line, nothing else. No explanations, no quotes, no extra text. Just the subject line text. ${toneInstruction}`,
      },
      {
        role: 'user',
        content: `My name is ${userName}. Please consider this when generating the subject line.`,
      },
      {
        role: 'user',
        content: `Create a subject line for this email content: ${prompt}`,
      },
    ],
    model: 'gemma2-9b-it',
    temperature: 0.7,
    max_tokens: 100,
  });
  return (completion.choices[0]?.message?.content || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, type, userName, tone } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (type === 'subject') {
      const subject = await generateSubjectLine(prompt, userName || '', tone || 'professional');
      return NextResponse.json({ subject });
    } else if (type === 'content') {
      const content = await generateEmailContent(prompt, userName || '', tone || 'professional');
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