'use client';
import React from 'react';
import type { Email } from '@/types/email';

export interface EmailListProps {
  emails: Email[];
  onSelect?: (email: Email) => void;
  selectedId?: string | null;
}

export function EmailList({ emails, selectedId, onSelect }: EmailListProps) {
  return (
    <div className="flex-1 overflow-y-auto border-r border-border/50">
      {/* Placeholder list */}
      {emails.map(email => (
        <div
          key={email.id}
          className={`px-4 py-3 cursor-pointer border-b border-border/50 ${selectedId === email.id ? 'bg-orange-500/10' : 'hover:bg-orange-500/5'}`}
          onClick={() => onSelect?.(email)}
        >
          <div className="font-medium text-sm truncate">{email.subject}</div>
          <div className="text-xs text-muted-foreground truncate">{email.snippet}</div>
        </div>
      ))}
    </div>
  );
}

export default EmailList; 