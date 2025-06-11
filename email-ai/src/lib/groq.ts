import { Groq } from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function generateEmailContent(prompt: string) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an AI email assistant. Return ONLY the email body, nothing else. Do not include any explanations, preambles, or extra text. The email should be professional, clear, and ready to send.',
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

    const emailContent = completion.choices[0]?.message?.content || '';
    return emailContent.trim();
  } catch (error) {
    console.error('Error generating email with Groq:', error);
    throw error;
  }
}

export async function generateSubjectLine(prompt: string) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an AI email assistant. Return ONLY the subject line, nothing else. Do not include any explanations, preambles, or extra text. The subject line should be clear, concise, and professional.',
        },
        {
          role: 'user',
          content: `Generate a subject line for an email about: ${prompt}`,
        },
      ],
      model: 'gemma2-9b-it',
      temperature: 0.7,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Error generating subject line with Groq:', error);
    throw error;
  }}

export async function flagEmailWithGroq({ subject, snippet, sender }: { subject: string, snippet: string, sender: string }) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert email categorization assistant. Analyze emails and classify them into one of these categories:

CATEGORIES:
- to_reply: Emails from REAL PEOPLE that require a response
- work: Professional/business communications (not requiring immediate reply)
- promotional: Marketing, newsletters, automated promotions
- other: Everything else

CRITICAL RULES FOR "to_reply":
✅ ONLY flag as "to_reply" if ALL these conditions are met:
1. Sender appears to be a REAL PERSON (not automated/company emails)
2. Email is DIRECTLY ADDRESSED to the recipient (not mass/cc)
3. Contains a QUESTION, REQUEST, or INVITATION that needs response
4. NOT automated (no "noreply", "no-reply", system notifications)
5. NOT newsletters, promotions, or marketing content
6. Shows clear expectation of a reply (uses "you", asks questions, requests action)

❌ NEVER flag as "to_reply":
- Automated emails (confirmations, receipts, notifications)
- Newsletters/marketing (even if personalized)
- No-reply addresses
- Company announcements
- System notifications
- Emails where sender doesn't expect a response
- Mass emails/mailing lists
- Job alerts, social media notifications
- Generic updates or FYI emails

EXAMPLES:
✅ "to_reply": "Hey John, can we meet tomorrow at 3pm?" from a colleague
✅ "to_reply": "Thanks for your proposal. Could you clarify the timeline?" from a client
❌ "work": "Weekly team update" (informational, no response needed)
❌ "promotional": "25% off sale this weekend!" 
❌ "other": "Your package has been delivered" (automated notification)

Return ONLY the category name. Be very conservative with "to_reply" - when in doubt, use "work" or "other".`,
        },
        {
          role: 'user',
          content: `Subject: ${subject}
Snippet: ${snippet}
Sender: ${sender}

Analyze this email and return the appropriate category.`,
        },
      ],
      model: 'gemma2-9b-it',
      temperature: 0.1, // Lower temperature for more consistent categorization
      max_tokens: 10,
    });
    
    const result = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'other';
    
    // Additional validation to ensure only valid categories are returned
    const validCategories = ['to_reply', 'work', 'promotional', 'other'];
    return validCategories.includes(result) ? result : 'other';
    
  } catch (error) {
    console.error('Error flagging email with Groq:', error);
    return 'other';
  }
} 