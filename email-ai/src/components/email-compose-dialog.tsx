import { useState, useImperativeHandle, forwardRef, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import debounce from 'lodash/debounce';
import { useAutocompleteSettings } from '@/hooks/use-autocomplete-settings';
import { RichTextEditor, RichTextEditorHandle } from '@/components/ui/rich-text-editor';

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
    const [contentText, setContentText] = useState('');
    const [draftId, setDraftId] = useState<string | null>(null);
    const [generating, setGenerating] = useState<'idle' | 'subject' | 'content'>('idle');
    const { toast } = useToast();
    const { isAutocompleteEnabled, toggleAutocomplete } = useAutocompleteSettings();
    const editorRef = useRef<RichTextEditorHandle>(null);

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
          // The editor's onUpdate callback will automatically sync the state
          editorRef.current?.setContent(content);
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
        // The editor's onUpdate callback will automatically sync the state
        editorRef.current?.setContent(arg2);
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
      debounce(async (to: string, subject: string, contentText: string, draftId: string | null) => {
        if (!to && !subject && !contentText) return;

        try {
          const endpoint = '/api/emails/send';
          const method = 'POST';
          const body = {
            to,
            subject,
            content: contentText,
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
        saveDraft(to, subject, contentText, draftId);
      }
      return () => {
        saveDraft.cancel();
      };
    }, [to, subject, contentText, draftId, open, saveDraft]);

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
            content: content, // Send HTML content
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
        editorRef.current?.setContent('');
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

    const handleGenerateContent = async (type: 'subject' | 'content') => {
      setGenerating(type);
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            context: type === 'subject' ? contentText : subject,
            tone: 'professional'
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate content');
        }
        
        const data = await response.json();
        if (type === 'subject') {
          setSubject(data.content);
        } else {
          // The editor's onUpdate callback will automatically sync the state
          editorRef.current?.setContent(data.content);
        }
        
        toast({
          title: "Success",
          description: `${type === 'subject' ? 'Subject' : 'Content'} generated successfully`,
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to generate content",
          variant: "destructive",
        });
      } finally {
        setGenerating('idle');
      }
    };

    const handleClose = () => {
      if (!to && !subject && !contentText) {
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
        <DialogContent className="w-[95vw] max-w-[525px] max-h-[85vh] md:max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New Email</DialogTitle>
              <DialogDescription>
                Compose and send a new email message. Drafts are saved automatically.
              </DialogDescription>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="autocomplete"
                  checked={isAutocompleteEnabled}
                  onCheckedChange={toggleAutocomplete}
                />
                <Label htmlFor="autocomplete" className="text-sm">
                  AI Autocomplete
                </Label>
              </div>
            </DialogHeader>
            <div className="grid gap-3 md:gap-4 py-3 md:py-4">
              <div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
                <Label htmlFor="to" className="text-left md:text-right text-sm md:text-base">
                  To
                </Label>
                <Input
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="col-span-1 md:col-span-3"
                  type="email"
                  required
                  disabled={loading}
                  placeholder="recipient@example.com"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
                <Label htmlFor="subject" className="text-left md:text-right text-sm md:text-base">
                  Subject
                </Label>
                <div className="col-span-1 md:col-span-3 flex gap-2">
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex-1"
                    required
                    disabled={loading}
                    placeholder="Email subject"
                  />
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleGenerateContent('subject')}
                    disabled={generating !== 'idle' || loading}
                    className="p-1 md:p-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 transition-colors flex-shrink-0"
                    title="Generate subject with AI"
                  >
                    {generating === 'subject' ? (
                      <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-2 md:gap-4">
                <Label htmlFor="content" className="text-left md:text-right text-sm md:text-base">
                  Message
                </Label>
                <div className="col-span-1 md:col-span-3 flex flex-col gap-2">
                  <RichTextEditor
                    ref={editorRef}
                    content={content}
                    onChange={setContent}
                    onTextChange={setContentText}
                    placeholder="Type your message here..."
                    minHeight="12rem"
                  />
                  <div className="flex justify-end">
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateContent('content')}
                      disabled={generating !== 'idle' || loading}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-3 md:px-4 shadow-sm transition-all hover:shadow-md text-xs md:text-sm"
                    >
                      {generating === 'content' ? (
                        <>
                          <Loader2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 animate-spin" />
                          <span className="hidden sm:inline">Generating...</span>
                          <span className="sm:hidden">Gen...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                          <span className="hidden sm:inline">Generate Content</span>
                          <span className="sm:hidden">Generate</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
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