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
  }
} 