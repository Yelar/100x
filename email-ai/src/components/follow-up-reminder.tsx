import React, { useState, useEffect } from 'react';
import { X, Clock, MessageCircle, Users, User, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PendingReply {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  flaggedAt: number;
}

interface FollowUpReminderProps {
  flaggedEmails: Record<string, { flag: string, subject: string, snippet: string, sender: string, flaggedAt: number }>;
  isOpen: boolean;
  onClose: () => void;
  onEmailClick?: (emailId: string) => void;
}

export function FollowUpReminder({ flaggedEmails, isOpen, onClose, onEmailClick }: FollowUpReminderProps) {
  const [pendingReplies, setPendingReplies] = useState<PendingReply[]>([]);

  useEffect(() => {
    // Get ALL emails flagged as "to_reply" (not just overdue ones)
    const toReplyEmails = Object.entries(flaggedEmails)
      .filter(([, data]) => data.flag === 'to_reply')
      .map(([id, data]) => ({
        id,
        subject: data.subject,
        snippet: data.snippet,
        sender: data.sender,
        flaggedAt: data.flaggedAt,
      }))
      .sort((a, b) => a.flaggedAt - b.flaggedAt); // Oldest first

    setPendingReplies(toReplyEmails);
  }, [flaggedEmails]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  const formatFullDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Categorize emails by urgency
  const urgentReplies = pendingReplies.filter(email => {
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return email.flaggedAt < dayAgo;
  });

  const recentReplies = pendingReplies.filter(email => {
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return email.flaggedAt >= dayAgo;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-semibold text-foreground">
                  Follow-Up Center
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {pendingReplies.length === 0 ? (
                    "No pending replies - you're all caught up! 🎉"
                  ) : (
                    <>
                      {pendingReplies.length} email{pendingReplies.length > 1 ? 's' : ''} waiting for your reply
                      {urgentReplies.length > 0 && (
                        <span className="text-red-600 font-medium">
                          {' '}({urgentReplies.length} overdue)
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Statistics */}
          {pendingReplies.length > 0 && (
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {urgentReplies.length} Overdue
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  {recentReplies.length} Recent
                </span>
              </div>
            </div>
          )}
        </DialogHeader>

        {pendingReplies.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">All caught up!</h3>
            <p className="text-muted-foreground">No emails are waiting for your reply.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {/* Overdue emails section */}
            {urgentReplies.length > 0 && (
              <div className="border-b border-border">
                <div className="p-4 bg-red-50 dark:bg-red-950/10">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <h3 className="font-semibold text-red-700 dark:text-red-300">
                      Overdue Replies ({urgentReplies.length})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {urgentReplies.map((email) => (
                      <EmailCard
                        key={email.id}
                        email={email}
                        isUrgent={true}
                        onEmailClick={onEmailClick}
                        formatTimeAgo={formatTimeAgo}
                        formatFullDate={formatFullDate}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent emails section */}
            {recentReplies.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold text-foreground">
                    Recent ({recentReplies.length})
                  </h3>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {recentReplies.map((email) => (
                    <EmailCard
                      key={email.id}
                      email={email}
                      isUrgent={false}
                      onEmailClick={onEmailClick}
                      formatTimeAgo={formatTimeAgo}
                      formatFullDate={formatFullDate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {pendingReplies.length > 0 && (
          <div className="p-6 pt-4 flex justify-between items-center border-t border-border bg-muted/20">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Only emails from real people are shown</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="text-muted-foreground"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Separate component for email cards to keep code clean
function EmailCard({ 
  email, 
  isUrgent, 
  onEmailClick, 
  formatTimeAgo, 
  formatFullDate 
}: {
  email: PendingReply;
  isUrgent: boolean;
  onEmailClick?: (emailId: string) => void;
  formatTimeAgo: (timestamp: number) => string;
  formatFullDate: (timestamp: number) => string;
}) {
  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isUrgent 
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20' 
          : 'border-border bg-card hover:border-orange-200 dark:hover:border-orange-700'
      }`}
      onClick={() => {
        if (onEmailClick) {
          onEmailClick(email.id);
        }
      }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Email content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-foreground truncate">
              {email.sender.split('<')[0]?.trim() || email.sender}
            </span>
            {isUrgent && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                Overdue
              </span>
            )}
          </div>
          
          <h4 className="font-medium text-foreground mb-2 line-clamp-2">
            {email.subject}
          </h4>
          
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {email.snippet}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatFullDate(email.flaggedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTimeAgo(email.flaggedAt)}</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="ml-3 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (onEmailClick) {
                  onEmailClick(email.id);
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
} 