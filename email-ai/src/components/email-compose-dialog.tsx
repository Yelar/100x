import { useState, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import debounce from 'lodash/debounce';

export interface EmailComposeDialogHandle {
  /**
   * Open the compose dialog.
   *
   * Usage patterns:
   * 1. `openDialog(draftId)` – pass a Gmail draft ID to load an existing draft.
   * 2. `openDialog(undefined, content)` – open a new compose window pre-filled with subject + content.
   */
  openDialog: (arg1?: string, arg2?: string) => void;
}

interface EmailComposeDialogProps {
  onEmailSent?: () => void;
}

interface DraftHeader {
  name: string;
  value: string;
}

interface DraftPayload {
  headers: DraftHeader[];
  body: {
    data?: string;
  };
}

interface DraftMessage {
  id: string;
  threadId?: string;
  payload: DraftPayload;
}

export const EmailComposeDialog = forwardRef<EmailComposeDialogHandle, EmailComposeDialogProps>(
  ({ onEmailSent }, ref) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [draftId, setDraftId] = useState<string | null>(null);
    const { toast } = useToast();

    const openDialog = async (arg1?: string, arg2?: string) => {
      // Case 1: open existing draft by ID
      if (arg1 && !arg2) {
        const draftId = arg1;
        try {
          const response = await fetch(`/api/emails/list?folder=drafts&id=${draftId}`);
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to load draft');
          }
          
          const draft: DraftMessage = data.messages[0];
          const headers = draft.payload.headers;
          const to = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
          const content = draft.payload.body.data
            ? Buffer.from(draft.payload.body.data, 'base64').toString()
            : '';

          setDraftId(draftId);
          setTo(to);
          setSubject(subject);
          setContent(content);
        } catch (error) {
          console.error('Error loading draft:', error);
          toast({
            title: "Error",
            description: "Failed to load draft",
            variant: "destructive",
          });
        }
      } else if (arg1 && arg2) {
        // Case 2: open a new draft pre-filled with subject and content
        setDraftId(null);
        setTo('');
        setSubject(arg1);
        setContent(arg2);
      }
      setOpen(true);
    };

    useImperativeHandle(ref, () => ({
      openDialog
    }));

    // Add this effect to handle the custom event
    useEffect(() => {
      const handleOpenCompose = (event: Event) => {
        const customEvent = event as CustomEvent<{ draftId: string }>;
        openDialog(customEvent.detail.draftId);
      };

      window.addEventListener('open-compose', handleOpenCompose);
      return () => {
        window.removeEventListener('open-compose', handleOpenCompose);
      };
    }, []);

    // Create a debounced function to save draft
    const saveDraft = useCallback(
      debounce(async (to: string, subject: string, content: string, draftId: string | null) => {
        if (!to && !subject && !content) return;

        try {
          const endpoint = '/api/emails/send';
          const method = 'POST';
          const body = {
            to,
            subject,
            content,
            mode: 'draft',
            draftId
          };

          const response = await fetch(endpoint, {
            method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to save draft');
          }

          if (!draftId) {
            setDraftId(data.id);
          }
        } catch (error) {
          console.error('Error saving draft:', error);
          toast({
            title: "Error",
            description: "Failed to save draft",
            variant: "destructive",
          });
        }
      }, 1000),
      []
    );

    // Save draft when content changes
    useEffect(() => {
      if (open) {
        saveDraft(to, subject, content, draftId);
      }
      return () => {
        saveDraft.cancel();
      };
    }, [to, subject, content, draftId, open, saveDraft]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const response = await fetch('/api/emails/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to,
            subject,
            content,
            draftId
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to send email');
        }
        toast({
          title: "Success",
          description: "Email sent successfully",
        });
        setTo('');
        setSubject('');
        setContent('');
        setDraftId(null);
        setOpen(false);
        onEmailSent?.();
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to send email",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    const handleClose = () => {
      if (!to && !subject && !content) {
        setOpen(false);
        return;
      }

      // Keep the draft when closing
      setOpen(false);
      toast({
        title: "Draft Saved",
        description: "Your email has been saved as a draft",
      });
    };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[525px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New Email</DialogTitle>
              <DialogDescription>
                Compose and send a new email message. Drafts are saved automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="to" className="text-right">
                  To
                </Label>
                <Input
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="col-span-3"
                  type="email"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subject" className="text-right">
                  Subject
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="col-span-3"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="content" className="text-right">
                  Message
                </Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="col-span-3"
                  required
                  disabled={loading}
                  rows={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);

EmailComposeDialog.displayName = 'EmailComposeDialog'; 