import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import api from '@/lib/axios';

interface ReplyComposerProps {
  recipientEmail: string;
  originalSubject: string;
  originalContent: string;
  originalMessageId: string;
  onClose: () => void;
  onSend: () => void;
}

export function ReplyComposer({ 
  recipientEmail, 
  originalSubject, 
  originalContent,
  originalMessageId,
  onClose, 
  onSend 
}: ReplyComposerProps) {
  const [content, setContent] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const handleGenerateReply = async () => {
    if (!content.trim()) {
      return;
    }

    try {
      setGenerating(true);
      const response = await api.post('/api/generate', {
        prompt: `Improve this email reply while maintaining the same intent and key points:\n${content}`,
        type: 'content',
        context: {
          type: 'email_reply',
          userContent: content,
          originalSubject,
          originalContent
        }
      });

      const data = response.data as { content?: string };
      if (data.content) {
        setContent(data.content.trim());
      }
    } catch (error) {
      console.error('Error generating reply:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!content.trim()) return;

    try {
      setSending(true);
      await api.post('/api/emails/reply', {
        to: recipientEmail,
        subject: `Re: ${originalSubject}`,
        content: content,
        originalMessageId: originalMessageId,
      });
      onSend();
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Reply in thread to <span className="font-medium text-foreground">{recipientEmail}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReply}
                disabled={generating || !content.trim()}
                className="h-8"
                title="Improve reply with AI"
              >
                {generating ? (
                  <span className="animate-spin mr-2">⟳</span>
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Improve with AI
              </Button>
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your reply..."
            className="w-full h-32 p-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[8rem]"
          />

          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-8"
            >
              Discard
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !content.trim()}
              className="h-8"
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 