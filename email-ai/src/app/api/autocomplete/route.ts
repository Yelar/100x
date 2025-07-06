import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { getAccessToken } from '@/lib/auth';

const apiKey = process.env.GROQ_API_KEY;

const PROMPT_TEMPLATE = `You are an autocomplete assistant for email composition. Your task is to CONTINUE the user's partial sentence naturally and professionally. Do NOT respond to the sentence or start a new thought. Simply continue from where the user left off.

User Name: {userName}
User Email: {userEmail}
Email Tone: {tone}

Conversation Context (for understanding the email topic):
{conversationContext}

User's partial sentence: "{textBeforeCursor}"

Continue this sentence naturally in a {tone} tone:`;

function buildPrompt(vars: Record<string,string>): string {
  let prompt = PROMPT_TEMPLATE;
  for (const [key,value] of Object.entries(vars)) {
    prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return prompt;
}

interface ThreadMessage {
  from: string;
  subject: string;
  body: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Autocomplete request received');
    
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

    // Validate request body
    let requestBody;
    try {
      const text = await request.text();
      console.log('Request body text:', text);
      if (!text || text.trim() === '') {
        console.log('Empty request body detected');
        return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
      }
      requestBody = JSON.parse(text);
      console.log('Parsed request body:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { sentence, userData, conversationContext, tone } = requestBody;

    if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
      console.log('Invalid sentence:', sentence);
      return NextResponse.json({ error: 'Invalid sentence' }, { status: 400 });
    }

    console.log('Processing autocomplete for sentence:', sentence);

    // Build conversation context string
    let contextString = 'No conversation context provided.';
    if (conversationContext) {
      if (conversationContext.originalSubject && conversationContext.originalContent) {
        // For replies, focus on the subject and key points from the original email
        const contentPreview = conversationContext.originalContent.length > 200 
          ? conversationContext.originalContent.substring(0, 200) + '...'
          : conversationContext.originalContent;
        contextString = `Email Topic: ${conversationContext.originalSubject}\nKey Points: ${contentPreview}`;
      } else if (conversationContext.threadMessages && conversationContext.threadMessages.length > 0) {
        // For threads, focus on the main topic and recent messages
        contextString = 'Email Thread Topic:\n';
        const recentMessages = conversationContext.threadMessages.slice(-3); // Last 3 messages
        recentMessages.forEach((msg: ThreadMessage, index: number) => {
          const contentPreview = msg.body.length > 100 
            ? msg.body.substring(0, 100) + '...'
            : msg.body;
          contextString += `${index + 1}. Subject: ${msg.subject}\nBrief: ${contentPreview}\n\n`;
        });
      }
    }

    console.log('Context string length:', contextString.length);

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
              userEmail: userData?.email || '',
              tone: tone || 'professional',
              conversationContext: contextString
            })
          },
          {
            role: 'user',
            content: sentence
          }
        ],
        max_tokens: 24,
        temperature: 0.3,
        top_p: 0.9,
        stop: ['\n', '.', '!', '?']
      })
    });

    if (!completionRequest.ok) {
      const text = await completionRequest.text();
      console.error('Groq error:', text);
      return NextResponse.json({ error: 'Autocomplete failed' }, { status: 500 });
    }

    const data = await completionRequest.json();
    const completion = data?.choices?.[0]?.message?.content?.trim() || '';

    console.log('Autocomplete completion:', completion);
    return NextResponse.json({ completion });
  } catch (error) {
    console.error('Autocomplete endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 