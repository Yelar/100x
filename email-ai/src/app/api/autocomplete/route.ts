import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { getAccessToken } from '@/lib/auth';

const apiKey = process.env.GROQ_API_KEY;

const PROMPT_TEMPLATE = `You are an autocomplete assistant for email composition. Given the user's partial sentence, continue it naturally and professionally. Only return the completion, nothing else.

User Name: {userName}
User Email: {userEmail}

Partial sentence: "{textBeforeCursor}"

Completion:`;
function buildPrompt(vars: Record<string,string>): string {
  let prompt = PROMPT_TEMPLATE;
  for (const [key,value] of Object.entries(vars)) {
    prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit – treat as AI endpoint
    const rateLimitResponse = await applyRateLimit(request, 'ai');
    if (rateLimitResponse) return rateLimitResponse;

    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    // Auth check
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { sentence, userData } = await request.json();

    if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid sentence' }, { status: 400 });
    }

    // Use Groq completion to continue sentence
    const completionRequest = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemma2-9b-it',
        messages: [
          {
            role: 'system',
            content: buildPrompt({ 
              textBeforeCursor: sentence,
              userName: userData?.name || '',
              userEmail: userData?.email || ''
            })
          },
          {
            role: 'user',
            content: sentence
          }
        ],
        max_tokens: 32,
        temperature: 0.7,
        stop: ['\n']
      })
    });

    if (!completionRequest.ok) {
      const text = await completionRequest.text();
      console.error('Groq error:', text);
      return NextResponse.json({ error: 'Autocomplete failed' }, { status: 500 });
    }

    const data = await completionRequest.json();
    const completion = data?.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ completion });
  } catch (error) {
    console.error('Autocomplete endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 