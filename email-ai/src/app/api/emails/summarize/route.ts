import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAccessToken } from '@/lib/auth';
import { Groq } from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not set');
}

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

// Function to strip HTML and clean up text
function stripHtml(html: string): string {
  // Replace all HTML tags with spaces or appropriate replacements
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags and content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags and content
    .replace(/<[^>]+>/g, ' ') // Replace other tags with spaces
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>'); // Replace &gt; with >
  
  // Fix spacing issues - collapse multiple spaces into one
  text = text.replace(/\s+/g, ' ');
  
  // Split by paragraphs and format them nicely
  const paragraphs = text.split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  // Join paragraphs with double newlines for readability
  return paragraphs.join('\n\n').trim();
}

// Function to truncate text if it's too long
function truncateText(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export async function POST(req: Request) {
  try {
    const { emailIds } = await req.json();
    
    if (!emailIds || !Array.isArray(emailIds)) {
      return NextResponse.json({ error: 'Invalid email IDs' }, { status: 400 });
    }

    // Limit to first 10 emails
    const limitedEmailIds = emailIds.slice(0, 20);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get detailed content for each email
    const emails = await Promise.all(
      limitedEmailIds.map(async (id) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/emails/content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: (await cookies()).toString()
          },
          body: JSON.stringify({ emailIds: [id] })
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch email ${id}`);
        }

        const data = await response.json();
        const email = data.emailContents[0];
        
        // Clean and truncate the email body
        return {
          ...email,
          body: truncateText(stripHtml(email.body))
        };
      })
    );

    // Prepare the messages for Groq
    const messages: { role: "system" | "user"; content: string }[] = [
      {
        role: "system",
        content: `You are an email analysis assistant. Your task is to analyze emails and return a JSON object.
IMPORTANT: You must return ONLY a valid JSON object with no additional text or explanation.

The JSON object must have this exact structure:
{
  "individual_summaries": [
    {
      "id": "email_id",
      "summary": "brief summary",
      "type": "email_type"
    }
  ],
  "overall_summary": "comprehensive summary of all emails",
  "immediate_actions": ["list of actions needed"],
  "important_updates": ["list of important updates"],
  "categories": {
    "category_name": ["email_ids in this category"]
  }
}

Do not include any text before or after the JSON object.`
      },
      {
        role: "user",
        content: `Analyze these emails and return a JSON object with the specified structure:

${JSON.stringify(emails.map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
          body: email.body
        })))}`
      }
    ];

    // Check total message size
    const totalSize = JSON.stringify(messages).length;
    if (totalSize > 100000) { // 100KB limit
      return NextResponse.json(
        { error: 'Email content too large to process' },
        { status: 413 }
      );
    }

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No content in response');
    }

    try {
      const summary = JSON.parse(content);
      return NextResponse.json(summary);
    } catch (error) {
      console.error('Invalid JSON response:', content, error);
      throw new Error('Invalid response format from AI');
    }
  } catch (error) {
    console.error('Error summarizing emails:', error);
    return NextResponse.json(
      { error: 'Failed to summarize emails' },
      { status: 500 }
    );
  }
} 

