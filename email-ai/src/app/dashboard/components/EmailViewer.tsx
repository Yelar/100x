'use client';
import React from 'react';
import type { Email } from '@/types/email';

export interface EmailViewerProps {
  email: Email | null;
}

export function EmailViewer({ email }: EmailViewerProps) {
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Select an email to read</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-xl font-bold mb-4">{email.subject}</h1>
      <pre className="whitespace-pre-wrap text-sm">
        {email.body}
      </pre>
    </div>
  );
}

export default EmailViewer; 