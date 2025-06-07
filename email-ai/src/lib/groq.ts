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
          content: `You are an AI email assistant. Given an email's subject, snippet, and sender, return ONLY one of these categories as a single word: promotional, work, to_reply, other. Do not include any explanations, preambles, or extra text.`,
        },
        {
          role: 'user',
          content: `Subject: ${subject}\nSnippet: ${snippet}\nSender: ${sender}`,
        },
      ],
      model: 'gemma2-9b-it',
      temperature: 0.2,
      max_tokens: 10,
    });
    return completion.choices[0]?.message?.content?.trim().toLowerCase() || 'other';
  } catch (error) {
    console.error('Error flagging email with Groq:', error);
    return 'other';
  }
} 