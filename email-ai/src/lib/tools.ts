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

export const tools: Tool[] = [
  {
    type: 'function',
    name: 'search_emails',
    description: 'Search and analyze emails to answer the user query',
  }
];

export type ToolResult = EmailSearchTool['output']; 