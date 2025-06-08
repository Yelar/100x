'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, useChat } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, Mail, Info, Search, Loader2, CheckCircle2, Activity, Mic, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailPreviewDialog } from '@/components/email-preview-dialog';
import { EmailComposeDialog, EmailComposeDialogHandle } from '@/components/email-compose-dialog';

interface ParsedAIResponse {
  thoughts?: string[];
  answer: string;
}

interface ChatWith100xProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ChatWith100x({ isOpen: propIsOpen, onToggle: propOnToggle }: ChatWith100xProps) {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = propIsOpen ?? isOpenInternal;
  const onToggle = propOnToggle ?? (() => setIsOpenInternal(!isOpenInternal));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onResponse: (response) => {
      // This is called when the API response starts streaming
      console.log("Response started:", response.status);
      setIsProcessing(true); // Ensure we show processing indicator
      
      // Check for error status
      if (!response.ok) {
        response.text().then((text) => {
          console.error('Error response from API:', text);
          setErrorMessage(`Error: ${response.status} - ${response.statusText}`);
          setIsProcessing(false);
        });
      } else {
        setErrorMessage(null);
      }
    },
    onFinish: () => {
      // This is called when the response finishes streaming
      console.log("Response finished");
      setIsProcessing(false);
    },
    onError: (error) => {
      console.error("Chat API error:", error);
      setErrorMessage(error.message || "An error occurred while communicating with the AI");
      setIsProcessing(false);
    }
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentThoughts, setCurrentThoughts] = useState<string[]>([]);
  const [currentThoughtIndex, setCurrentThoughtIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const composeDialogRef = useRef<EmailComposeDialogHandle>(null);
  
  // Function to safely try to parse JSON from a string that might contain text before/after the JSON
  const extractJsonFromString = (str: string): Record<string, unknown> | null => {
    try {
      // First try direct parsing
      return JSON.parse(str);
    } catch {
      try {
        // Try to find a JSON object in the string using a more robust regex
        const match = str.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch {
            console.log("Found JSON-like string but failed to parse");
            // Try to clean the match before parsing
            const cleaned = match[0].replace(/\\n/g, ' ').replace(/\\"/g, '"');
            try {
              return JSON.parse(cleaned);
            } catch {
              console.log("Failed to parse cleaned JSON");
            }
          }
        }
      } catch {
        console.log("Failed to extract JSON from string");
      }
    }
    return null;
  };
  
  // Parse AI responses to extract structured data
  const parseAIMessage = (content: string): ParsedAIResponse => {
    console.log("Parsing message content:", content);
    
    // Handle empty content
    if (!content || content.trim() === '') {
      return {
        thoughts: ["Processing your question"],
        answer: "I'm working on your answer..."
      };
    }
    
    // Try different ways to get structured data
    try {
      const jsonData = extractJsonFromString(content);
      console.log("Extracted JSON data:", jsonData);
      
      if (jsonData && typeof jsonData === 'object') {
        if ('thoughts' in jsonData && 'answer' in jsonData && typeof jsonData.answer === 'string') {
          return {
            thoughts: Array.isArray(jsonData.thoughts) ? jsonData.thoughts as string[] : undefined,
            answer: jsonData.answer as string
          };
        } else if ('answer' in jsonData && typeof jsonData.answer === 'string') {
          return {
            thoughts: ["Analyzed your question", "Searched through emails", "Found relevant information"],
            answer: jsonData.answer as string
          };
        }
      }
    } catch (parseError) {
      console.log('Error parsing AI response:', parseError);
    }
    
    // Look for patterns in unstructured text if JSON parsing failed
    try {
      // Try to find "thoughts" and "answer" sections in the text
      const thoughtsMatch = content.match(/("thoughts":|thoughts:)\s*\[([\s\S]*?)\]/i);
      const answerMatch = content.match(/("answer":|answer:)\s*"([\s\S]*?)"/i);
      
      if (thoughtsMatch && answerMatch) {
        const thoughtsText = thoughtsMatch[2];
        const answerText = answerMatch[2];
        
        const thoughts = thoughtsText
          .split(/",\s*"/g)
          .map(t => t.replace(/^"/, '').replace(/"$/, '').trim())
          .filter(t => t.length > 0);
          
        return {
          thoughts,
          answer: answerText.trim()
        };
      }
    } catch (patternError) {
      console.log("Error extracting patterns from text:", patternError);
    }
    
    // Default fallback if all parsing methods fail
    // If content looks like plain text (no JSON-like structures), just use it as the answer
    if (!content.includes('{') && !content.includes('"thoughts":') && !content.includes('"answer":')) {
      return { 
        thoughts: ["Analyzed your question", "Searched through emails", "Found relevant information"],
        answer: content.trim()
      };
    }
    
    // Final fallback
    return { 
      thoughts: ["Analyzed your question", "Searched through emails", "Found relevant information"],
      answer: "I encountered an issue processing your request. Please try asking your question again."
    };
  };
  
  // Handle email reference clicks
  const handleEmailReferenceClick = (emailId: string) => {
    console.log("Opening email in preview dialog:", emailId);
    setPreviewEmail(emailId);
    setPreviewDialogOpen(true);
    return false;
  };
  
  // Format answer text with clickable email references
  const formatAnswerWithEmailReferences = (answer: string) => {
    if (!answer) return null;
    
    // Enhanced regex to catch more email reference formats
    // This will match formats like:
    // - [Email:ID123]
    // - [Email:ID123 Subject]
    // - [EmailID123]
    // - Email ID: ID123
    // - Reference: ID123
    const emailRefRegex = /\[Email:([a-zA-Z0-9_-]+)(?:[^\]]*)\]|\[EmailID:?([a-zA-Z0-9_-]+)(?:[^\]]*)\]|Email ID:?\s*([a-zA-Z0-9_-]+)|Reference:?\s*([a-zA-Z0-9_-]+)/gi;
    
    try {
      // Split the text to find all email references
      const matches = Array.from(answer.matchAll(new RegExp(emailRefRegex)));
      
      if (!matches || matches.length === 0) {
        return <span>{answer}</span>;
      }
      
      // Build segments of text and buttons
      const elements: React.ReactNode[] = [];
      let lastIndex = 0;
      
      matches.forEach((match, index) => {
        // Add text before the match
        if (match.index && match.index > lastIndex) {
          elements.push(
            <span key={`text-${index}`}>
              {answer.substring(lastIndex, match.index)}
            </span>
          );
        }
        
        // Extract the email ID from the match
        // Check all capturing groups and use the first non-undefined one
        const emailId = match[1] || match[2] || match[3] || match[4];
        
        // Add the email button
        elements.push(
          <Button 
            key={`email-${index}`}
            variant="link" 
            className="px-1 py-0 h-auto text-primary inline-flex items-center gap-1 underline underline-offset-2" 
            onClick={(e) => {
              e.preventDefault();  // Prevent any default link behavior
              e.stopPropagation(); // Stop event propagation
              handleEmailReferenceClick(emailId);
            }}
            type="button" // Explicitly set as button type
          >
            <Mail className="h-3 w-3" />
            <span>View Email</span>
          </Button>
        );
        
        // Update the lastIndex
        lastIndex = (match.index || 0) + match[0].length;
      });
      
      // Add any remaining text after the last match
      if (lastIndex < answer.length) {
        elements.push(
          <span key="text-last">{answer.substring(lastIndex)}</span>
        );
      }
      
      return <>{elements}</>;
    } catch (error) {
      console.error("Error formatting email references:", error);
      return <span>{answer}</span>;
    }
  };
  
  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // When a new message arrives, we're no longer processing
    if (messages.length > 0 && isProcessing) {
      // Only stop processing if the last message is not empty
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.content && lastMessage.content.trim() !== '') {
        console.log("New message received, stopping processing");
        setIsProcessing(false);
        setCurrentThoughts([]);
        setCurrentThoughtIndex(0);
      }
    }
  }, [messages, isProcessing]);
  
  // Check if email context has been loaded
  useEffect(() => {
    const checkEmailContext = async () => {
      try {
        const response = await fetch('/api/emails/context');
        if (response.ok) {
          const data = await response.json();
          const hasEmails = data.emailContext && data.emailContext.length > 0;
          setContextLoaded(hasEmails);
        }
      } catch (error) {
        console.error('Error checking email context:', error);
      }
    };
    
    checkEmailContext();
  }, []);
  
  // Effect to simulate thinking process when processing
  useEffect(() => {
    if (isProcessing) {
      const defaultThoughts = [
        "Analyzing your question...",
        "Generating search keywords...",
        "Searching for relevant emails...",
        "Summarizing key points from relevant emails...",
        "Analyzing email content...",
        "Preparing concise answer..."
      ];
      
      setCurrentThoughts(defaultThoughts);
      
      // Simulate progression through thoughts
      const interval = setInterval(() => {
        setCurrentThoughtIndex((prev) => {
          if (prev < defaultThoughts.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isProcessing]);
  
  // Clean up any active timeouts when component unmounts
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  
  const addToCleanup = (timeout: NodeJS.Timeout) => {
    timeoutRefs.current.push(timeout);
  };
  
  useEffect(() => {
    // Clean up all timeouts when component unmounts
    const timeouts = timeoutRefs.current;
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  // Custom submit handler to show processing state
  const handleCustomSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setCurrentThoughtIndex(0);
    
    // Safety timeout - ensure UI updates if streaming fails
    const safetyTimeout = setTimeout(() => {
      if (isProcessing) {
        console.log("Safety timeout triggered - forcing UI update");
        setIsProcessing(false);
      }
    }, 30000); // Increase to 30 seconds to allow for processing time
    
    // Add to cleanup
    addToCleanup(safetyTimeout);
    
    handleSubmit(e);
  };
  
  // Start recording audio
  const startRecording = async () => {
    setIsRecording(true);
    setIsTranscribing(false);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = handleAudioStop;
      mediaRecorder.start();
    } catch {
      setIsRecording(false);
      alert('Could not access microphone.');
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
  };

  // Handle audio stop and send to API
  const handleAudioStop = async () => {
    setIsTranscribing(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Transcription failed');
      const data = await response.json();
      if (data.text) {
        handleInputChange({ target: { value: input ? input + ' ' + data.text : data.text } } as React.ChangeEvent<HTMLInputElement>);
      }
    } catch {
      alert('Failed to transcribe audio.');
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Render a single message
  const renderMessage = (message: Message) => {
    // For assistant messages, try to parse structured format
    if (message.role === 'assistant') {
      try {
        const parsedResponse = parseAIMessage(message.content);
        
        return (
          <div className="flex flex-col gap-2 max-w-[80%] animate-slideIn">
            {parsedResponse.thoughts && parsedResponse.thoughts.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>Thought process:</span>
                </div>
                <ul className="pl-5 space-y-1.5">
                  {parsedResponse.thoughts.map((thought, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary/70" />
                      <span>{thought}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-lg px-4 py-2 bg-muted">
              <div className="prose dark:prose-invert max-w-none text-sm">
                {formatAnswerWithEmailReferences(parsedResponse.answer)}
              </div>
            </div>
          </div>
        );
      } catch (error) {
        console.error("Error rendering assistant message:", error);
        // Fallback rendering for assistant messages when parsing fails
        return (
          <div className="flex flex-col gap-2 max-w-[80%] animate-slideIn">
            <div className="rounded-lg px-4 py-2 bg-muted">
              <div className="prose dark:prose-invert max-w-none text-sm break-words">
                {message.content || "I'm having trouble processing your request."}
              </div>
            </div>
          </div>
        );
      }
    }
    
    // User message
    return (
      <div className="flex flex-row-reverse gap-2 max-w-[80%] animate-slideIn">
        <div className="rounded-lg px-4 py-2 bg-primary text-primary-foreground">
          <div className="prose dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  };

  // Watch for triggerRecipientDialog flag in assistant messages
  useEffect(() => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') {
      try {
        const json = extractJsonFromString(lastMsg.content);
        if (
          json &&
          typeof json === 'object' &&
          'triggerRecipientDialog' in json &&
          json.triggerRecipientDialog === true &&
          typeof json.subject === 'string' &&
          typeof json.content === 'string' &&
          composeDialogRef.current
        ) {
          composeDialogRef.current.openDialog(json.subject, json.content);
        }
      } catch {}
    }
  }, [messages]);

  // At the end of your messages list, add the thinking indicator
  const renderThinkingIndicator = () => {
    if (!isLoading && !isProcessing) return null;
    
    return (
      <div className="flex items-start gap-3 p-4 animate-in slide-in-from-bottom-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="bg-muted/50 rounded-xl p-3 max-w-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm font-medium">100x is thinking</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <Card className="w-[400px] flex flex-col shadow-2xl border-orange-200/50 bg-background/95 backdrop-blur-lg animate-in slide-in-from-bottom-2">
          <CardHeader 
            className="px-4 py-3 border-b hover:bg-accent/50 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-md">Chat with 100x</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {contextLoaded && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Search className="h-3 w-3" />
                        Smart Email Search
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Intelligent email search based on your questions</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={onToggle}
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          
          <div className="h-[500px] flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 mb-4">
                {/* Error message display */}
                {errorMessage && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <h2 className="text-xl font-semibold text-foreground mb-1">Ask anything about your emails</h2>
                    <p className="text-sm text-muted-foreground mb-6">Ask to do or show anything using natural language</p>
                    <div className="mt-2 flex flex-col items-center gap-2">
                      <div className="flex gap-2 flex-wrap justify-center">
                        {[
                          'Show unpaid invoices',
                          'Show recent work emails',
                          'Find all work meetings',
                          'What projects do I have coming up?',
                          'Show emails from Stripe',
                          'When is my next interview?',
                        ].map((example, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleInputChange({ target: { value: example } } as React.ChangeEvent<HTMLInputElement>)}
                            className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors whitespace-nowrap border border-border/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                            style={{ minWidth: 'fit-content' }}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap justify-center ml-6">
                        {[
                          'When is my interview',
                          'Summarize my recent emails',
                          'Find emails about project deadlines',
                          'Help me draft a reply',
                          'Find emails from my recruiter',
                          'Key points from last meeting'
                        ].map((example, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleInputChange({ target: { value: example } } as React.ChangeEvent<HTMLInputElement>)}
                            className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors whitespace-nowrap border border-border/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                            style={{ minWidth: 'fit-content' }}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map(message => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {renderMessage(message)}
                    </div>
                  ))
                )}
                
                {/* Thinking state display */}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="flex flex-col gap-2 max-w-[80%] animate-slideIn">
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>Thinking...</span>
                        </div>
                        <ul className="pl-5 space-y-1.5">
                          {currentThoughts.map((thought, index) => (
                            <li 
                              key={index} 
                              className={`text-xs flex items-start gap-2 transition-all duration-500 ease-in-out ${
                                index <= currentThoughtIndex 
                                  ? 'opacity-100 translate-y-0' 
                                  : 'opacity-50 translate-y-1'
                              }`}
                            >
                              <div className="relative">
                                {index <= currentThoughtIndex ? (
                                  <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary/70 animate-scaleIn" />
                                ) : (
                                  <div className="h-3 w-3 mt-0.5 rounded-full border border-muted-foreground/30 animate-pulse" />
                                )}
                              </div>
                              <span className={index <= currentThoughtIndex ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
                                {thought}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {renderThinkingIndicator()}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <CardFooter className="p-3 border-t mt-auto">
              <form onSubmit={handleCustomSubmit} className="flex w-full gap-2 items-center">
                <Input
                  placeholder={isProcessing ? "Searching through your emails..." : isTranscribing ? "Transcribing..." : "Type your message..."}
                  value={input}
                  onChange={handleInputChange}
                  disabled={isLoading || isProcessing || isTranscribing}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant={isRecording ? "secondary" : "outline"}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading || isProcessing || isTranscribing}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  className="h-10 w-10"
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className={`h-4 w-4 ${isRecording ? 'text-red-500 animate-pulse' : ''}`} />
                  )}
                </Button>
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading || isProcessing || !input.trim() || isTranscribing}
                  className="h-10 w-10"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardFooter>
          </div>
        </Card>
      ) : (
        <Button
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300 text-white px-4"
          onClick={onToggle}
        >
          <Bot className="h-5 w-5" />
          <span>Chat with 100x</span>
        </Button>
      )}
      
      {/* Email preview dialog */}
      <EmailPreviewDialog 
        isOpen={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        emailId={previewEmail}
      />
      <EmailComposeDialog ref={composeDialogRef} />
    </div>
  );
} 