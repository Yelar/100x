import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Send, Edit3 } from 'lucide-react';
import { EmailComposeDialog } from './email-compose-dialog';
import type { EmailComposeDialogHandle } from './email-compose-dialog';

interface DraftHeader {
  name: string;
  value: string;
}

interface DraftMessage {
  id: string;
  threadId?: string;
  payload: {
    headers: DraftHeader[];
    body: {
      data?: string;
    };
  };
}

interface Draft {
  id: string;
  message: DraftMessage;
}

export function DraftsPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const composeDialogRef = useRef<EmailComposeDialogHandle>(null);
  const { toast } = useToast();

  const fetchDrafts = async () => {
    try {
      const response = await fetch('/api/emails/draft');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch drafts');
      }
      setDrafts(data.drafts || []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      toast({
        title: "Error",
        description: "Failed to load drafts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDelete = async (draftId: string) => {
    if (deleting.has(draftId)) return;

    try {
      setDeleting(prev => new Set(prev).add(draftId));
      const response = await fetch('/api/emails/draft', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete draft');
      }

      setDrafts(prev => prev.filter(draft => draft.id !== draftId));
      toast({
        title: "Success",
        description: "Draft deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Error",
        description: "Failed to delete draft",
        variant: "destructive",
      });
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  const handleSend = async (draft: Draft) => {
    try {
      const response = await fetch('/api/emails/draft/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId: draft.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send draft');
      }

      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      toast({
        title: "Success",
        description: "Draft sent successfully",
      });
    } catch (error) {
      console.error('Error sending draft:', error);
      toast({
        title: "Error",
        description: "Failed to send draft",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (draft: Draft) => {
    composeDialogRef.current?.openDialog(draft.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Drafts</h2>
      </div>
      <ScrollArea className="flex-1">
        {drafts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No drafts found
          </div>
        ) : (
          <div className="divide-y">
            {drafts.map(draft => {
              const subject = draft.message.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No subject)';
              const snippet = draft.message.payload.body.data
                ? Buffer.from(draft.message.payload.body.data, 'base64').toString().substring(0, 100) + '...'
                : '(No content)';
              const isDeleting = deleting.has(draft.id);

              return (
                <div key={draft.id} className="p-4 hover:bg-muted/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{subject}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {snippet}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(draft)}
                        title="Edit draft"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSend(draft)}
                        title="Send draft"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(draft.id)}
                        disabled={isDeleting}
                        title="Delete draft"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <EmailComposeDialog ref={composeDialogRef} onEmailSent={fetchDrafts} />
    </div>
  );
} 