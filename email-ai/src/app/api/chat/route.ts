import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
// import { tools, ToolResult as ImportedToolResult } from '@/lib/tools';

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

// Define proper message type
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Generate search keywords for the user question using Groq with full conversation context
async function generateSearchKeywords(messages: Message[], currentDate?: string, userName?: string): Promise<string[]> {
  if (!messages.length) {
    return [];
  }
  
  // Get the latest user message
  const latestMessage = messages[messages.length - 1]?.content || '';
  if (!latestMessage.trim()) {
    return [];
  }
  
  // Parse the current date for date-aware queries
  const now = new Date(currentDate || new Date().toISOString());
  const formatDate = (date: Date) => date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Calculate common date ranges
  const today = formatDate(now);
  const yesterday = formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const lastWeekStart = formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const lastMonthStart = formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const thisYear = now.getFullYear().toString();
  
  // Build conversation context
  const conversationHistory = messages.slice(-6) // Last 6 messages for context
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');
  
  const prompt = [
    {
      role: 'system',
      content: `You are an expert Gmail search query generator that creates precise search queries to find relevant emails.

CONTEXT INFORMATION:
- User: ${userName || 'Unknown user'}
- Current Date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Today: ${today}
- Yesterday: ${yesterday}
- Last week started: ${lastWeekStart}
- Last month started: ${lastMonthStart}
- This year: ${thisYear}

GMAIL SEARCH OPERATORS (use these precisely):
- after:YYYY/MM/DD or after:YYYY/M/D (emails after date)
- before:YYYY/MM/DD or before:YYYY/M/D (emails before date)
- from:email@domain.com or from:"Name" (from specific sender)
- to:email@domain.com (to specific recipient)
- subject:"exact phrase" (exact phrase in subject)
- has:attachment (emails with attachments)
- is:unread (unread emails)
- is:important (important emails)
- category:primary/social/promotions/updates (Gmail categories)
- "exact phrase" (exact phrase anywhere in email)

DATE TRANSLATION RULES:
- "last week" → after:${lastWeekStart}
- "yesterday" → after:${yesterday} before:${today}
- "today" → after:${today}
- "recent" or "recently" → after:${lastWeekStart}
- "this month" → after:${lastMonthStart}
- "this year" → after:${thisYear}/01/01
- "past few days" → after:${formatDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000))}

QUERY ANALYSIS GUIDELINES:
1. If this is a follow-up question (uses "this", "that", "it", "them"), refer to previous conversation context
2. For sender queries ("emails from X"), always use from: operator
3. For date queries, ALWAYS include appropriate after:/before: operators
4. For subject queries, use subject: operator with quoted phrases
5. For content queries, use quoted phrases for exact matches
6. Combine operators intelligently (e.g., from:someone after:date)
7. Keep keyword count to 3-5 most relevant terms

RESPONSE FORMAT:
Return ONLY a JSON array of Gmail search terms/operators. Each element should be a complete, valid Gmail search operator or keyword.

EXAMPLES:
- "emails from john last week" → ["from:john", "after:${lastWeekStart}"]
- "university updates from yesterday" → ["university updates", "after:${yesterday}", "before:${today}"]
- "meeting invites with attachments" → ["meeting", "invite", "has:attachment"]
- "unread emails from stripe" → ["from:stripe", "is:unread"]
- "interview emails this month" → ["interview", "after:${lastMonthStart}"]`
    },
    {
      role: 'user',
      content: `CONVERSATION HISTORY:
${conversationHistory}

CURRENT QUERY: "${latestMessage}"

Based on the full conversation context and the current query, generate 3-5 Gmail search operators/keywords that will find the most relevant emails.

IMPORTANT INSTRUCTIONS:
1. Consider the conversation history - if this is a follow-up question, maintain context from previous messages
2. If the query mentions relative dates, convert them to Gmail after:/before: operators using current date context
3. If asking about specific senders, use from: operator
4. If asking about email content, include relevant keywords
5. Always prioritize precision over broad matching
6. Return ONLY the JSON array, no other text

Format: ["search_term1", "from:sender", "after:2024/01/15"]`
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
        model: 'gemma2-9b-it',
        messages: prompt,
        temperature: 0.1, // Lower temperature for more consistent results
        max_tokens: 300
      })
    });
    
    if (!response.ok) {
      console.error('Groq API error generating keywords:', await response.text());
      return fallbackGenerateKeywords(latestMessage);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    console.log('[INFO] Generated search query response:', content);
    
    if (!content) {
      return fallbackGenerateKeywords(latestMessage);
    }
    
    try {
      // Extract JSON array from response - try multiple patterns
      let keywords: string[] = [];
      
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[([\s\S]*)\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          keywords = parsed.filter(k => typeof k === 'string' && k.trim().length > 0);
        }
      }
      
      // If no valid keywords found, try fallback
      if (keywords.length === 0) {
        console.warn('No valid keywords extracted from LLM response:', content);
        return fallbackGenerateKeywords(latestMessage);
      }
      
      // Limit to 5 keywords max and clean them
      const cleanedKeywords = keywords
        .slice(0, 5)
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      console.log('[INFO] Final search keywords:', cleanedKeywords);
      return cleanedKeywords;
      
    } catch (error) {
      console.error('Error parsing keywords response:', error);
      return fallbackGenerateKeywords(latestMessage);
    }
  } catch (error) {
    console.error('Error calling Groq for keyword generation:', error);
    return fallbackGenerateKeywords(latestMessage);
  }
}

// Fallback keyword generation
function fallbackGenerateKeywords(latestUserMessage: string): string[] {
  const words = latestUserMessage.split(/\s+/);
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
        model: 'gemma2-9b-it',
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
          model: 'gemma2-9b-it',
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

// Update the ToolResult interface to match the return type of searchEmails
interface ToolResult {
  relevant_emails: EmailContext[];
  full_emails: (EmailContent & { summary?: string })[];
  analysis: string;
  answer: string;
}

export async function POST(request: NextRequest) {
  try {
    // Apply AI rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'ai');
    if (rateLimitResponse) return rateLimitResponse;

    // Parse request body once to extract data
    const { messages, userName, userEmail, currentDate } = await request.json();

    // Determine user email (required for per-user limits)
    const cookieStore = await cookies();
    const email = userEmail || cookieStore.get('user_email')?.value;
    if (!email) {
      return NextResponse.json({ error: 'User email is required for chat usage tracking' }, { status: 400 });
    }

    // Enforce daily chat limit (tracked in Postgres via Prisma)
    const todayStr = new Date().toISOString().split('T')[0];

    let usage = await prisma.chatUsage.findUnique({
      where: { userEmail_date: { userEmail: email, date: todayStr } },
    });

    if (usage && usage.count >= 20) {
      return NextResponse.json(
        { error: 'Daily chat limit reached', remaining: 0 },
        { status: 429 }
      );
    }

    if (!usage) {
      usage = await prisma.chatUsage.create({
        data: { userEmail: email, date: todayStr, count: 0 },
      });
    }

    usage = await prisma.chatUsage.update({
      where: { id: usage.id },
      data: { count: usage.count + 1 },
    });

    const remainingChats = Math.max(0, 20 - usage.count);

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

    // Get the user's latest message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // Parse the current date for date-aware queries
    const now = new Date(currentDate || new Date().toISOString());
    const formatDate = (date: Date) => date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Calculate common date ranges for reference
    const today = formatDate(now);
    const yesterday = formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const lastWeekStart = formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const lastMonthStart = formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    
    // Execute the email search tool
    const toolResult = await searchEmails(messages, currentDate, userName);
    
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
      content: `You are an AI assistant for ${userName || 'the user'}'s email client that provides EXTREMELY CONCISE answers.

USER CONTEXT:
- User Name: ${userName || 'Unknown'}
- User Email: ${userEmail || 'Unknown'}
- Current Date: ${currentDate ? new Date(currentDate).toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
}) : 'Unknown'}
- Today: ${today}
- Yesterday: ${yesterday}
- Last Week Started: ${lastWeekStart}
- Last Month Started: ${lastMonthStart}

DATE AWARENESS:
When users mention relative dates (e.g., "last week", "yesterday", "this month"), use the current date context to understand what they mean. For searches involving dates, generate appropriate Gmail search queries like:
- "last week" → after:${lastWeekStart}
- "yesterday" → after:${yesterday} before:${today}
- "this month" → after:${lastMonthStart}
- "recent" → after:${lastWeekStart}

TOOLS AVAILABLE:
1. search_emails: Search and analyze emails to answer the user query.
2. compose_email: Draft an email (subject and content) based on the user's message. The recipient will be entered manually by the user in the UI dialog. Use this tool when the user wants to send a new email or requests to compose an email.

IMPORTANT: When the user wants to compose an email, format your response as:
{
  "thoughts": ["Understood email request", "Drafting email content"],
  "answer": "I'll help you compose that email.",
  "triggerRecipientDialog": true,
  "subject": "Your generated subject line",
  "content": "Your generated email content"
}

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
7. Do not add unnecessary commentary or explanations
8. When user wants to compose an email, use the compose_email tool format shown above
9. MOST IMPORTANTLY, GENERATE CYRILLIC SYMBOLS WHEN ANSWERING ON RUSSIAN CORRECTLY. NO Symbols like Ã ÂŸÃ Â¾Ã`
    };
    
    // Make sure the model is prompted to output JSON
    const systemFormatter = {
      role: 'system',
      content: `IMPORTANT: Format your ENTIRE response as a JSON object with one of these structures:

For regular responses:
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

For email composition requests:
{
  "thoughts": ["Understood email request", "Drafting email content"],
  "answer": "I'll help you compose that email.",
  "triggerRecipientDialog": true,
  "subject": "Your generated subject line",
  "content": "Your generated email content"
}

The email summaries contain just the core facts extracted from each email. Your answer should be equally brief and direct.

Keep answers under 30 words if possible. Omit articles and unnecessary words. Use telegraphic style. ALWAYS directly answer the question asked, then include relevant email references.

When the user wants to compose an email, use the email composition format to trigger the compose dialog.`
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
      model: groq('gemma2-9b-it'),
      messages: augmentedMessages
    });

    const streamResponse = result.toDataStreamResponse();
    
    // Add explicit streaming headers
    streamResponse.headers.set('Content-Type', 'text/event-stream');
    streamResponse.headers.set('Cache-Control', 'no-cache');
    streamResponse.headers.set('Connection', 'keep-alive');
    // Chat usage headers
    streamResponse.headers.set('X-Chat-Limit', '20');
    streamResponse.headers.set('X-Chat-Remaining', String(remainingChats));
    
    return streamResponse;
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// The main email search tool function that performs the multi-step process
async function searchEmails(messages: Message[], currentDate?: string, userName?: string): Promise<ToolResult> {
  const query = messages[messages.length - 1]?.content || '';
  console.log(`[INFO] Starting email search for query: "${query}"`);
  
  // Step 1: Generate search keywords using the LLM
  const keywords = await generateSearchKeywords(messages, currentDate, userName);
  console.log(`[INFO] Generated keywords: ${keywords.join(', ')}`);
  
  if (keywords.length === 0) {
    return {
      relevant_emails: [],
      full_emails: [],
      analysis: "No keywords could be generated for the query",
      answer: "I couldn't understand your question well enough to search for emails."
    };
  }
  
  // Step 2: Search for emails using the generated keywords
  const emailsByKeyword: EmailContext[] = [];
  for (const keyword of keywords) {
    const emails = await fetchEmailsByKeyword(keyword, 5);
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
