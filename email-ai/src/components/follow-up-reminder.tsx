import React, { useState, useEffect } from 'react';
import { X, Clock, MessageCircle, Users } from 'lucide-react';
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
  onEmailClick?: (emailId: string) => void;
}

export function FollowUpReminder({ flaggedEmails, onEmailClick }: FollowUpReminderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownToday, setHasShownToday] = useState(false);
  const [pendingReplies, setPendingReplies] = useState<PendingReply[]>([]);

  // Check for follow-up reminders
  useEffect(() => {
    const checkForReminders = () => {
      // Get emails flagged as "to_reply"
      const toReplyEmails = Object.entries(flaggedEmails)
        .filter(([, data]) => data.flag === 'to_reply')
        .map(([id, data]) => ({
          id,
          subject: data.subject,
          snippet: data.snippet,
          sender: data.sender,
          flaggedAt: data.flaggedAt,
        }));

      setPendingReplies(toReplyEmails);

      // Check if we should show reminder
      if (toReplyEmails.length > 0 && !hasShownToday) {
        const lastShown = localStorage.getItem('follow_up_reminder_last_shown');
        const today = new Date().toDateString();
        
        if (!lastShown || lastShown !== today) {
          // Only show if there are emails older than 2 hours
          const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
          const oldEmails = toReplyEmails.filter(email => email.flaggedAt < twoHoursAgo);
          
          if (oldEmails.length > 0) {
            setIsOpen(true);
            setHasShownToday(true);
            localStorage.setItem('follow_up_reminder_last_shown', today);
          }
        }
      }
    };

    // Check immediately and then every 30 minutes
    checkForReminders();
    const interval = setInterval(checkForReminders, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [flaggedEmails, hasShownToday]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSnooze = () => {
    // Snooze for 4 hours
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('follow_up_reminder_snoozed_until', fourHoursFromNow);
    setIsOpen(false);
  };

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

  const urgentReplies = pendingReplies.filter(email => {
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return email.flaggedAt < dayAgo;
  });

  if (pendingReplies.length === 0) {
    return null;
  }

  return (
    <>
      {/* Subtle notification indicator in the corner */}
      {!isOpen && pendingReplies.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-full p-3 group"
            title={`${pendingReplies.length} email${pendingReplies.length > 1 ? 's' : ''} need${pendingReplies.length === 1 ? 's' : ''} reply`}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">{pendingReplies.length}</span>
            {urgentReplies.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </Button>
        </div>
      )}

      {/* Follow-up reminder dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold text-foreground">
                    Follow-Up Reminder
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have {pendingReplies.length} email{pendingReplies.length > 1 ? 's' : ''} waiting for your reply
                    {urgentReplies.length > 0 && (
                      <span className="text-orange-600 font-medium">
                        {' '}({urgentReplies.length} overdue)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto p-6">
            <div className="space-y-3">
              {pendingReplies
                .sort((a, b) => a.flaggedAt - b.flaggedAt) // Oldest first
                .map((email) => {
                  const isUrgent = email.flaggedAt < Date.now() - (24 * 60 * 60 * 1000);
                  
                  return (
                    <div
                      key={email.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        isUrgent 
                          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20' 
                          : 'border-border bg-card'
                      }`}
                      onClick={() => {
                        if (onEmailClick) {
                          onEmailClick(email.id);
                          setIsOpen(false);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-foreground truncate">
                              {email.sender.split('<')[0] || email.sender}
                            </span>
                            {isUrgent && (
                              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                                Overdue
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium text-foreground text-sm mb-1 truncate">
                            {email.subject}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate mb-2">
                            {email.snippet}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Received {formatTimeAgo(email.flaggedAt)}</span>
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
                              setIsOpen(false);
                            }
                          }}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="p-6 pt-0 flex justify-between items-center border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Only emails from real people are shown</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSnooze}
                className="text-muted-foreground"
              >
                Snooze 4h
              </Button>
              <Button
                onClick={handleClose}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 