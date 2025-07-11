import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, X } from "lucide-react";
import api from '@/lib/axios';
import { useAutocompleteSettings } from '@/hooks/use-autocomplete-settings';
import { RichTextEditor, RichTextEditorHandle } from "@/components/ui/rich-text-editor";

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
  const [contentText, setContentText] = React.useState('');
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
  const editorRef = React.useRef<RichTextEditorHandle>(null);

  const handleGenerateReply = async () => {
    if (!contentText.trim()) {
      return;
    }

    try {
      setGenerating(true);
      const response = await api.post('/api/generate', {
        prompt: `Improve this email reply while maintaining the same intent and key points:\n${contentText}`,
        type: 'content',
        context: {
          type: 'email_reply',
          userContent: contentText,
          originalSubject,
          originalContent
        }
      });

      const data = response.data as { content?: string };
      if (data.content) {
        // The editor's onUpdate callback will automatically sync the state
        editorRef.current?.setContent(data.content.trim());
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
    if (!selectedChoice) return;

    // When the choices preview is open, the RichTextEditor is unmounted, so the
    // `editorRef` instance is not available. Instead of trying to call
    // `editorRef.current?.setContent`, persist the chosen content into React
    // state. Once `showChoicesPreview` is set to false the editor mounts again
    // and receives the updated `content` prop, ensuring the selected reply is
    // rendered correctly.

    // 1. Update HTML content state (this is what the editor consumes on mount)
    setContent(selectedChoice.content);

    // 2. Update plain-text version for validations / send logic
    const tmp = document.createElement('div');
    tmp.innerHTML = selectedChoice.content;
    setContentText(tmp.textContent ?? tmp.innerText ?? selectedChoice.content);

    // 3. Close preview UI and reset helper state
    setShowChoicesPreview(false);
    setGeneratedChoices([]);
    setSelectedChoice(null);
  };

  const handleRejectChoices = () => {
    setShowChoicesPreview(false);
    setGeneratedChoices([]);
    setSelectedChoice(null);
  };

  const handleSend = async () => {
    if (!contentText.trim()) return;

    try {
      setSending(true);
      await api.post('/api/emails/reply', {
        to: recipientEmail,
        subject: `Re: ${originalSubject}`,
        content: content, // Send HTML content
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
    
    // Don't generate autocomplete if content is empty
    if (!contentText || contentText.trim() === '') {
      setAutoSuggestion('');
      return;
    }
    
    // Extract the last sentence fragment, preserving all whitespace
    const lastSentenceMatch = contentText.match(/[^.!?]*$/);
    const fragment = lastSentenceMatch ? lastSentenceMatch[0] : '';
    
    // Check if the fragment has meaningful content (excluding just whitespace)
    if (fragment.trim().length < 5) {
      setAutoSuggestion('');
      return;
    }
    
    // Clear suggestion if user just applied the previous suggestion
    if (autoSuggestion && contentText.endsWith(autoSuggestion)) {
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
            },
            tone: 'professional',
            conversationContext: {
              originalSubject,
              originalContent
            }
          }),
          signal: controller.signal,
        });
        
        if (res.status === 429) {
          setAutoSuggestion('');
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          if (data.completion) {
            let comp = data.completion as string;
            
            // Clean up the completion
            comp = comp.trim();
            
            // Filter out responses that start with common response patterns
            const responsePatterns = [
              /^(i think|i believe|in my opinion|from my perspective)/i,
              /^(that's|that is|this is|it is|it's)/i,
              /^(yes|no|absolutely|definitely|certainly)/i,
              /^(thank you|thanks|appreciate)/i,
              /^(regarding|concerning|about)/i,
              /^(as for|as to|with regard to)/i
            ];
            
            // If the completion looks like a response, try to extract continuation
            if (responsePatterns.some(pattern => pattern.test(comp))) {
              const continuationMatch = comp.match(/(?:that|this|it|as|regarding|concerning|about|with regard to)\s+(.+)/i);
              if (continuationMatch) {
                comp = continuationMatch[1];
              } else {
                setAutoSuggestion('');
                return;
              }
            }
            
            // Get the meaningful part of the fragment (without leading spaces)
            const fragmentTrimmed = fragment.trim();
            
            // Find the longest common prefix between the trimmed fragment and completion
            const fragLower = fragmentTrimmed.toLowerCase();
            const compLower = comp.toLowerCase();
            
            let commonPrefixLength = 0;
            for (let i = 0; i < Math.min(fragLower.length, compLower.length); i++) {
              if (fragLower[i] === compLower[i]) {
                commonPrefixLength = i + 1;
              } else {
                break;
              }
            }
            
            // Remove the common prefix from completion
            comp = comp.slice(commonPrefixLength);
            
            // Handle spacing - only add space after complete words
            const fragmentEndsWithSpace = /\s$/.test(fragment);
            const completionStartsWithPunct = /^[.,;!?)]/.test(comp);
            
            // Check if we're completing a word vs continuing an incomplete word
            const fragmentEndsWithCompleteWord = /\w\s*$/.test(fragment) && !/\w$/.test(fragment.trim());
            const fragmentEndsWithIncompleteWord = /\w$/.test(fragment) && !fragmentEndsWithSpace;
            
            // Only add space if:
            // 1. Fragment ends with space (preserve existing spacing), OR
            // 2. Fragment ends with complete word and completion doesn't start with punctuation
            // DON'T add space if we're in the middle of typing a word (incomplete word)
            if (!completionStartsWithPunct && comp) {
              if (fragmentEndsWithSpace) {
                // Already has space, don't add another
              } else if (fragmentEndsWithCompleteWord) {
                // Complete word, add space
                comp = ' ' + comp;
              } else if (fragmentEndsWithIncompleteWord) {
                // Incomplete word, don't add space (continue the word)
              } else {
                // Default case - add space
              comp = ' ' + comp;
              }
            }
            
            // Clean up any excessive whitespace but preserve intentional single spaces
            comp = comp.replace(/\s+/g, ' '); // Normalize multiple spaces to single space
            
            // limit to 60 chars to avoid long ghost text
            if (comp.length > 60) comp = comp.slice(0, 60);
            
            // Only show suggestion if it's substantial and different from current content
            if (comp.length > 2 && !contentText.endsWith(comp)) {
            setAutoSuggestion(comp);
            } else {
              setAutoSuggestion('');
            }
          } else {
            setAutoSuggestion('');
          }
        } else {
          setAutoSuggestion('');
        }
      } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Autocomplete error:', e);
          setAutoSuggestion('');
        }
      }
    }, 800);
    
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [contentText, isAutocompleteEnabled, autoSuggestion]);

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
              {!contentText.trim() && (
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
              {contentText.trim() && (
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
            <RichTextEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              onTextChange={setContentText}
              placeholder="Write your reply or generate choices to get started..."
              autoSuggestion={autoSuggestion}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && autoSuggestion) {
                  e.preventDefault();
                  setContentText(prev => prev + autoSuggestion);
                  setAutoSuggestion('');
                }
              }}
              minHeight="8rem"
            />
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
              disabled={sending || !contentText.trim()}
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