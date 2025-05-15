'use client';

import { useState, useEffect, useRef } from 'react';
import { Email } from '@/types/email';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, Flag, Archive, MoreVertical } from "lucide-react";
import api from '@/lib/axios';
import { createEmailDocument, sanitizeHtml } from '@/lib/sanitize-html';

interface EmailPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  emailId: string | null;
}

export function EmailPreviewDialog({ isOpen, onOpenChange, emailId }: EmailPreviewDialogProps) {
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(500);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    // Reset state when dialog opens/closes
    if (!isOpen) {
      setEmail(null);
      setError(null);
      setRenderError(false);
    }
  }, [isOpen]);

  // Fetch email when ID changes and dialog is open
  useEffect(() => {
    if (isOpen && emailId) {
      const fetchEmail = async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await api.get<{ email: Email }>(`/api/emails/${emailId}`);
          if (response.data && response.data.email) {
            setEmail(response.data.email);
          }
        } catch (error) {
          console.error('Error fetching email:', error);
          setError('Failed to load email. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      
      fetchEmail();
    }
  }, [emailId, isOpen]);

  // Handle iframe messages for resizing
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize') {
        setIframeHeight(event.data.height + 20);
      } else if (event.data && event.data.type === 'error') {
        setRenderError(true);
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
          <DialogTitle className="text-lg">{loading ? 'Loading Email...' : email?.subject || 'Email Preview'}</DialogTitle>
          <DialogClose asChild>
            
          </DialogClose>
        </DialogHeader>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted"></div>
              <div className="h-4 w-64 bg-muted rounded"></div>
              <div className="h-4 w-40 bg-muted rounded"></div>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-destructive">
            {error}
          </div>
        ) : email ? (
          <div className="flex-1 overflow-y-auto flex flex-col space-y-4 p-4">
            <div className="flex items-center">
              <Avatar className="h-10 w-10 mr-3">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {email.from.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
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
                  To: me • {formatDate(email.date)}
                </div>
              </div>
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                  <Archive className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                  <Flag className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {renderError ? (
                <div className="p-4 border border-muted rounded-md">
                  <p>This email contains complex formatting that couldn&apos;t be displayed properly.</p>
                  <div className="mt-2 p-3 bg-muted/30 rounded whitespace-pre-wrap text-sm">
                    {email.body
                      .replace(/<style[\s\S]*?<\/style>/gi, '')
                      .replace(/<script[\s\S]*?<\/script>/gi, '')
                      .replace(/<[^>]*>/g, '')
                      .replace(/&nbsp;/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()}
                  </div>
                </div>
              ) : (
                <iframe 
                  ref={iframeRef}
                  srcDoc={createEmailDocument(sanitizeHtml(email.body))}
                  className="w-full border-none"
                  style={{ height: `${iframeHeight}px`, minHeight: "300px" }}
                  sandbox="allow-same-origin allow-popups allow-scripts"
                  title="Email content"
                  onError={() => setRenderError(true)}
                />
              )}
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