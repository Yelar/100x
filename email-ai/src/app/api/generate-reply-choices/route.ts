import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

interface GeneratedChoice {
  id: string;
  content: string;
  tone: string;
  description: string;
}

async function generateReplyChoices(
  originalSubject: string, 
  originalContent: string, 
  recipientEmail: string
): Promise<GeneratedChoice[]> {
  
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are an expert email assistant helping users create contextual reply choices.
Analyze the original email and provide 3-4 different reply options that are appropriate for the situation.

ANALYSIS INSTRUCTIONS:
- Determine the email type (meeting invitation, question, request, proposal, etc.)
- Consider the tone and formality level of the original email
- Generate diverse response options (positive, negative, neutral, requesting more info)

REPLY CHOICE GUIDELINES:
- Keep replies concise but complete (1-3 sentences max)
- Make them sound natural and conversational
- Include appropriate context from the original email
- No generic responses - make them specific to the situation
- No signatures or formal closings needed

REQUIRED JSON FORMAT (return exactly this structure):
{
  "choices": [
    {
      "id": "choice_1",
      "content": "Actual reply text here",
      "tone": "positive/negative/neutral/curious",
      "description": "Brief description of this choice"
    }
  ]
}

EXAMPLES BY EMAIL TYPE:

Meeting Invitation:
- Positive: "Sounds great! I'll be there at [time]. Looking forward to it."
- Negative: "Thanks for the invite, but I won't be able to make it. Could we reschedule?"
- Conditional: "I might be able to join depending on my schedule. I'll confirm by tomorrow."

Question/Request:
- Helpful: "Sure! Here's what you need: [specific info]"
- Redirect: "I'm not the best person for this, but [colleague] would know. Let me connect you."
- Need more info: "I'd be happy to help! Could you provide a bit more detail about [specific aspect]?"

Return ONLY the JSON object. No markdown, no explanations.`,
      },
      {
        role: 'user',
        content: `Generate reply choices for this email:

Subject: ${originalSubject}
From: ${recipientEmail}

Content:
${originalContent}

Please analyze this email and provide appropriate reply options.`,
      },
    ],
    model: 'gemma2-9b-it',
    temperature: 0.8,
    max_tokens: 1500,
  });

  const response = completion.choices[0]?.message?.content || '';
  console.log('Raw AI response for reply choices:', response);

  try {
    // Clean the response
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find and extract the JSON object
    const firstBrace = cleanedResponse.indexOf('{');
    const lastBrace = cleanedResponse.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
    }
    
    // Fix common JSON issues
    cleanedResponse = cleanedResponse.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    
    console.log('Cleaned response:', cleanedResponse);
    
    const parsed = JSON.parse(cleanedResponse);
    
    if (parsed.choices && Array.isArray(parsed.choices)) {
      return parsed.choices.map((choice: { id?: string; content?: string; tone?: string; description?: string }, index: number) => ({
        id: choice.id || `choice_${index + 1}`,
        content: (choice.content || '').toString().trim(),
        tone: (choice.tone || 'neutral').toString().toLowerCase(),
        description: (choice.description || '').toString().trim()
      }));
    }
    
    // Fallback if structure is different
    throw new Error('Invalid choices structure');
    
  } catch (e) {
    console.error('JSON parsing error for reply choices:', e);
    console.error('Raw response was:', response);
    
    // Fallback: create generic choices based on email type detection
    const subject = originalSubject.toLowerCase();
    const content = originalContent.toLowerCase();
    
    if (subject.includes('meeting') || content.includes('meeting') || content.includes('schedule')) {
      return [
        {
          id: 'meeting_yes',
          content: "Sounds great! I'll be there. Looking forward to it.",
          tone: 'positive',
          description: 'Accept the meeting'
        },
        {
          id: 'meeting_no',
          content: "Thanks for the invite, but I won't be able to make it. Could we reschedule?",
          tone: 'negative',
          description: 'Decline and reschedule'
        },
        {
          id: 'meeting_maybe',
          content: "I might be able to join depending on my schedule. I'll confirm by tomorrow.",
          tone: 'neutral',
          description: 'Tentative response'
        }
      ];
    } else if (content.includes('?') || subject.includes('question')) {
      return [
        {
          id: 'helpful_yes',
          content: "Sure, I'd be happy to help! Let me get back to you with the details.",
          tone: 'positive',
          description: 'Offer to help'
        },
        {
          id: 'need_info',
          content: "I'd love to help! Could you provide a bit more detail about what you need?",
          tone: 'curious',
          description: 'Request more information'
        },
        {
          id: 'redirect',
          content: "I'm not the best person for this, but I think [colleague] would know. Let me connect you.",
          tone: 'neutral',
          description: 'Redirect to someone else'
        }
      ];
    } else {
      return [
        {
          id: 'positive',
          content: "Thanks for reaching out! This sounds good to me.",
          tone: 'positive',
          description: 'Positive response'
        },
        {
          id: 'neutral',
          content: "Thanks for the message. I'll review this and get back to you.",
          tone: 'neutral',
          description: 'Acknowledge and defer'
        },
        {
          id: 'more_info',
          content: "Interesting! Could you tell me more about this?",
          tone: 'curious',
          description: 'Ask for more details'
        }
      ];
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { originalSubject, originalContent, recipientEmail } = await req.json();

    if (!originalSubject || !originalContent) {
      return NextResponse.json(
        { error: 'Original subject and content are required' },
        { status: 400 }
      );
    }

    const choices = await generateReplyChoices(
      originalSubject, 
      originalContent, 
      recipientEmail || 'sender'
    );

    return NextResponse.json({ choices });
    
  } catch (error) {
    console.error('Error in generate-reply-choices API route:', error);
    return NextResponse.json(
      { error: 'Failed to generate reply choices' },
      { status: 500 }
    );
  }
}
