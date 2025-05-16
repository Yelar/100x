import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { cookies } from 'next/headers';
import { tools, ToolResult as ImportedToolResult } from '@/lib/tools';

export const maxDuration = 60; // Increased to allow for email content fetching

// Set your API key in .env.local as GROQ_API_KEY
const apiKey = process.env.GROQ_API_KEY;

// Define the email interface
interface EmailContext {
  id: string;
  from: string; 
  subject: string;
  date: string;
  snippet: string;
}

interface EmailContent extends EmailContext {
  body: string;
  summary?: string; // Add summary field
}

// Generate search keywords for the user question using Groq
async function generateSearchKeywords(userMessage: string): Promise<string[]> {
  if (!userMessage.trim()) {
    return [];
  }
  
  const prompt = [
    {
      role: 'system',
      content: `You are an assistant that generates effective search keywords for email search.
      Given a user's question, extract important keywords that would be most helpful for finding relevant emails.
      Return ONLY a JSON array of keywords, with no other text.`
    },
    {
      role: 'user',
      content: `User question: "${userMessage}"
      
      Generate specific search keywords (MAX 10) to find emails related to this question.
      Return as a JSON array of strings only, no other text. Format: ["keyword1", "keyword2"]`
    }
  ];
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'compound-beta-mini',
        messages: prompt,
        temperature: 0.2,
        max_tokens: 100
      })
    });
    
    if (!response.ok) {
      console.error('Groq API error generating keywords:', await response.text());
      // Fallback to basic keyword extraction
      return userMessage.split(/\s+/)
        .filter(word => word.length > 3 && !['what', 'when', 'where', 'which', 'this', 'that', 'have', 'from'].includes(word.toLowerCase()))
        .slice(0, 3);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    console.log('[INFO] Generated keywords:', content);
    if (!content) {
      return fallbackGenerateKeywords(userMessage);
    }
    
    try {
      // Extract JSON array from response
      const match = content.match(/\[([\s\S]*)\]/);
      if (match) {
        const keywords = JSON.parse(match[0]);
        return Array.isArray(keywords) ? keywords.slice(0, 3) : fallbackGenerateKeywords(userMessage);
      }
      return fallbackGenerateKeywords(userMessage);
    } catch (error) {
      console.error('Error parsing keywords response:', error);
      return fallbackGenerateKeywords(userMessage);
    }
  } catch (error) {
    console.error('Error calling Groq for keyword generation:', error);
    return fallbackGenerateKeywords(userMessage);
  }
}

// Fallback keyword generation
function fallbackGenerateKeywords(userMessage: string): string[] {
  const words = userMessage.split(/\s+/);
  const keywords = words
    .filter(word => word.length > 3 && !['what', 'when', 'where', 'which', 'this', 'that', 'have', 'from'].includes(word.toLowerCase()))
    .slice(0, 3);
  
  return keywords.length > 0 ? keywords : ['recent'];
}

// This function fetches emails by a specific search term
async function fetchEmailsByKeyword(keyword: string, maxResults: number = 5): Promise<EmailContext[]> {
  try {
    const cookiesList = await cookies();
    const accessTokenCookie = cookiesList.get('access_token')?.value;
    
    if (!accessTokenCookie) {
      console.error('No access token found');
      return [];
    }
    
    // Use the existing email context API with the search term
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/emails/context?query=${encodeURIComponent(keyword)}&maxResults=${maxResults}`, {
      method: 'GET',
      headers: {
        Cookie: cookiesList.toString()
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch emails by keyword:', await response.text());
      return [];
    }
    
    const data = await response.json();
    return data.emailContext || [];
  } catch (error) {
    console.error(`Error fetching emails for keyword "${keyword}":`, error);
    return [];
  }
}

// This function determines which emails might be relevant to the user's query
// using Groq LLM instead of programmatic matching
async function identifyRelevantEmails(emails: EmailContext[], userMessage: string): Promise<string[]> {
  // Skip if no emails or query
  if (!emails.length || !userMessage.trim()) {
    return [];
  }
  
  // Prepare email summaries for the LLM
  const emailSummaries = emails.map((email, index) => {
    return `Email ${index + 1}:
    ID: ${email.id}
    From: ${email.from}
    Subject: ${email.subject}
    Date: ${email.date}
    Snippet: ${email.snippet}
    `;
  }).join('\n\n');
  // Construct the prompt for Groq
  const prompt = [
    {
      role: 'system',
      content: `You are an assistant that analyzes which emails are relevant to a user's query.
      You'll be given email metadata and a query, and you need to identify which emails are most likely to contain information related to the query.
      Return ONLY the IDs of relevant emails as a JSON array, with no other text. If no emails are relevant, return an empty array.`
    },
    {
      role: 'user',
      content: `Here are the emails:
      
      ${emailSummaries}
      
      User query: "${userMessage}"
      
      Identify the email IDs that are most relevant to this query. Return them as a JSON array of strings, with no other text.
      Limit your selection to at most 5 emails that are actually relevant - don't include marginally relevant ones.
      Format: ["id1", "id2", ...]`
    }
  ];
  
  try {
    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'compound-beta-mini',
        messages: prompt,
        temperature: 0.2, // Lower temperature for more focused responses
        max_tokens: 8192
      })
    });
    if (!response.ok) {
      console.error('Groq API error:', await response.text());
      // Fall back to simple matching if API fails
      return fallbackIdentifyRelevantEmails(emails, userMessage);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackIdentifyRelevantEmails(emails, userMessage);
    }
    
    try {
      // Extract JSON array from response
      const match = content.match(/\[([\s\S]*)\]/);
      if (match) {
        const emailIds = JSON.parse(match[0]);
        return Array.isArray(emailIds) ? emailIds.slice(0, 5) : [];
      }
      return fallbackIdentifyRelevantEmails(emails, userMessage);
    } catch (error) {
      console.error('Error parsing Groq response:', error);
      return fallbackIdentifyRelevantEmails(emails, userMessage);
    }
  } catch (error) {
    console.error('Error calling Groq for email relevance:', error);
    return fallbackIdentifyRelevantEmails(emails, userMessage);
  }
}

// Fallback function if Groq API fails
function fallbackIdentifyRelevantEmails(emails: EmailContext[], userMessage: string): string[] {
  // Convert user message to lowercase for case-insensitive matching
  const query = userMessage.toLowerCase();
  
  // Keywords that might indicate interest in specific emails
  const searchTerms = query.split(/\s+/).filter(term => term.length > 3);
  
  // Identify potentially relevant emails based on simple matching
  return emails.filter(email => {
    const from = email.from.toLowerCase();
    const subject = email.subject.toLowerCase();
    const snippet = email.snippet.toLowerCase();
    
    // Check for direct mentions of sender
    if (from.includes('@') && query.includes(from.split('@')[0])) return true;
    if (from.includes('<') && query.includes(from.split('<')[0].trim().toLowerCase())) return true;
    
    // Check for subject mentions
    if (searchTerms.some(term => subject.includes(term))) return true;
    
    // Check for content mentions in snippet
    if (searchTerms.some(term => snippet.includes(term))) return true;
    
    // Check for specific requests about recent emails
    if ((query.includes('latest') || query.includes('recent')) && 
        new Date(email.date).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
    
    return false;
  }).map(email => email.id).slice(0, 5); // Limit to 5 most relevant emails
}

// This function fetches detailed content for specific emails
async function getEmailDetails(emailIds: string[]): Promise<EmailContent[] | null> {
  if (emailIds.length === 0) return [];
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/emails/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: (await cookies()).toString()
      },
      body: JSON.stringify({ emailIds })
    });
    
    if (!response.ok) {
      console.error('Failed to fetch email content:', await response.text());
      return null;
    }
    
    const data = await response.json();
    
    // Clean email content - extract text from HTML
    const cleanedEmails = data.emailContents.map((email: EmailContent) => {
      // Extract text from HTML content
      const cleanedBody = stripHtml(email.body);
      return {
        ...email,
        body: cleanedBody
      };
    });
    
    return cleanedEmails;
  } catch (error) {
    console.error('Error fetching email content:', error);
    return null;
  }
}

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

// Function to summarize email content using Groq
async function summarizeEmailContent(emails: EmailContent[]): Promise<EmailContent[]> {
  if (!emails.length) return [];
  
  try {
    // For each email, generate a summary of its content
    const emailsWithSummaries = await Promise.all(emails.map(async (email) => {
      // Skip if the email is too short to need summarization (less than 500 chars)
      if (email.body.length < 500) {
        return {
          ...email,
          summary: email.body
        };
      }
      
      // Prepare prompt for summarization
      const prompt = [
        {
          role: 'system',
          content: `You are an email summarizer that extracts key points from email content.
          Extract key points from the email in bullet point format.
          Be very concise and focus only on factual information, action items, and important details.
          Do not include introductory text or closing remarks.
          Format each bullet point with a dash (-) and a space before the text.`
        },
        {
          role: 'user',
          content: `Summarize the key points from this email:
          
          From: ${email.from}
          Subject: ${email.subject}
          Date: ${email.date}
          
          ${email.body.substring(0, 4000)}` // Limit to 4000 chars to avoid token limits
        }
      ];
      
      // Call Groq for summarization
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'compound-beta-mini',
          messages: prompt,
          temperature: 0.2,
          max_tokens: 300
        })
      });
      
      if (!response.ok) {
        console.error('Groq API error generating email summary:', await response.text());
        return {
          ...email,
          summary: `${email.snippet}... [Email too long to display in full]`
        };
      }
      
      const result = await response.json();
      const summary = result.choices?.[0]?.message?.content || email.snippet;
      
      // Format the summary for better display - ensure each bullet point is on a new line
      const formattedSummary = summary
        .replace(/•/g, '-') // Replace bullet characters with dashes
        .replace(/\n+/g, '\n') // Normalize line breaks
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .join('\n');
      
      return {
        ...email,
        summary: formattedSummary,
        // Keep the original body but mark it as processed
        body: email.body
      };
    }));
    
    return emailsWithSummaries;
  } catch (error) {
    console.error('Error summarizing emails:', error);
    // Fall back to using snippets if summarization fails
    return emails.map(email => ({
      ...email,
      summary: email.snippet
    }));
  }
}

// The main email search tool function that performs the multi-step process
async function searchEmails(query: string): Promise<ToolResult> {
  // Step 1: Generate search keywords
  const keywords = await generateSearchKeywords(query);
  console.log("Generated keywords:", keywords);
  
  // Step 2: Fetch emails for each keyword
  const emailsByKeyword: EmailContext[] = [];
  for (const keyword of keywords) {
    const emails = await fetchEmailsByKeyword(keyword);
    emailsByKeyword.push(...emails);
  }
  
  // Remove duplicates based on email ID
  const uniqueEmails = Array.from(
    new Map(emailsByKeyword.map(email => [email.id, email])).values()
  );
  
  console.log(`[INFO] Found ${uniqueEmails.length} unique emails across ${keywords.length} keywords`);
  
  if (uniqueEmails.length === 0) {
    return {
      relevant_emails: [],
      full_emails: [],
      analysis: "No emails found for the generated keywords",
      answer: "I couldn't find any emails related to your question."
    };
  }
  
  // Step 3: Identify relevant emails using the LLM
  const relevantEmailIds = await identifyRelevantEmails(uniqueEmails, query);

  const relevantMetadata = uniqueEmails.filter(email => 
    relevantEmailIds.includes(email.id)
  );
  
  // Step 4: Get detailed content for relevant emails
  const detailedEmails = await getEmailDetails(relevantEmailIds) || [];
  
  // Step 5: Summarize the content of each relevant email
  const summarizedEmails = await summarizeEmailContent(detailedEmails);
  
  // Return the result structure
  return {
    relevant_emails: relevantMetadata,
    full_emails: summarizedEmails,
    analysis: `Generated keywords: ${keywords.join(', ')}. Found ${uniqueEmails.length} emails, analyzed and identified ${summarizedEmails.length} relevant emails with summaries.`,
    answer: summarizedEmails.length > 0 
      ? `Found ${summarizedEmails.length} relevant emails that may address your question.` 
      : "I couldn't find specific emails that address your question."
  };
}

// Update the ToolResult interface to match the return type of searchEmails
interface ToolResult {
  relevant_emails: EmailContext[];
  full_emails: (EmailContent & { summary?: string })[];
  analysis: string;
  answer: string;
}

export async function POST(req: Request) {
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY environment variable not set' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  try {
    const { messages } = await req.json();
    
    // Get the user's latest message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // Execute the email search tool
    const toolResult = await searchEmails(userMessage);
    
    // Format the email data with summaries for better readability
    const formattedEmails = toolResult.full_emails.map(email => {
      return {
        id: email.id,
        from: email.from,
        subject: email.subject,
        date: email.date,
        key_points: email.summary || email.snippet,
        // Don't include the full body to save tokens and focus on the summary
      };
    });
    
    // Prepare system message with tool instructions and formatted email data
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant for an email client that provides EXTREMELY CONCISE answers.

Here are the relevant emails found for the query: "${userMessage}"

${formattedEmails.map((email, index) => `
EMAIL ${index + 1}:
ID: ${email.id}
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Core Facts:
${email.key_points}
`).join('\n')}

Analysis: ${toolResult.analysis}

When responding:
1. ALWAYS provide direct answers to questions - don't just refer to emails
2. Be EXTREMELY brief - use telegraphic style (omit articles, use minimal words)
3. Focus ONLY on core facts (dates, names, numbers, decisions)
4. Answer in 30 words or less when possible
5. Include [Email:ID] references after facts from specific emails
6. Only include information explicitly found in the emails
7. Do not add unnecessary commentary or explanations`
    };
    
    // Make sure the model is prompted to output JSON
    const systemFormatter = {
      role: 'system',
      content: `IMPORTANT: Format your ENTIRE response as a JSON object with the following structure:

{
  "thoughts": [
    "Generated search keywords to find relevant emails",
    "Retrieved email metadata matching those keywords",
    "Identified the most relevant emails",
    "Generated ultra-concise summaries of email content",
    "Analyzed email summaries to answer the question"
  ],
  "answer": "Your DIRECT and COMPLETE answer to the question in EXTREMELY CONCISE format. Include both the answer itself AND references to emails [Email:ID123]."
}

The email summaries contain just the core facts extracted from each email. Your answer should be equally brief and direct.

Keep answers under 30 words if possible. Omit articles and unnecessary words. Use telegraphic style. ALWAYS directly answer the question asked, then include relevant email references.`
    };
    
    // Add the system message to the conversation
    const augmentedMessages = [
      systemMessage,
      systemFormatter,
      ...messages
    ];
    console.log('[INFO] toolResult', formattedEmails.map((email, index) => `
    EMAIL ${index + 1}:
    ID: ${email.id}
    From: ${email.from}
    Subject: ${email.subject}
    Date: ${email.date}
    Core Facts:
    ${email.key_points}
    `).join('\n'));
    const result = streamText({
      model: groq('compound-beta-mini'),
      messages: augmentedMessages
    });

    const streamResponse = result.toDataStreamResponse();
    
    // Add explicit streaming headers
    streamResponse.headers.set('Content-Type', 'text/event-stream');
    streamResponse.headers.set('Cache-Control', 'no-cache');
    streamResponse.headers.set('Connection', 'keep-alive');
    
    return streamResponse;
  } catch (error) {
    console.error('Error calling Groq API:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
} 