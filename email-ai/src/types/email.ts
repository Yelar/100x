export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded data for inline viewing
}

export interface Email {
  id: string;
  threadId?: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  attachments?: Attachment[];
  avatar?: string;
} 