import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

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

export function DraftsView() {
  const [drafts, setDrafts] = useState<DraftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      const response = await fetch('/api/emails/list?folder=drafts');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch drafts');
      }
      setDrafts(data.messages || []);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No drafts found</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {drafts.map(draft => {
        const headers = draft.payload.headers;
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No subject)';
        const to = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
        const date = headers.find(h => h.name.toLowerCase() === 'date')?.value;
        const snippet = draft.payload.body.data
          ? Buffer.from(draft.payload.body.data, 'base64').toString().substring(0, 100) + '...'
          : '(No content)';

        return (
          <div
            key={draft.id}
            className="p-4 hover:bg-muted/50 cursor-pointer"
            onClick={() => {
              // Open compose dialog with draft content
              const event = new CustomEvent('open-compose', {
                detail: { draftId: draft.id }
              });
              window.dispatchEvent(event);
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{subject}</h3>
                </div>
                <p className="text-sm text-muted-foreground truncate">To: {to}</p>
                <p className="text-sm text-muted-foreground truncate">{snippet}</p>
              </div>
              {date && (
                <time className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(date), 'MMM d')}
                </time>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
} 