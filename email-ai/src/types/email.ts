export interface Email {
  id: string;
  threadId?: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
} 