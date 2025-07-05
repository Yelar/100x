import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { applyRateLimit } from '@/lib/rate-limit';

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
        content: `You are helping ${userName} rewrite their email content.
${userName} has drafted some text and wants you to improve it while maintaining their voice and intent.
- Rewrite the content to sound like ${userName} is personally writing it
- DO NOT change the core meaning or intent
- DO NOT add greetings, closings, or signatures - ${userName} will handle those
- ONLY provide the rewritten body content
- ${toneInstruction}
- Make it sound natural and authentic to ${userName}'s communication style`,
      },
      {
        role: 'user',
        content: `I'm ${userName}. Please rewrite this email content for me:\n\n${prompt}`,
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
        content: `You are helping ${userName} create a subject line for their email.
Create a subject line that reflects ${userName}'s communication style and the email's purpose.
- Make it sound like ${userName} would naturally write it
- Keep it concise and relevant to the email content
- ${toneInstruction}
- Return ONLY the subject line text, no quotes or prefixes`,
      },
      {
        role: 'user',
        content: `I'm ${userName}. Create a subject line for my email about: ${prompt}`,
      },
    ],
    model: 'gemma2-9b-it',
    temperature: 0.7,
    max_tokens: 100,
  });
  return (completion.choices[0]?.message?.content || '').trim().replace(/^"|"$/g, '');
}

async function generateBothSubjectAndContent(prompt: string, userName: string, tone: string = 'professional') {
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
        content: `You are helping ${userName} write a complete email.
Generate both subject line and email content that sounds like ${userName} is personally writing it.

CRITICAL JSON FORMATTING RULES:
- Use \\n for line breaks in content (not actual newlines)
- Use \\" for quotes inside strings
- Do not use unnecessary backslashes before $ or other characters
- The JSON must be properly formatted

Required format:
{"subject": "Your Subject", "content": "Line 1\\n\\nLine 2\\n\\nLine 3"}

Writing Guidelines for ${userName}:
- Write as if ${userName} is personally composing this email
- ${toneInstruction}
- Make the content authentic and natural
- DO NOT add generic greetings like "Dear Sir/Madam" - keep it relevant
- DO NOT add signatures - ${userName} will handle that
- Focus on ${userName}'s specific request and context

EXAMPLE RESPONSE:
{"subject": "Quick Question About Project Timeline", "content": "Hi there,\\n\\nI wanted to follow up on the project we discussed last week. Could you let me know if the timeline we agreed on is still realistic?\\n\\nThanks!"}

Return ONLY the JSON object. No markdown, no explanations, no code blocks.`,
      },
      {
        role: 'user',
        content: `I'm ${userName} and I need to write an email about: ${prompt}`,
      },
    ],
    model: 'gemma2-9b-it',
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  const response = completion.choices[0]?.message?.content || '';
  console.log('Raw AI response:', response);
  
  try {
    // Clean the response by removing markdown formatting and extra text
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Remove any text before the first {
    const firstBrace = cleanedResponse.indexOf('{');
    if (firstBrace !== -1) {
      cleanedResponse = cleanedResponse.substring(firstBrace);
    }
    
    // Remove any text after the last }
    const lastBrace = cleanedResponse.lastIndexOf('}');
    if (lastBrace !== -1) {
      cleanedResponse = cleanedResponse.substring(0, lastBrace + 1);
    }
    
    // Fix JSON formatting issues:
    // 1. Replace actual newlines with escaped newlines in JSON strings
    cleanedResponse = cleanedResponse.replace(/"content":\s*"([^"]*(?:\\.[^"]*)*)"/, (match, content) => {
      // Replace actual newlines with \n in the content field
      const escapedContent = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      return `"content": "${escapedContent}"`;
    });
    
    // 2. Fix common JSON escape issues for other backslashes
    cleanedResponse = cleanedResponse.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    
    console.log('Cleaned response:', cleanedResponse);
    
    const parsed = JSON.parse(cleanedResponse);
    
    return {
      subject: (parsed.subject || 'Generated Subject').toString().trim(),
      content: (parsed.content || 'Could not generate content.').toString().trim()
    };
  } catch (e) {
    console.error('JSON parsing error:', e);
    console.error('Raw response was:', response);
    
    // Last resort: try to manually extract content if it looks like proper text
    const lines = response.split('\n').filter(line => line.trim());
    if (lines.length >= 2) {
      return {
        subject: lines[0].replace(/^subject:?\s*/i, '').replace(/['"]/g, '').trim() || 'Generated Subject',
        content: lines.slice(1).join('\n').trim() || 'Could not parse content from AI response.'
      };
    }
    
    // Ultimate fallback
    return {
      subject: 'AI Response Error',
      content: `The AI returned an unparseable response. Raw response: ${response}`
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Apply AI rate limiting
    const rateLimitResponse = await applyRateLimit(req, 'ai');
    if (rateLimitResponse) return rateLimitResponse;

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
    } else if (type === 'both') {
      const result = await generateBothSubjectAndContent(prompt, userName || '', tone || 'professional');
      return NextResponse.json(result);
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


