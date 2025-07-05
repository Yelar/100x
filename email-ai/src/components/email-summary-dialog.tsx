import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mail, AlertCircle, CheckCircle2, Clock, ArrowUpRight } from "lucide-react";
import { VisuallyHidden } from '@/components/ui/visually-hidden';

interface EmailSummary {
  individual_summaries: Array<{
    id: string;
    summary: string;
    type: string;
  }>;
  overall_summary: string;
  immediate_actions: string[];
  important_updates: string[];
  categories: Record<string, string[]>;
}

interface EmailSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  summary: EmailSummary | null;
  onEmailClick: (emailId: string) => void;
}

// quick helper to pick the summary id most similar to a sentence
function pickClosestSummary(sentence: string, summaries: EmailSummary["individual_summaries"]): string | null {
  const words = sentence.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  let bestId: string | null = null;
  let bestScore = 0;
  for (const s of summaries) {
    const sumWords = s.summary.toLowerCase();
    let score = 0;
    words.forEach(w => {
      if (sumWords.includes(w)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestId = s.id;
    }
  }
  return bestScore > 0 ? bestId : summaries[0]?.id ?? null;
}

export function EmailSummaryDialog({ 
  isOpen, 
  onOpenChange, 
  summary,
  onEmailClick 
}: EmailSummaryDialogProps) {
  if (!summary) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-6">
        <VisuallyHidden>
          <DialogTitle>Email Summary</DialogTitle>
        </VisuallyHidden>
        <ScrollArea className="h-[calc(90vh-4rem)] pr-4">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-2">Email Summary</h2>
            {/* Overall Summary */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Overall Summary</h3>
              <p className="text-muted-foreground">{summary.overall_summary}</p>
            </div>

            {/* Immediate Actions */}
            {summary.immediate_actions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Immediate Actions
                </h3>
                <ul className="space-y-2">
                  {summary.immediate_actions.map((action, index) => {
                    const matchedId = pickClosestSummary(action, summary.individual_summaries);
                    return (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        {matchedId ? (
                          <button
                            onClick={() => onEmailClick(matchedId)}
                            className="text-left underline text-orange-600 hover:text-orange-700 cursor-pointer"
                          >
                            {action}
                          </button>
                        ) : (
                          <span className="opacity-70">{action}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Important Updates */}
            {summary.important_updates.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Important Updates
                </h3>
                <ul className="space-y-2">
                  {summary.important_updates.map((update, index) => {
                    const matchedId = pickClosestSummary(update, summary.individual_summaries);
                    return (
                      <li key={index} className="flex items-start gap-2">
                        <ArrowUpRight className="h-5 w-5 text-blue-500 mt-0.5" />
                        {matchedId ? (
                          <button
                            onClick={() => onEmailClick(matchedId)}
                            className="text-left underline text-orange-600 hover:text-orange-700 cursor-pointer"
                          >
                            {update}
                          </button>
                        ) : (
                          <span className="opacity-70">{update}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Categories */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Categories</h3>
              <div className="space-y-4">
                {Object.entries(summary.categories).map(([category, emailIds]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="font-medium text-muted-foreground">{category}</h4>
                    <div className="flex flex-wrap gap-2">
                      {emailIds.map((emailId) => {
                        const emailSummary = summary.individual_summaries.find(
                          (s) => s.id === emailId
                        );
                        return (
                          <Button
                            key={`${category}-${emailId}`}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={() => onEmailClick(emailId)}
                          >
                            <Mail className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">
                              {emailSummary?.summary || emailId}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Individual Summaries */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Individual Summaries</h3>
              <div className="space-y-4">
                {summary.individual_summaries.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onEmailClick(email.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{email.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{email.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 