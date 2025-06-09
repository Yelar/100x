'use client';

import { useState, useEffect } from 'react';
import { Email } from '@/types/email';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Flag, Archive, MoreVertical } from "lucide-react";
import api from '@/lib/axios';
import { processEmailContent, sanitizeHtml } from '@/lib/sanitize-html';

interface EmailPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  emailId: string | null;
}

export function EmailPreviewDialog({ isOpen, onOpenChange, emailId }: EmailPreviewDialogProps) {
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch email when dialog opens and emailId changes
  useEffect(() => {
    if (isOpen && emailId) {
      setLoading(true);
      
      api.get(`/api/emails/${emailId}`)
        .then(response => {
          const emailData = response.data as Email;
          setEmail(emailData);
        })
        .catch(error => {
          console.error('Error fetching email:', error);
          setEmail(null);
        });
      
      setLoading(false);
    }
  }, [isOpen, emailId]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {loading ? "Loading..." : email?.subject || "Email Preview"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">Close</Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : email ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 pb-4 mb-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex space-x-2">
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Archive className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Flag className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center mb-3">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {email.from.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center">
                    <span className="font-medium text-foreground">
                      {email.from.split('<')[0] || email.from}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {`<${email.from.match(/<(.+)>/)
                        ? email.from.match(/<(.+)>/)?.[1]
                        : email.from}>`}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    to me • {new Date(email.date).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: processEmailContent(sanitizeHtml(email.body))
                  }} 
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No email selected
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 