export interface Tool {
  type: string;
  name: string;
  description: string;
}

export interface EmailSearchTool extends Tool {
  type: 'function';
  name: 'search_emails';
  description: 'Search and analyze emails to answer the user query';
  input: {
    query: string;
  };
  output: {
    relevant_emails: Array<{
      id: string;
      from: string;
      subject: string;
      date: string;
      snippet: string;
    }>;
    full_emails: Array<{
      id: string;
      from: string;
      subject: string;
      date: string;
      body: string;
    }>;
    analysis: string;
    answer: string;
  };
}

export interface ComposeEmailTool extends Tool {
  type: 'function';
  name: 'compose_email';
  description: 'Draft an email (subject and content) based on the user\'s message. The recipient will be entered manually.';
  input: {
    subject: string;
    content: string;
  };
  output: {
    subject: string;
    content: string;
  };
}

export const tools: Tool[] = [
  {
    type: 'function',
    name: 'search_emails',
    description: 'Search and analyze emails to answer the user query',
  },
  {
    type: 'function',
    name: 'compose_email',
    description: 'Draft an email (subject and content) based on the user\'s message. The recipient will be entered manually.',
  }
];

export type ToolResult = EmailSearchTool['output']; 