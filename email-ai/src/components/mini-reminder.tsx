import React, { useState, useEffect } from 'react';
import { X, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingReply {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  flaggedAt: number;
}

interface MiniReminderProps {
  flaggedEmails: Record<string, { flag: string, subject: string, snippet: string, sender: string, flaggedAt: number }>;
  isVisible: boolean;
  onClose: () => void;
  onEmailClick?: (emailId: string) => void;
  onViewAll: () => void;
}

export function MiniReminder({ flaggedEmails, isVisible, onClose, onEmailClick, onViewAll }: MiniReminderProps) {
  const [pendingReplies, setPendingReplies] = useState<PendingReply[]>([]);

  useEffect(() => {
    // Get emails flagged as "to_reply"
    const toReplyEmails = Object.entries(flaggedEmails)
      .filter(([, data]) => data.flag === 'to_reply')
      .map(([id, data]) => ({
        id,
        subject: data.subject,
        snippet: data.snippet,
        sender: data.sender,
        flaggedAt: data.flaggedAt,
      }))
      .sort((a, b) => a.flaggedAt - b.flaggedAt) // Oldest first
      .slice(0, 3); // Show only first 3

    setPendingReplies(toReplyEmails);
  }, [flaggedEmails]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return 'now';
    }
  };

  const totalCount = Object.values(flaggedEmails).filter(email => email.flag === 'to_reply').length;

  if (!isVisible || pendingReplies.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 border border-border rounded-lg shadow-lg z-[60] animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          <span className="font-medium text-sm">Pending Replies</span>
          <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs px-2 py-1 rounded-full font-medium">
            {totalCount}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Mini email list */}
      <div className="max-h-64 overflow-y-auto">
        {pendingReplies.map((email) => {
          const isUrgent = email.flaggedAt < Date.now() - (24 * 60 * 60 * 1000);
          
          return (
            <div
              key={email.id}
              className="p-3 border-b border-border/50 last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => {
                if (onEmailClick) {
                  onEmailClick(email.id);
                  onClose();
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs text-foreground truncate">
                      {email.sender.split('<')[0]?.trim() || email.sender}
                    </span>
                    {isUrgent && (
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate mb-1">
                    {email.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {email.snippet}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(email.flaggedAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEmailClick) {
                          onEmailClick(email.id);
                          onClose();
                        }
                      }}
                    >
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onViewAll();
            onClose();
          }}
          className="w-full text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
        >
          View all {totalCount} pending {totalCount === 1 ? 'reply' : 'replies'}
        </Button>
      </div>
    </div>
  );
} 