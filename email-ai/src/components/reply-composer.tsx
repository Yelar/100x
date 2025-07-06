import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, X } from "lucide-react";
import api from '@/lib/axios';
import { useAutocompleteSettings } from '@/hooks/use-autocomplete-settings';

interface ReplyComposerProps {
  recipientEmail: string;
  originalSubject: string;
  originalContent: string;
  originalMessageId: string;
  userInfo?: {
    name: string;
    email: string;
  } | null;
  onClose: () => void;
  onSend: () => void;
}

interface GeneratedChoice {
  id: string;
  content: string;
  tone: string;
  description: string;
}

export function ReplyComposer({ 
  recipientEmail, 
  originalSubject, 
  originalContent,
  originalMessageId,
  userInfo,
  onClose, 
  onSend 
}: ReplyComposerProps) {
  const [content, setContent] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [generatingChoices, setGeneratingChoices] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [generatedChoices, setGeneratedChoices] = React.useState<GeneratedChoice[]>([]);
  const [showChoicesPreview, setShowChoicesPreview] = React.useState(false);
  const [selectedChoice, setSelectedChoice] = React.useState<GeneratedChoice | null>(null);
  
  // Autocomplete functionality
  const { isAutocompleteEnabled, toggleAutocomplete } = useAutocompleteSettings();
  const [autoSuggestion, setAutoSuggestion] = React.useState('');
  const [autoAbortController, setAutoAbortController] = React.useState<AbortController | null>(null);

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

  const handleGenerateChoices = async () => {
    try {
      setGeneratingChoices(true);
      const response = await api.post('/api/generate-reply-choices', {
        originalSubject,
        originalContent,
        recipientEmail
      });

      const data = response.data as { choices?: GeneratedChoice[] };
      if (data.choices && data.choices.length > 0) {
        setGeneratedChoices(data.choices);
        setShowChoicesPreview(true);
      }
    } catch (error) {
      console.error('Error generating reply choices:', error);
    } finally {
      setGeneratingChoices(false);
    }
  };

  const handleSelectChoice = (choice: GeneratedChoice) => {
    setSelectedChoice(choice);
  };

  const handleAcceptChoice = () => {
    if (selectedChoice) {
      setContent(selectedChoice.content);
      setShowChoicesPreview(false);
      setGeneratedChoices([]);
      setSelectedChoice(null);
    }
  };

  const handleRejectChoices = () => {
    setShowChoicesPreview(false);
    setGeneratedChoices([]);
    setSelectedChoice(null);
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

  // Autocomplete effect
  React.useEffect(() => {
    if (!isAutocompleteEnabled) {
      setAutoSuggestion('');
      return;
    }
    
    const contentText = content;
    const lastFragmentMatch = contentText.match(/[^\.\!?]*$/);
    const fragment = lastFragmentMatch ? lastFragmentMatch[0].trim() : '';
    if (fragment.length < 5) {
      setAutoSuggestion('');
      return;
    }
    const controller = new AbortController();
    if (autoAbortController) autoAbortController.abort();
    setAutoAbortController(controller);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sentence: fragment,
            userData: {
              name: userInfo?.name || '',
              email: userInfo?.email || ''
            }
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.completion) {
            let comp = data.completion as string;
            // Strip common prefix (case-insensitive) including trailing spaces
            const fragLower = fragment.toLowerCase();
            const compLower = comp.toLowerCase();
            let idx = 0;
            while (idx < fragLower.length && idx < compLower.length && fragLower[idx] === compLower[idx]) {
              idx++;
            }
            comp = comp.slice(idx);
            // If user ended without space and suggestion doesn't start with space/punct, prepend a space
            if (fragment && !/\s$/.test(fragment) && comp && !/^[\s.,;!?)]/.test(comp)) {
              comp = ' ' + comp;
            }
            comp = comp.replace(/^\s+/, ''); // trim leading whitespace after adjustment
            // limit to 60 chars to avoid long ghost text
            if (comp.length > 60) comp = comp.slice(0, 60);
            setAutoSuggestion(comp);
          } else {
            setAutoSuggestion('');
          }
        }
      } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') console.error(e);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [content, isAutocompleteEnabled]);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Reply in thread to <span className="font-medium text-foreground">{recipientEmail}</span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Autocomplete toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="autocomplete-reply"
                  checked={isAutocompleteEnabled}
                  onCheckedChange={toggleAutocomplete}
                />
                <Label htmlFor="autocomplete-reply" className="text-sm text-muted-foreground">
                  AI Autocomplete
                </Label>
              </div>
              {/* Generate Choices Button - only show when content is empty */}
              {!content.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateChoices}
                  disabled={generatingChoices}
                  className="h-8 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border-purple-200 dark:border-purple-500/20 hover:from-purple-600/20 hover:to-blue-600/20"
                  title="Generate reply choices"
                >
                  {generatingChoices ? (
                    <span className="animate-spin mr-2">⟳</span>
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Choices
                </Button>
              )}
              
              {/* Improve Reply Button - only show when content exists */}
              {content.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateReply}
                  disabled={generating}
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
              )}
            </div>
          </div>

          {/* Show choices preview or regular textarea */}
          {showChoicesPreview ? (
            <div className="border border-border/60 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-border/60 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <h4 className="font-medium text-foreground">Choose a Reply</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRejectChoices}
                  className="text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-black/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {generatedChoices.map((choice) => (
                  <div 
                    key={choice.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                      selectedChoice?.id === choice.id 
                        ? 'border-purple-300 bg-purple-50 dark:border-purple-600 dark:bg-purple-950/20' 
                        : 'border-border/30 bg-gray-50 dark:bg-gray-900/50 hover:border-border/60'
                    }`}
                    onClick={() => handleSelectChoice(choice)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                        {choice.tone}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {choice.description}
                      </span>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {choice.content}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end gap-3 p-4 border-t border-border/60 bg-gray-50 dark:bg-gray-800/50">
                <Button
                  variant="outline"
                  onClick={handleRejectChoices}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/10"
                >
                  ✗ Cancel
                </Button>
                <Button
                  onClick={handleAcceptChoice}
                  disabled={!selectedChoice}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm disabled:opacity-50"
                >
                  ✓ Use Reply
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && autoSuggestion) {
                    e.preventDefault();
                    setContent(prev => prev + autoSuggestion);
                    setAutoSuggestion('');
                  }
                }}
                placeholder="Write your reply or generate choices to get started..."
                className="w-full h-32 p-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[8rem]"
              />
              {autoSuggestion && (
                <div className="pointer-events-none absolute top-0 left-0 p-3 whitespace-pre-wrap text-sm text-muted-foreground select-none" style={{ whiteSpace: 'pre-wrap' }}>
                  {/* Render existing content invisibly to align suggestion */}
                  <span className="opacity-0">{content}</span>
                  <span className="opacity-60">{autoSuggestion}</span>
                </div>
              )}
            </div>
          )}

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