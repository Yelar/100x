import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { emailContent, subject } = await request.json();

    if (!emailContent) {
      return NextResponse.json(
        { error: 'Email content is required' },
        { status: 400 }
      );
    }

    // Clean up the email content
    const cleanContent = emailContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (cleanContent.length < 100) {
      return NextResponse.json(
        { summary: 'Email is too short to summarize.' },
        { status: 200 }
      );
    }

    const prompt = `Please provide a concise TLDR summary of this email. Focus on:
- Main points and key information
- Action items or requests
- Important dates, deadlines, or decisions
- Next steps or follow-ups needed

Email Subject: ${subject || 'No subject'}

Email Content:
${cleanContent}

Provide a bullet-pointed summary that's easy to scan and understand quickly.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are a professional email summarizer. Create concise, actionable TLDR summaries that highlight the most important information and action items from emails. Use bullet points and clear, professional language.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error generating TLDR:', error);
    return NextResponse.json(
      { error: 'Failed to generate TLDR summary' },
      { status: 500 }
    );
  }
} 