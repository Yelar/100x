'use client';
import React from 'react';
import type { Email } from '@/types/email';
import { EmailAvatar } from "@/components/ui/email-avatar";

export interface EmailListProps {
  emails: Email[];
  onSelect?: (email: Email) => void;
  selectedId?: string | null;
}

export function EmailList({ emails, selectedId, onSelect }: EmailListProps) {
  return (
    <div className="flex-1 overflow-y-auto border-r border-border/50">
      {emails.map(email => (
        <div
          key={email.id}
          className={`px-4 py-3 cursor-pointer border-b border-border/50 ${selectedId === email.id ? 'bg-orange-500/10' : 'hover:bg-orange-500/5'}`}
          onClick={() => onSelect?.(email)}
        >
          <div className="flex items-center gap-3">
            <EmailAvatar from={email.from} avatar={email.avatar} size="md" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{email.subject}</div>
              <div className="text-xs text-muted-foreground truncate">{email.from}</div>
              <div className="text-xs text-muted-foreground truncate">{email.snippet}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmailList; 






