'use client';

import * as React from 'react';
import { useEffect, useState, useRef, useCallback, Suspense, lazy } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Mail, LogOut, Inbox, FileText, Send, Trash, Plus, ChevronLeft, ChevronRight, MoreVertical, Star, Tag, Flag, Archive, Sparkles, Shield, Paperclip, Download, Eye, Trash2, X, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import api from '@/lib/axios';
import debounce from 'lodash/debounce';
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { ResizableHandleWithReset } from "@/components/ui/resizable-handle-with-reset";
import { useEmailPanelLayout } from "@/hooks/use-email-panel-layout";
import { toast } from 'sonner';
import { processEmailContent } from '@/lib/sanitize-html';

interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded data for inline viewing
}

interface Email {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  internalDate?: string;
  attachments?: Attachment[];
  starred?: boolean;
}

interface EmailThread {
  threadId: string;
  messages: Email[];
  historyId?: string;
}

interface EmailsResponse {
  messages: Email[];
  nextPageToken?: string;
}

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

// Lazy load heavy components
const ChatWith100x = lazy(() => import('@/components/chat-with-100x').then(m => ({ default: m.ChatWith100x })));
const ReplyComposer = lazy(() => import('@/components/reply-composer').then(m => ({ default: m.ReplyComposer })));
const EmailSummaryDialog = lazy(() => import('@/components/email-summary-dialog').then(m => ({ default: m.EmailSummaryDialog })));
const FollowUpReminder = lazy(() => import('@/components/follow-up-reminder').then(m => ({ default: m.FollowUpReminder })));
const MiniReminder = lazy(() => import('@/components/mini-reminder').then(m => ({ default: m.MiniReminder })));

// In-memory cache for emails per folder/query (non-reactive, not persisted)
const emailCache: Record<string, { emails: Email[]; nextPageToken?: string }> = {};

// Add flag colors and labels
const FLAG_LABELS: Record<string, string> = {
  promotional: 'Promotional',
  work: 'Work',
  to_reply: 'To Reply',
  other: 'Other',
};
const FLAG_COLORS: Record<string, string> = {
  promotional: 'bg-pink-500',
  work: 'bg-blue-500',
  to_reply: 'bg-amber-500',
  other: 'bg-gray-400',
};

// Helper to get/set flags in localStorage (latest 40 only)
function getFlaggedEmailsLS() {
  try {
    const raw = localStorage.getItem('flagged_emails');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function setFlaggedEmailsLS(flags: Record<string, { flag: string, subject: string, snippet: string, sender: string, flaggedAt: number }>) {
  // Only keep the latest 40 (delete the oldest if more than 40)
  const sorted = Object.entries(flags)
    .sort((a, b) => b[1].flaggedAt - a[1].flaggedAt) // newest first
    .slice(0, 40); // keep only the newest 40
  const obj = Object.fromEntries(sorted);
  localStorage.setItem('flagged_emails', JSON.stringify(obj));
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
        {/* Loading skeleton */}
        <div className="h-16 border-b border-border/50 flex items-center px-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 backdrop-blur-xl flex-none">
          <div className="flex items-center space-x-4 w-64">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex-1 px-4">
            <Skeleton className="h-10 w-full max-w-xl mx-auto rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Memoize the cache key generator function to prevent infinite re-renders
  const getCacheKey = useCallback((folder: string, query: string, starredOnly: boolean) => {
    return `${folder}_${query}_${starredOnly ? 'starred' : 'all'}`;
  }, []);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [composing, setComposing] = useState(false);
  const [newEmail, setNewEmail] = useState({
    to: '',
    subject: '',
    content: ''
  });
  const [emailChips, setEmailChips] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState<'idle' | 'subject' | 'content'>('idle');
  const [selectedTone, setSelectedTone] = useState('professional');
  const [showToneDropdown, setShowToneDropdown] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<Record<string, EmailThread>>({});
  const loadingThreadIds = useRef<Set<string>>(new Set());
  const [isReplying, setIsReplying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<EmailSummary | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<'inbox' | 'sent' | 'spam' | 'trash'>('inbox');
  const [flaggedEmails, setFlaggedEmails] = useState<Record<string, { flag: string, subject: string, snippet: string, sender: string, flaggedAt: number }>>({});
  const [emailSummary, setEmailSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [starringEmails, setStarringEmails] = useState<Set<string>>(new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [deletingEmails, setDeletingEmails] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    emailId: string;
    emailSubject: string;
    action: 'trash' | 'permanent';
  }>({
    isOpen: false,
    emailId: '',
    emailSubject: '',
    action: 'trash'
  });

  // New state for preview functionality
  const [generatedPreview, setGeneratedPreview] = useState<{
    subject?: string;
    content?: string;
    isVisible: boolean;
  }>({
    isVisible: false
  });

  // New state for attachments
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state for reminder system
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isMiniReminderVisible, setIsMiniReminderVisible] = useState(false);

  const { refs, sizes, onResize } = useEmailPanelLayout();

  const observer = useRef<IntersectionObserver | null>(null);
  
  // Create a stable debounced search function
  const debouncedSearchRef = useRef<ReturnType<typeof debounce> | null>(null);
  
  // Initialize debounced function only once
  useEffect(() => {
    debouncedSearchRef.current = debounce((query: string, callback: (query: string) => void) => {
      callback(query);
    }, 800);
    
    return () => {
      debouncedSearchRef.current?.cancel();
    };
  }, []);

  // Define handleLogout early so it can be used in useEffect
  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    router.push('/login');
  }, [router]);

  const toneOptions = [
    { value: 'professional', label: '💼 Professional', emoji: '💼' },
    { value: 'casual', label: '😊 Casual', emoji: '😊' },
    { value: 'formal', label: '🎩 Formal', emoji: '🎩' },
    { value: 'persuasive', label: '🎯 Persuasive', emoji: '🎯' },
    { value: 'friendly', label: '🤝 Friendly', emoji: '🤝' },
    { value: 'urgent', label: '⚡ Urgent', emoji: '⚡' },
    { value: 'apologetic', label: '🙏 Apologetic', emoji: '🙏' },
    { value: 'confident', label: '💪 Confident', emoji: '💪' },
  ];

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Handle adding email chips
  const addEmailChip = (email: string) => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && emailRegex.test(trimmedEmail) && !emailChips.includes(trimmedEmail)) {
      setEmailChips(prev => [...prev, trimmedEmail]);
    }
  };

  // Handle removing email chips
  const removeEmailChip = (emailToRemove: string) => {
    setEmailChips(prev => prev.filter(email => email !== emailToRemove));
  };

  // Handle input key events
  const handleEmailInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === ' ' || e.key === ',' || e.key === 'Enter') && emailInput.trim()) {
      e.preventDefault();
      addEmailChip(emailInput);
      setEmailInput('');
    } else if (e.key === 'Backspace' && !emailInput && emailChips.length > 0) {
      // Remove last chip when backspace is pressed on empty input
      setEmailChips(prev => prev.slice(0, -1));
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Validate file size (max 25MB per file)
      const maxSize = 25 * 1024 * 1024; // 25MB
      const validFiles = files.filter(file => {
        if (file.size > maxSize) {
          toast.error(`File "${file.name}" is too large. Maximum size is 25MB.`);
          return false;
        }
        return true;
      });

      // Check total attachment size (max 100MB total)
      const totalSize = [...selectedFiles, ...validFiles].reduce((sum, file) => sum + file.size, 0);
      const maxTotalSize = 100 * 1024 * 1024; // 100MB
      
      if (totalSize > maxTotalSize) {
        toast.error('Total attachment size cannot exceed 100MB.');
        return;
      }

      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    // Reset the input
    if (e.target) e.target.value = '';
  };

  // Handle file removal
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Initialize flagged emails from localStorage on mount
  useEffect(() => {
    const flaggedLS = getFlaggedEmailsLS();
    setFlaggedEmails(flaggedLS);
  }, []);

  // Handle click outside to close tone dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showToneDropdown && !(event.target as Element)?.closest('.tone-dropdown-container')) {
        setShowToneDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showToneDropdown]);

  // Update URL when folder changes - stable implementation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentUrlFolder = params.get('folder');
    
    if (currentUrlFolder !== currentFolder) {
      params.set('folder', currentFolder);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [currentFolder, router]);

  // Initialize folder from URL on mount - only run once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get('folder');
    if (folder === 'sent' || folder === 'inbox' || folder === 'spam' || folder === 'trash') {
      setCurrentFolder(folder);
    }
    
    // Initialize starred view
    const view = params.get('view');
    if (view === 'starred') {
      setShowStarredOnly(true);
    }
  }, []); // Empty dependency array - only run on mount

  // Handle thread expansion/collapse
  const handleToggleThread = useCallback(async (threadId: string) => {
    try {
      const response = await api.get(`/api/emails/thread/${threadId}`);
      setThreadData(prev => ({
        ...prev,
        [threadId]: response.data as EmailThread
      }));
    } catch (error) {
      console.error('Error fetching thread:', error);
    }
  }, []);

  // Fetch a specific email by threadId when it's not in the current list
  const fetchEmailByThreadId = useCallback(async (threadId: string) => {
    // Prevent redundant API calls
    if (loadingThreadIds.current.has(threadId)) {
      console.log('Already loading threadId:', threadId);
      return null;
    }
    
    loadingThreadIds.current.add(threadId);
    try {
      console.log('Fetching email by threadId:', threadId);
      const response = await api.get(`/api/emails/thread/${threadId}`);
      const threadData = response.data as EmailThread & { mainEmail?: Email };
      
      if (threadData.mainEmail) {
        console.log('Found main email for threadId:', threadData.mainEmail.subject);
        // Add to thread data
        setThreadData(prev => ({
          ...prev,
          [threadId]: {
            threadId: threadData.threadId,
            messages: threadData.messages,
            historyId: threadData.historyId
          }
        }));
        // Set as selected email
        setSelectedEmail(threadData.mainEmail);
        return threadData.mainEmail;
      }
    } catch (error) {
      console.error('Error fetching email by threadId:', error);
    } finally {
      loadingThreadIds.current.delete(threadId);
    }
    return null;
  }, []);

  const fetchEmails = useCallback(async (pageToken?: string, query?: string) => {
    const cacheKey = getCacheKey(currentFolder, query || '', showStarredOnly);
    
    // If switching folders or star view without pageToken, clear relevant caches
    if (!pageToken) {
      // Clear the current cache to ensure fresh data
      if (emailCache[cacheKey]) {
        delete emailCache[cacheKey];
      }
    }
    
    // Check cache only for pagination (when pageToken exists)
    if (pageToken && emailCache[cacheKey]) {
      setEmails(emailCache[cacheKey].emails);
      setNextPageToken(emailCache[cacheKey].nextPageToken);
      setHasMore(!!emailCache[cacheKey].nextPageToken);
      setLoading(false);
      setSearchLoading(false);
      setLoadingMore(false);
      return;
    }
    
    try {
      if (pageToken) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const params = new URLSearchParams();
      if (pageToken) params.append('pageToken', pageToken);
      if (query) params.append('q', query);
      params.append('folder', currentFolder);
      const response = await api.get<EmailsResponse>(`/api/emails?${params.toString()}`);
      const { messages, nextPageToken } = response.data;
      
      // Filter messages based on starred view if needed
      let filteredMessages = messages || [];
      if (showStarredOnly) {
        filteredMessages = filteredMessages.filter(email => email.starred);
      }
      
      if (pageToken) {
        setEmails(prev => {
          const uniqueMessages = filteredMessages.filter(
            newEmail => !prev.some(existingEmail => existingEmail.id === newEmail.id)
          );
          const updated = [...prev, ...uniqueMessages];
          emailCache[cacheKey] = { emails: updated, nextPageToken };
          return updated;
        });
      } else {
        setEmails(filteredMessages);
        emailCache[cacheKey] = { emails: filteredMessages, nextPageToken };
      }
      setNextPageToken(nextPageToken);
      setHasMore(!!nextPageToken);
      
      // Prefetch next page in background if available
      if (nextPageToken && !query) {
        api.get<EmailsResponse>(`/api/emails?${params.toString()}&pageToken=${nextPageToken}`)
          .then(res => {
            const { messages: nextMessages, nextPageToken: nextToken } = res.data;
            const nextCacheKey = `${cacheKey}:page:${nextPageToken}`;
            emailCache[nextCacheKey] = { emails: nextMessages, nextPageToken: nextToken };
          })
          .catch(() => {
            // Prefetch failed, ignore silently
          });
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      setEmails([]);
    } finally {
      setLoading(false);
      setSearchLoading(false);
      setLoadingMore(false);
    }
  }, [currentFolder, showStarredOnly, getCacheKey]);

  const lastEmailElementRef = useCallback((node: HTMLElement | null) => {
    if (loading || searchLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchEmails(nextPageToken);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, searchLoading, hasMore, nextPageToken, fetchEmails]);

  const search = useCallback((query: string) => {
    if (query.trim().length < 2) {
      setSearchLoading(true);
      fetchEmails(undefined);
      return;
    }
    setSearchLoading(true);
    fetchEmails(undefined, query);
  }, [fetchEmails]);

  // Stable initial data fetch effect
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const cookies = document.cookie.split(';');
        const userInfoCookie = cookies
          .find(c => c.trim().startsWith('temp_user_info='))
          ?.split('=')?.[1];

        if (userInfoCookie) {
          const userInfo = JSON.parse(decodeURIComponent(userInfoCookie));
          localStorage.setItem('user_info', JSON.stringify(userInfo));
          document.cookie = 'temp_user_info=; max-age=0; path=/;';
        }

        const storedUserInfo = localStorage.getItem('user_info');
        if (!storedUserInfo) {
          console.log('No user info found, logging out');
          handleLogout();
          return;
        }
        
        if (isMounted) {
        setUserInfo(JSON.parse(storedUserInfo));
          // Call fetchEmails directly instead of relying on dependency
          fetchEmails(undefined, '');
        }
        
        // After emails are loaded, check if there's a threadId in URL that needs loading
        const urlThreadId = searchParams.get('threadId');
        if (urlThreadId && isMounted) {
          console.log('Page loaded with threadId in URL:', urlThreadId);
          // The URL navigation effect will handle this, but we may need to fetch it if not in list
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
        setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [handleLogout, searchParams]); // Remove fetchEmails to prevent infinite loop

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current(value, search);
    }
  }, [search]);

  const handleSendEmail = async () => {
    if (emailChips.length === 0 || !newEmail.subject || !newEmail.content) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setSending(true);
      
      // Prepare form data for attachments
      const formData = new FormData();
      formData.append('to', emailChips.join(', '));
      formData.append('subject', newEmail.subject);
      formData.append('content', newEmail.content);
      
      // Add attachments
      selectedFiles.forEach((file) => {
        formData.append(`attachments`, file);
      });

      const response = await fetch('/api/emails/send', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        const recipientCount = emailChips.length;
        const attachmentText = selectedFiles.length > 0 ? ` with ${selectedFiles.length} attachment${selectedFiles.length !== 1 ? 's' : ''}` : '';
        toast.success(`Email sent successfully to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}${attachmentText}!`);
        setComposing(false);
        setNewEmail({ to: '', subject: '', content: '' });
        setEmailChips([]);
        setEmailInput('');
        setSelectedFiles([]);
        setSelectedTone('professional');
        setShowToneDropdown(false);
        // Optionally refresh the sent emails list
        fetchEmails(undefined);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleGenerateContent = async (type: 'subject' | 'content') => {
    let prompt = '';
    let shouldGenerateBoth = false;
    
    if (type === 'subject') {
      prompt = newEmail.subject;
      if (!prompt.trim()) {
        alert('Please enter a subject to rephrase');
        return;
      }
    } else if (type === 'content') {
      prompt = newEmail.content;
      if (!prompt.trim()) {
        alert('Please enter some content to generate or rewrite');
        return;
      }
      // If content is being generated and no subject exists, generate both
      if (!newEmail.subject.trim()) {
        shouldGenerateBoth = true;
      }
    }

    try {
      setGenerating(type);
      const response = await api.post('/api/generate', {
        prompt,
        type: shouldGenerateBoth ? 'both' : type,
        tone: selectedTone,
        userName: userInfo?.name || '',
      });

      const data = response.data as { subject?: string; content?: string };
      
      // Show preview with generated content
      setGeneratedPreview({
        subject: shouldGenerateBoth ? data.subject : (type === 'subject' ? data.subject : undefined),
        content: type === 'content' ? data.content : undefined,
        isVisible: true
      });
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      alert(`Failed to generate ${type}. Please try again.`);
    } finally {
      setGenerating('idle');
    }
  };

  // Accept generated content
  const acceptGeneratedContent = () => {
    if (generatedPreview.subject) {
      setNewEmail(prev => ({ ...prev, subject: generatedPreview.subject! }));
    }
    if (generatedPreview.content) {
      setNewEmail(prev => ({ ...prev, content: generatedPreview.content! }));
    }
    setGeneratedPreview({ isVisible: false });
  };

  // Reject generated content
  const rejectGeneratedContent = () => {
    setGeneratedPreview({ isVisible: false });
  };

  const handleReplyComplete = (repliedToEmailId?: string) => {
    setIsReplying(false);
    
    // If we have the replied-to email ID, update its flag from 'to_reply' to 'work'
    if (repliedToEmailId) {
      const currentFlags = getFlaggedEmailsLS();
      if (currentFlags[repliedToEmailId] && currentFlags[repliedToEmailId].flag === 'to_reply') {
        const updatedFlags = {
          ...currentFlags,
          [repliedToEmailId]: {
            ...currentFlags[repliedToEmailId],
            flag: 'work', // Mark as work since it's been responded to
            flaggedAt: Date.now() // Update timestamp to prevent re-flagging
          }
        };
        setFlaggedEmails(updatedFlags);
        setFlaggedEmailsLS(updatedFlags);
        console.log(`Marked email ${repliedToEmailId} as 'work' after reply`);
      }
    }
    
    // Optionally refresh the emails list
    fetchEmails(undefined);
  };

  // Helper function to detect if email is long enough for TLDR
  const isEmailLong = (emailBody: string) => {
    const textContent = emailBody.replace(/<[^>]*>/g, '').trim();
    return textContent.length > 1000; // More than 1000 characters
  };

  // Generate TLDR summary for email
  const handleGenerateTLDR = async (email: Email) => {
    if (isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      const response = await api.post('/api/emails/tldr', {
        emailContent: email.body,
        subject: email.subject,
      });

      const data = response.data as { summary?: string; error?: string };
      
      if (data.error) {
        setEmailSummary(`Error: ${data.error}`);
      } else {
        setEmailSummary(data.summary || 'Unable to generate summary');
      }
      
      setShowSummary(true);
    } catch (error) {
      console.error('Error generating TLDR:', error);
      setEmailSummary('Failed to generate summary. Please try again.');
      setShowSummary(true);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Enhanced handleStarEmail to properly manage starred emails across folders
  const handleStarEmail = async (emailId: string, currentlyStarred: boolean) => {
    if (starringEmails.has(emailId)) return;

    setStarringEmails(prev => new Set(prev).add(emailId));
    
    // Optimistic update - update UI immediately
    const newStarredState = !currentlyStarred;
    
    // Update the email in the local state immediately
    setEmails(prevEmails => {
      const updatedEmails = prevEmails.map(email => 
        email.id === emailId 
          ? { ...email, starred: newStarredState }
          : email
      );
      
      // If we're showing starred only and email is being unstarred, remove it from view
      if (showStarredOnly && !newStarredState) {
        return updatedEmails.filter(email => email.id !== emailId);
      }
      
      return updatedEmails;
    });

    // Update selected email if it's the one being starred
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(prev => prev ? { ...prev, starred: newStarredState } : null);
      
      // If we're showing starred only and this email is being unstarred, clear selection
      if (showStarredOnly && !newStarredState) {
        setSelectedEmail(null);
        const params = new URLSearchParams(window.location.search);
        params.delete('threadId');
        router.replace(`/dashboard?${params.toString()}`, { scroll: false });
      }
    }

    // Update thread data if the email is part of a thread
    if (selectedEmail?.threadId && threadData[selectedEmail.threadId]) {
      setThreadData(prev => ({
        ...prev,
        [selectedEmail.threadId!]: {
          ...prev[selectedEmail.threadId!],
          messages: prev[selectedEmail.threadId!].messages.map(msg =>
            msg.id === emailId ? { ...msg, starred: newStarredState } : msg
          )
        }
      }));
    }

    // Update cache for current folder/query
    const cacheKey = getCacheKey(currentFolder, searchQuery, showStarredOnly);
    if (emailCache[cacheKey]) {
      emailCache[cacheKey] = {
        ...emailCache[cacheKey],
        emails: emailCache[cacheKey].emails.map(email =>
          email.id === emailId ? { ...email, starred: newStarredState } : email
        ).filter(email => !showStarredOnly || email.starred) // Remove unstarred emails if showing starred only
      };
    }
    
    try {
      const response = await api.post('/api/emails/star', {
        messageId: emailId,
        star: newStarredState
      });

      const responseData = response.data as { success: boolean; starred: boolean };

      if (responseData.success) {
        toast.success(currentlyStarred ? 'Email unstarred' : 'Email starred');
      } else {
        throw new Error('API call returned unsuccessful');
      }
    } catch (error) {
      console.error('Error starring email:', error);
      toast.error('Failed to update star status');
      
      // Revert optimistic update on error
      setEmails(prevEmails => 
        prevEmails.map(email => 
          email.id === emailId 
            ? { ...email, starred: currentlyStarred }
            : email
        )
      );

      if (selectedEmail?.id === emailId) {
        setSelectedEmail(prev => prev ? { ...prev, starred: currentlyStarred } : null);
      }

      if (selectedEmail?.threadId && threadData[selectedEmail.threadId]) {
        setThreadData(prev => ({
          ...prev,
          [selectedEmail.threadId!]: {
            ...prev[selectedEmail.threadId!],
            messages: prev[selectedEmail.threadId!].messages.map(msg =>
              msg.id === emailId ? { ...msg, starred: currentlyStarred } : msg
            )
          }
        }));
      }
      
      // Revert cache
      if (emailCache[cacheKey]) {
        emailCache[cacheKey] = {
          ...emailCache[cacheKey],
          emails: emailCache[cacheKey].emails.map(email =>
            email.id === emailId ? { ...email, starred: currentlyStarred } : email
          )
        };
      }
    } finally {
      setStarringEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  const handleSummarize = async () => {
    if (!emails.length) return;
    
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/emails/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailIds: emails.slice(0, 20).map(email => email.id)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to summarize emails');
      }

      const data = await response.json();
      setSummary(data);
      setIsSummaryDialogOpen(true);
    } catch (error) {
      console.error('Error summarizing emails:', error);
      toast.error('Failed to summarize emails');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleEmailClick = useCallback((email: Email) => {
    // Update URL with threadId only
    const params = new URLSearchParams(window.location.search);
    if (email.threadId) {
      params.set('threadId', email.threadId);
      // Auto-load thread data if not already loaded
      if (email.threadId && !threadData[email.threadId]) {
        handleToggleThread(email.threadId);
      }
    } else {
      params.delete('threadId');
    }
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    
    // Set email immediately - no loading bullshit
    setSelectedEmail(email);
  }, [router, threadData, handleToggleThread]);

  const handleEmailClickById = useCallback((emailId: string) => {
    console.log('Opening email from chat:', emailId);
     
     // Update URL and let the URL navigation effect handle the rest
     const params = new URLSearchParams(window.location.search);
     params.set('threadId', emailId); // Treat emailId as threadId since chat passes threadId
     const newUrl = `/dashboard?${params.toString()}`;
     console.log('Calling router.push with:', newUrl);
     console.log('Current URL before push:', window.location.href);
     router.push(newUrl);
     
     // Check if URL actually changed after a short delay
     setTimeout(() => {
       console.log('URL after push:', window.location.href);
       console.log('SearchParams after push:', searchParams.get('threadId'));
     }, 100);
   }, [router, searchParams]);

  const handleEmailClickFromSummary = useCallback((emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (email) {
      handleEmailClick(email);
      setIsSummaryDialogOpen(false);
    }
  }, [emails, handleEmailClick]);

  // Handle email click from follow-up reminder
  const handleEmailClickFromReminder = (emailId: string) => {
    // Find the email and select it
    const email = emails.find(e => e.id === emailId);
    if (email) {
      setSelectedEmail(email);
      
      // Update URL with threadId
      const params = new URLSearchParams(window.location.search);
      if (email.threadId) {
        params.set('threadId', email.threadId);
      } else {
        params.delete('threadId');
      }
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
      
      // Load thread data if needed
      if (email.threadId && !threadData[email.threadId]) {
        handleToggleThread(email.threadId);
      }
    }
  };

  const formatEmailDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }, []);

  // Fetch flags after emails are loaded (optimized: flag up to 20 unflagged emails per load, update UI as results come in)
  useEffect(() => {
    if (!emails.length) return;
    const flaggedLS = getFlaggedEmailsLS();
    setFlaggedEmails(flaggedLS); // Show emails instantly with whatever flags are present
    
    // Find up to 20 unflagged emails, but exclude recently updated ones to prevent overriding manual changes
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const toFlag = emails.filter(e => {
      const existingFlag = flaggedLS[e.id];
      // Skip if: already flagged AND recently updated (within 1 hour)
      if (existingFlag && existingFlag.flaggedAt > oneHourAgo) {
        return false;
      }
      // Include if: not flagged at all OR flagged but old (allow re-flagging old entries)
      return !existingFlag || existingFlag.flaggedAt <= oneHourAgo;
    }).slice(0, 20).map(e => ({ id: e.id, subject: e.subject, snippet: e.snippet, sender: e.from }));
    
    if (toFlag.length === 0) return;
    
    console.log(`Flagging ${toFlag.length} emails (${emails.length - toFlag.length} skipped due to recent updates)`);
    
    // Make request for only the batch
    fetch('/api/emails/flagged', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: toFlag }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.flagged) {
          const now = Date.now();
          const newFlags = { ...getFlaggedEmailsLS() };
          for (const f of data.flagged) {
            // Only update if the email wasn't recently manually updated
            const existing = newFlags[f.id];
            if (!existing || existing.flaggedAt <= oneHourAgo) {
              newFlags[f.id] = {
                flag: f.flag,
                subject: f.subject,
                snippet: f.snippet,
                sender: f.sender,
                flaggedAt: now,
              };
            }
          }
          setFlaggedEmails(newFlags);
          setFlaggedEmailsLS(newFlags);
        }
      })
      .catch(() => setFlaggedEmails(getFlaggedEmailsLS()));
  }, [emails]);

  // Handle URL-based email/thread navigation
  useEffect(() => {
    const urlThreadId = searchParams.get('threadId');
    console.log('URL navigation effect triggered, threadId:', urlThreadId);
    console.log('Current selectedEmail threadId:', selectedEmail?.threadId);
    console.log('ThreadData has this threadId:', !!threadData[urlThreadId || '']);
    console.log('Currently loading:', loadingThreadIds.current.has(urlThreadId || ''));

    if (urlThreadId) {
      // Check if we already have this email selected
      if (selectedEmail?.threadId === urlThreadId) {
        console.log('Email already selected for threadId:', urlThreadId);
        return;
      }
      
      // First try to find the email in current list
      const targetEmail = emails.find(email => email.threadId === urlThreadId);
      
      if (targetEmail) {
        console.log('Found target email in current list, selecting:', targetEmail.subject);
        setSelectedEmail(targetEmail);
        
        // Load thread data if needed
        if (!threadData[urlThreadId]) {
          console.log('Loading thread data for URL threadId:', urlThreadId);
          handleToggleThread(urlThreadId);
        }
      } else if (!loadingThreadIds.current.has(urlThreadId) && !threadData[urlThreadId]) {
        // Email not in current list, fetch it directly
        console.log('Email not found in current list, fetching by threadId:', urlThreadId);
        fetchEmailByThreadId(urlThreadId);
      } else if (threadData[urlThreadId] && threadData[urlThreadId].messages && threadData[urlThreadId].messages.length > 0) {
        // We have thread data but might not have selected the email yet
        const mainEmail = threadData[urlThreadId].messages[0];
        console.log('Thread data exists, selecting main email:', mainEmail.subject);
        setSelectedEmail(mainEmail);
      } else {
        console.log('Not fetching because:', {
          alreadyLoading: loadingThreadIds.current.has(urlThreadId),
          hasThreadData: !!threadData[urlThreadId],
          threadDataKeys: Object.keys(threadData)
        });
      }
    }
  }, [emails, threadData, handleToggleThread, fetchEmailByThreadId, searchParams]);

  // Clear TLDR summary when email changes
  useEffect(() => {
    setEmailSummary(null);
    setShowSummary(false);
  }, [selectedEmail?.id]);

  // Helper function to format TLDR summary
  const formatTLDRSummary = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .split('\n')
      .map(line => {
        if (line.trim().startsWith('* ')) {
          return `<li>${line.trim().substring(2)}</li>`;
        } else if (line.trim().match(/^ {2,}\+ /)) {
          return `<li class="ml-4">${line.trim().substring(2)}</li>`;
        } else if (line.trim() === '') {
          return '<br>';
        } else {
          return line;
        }
      })
      .join('<br>')
      .replace(/(<li>.*?<\/li>(?:<br><li>.*?<\/li>)*)/g, '<ul class="list-disc list-inside space-y-1 ml-4">$1</ul>')
      .replace(/(<li class="ml-4">.*?<\/li>(?:<br><li class="ml-4">.*?<\/li>)*)/g, '<ul class="list-disc list-inside space-y-1 ml-8">$1</ul>')
      .replace(/<br><br>/g, '<div class="my-2"></div>');
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get file type icon
  const getFileTypeIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (mimeType.includes('pdf')) {
      return '📄';
    } else if (mimeType.includes('word') || filename.endsWith('.doc') || filename.endsWith('.docx')) {
      return '📝';
    } else if (mimeType.includes('excel') || filename.endsWith('.xls') || filename.endsWith('.xlsx')) {
      return '📊';
    } else if (mimeType.includes('powerpoint') || filename.endsWith('.ppt') || filename.endsWith('.pptx')) {
      return '📊';
    } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
      return '🗄️';
    } else if (mimeType.startsWith('audio/')) {
      return '🎵';
    } else if (mimeType.startsWith('video/')) {
      return '🎬';
    } else {
      return '📎';
    }
  };

  // Handle attachment download
  const handleAttachmentDownload = async (attachment: Attachment, emailId: string) => {
    try {
      const response = await api.get(`/api/emails/attachments/${emailId}/${attachment.id}`);
      const responseData = response.data as { data: string; size: number };
      
      // Validate base64 data
      if (!responseData.data) {
        throw new Error('No attachment data received');
      }

      console.log('Raw attachment data length:', responseData.data.length);
      console.log('First 100 chars of data:', responseData.data.substring(0, 100));

      // Clean and convert URL-safe base64 to standard base64
      let base64Data = responseData.data.replace(/\s/g, ''); // Remove whitespace
      base64Data = base64Data.replace(/-/g, '+').replace(/_/g, '/'); // Convert URL-safe base64 to standard
      
      // Add proper padding
      const padding = base64Data.length % 4;
      const paddedBase64 = padding ? base64Data + '='.repeat(4 - padding) : base64Data;

      console.log('Processed base64 length:', paddedBase64.length);
      console.log('Base64 validation:', /^[A-Za-z0-9+/]*={0,2}$/.test(paddedBase64));

      try {
        // Validate base64 format before attempting to decode
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(paddedBase64)) {
          throw new Error('Invalid base64 format detected');
        }

        // Convert base64 to blob
        const byteCharacters = atob(paddedBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: attachment.mimeType });
        
        console.log('Blob created successfully, size:', blob.size);
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Downloaded ${attachment.filename}`);
      } catch (error) {
        console.error('Error processing attachment data:', error);
        console.error('Base64 data that caused error:', paddedBase64.substring(0, 100));
        toast.error('Failed to process attachment data');
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Failed to download attachment');
    }
  };

  // Handle attachment preview (for images)
  const handleAttachmentPreview = async (attachment: Attachment, emailId: string) => {
    if (!attachment.mimeType.startsWith('image/')) {
      // For non-images, just download
      handleAttachmentDownload(attachment, emailId);
      return;
    }
    
    try {
      const response = await api.get(`/api/emails/attachments/${emailId}/${attachment.id}`);
      const responseData = response.data as { data: string; size: number };
      
      // Clean and convert URL-safe base64 to standard base64
      let base64Data = responseData.data.replace(/\s/g, ''); // Remove whitespace
      base64Data = base64Data.replace(/-/g, '+').replace(/_/g, '/'); // Convert URL-safe base64 to standard
      
      // Add proper padding
      const padding = base64Data.length % 4;
      const paddedBase64 = padding ? base64Data + '='.repeat(4 - padding) : base64Data;
      
      // Validate base64 format before attempting to decode
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(paddedBase64)) {
        throw new Error('Invalid base64 format detected');
      }
      
      // Create a blob URL for the image
      const byteCharacters = atob(paddedBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.mimeType });
      const url = window.URL.createObjectURL(blob);
      
      // Open in new window for preview
      window.open(url, '_blank');
      
      // Clean up after some time
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Error previewing attachment:', error);
      toast.error('Failed to preview attachment');
    }
  };

  // Enhanced handleDeleteEmail to properly manage emails across folders
  const handleDeleteEmail = async (emailId: string, action: 'trash' | 'permanent' = 'trash') => {
    if (deletingEmails.has(emailId)) return;

    setDeletingEmails(prev => new Set(prev).add(emailId));
    
    // Store original state for potential revert
    const originalEmails = emails;
    const originalSelectedEmail = selectedEmail;
    const originalThreadData = threadData;
    
    // Optimistic update - update UI immediately
    // Remove the email from the local state immediately
    setEmails(prevEmails => 
      prevEmails.filter(email => email.id !== emailId)
    );

    // Clear selected email if it's the one being deleted
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
      // Clear URL params
      const params = new URLSearchParams(window.location.search);
      params.delete('threadId');
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    }

    // Remove from thread data if present
    const updatedThreadData = { ...threadData };
    Object.keys(threadData).forEach(threadId => {
      if (threadData[threadId].messages.some(msg => msg.id === emailId)) {
        updatedThreadData[threadId] = {
          ...threadData[threadId],
          messages: threadData[threadId].messages.filter(msg => msg.id !== emailId)
        };
      }
    });
    setThreadData(updatedThreadData);

    // Update cache for current folder/query
    const cacheKey = getCacheKey(currentFolder, searchQuery, showStarredOnly);
    if (emailCache[cacheKey]) {
      emailCache[cacheKey] = {
        ...emailCache[cacheKey],
        emails: emailCache[cacheKey].emails.filter(email => email.id !== emailId)
      };
    }
    
    try {
      const response = await api.post('/api/emails/delete', {
        messageId: emailId,
        action
      });

      const responseData = response.data as { success: boolean; action: string; messageId: string };

      if (responseData.success) {
        toast.success(
          action === 'permanent' 
            ? 'Email permanently deleted' 
            : 'Email moved to trash'
        );
        
        // Cache for other folders will be refreshed when user switches to them
      } else {
        throw new Error('API call returned unsuccessful');
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      toast.error('Failed to delete email');
      
      // Revert optimistic update on error
      setEmails(originalEmails);
      setSelectedEmail(originalSelectedEmail);
      setThreadData(originalThreadData);
      
      // Revert cache
      const cacheKey = getCacheKey(currentFolder, searchQuery, showStarredOnly);
      if (emailCache[cacheKey]) {
        emailCache[cacheKey] = {
          ...emailCache[cacheKey],
          emails: originalEmails
        };
      }
      
      // Restore URL params if needed
      if (originalSelectedEmail?.threadId) {
        const params = new URLSearchParams(window.location.search);
        params.set('threadId', originalSelectedEmail.threadId);
        router.replace(`/dashboard?${params.toString()}`, { scroll: false });
      }
    } finally {
      setDeletingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  // Show delete confirmation dialog
  const showDeleteConfirmation = (emailId: string, emailSubject: string, action: 'trash' | 'permanent' = 'trash') => {
    setDeleteDialog({
      isOpen: true,
      emailId,
      emailSubject,
      action
    });
  };

  // Confirm delete action
  const confirmDelete = () => {
    handleDeleteEmail(deleteDialog.emailId, deleteDialog.action);
    setDeleteDialog({ isOpen: false, emailId: '', emailSubject: '', action: 'trash' });
  };

  // Enhanced handleRestoreEmail to properly manage restoration
  const handleRestoreEmail = async (emailId: string) => {
    if (deletingEmails.has(emailId)) return;

    setDeletingEmails(prev => new Set(prev).add(emailId));
    
    // Store original state for potential revert
    const originalEmails = emails;
    const originalSelectedEmail = selectedEmail;
    
    // Optimistic update - remove the email from the trash view immediately
    setEmails(prevEmails => 
      prevEmails.filter(email => email.id !== emailId)
    );

    // Clear selected email if it's the one being restored
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
      // Clear URL params
      const params = new URLSearchParams(window.location.search);
      params.delete('threadId');
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    }

    // Update cache for trash folder
    const trashCacheKey = getCacheKey('trash', '', false);
    if (emailCache[trashCacheKey]) {
      emailCache[trashCacheKey] = {
        ...emailCache[trashCacheKey],
        emails: emailCache[trashCacheKey].emails.filter(email => email.id !== emailId)
      };
    }
    
    try {
      const response = await api.post('/api/emails/delete', {
        messageId: emailId,
        action: 'restore'
      });

      const responseData = response.data as { success: boolean; action: string; messageId: string };

      if (responseData.success) {
        toast.success('Email restored to inbox');
        
        // Clear inbox cache so it will be refreshed next time user visits inbox
        const inboxCacheKey = getCacheKey('inbox', '', false);
        if (emailCache[inboxCacheKey]) {
          delete emailCache[inboxCacheKey];
        }
      } else {
        throw new Error('API call returned unsuccessful');
      }
    } catch (error) {
      console.error('Error restoring email:', error);
      toast.error('Failed to restore email');
      
      // Revert optimistic update on error
      setEmails(originalEmails);
      setSelectedEmail(originalSelectedEmail);
      
      // Revert cache
      const trashCacheKey = getCacheKey('trash', '', false);
      if (emailCache[trashCacheKey]) {
        emailCache[trashCacheKey] = {
          ...emailCache[trashCacheKey],
          emails: originalEmails
        };
      }
      
      // Restore URL params if needed
      if (originalSelectedEmail?.threadId) {
        const params = new URLSearchParams(window.location.search);
        params.set('threadId', originalSelectedEmail.threadId);
        router.replace(`/dashboard?${params.toString()}`, { scroll: false });
      }
    } finally {
      setDeletingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  if (loading && !searchLoading && emails.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
        {/* Header skeleton */}
        <div className="h-16 border-b border-border/50 flex items-center px-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 backdrop-blur-xl flex-none">
          <div className="flex items-center space-x-4 w-64">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex-1 px-4">
            <Skeleton className="h-10 w-full max-w-xl mx-auto rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border/50 flex items-center px-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 backdrop-blur-xl flex-none">
        <div className="flex items-center space-x-4 w-64">
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8 ring-2 ring-orange-500/20">
              <AvatarImage src={userInfo?.picture} alt={userInfo?.name} />
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600">{userInfo?.name?.[0]}</AvatarFallback>
              </Avatar>
            <div className="font-medium text-sm truncate">
              {userInfo?.name}
              <div className="text-xs text-orange-600/80 truncate">{userInfo?.email}</div>
              </div>
          </div>
        </div>
        <div className="flex-1 px-4">
          <div className="relative w-full max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-orange-500/50" />
            <Input
              type="text"
              placeholder="Search in emails..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10 pr-4 py-2 h-10 rounded-full bg-white/5 border-orange-500/20 hover:border-orange-500/30 focus:border-orange-500/50 w-full transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
            size="icon"
            className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10"
                onClick={handleLogout}
              >
            <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar (fixed width) */}
        <div className="w-64 border-r border-border/50 bg-gradient-to-b from-orange-500/5 to-amber-500/5 flex flex-col overflow-y-auto">
          <div className="p-4 relative">
            <Button className="rounded-full px-6 py-2 h-12 w-full justify-start font-medium shadow-sm mb-6 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white" onClick={() => setComposing(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Compose
            </Button>
            <div className="space-y-1">
              <Button 
                variant="ghost" 
                className={`w-full justify-start font-medium ${currentFolder === 'inbox' ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                onClick={() => {
                  setCurrentFolder('inbox');
                  setSelectedEmail(null); // Clear selected email when switching folders
                  setSelectedFlag(null); // Clear flag filter when switching to inbox
                  // Clear email/thread URL params when switching folders
                  const params = new URLSearchParams(window.location.search);
                  params.delete('threadId');
                  params.set('folder', 'inbox');
                  router.replace(`/dashboard?${params.toString()}`, { scroll: false });
                  fetchEmails(undefined, searchQuery);
                }}
              >
                <Inbox className="mr-2 h-5 w-5" />
                Inbox
              </Button>
              <Button 
                variant="ghost" 
                className={`w-full justify-start font-medium ${showStarredOnly ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                onClick={() => {
                  setShowStarredOnly(!showStarredOnly);
                  setSelectedEmail(null);
                  setSelectedFlag(null);
                  // Clear email/thread URL params when switching to starred view
                  const params = new URLSearchParams(window.location.search);
                  params.delete('threadId');
                  if (!showStarredOnly) {
                    params.set('view', 'starred');
                  } else {
                    params.delete('view');
                  }
                  router.replace(`/dashboard?${params.toString()}`, { scroll: false });
                  // Trigger refresh to show/hide starred emails
                  fetchEmails(undefined, searchQuery);
                }}
              >
                <Star className={`mr-2 h-5 w-5 ${showStarredOnly ? 'fill-current text-amber-500' : ''}`} />
                Starred
              </Button>
              <Button 
                variant="ghost" 
                className={`w-full justify-start font-medium ${currentFolder === 'sent' ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                onClick={() => {
                  setCurrentFolder('sent');
                  setSelectedEmail(null); // Clear selected email when switching folders
                  setSelectedFlag(null); // Clear flag filter when switching to sent
                  // Clear email/thread URL params when switching folders
                  const params = new URLSearchParams(window.location.search);
                  params.delete('threadId');
                  params.set('folder', 'sent');
                  router.replace(`/dashboard?${params.toString()}`, { scroll: false });
                  fetchEmails(undefined, searchQuery);
                }}
              >
                <Send className="mr-2 h-5 w-5" />
                Sent
              </Button>
              <Button 
                variant="ghost" 
                className={`w-full justify-start font-medium ${currentFolder === 'spam' ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                onClick={() => {
                  setCurrentFolder('spam');
                  setSelectedEmail(null); // Clear selected email when switching folders
                  setSelectedFlag(null); // Clear flag filter when switching to spam
                  // Clear email/thread URL params when switching folders
                  const params = new URLSearchParams(window.location.search);
                  params.delete('threadId');
                  params.set('folder', 'spam');
                  router.replace(`/dashboard?${params.toString()}`, { scroll: false });
                  fetchEmails(undefined, searchQuery);
                }}
              >
                <Shield className="mr-2 h-5 w-5" />
                Spam
              </Button>
              <Button 
                variant="ghost" 
                className={`w-full justify-start font-medium ${currentFolder === 'trash' ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                onClick={() => {
                  setCurrentFolder('trash');
                  setSelectedEmail(null); // Clear selected email when switching folders
                  setSelectedFlag(null); // Clear flag filter when switching to trash
                  // Clear email/thread URL params when switching folders
                  const params = new URLSearchParams(window.location.search);
                  params.delete('threadId');
                  params.set('folder', 'trash');
                  router.replace(`/dashboard?${params.toString()}`, { scroll: false });
                  fetchEmails(undefined, searchQuery);
                }}
              >
                <Trash className="mr-2 h-5 w-5" />
                Trash
              </Button>
              <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10">
                <FileText className="mr-2 h-5 w-5" />
                Drafts
              </Button>

              {/* Reminder Bell Button */}
              <div className="relative">
                <Button 
                  variant="ghost" 
                  className={`w-full justify-start font-medium ${isMiniReminderVisible ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                  onClick={() => {
                    if (isMiniReminderVisible) {
                      setIsMiniReminderVisible(false);
                    } else {
                      const totalToReply = Object.values(flaggedEmails).filter(email => email.flag === 'to_reply').length;
                      if (totalToReply > 0) {
                        setIsMiniReminderVisible(true);
                      } else {
                        setIsReminderOpen(true);
                      }
                    }
                  }}
                >
                  <Bell className="mr-2 h-5 w-5" />
                  Reminders
                  {(() => {
                    const totalToReply = Object.values(flaggedEmails).filter(email => email.flag === 'to_reply').length;
                    const urgentToReply = Object.values(flaggedEmails).filter(email => {
                      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
                      return email.flag === 'to_reply' && email.flaggedAt < dayAgo;
                    }).length;
                    
                    if (totalToReply > 0) {
                      return (
                        <div className="ml-auto flex items-center gap-1">
                          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                            {totalToReply}
                          </span>
                          {urgentToReply > 0 && (
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </Button>
                
                {/* Mini Reminder Popup */}
                <Suspense fallback={<></>}>
                  <MiniReminder 
                    flaggedEmails={flaggedEmails}
                    isVisible={isMiniReminderVisible}
                    onClose={() => setIsMiniReminderVisible(false)}
                    onEmailClick={handleEmailClickFromReminder}
                    onViewAll={() => {
                      setIsMiniReminderVisible(false);
                      setIsReminderOpen(true);
                    }}
                  />
                </Suspense>
              </div>

              <div className="space-y-1">
                {Object.entries(FLAG_LABELS).map(([flag, label]) => (
                  <Button
                    key={flag}
                    variant="ghost"
                    className={`w-full justify-start font-medium flex items-center gap-2 ${selectedFlag === flag ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'}`}
                    onClick={() => {
                      setSelectedFlag(flag === selectedFlag ? null : flag);
                      setSelectedEmail(null);
                    }}
                  >
                    <span className={`inline-block w-3 h-3 rounded-full ${FLAG_COLORS[flag]}`}></span>
                    {label}
                    <span className="ml-auto text-xs text-muted-foreground">{Object.values(flaggedEmails).filter(f => f.flag === flag).length}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <ResizablePanelGroup 
          direction="horizontal" 
          className="flex-1"
          onLayout={onResize}
        >
          {/* Email list */}
          <ResizablePanel 
            ref={refs.emailListRef}
            defaultSize={sizes.emailListSize} 
            minSize={20}
            maxSize={40}
            className="border-r border-border/50 flex flex-col overflow-hidden bg-gradient-to-b from-white/50 to-white/30 dark:from-background/50 dark:to-background/30"
          >
            <div className="flex-none p-2 border-b border-border/50 flex items-center bg-white/50 dark:bg-background/50">
              <Button variant="ghost" size="icon" className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10">
                <Archive className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10">
                <Flag className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10">
                <Tag className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10 flex items-center gap-1.5"
                onClick={handleSummarize}
                disabled={isSummarizing || emails.length === 0}
              >
                {isSummarizing ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>Summarizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Summarize</span>
                  </>
                )}
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" disabled={!nextPageToken} className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" disabled={!nextPageToken} className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10" onClick={() => fetchEmails(nextPageToken)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable email list */}
            <div className="flex-1 overflow-y-auto">
              {emails
                .filter(email => {
                  // First filter by starred status if showStarredOnly is true
                  if (showStarredOnly && !email.starred) {
                    return false;
                  }
                  
                  // Then filter by flag if selectedFlag is set
                  if (selectedFlag) {
                    const flag = flaggedEmails[email.id]?.flag;
                    return flag === selectedFlag;
                  }
                  
                  return true;
                })
                .map((email, index) => (
                  <React.Fragment key={`${currentFolder}-${email.id}`}>
                <div
                  key={`${currentFolder}-${email.id}`}
                  ref={index === emails.length - 1 ? lastEmailElementRef : undefined}
                      onClick={() => handleEmailClick(email)}
                      className={`relative flex items-center px-4 py-3 cursor-pointer border-b border-border/50 hover:bg-orange-500/5 ${selectedEmail?.id === email.id ? 'bg-orange-500/10' : ''}`}
                      style={{ minHeight: '64px' }}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 mr-4">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={undefined} alt={email.from} />
                          <AvatarFallback className="bg-muted text-foreground font-bold">
                            {email.from.trim()[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                  </div>
                      {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                          <span className="font-bold text-sm truncate max-w-[180px] text-foreground">
                        {email.from.split('<')[0] || email.from}
                          </span>
                          <div className="flex items-center gap-2">
                            {email.attachments && email.attachments.length > 0 && (
                              <span title={`${email.attachments.length} attachment${email.attachments.length > 1 ? 's' : ''}`}>
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStarEmail(email.id, email.starred || false);
                              }}
                              disabled={starringEmails.has(email.id)}
                              className={`p-1 h-6 w-6 ${
                                email.starred 
                                  ? 'text-amber-500 hover:text-amber-600' 
                                  : 'text-muted-foreground hover:text-amber-500'
                              }`}
                              title={email.starred ? 'Unstar email' : 'Star email'}
                            >
                              {starringEmails.has(email.id) ? (
                                <span className="animate-spin text-xs">⟳</span>
                              ) : (
                                <Star className={`h-3 w-3 ${email.starred ? 'fill-current' : ''}`} />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (currentFolder === 'trash') {
                                  handleRestoreEmail(email.id);
                                } else {
                                  showDeleteConfirmation(email.id, email.subject, 'trash');
                                }
                              }}
                              disabled={deletingEmails.has(email.id)}
                              className={`p-1 h-6 w-6 ${
                                currentFolder === 'trash' 
                                  ? 'text-muted-foreground hover:text-green-500' 
                                  : 'text-muted-foreground hover:text-red-500'
                              }`}
                              title={currentFolder === 'trash' ? 'Restore email' : 'Delete email'}
                            >
                              {deletingEmails.has(email.id) ? (
                                <span className="animate-spin text-xs">⟳</span>
                              ) : (
                                currentFolder === 'trash' ? (
                                  <Archive className="h-3 w-3" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )
                              )}
                            </Button>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatEmailDate(email.date)}
                            </span>
                      </div>
                    </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.snippet}
                  </div>
                </div>
                      {/* Flag badge in right-bottom corner */}
                      {flaggedEmails[email.id]?.flag && (
                        <span
                          className={`absolute right-4 bottom-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${FLAG_COLORS[flaggedEmails[email.id].flag]} text-white shadow`}
                          title={FLAG_LABELS[flaggedEmails[email.id].flag]}
                          style={{ minWidth: '2.5rem', justifyContent: 'center', textTransform: 'lowercase', pointerEvents: 'none' }}
                        >
                          {flaggedEmails[email.id].flag}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
              ))}
              {(loading || searchLoading) && !loadingMore && (
                <div className="p-4 space-y-4">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              )}
              {loadingMore && (
                <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              )}
              {!loading && !searchLoading && !loadingMore && emails.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{searchQuery ? 'No emails found matching your search' : 'No emails found'}</p>
                </div>
              )}
            </div>
          </ResizablePanel>
          
          <ResizableHandleWithReset 
            withHandle
            leftPanelRef={refs.emailListRef}
            rightPanelRef={refs.emailContentRef}
            defaultLeftSize={35}
            defaultRightSize={65}
          />

          {/* Email content */}
          <ResizablePanel 
            ref={refs.emailContentRef}
            defaultSize={sizes.emailContentSize} 
            minSize={40}
            className="flex flex-col overflow-hidden bg-gradient-to-br from-white/50 to-orange-50/30 dark:from-background/50 dark:to-orange-900/5"
          >
            {selectedEmail ? (
              <div className="flex-1 overflow-y-auto email-content-container">
                <div className="p-4 md:p-6 max-w-5xl mx-auto">
                  <div className="pb-4 mb-4 border-b border-border">
                    {currentFolder === 'trash' && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                          <Trash className="h-4 w-4" />
                          <span className="text-sm font-medium">This email is in trash</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <h1 className="text-xl font-bold text-foreground">{selectedEmail.subject}</h1>
                      <div className="flex space-x-2">
                        {isEmailLong(selectedEmail.body) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateTLDR(selectedEmail)}
                            disabled={isGeneratingSummary}
                            className="gap-2"
                            title="Generate TLDR summary"
                          >
                            {isGeneratingSummary ? (
                              <>
                                <span className="animate-spin">⟳</span>
                                Summarizing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                TLDR
                              </>
                            )}
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (currentFolder === 'trash') {
                              handleRestoreEmail(selectedEmail.id);
                            } else {
                              showDeleteConfirmation(selectedEmail.id, selectedEmail.subject, 'trash');
                            }
                          }}
                          disabled={deletingEmails.has(selectedEmail.id)}
                          className={`${
                            currentFolder === 'trash' 
                              ? 'text-muted-foreground hover:text-green-500' 
                              : 'text-muted-foreground hover:text-red-500'
                          }`}
                          title={currentFolder === 'trash' ? 'Restore email' : 'Delete email'}
                        >
                          {deletingEmails.has(selectedEmail.id) ? (
                            <span className="animate-spin">⟳</span>
                          ) : (
                            currentFolder === 'trash' ? (
                              <Archive className="h-5 w-5" />
                            ) : (
                              <Trash2 className="h-5 w-5" />
                            )
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <Archive className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleStarEmail(selectedEmail.id, selectedEmail.starred || false)}
                          disabled={starringEmails.has(selectedEmail.id)}
                          className={`${
                            selectedEmail.starred 
                              ? 'text-amber-500 hover:text-amber-600' 
                              : 'text-muted-foreground hover:text-amber-500'
                          }`}
                          title={selectedEmail.starred ? 'Unstar email' : 'Star email'}
                        >
                          {starringEmails.has(selectedEmail.id) ? (
                            <span className="animate-spin">⟳</span>
                          ) : (
                            <Star className={`h-5 w-5 ${selectedEmail.starred ? 'fill-current' : ''}`} />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <Flag className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center mb-3">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {selectedEmail.from.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium text-foreground">
                            {selectedEmail.from.split('<')[0] || selectedEmail.from}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {`<${selectedEmail.from.match(/<(.+)>/)
                              ? selectedEmail.from.match(/<(.+)>/)?.[1]
                              : selectedEmail.from}>`}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          to me • {new Date(selectedEmail.date).toLocaleString()}
                        </div>
                      </div>
                      <div className="ml-auto">
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="relative w-full">
                      <div 
                        className="email-content-container animate-in fade-in duration-300"
                        style={{
                          minHeight: "300px",
                          borderRadius: '8px'
                        }}
                      >
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: processEmailContent(selectedEmail.body)
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Attachments section */}
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="mt-6 border-t border-border/50 pt-6">
                      <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                        <Paperclip className="h-5 w-5" />
                        Attachments ({selectedEmail.attachments.length})
                      </h3>
                      <div className="bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
                        {selectedEmail.attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-4 hover:bg-muted/20 transition-colors ${
                              index < selectedEmail.attachments!.length - 1 ? 'border-b border-border/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-lg">
                                  {getFileTypeIcon(attachment.mimeType, attachment.filename)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate" title={attachment.filename}>
                                  {attachment.filename}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                  <span>{formatFileSize(attachment.size)}</span>
                                  <span>•</span>
                                  <span className="truncate">{attachment.mimeType}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              {attachment.mimeType.startsWith('image/') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAttachmentPreview(attachment, selectedEmail.id)}
                                  className="text-muted-foreground hover:text-foreground h-8 px-2"
                                  title="Preview image"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAttachmentDownload(attachment, selectedEmail.id)}
                                className="text-muted-foreground hover:text-foreground h-8 px-2"
                                title="Download attachment"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Thread conversation */}
                  {selectedEmail.threadId && threadData[selectedEmail.threadId] && threadData[selectedEmail.threadId].messages.length > 1 && (
                    <div className="mt-8 border-t border-border/50 pt-6">
                      <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Conversation ({threadData[selectedEmail.threadId].messages.length} messages)
                      </h3>
                      <div className="space-y-3">
                        {threadData[selectedEmail.threadId].messages
                          .sort((a, b) => {
                            const aTime = a.internalDate ? parseInt(a.internalDate) : new Date(a.date).getTime();
                            const bTime = b.internalDate ? parseInt(b.internalDate) : new Date(b.date).getTime();
                            return aTime - bTime;
                          })
                          .map((threadMsg, messageIndex) => (
                            <div
                              key={threadMsg.id}
                              className={`border border-border/30 rounded-lg overflow-hidden transition-all hover:shadow-sm ${
                                threadMsg.id === selectedEmail.id 
                                  ? 'ring-2 ring-orange-500/30 bg-orange-50/30 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-800/30' 
                                  : 'bg-card/30 hover:bg-card/50'
                              }`}
                            >
                              <div className="p-4 border-b border-border/20 bg-muted/10">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8 ring-2 ring-background">
                                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                        {threadMsg.from.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium text-sm text-foreground">
                                        {threadMsg.from.split('<')[0] || threadMsg.from}
                                      </div>
                                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                                        <span>{new Date(threadMsg.date).toLocaleString()}</span>
                                        {threadMsg.attachments && threadMsg.attachments.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            <Paperclip className="h-3 w-3" />
                                            <span>{threadMsg.attachments.length}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {threadMsg.id === selectedEmail.id && (
                                      <span className="text-xs px-2 py-1 bg-orange-500 text-white rounded-full font-medium">
                                        Current
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                      #{messageIndex + 1}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {threadMsg.id !== selectedEmail.id && (
                                <div className="p-4">
                                  <div 
                                    className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ 
                                      __html: processEmailContent(threadMsg.body)
                                    }} 
                                  />
                                  
                                  {/* Show attachments for conversation messages */}
                                  {threadMsg.attachments && threadMsg.attachments.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-border/20">
                                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                        <Paperclip className="h-3 w-3" />
                                        {threadMsg.attachments.length} attachment{threadMsg.attachments.length > 1 ? 's' : ''}
                                      </div>
                <div className="space-y-1">
                                        {threadMsg.attachments.map((attachment, attachIndex) => (
                                          <div
                                            key={attachIndex}
                                            className="flex items-center gap-2 p-2 bg-muted/20 rounded text-xs hover:bg-muted/30 transition-colors"
                                          >
                                            <span className="text-sm">
                                              {getFileTypeIcon(attachment.mimeType, attachment.filename)}
                    </span>
                                            <span className="flex-1 truncate font-medium">{attachment.filename}</span>
                                            <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleAttachmentDownload(attachment, threadMsg.id)}
                                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                              title="Download"
                                            >
                                              <Download className="h-3 w-3" />
                                            </Button>
                  </div>
                                        ))}
                </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-8 pt-4 border-t border-border/50">
                    <Suspense fallback={<></>}>
                    {isReplying && selectedEmail && (
                      <ReplyComposer
                        recipientEmail={selectedEmail.from}
                        originalSubject={selectedEmail.subject}
                        originalContent={selectedEmail.body.replace(/<[^>]*>/g, '')}
                        originalMessageId={selectedEmail.id}
                        onClose={() => setIsReplying(false)}
                        onSend={() => handleReplyComplete(selectedEmail.id)}
                      />
                    )}
                    </Suspense>
                    <div className="flex space-x-2 mt-4">
                      <Button 
                        variant="outline" 
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-500/20 dark:hover:bg-orange-500/10"
                        onClick={() => setIsReplying(true)}
                      >
                        Reply
                      </Button>
                      <Button 
                        variant="outline" 
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-500/20 dark:hover:bg-orange-500/10"
                      >
                        Forward
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Select an email to read</p>
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Suspense fallback={<></>}>
        <ChatWith100x onEmailClick={handleEmailClickById} />
      </Suspense>

      {/* Follow-up reminder component */}
      <Suspense fallback={<></>}>
        <FollowUpReminder 
          flaggedEmails={flaggedEmails}
          isOpen={isReminderOpen}
          onClose={() => setIsReminderOpen(false)}
          onEmailClick={handleEmailClickFromReminder}
        />
      </Suspense>

      {/* Email compose dialog */}
      <Dialog open={composing} onOpenChange={setComposing}>
        <DialogContent className="max-w-5xl w-[90vw] h-[85vh] p-0 flex flex-col gap-0 overflow-hidden border-2 border-border/30 rounded-lg">
          {/* Hidden title for accessibility */}
          <VisuallyHidden>
            <DialogTitle>Compose Email</DialogTitle>
          </VisuallyHidden>
          
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 flex-none">
            <h2 className="text-base font-medium text-foreground">New Message</h2>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors h-5 w-5 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col px-4 pt-2 pb-4 space-y-3 overflow-hidden bg-white dark:bg-gray-900">
            {/* To field */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium w-12 text-muted-foreground">To:</span>
              <div className="flex-1">
                <div className="border border-border/60 rounded-lg p-3 min-h-[42px] flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-gray-800/50 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500/40 transition-all">
                  {emailChips.map((email, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-full text-xs font-medium border border-orange-200 dark:border-orange-700/30"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmailChip(email)}
                        className="ml-1 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 transition-colors hover:bg-orange-200 dark:hover:bg-orange-800/30 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        ×
              </button>
                    </span>
                  ))}
                  <Input
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailInputKeyDown}
                    onBlur={() => {
                      if (emailInput.trim()) {
                        addEmailChip(emailInput);
                        setEmailInput('');
                      }
                    }}
                    placeholder={emailChips.length === 0 ? "Enter email address" : "Add another email..."}
                    className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto flex-1 min-w-[200px] placeholder:text-muted-foreground bg-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <button type="button" className="hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Cc</button>
                <button type="button" className="hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Bcc</button>
              </div>
            </div>

            {/* Subject field */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium w-12 text-muted-foreground">Subject:</span>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={newEmail.subject}
                  onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                  className="flex-1 border-border/60 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 bg-gray-50 dark:bg-gray-800/50"
                  placeholder="Email subject"
                />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleGenerateContent('subject')}
                  disabled={generating !== 'idle'}
                  className="p-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 transition-colors"
                  title="Generate subject with AI"
                >
                  {generating === 'subject' ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
          </div>
        </div>
        
            {/* Content area */}
            <div className="flex-1 relative overflow-hidden">
              {generatedPreview.isVisible ? (
                /* Preview Mode */
                <div className="h-full flex flex-col border border-border/60 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between p-4 border-b border-border/60 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                    <h4 className="font-medium text-foreground">Generated Content Preview</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={rejectGeneratedContent}
                      className="text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-black/20"
                    >
                      ✕
                    </Button>
                  </div>
                  
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {generatedPreview.subject && (
              <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject:</label>
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-border/30 text-sm">
                          {generatedPreview.subject}
              </div>
                      </div>
                    )}
                    
                    {generatedPreview.content && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content:</label>
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-border/30 text-sm">
                          <div className="whitespace-pre-wrap">{generatedPreview.content}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-3 p-4 border-t border-border/60 bg-gray-50 dark:bg-gray-800/50">
                    <Button
                      variant="outline"
                      onClick={rejectGeneratedContent}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/10"
                    >
                      ✗ Reject
                    </Button>
                    <Button
                      onClick={acceptGeneratedContent}
                      className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                    >
                      ✓ Accept
                    </Button>
                  </div>
                </div>
              ) : (
                /* Normal Edit Mode */
                <textarea
                  value={newEmail.content}
                  onChange={(e) => setNewEmail({ ...newEmail, content: e.target.value })}
                  className="w-full h-full border border-border/60 rounded-lg p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 bg-gray-50 dark:bg-gray-800/50 placeholder:text-muted-foreground transition-all"
                  placeholder="Write your email content here..."
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border/20">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 shadow-sm transition-all hover:shadow-md"
                >
                  {sending ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Sending...
                    </>
                  ) : (() => {
                    if (emailChips.length > 1) {
                      return `Send to ${emailChips.length} recipients`;
                    }
                    return 'Send';
                  })()}
                  <span className="ml-2 text-orange-200">⌘ ↵</span>
                </Button>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="*/*"
                />
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={triggerFileInput}
                  className="border-border/60 hover:bg-gray-50 dark:hover:bg-gray-800 gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Add Files
                  {selectedFiles.length > 0 && (
                    <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                      {selectedFiles.length}
                    </span>
                  )}
                </Button>

                {/* Tone Selection */}
                <div className="relative tone-dropdown-container">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToneDropdown(!showToneDropdown)}
                    className="gap-2 border-border/60 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {toneOptions.find(t => t.value === selectedTone)?.emoji}
                    <span className="text-xs">{toneOptions.find(t => t.value === selectedTone)?.label.split(' ')[1]}</span>
                    <span className="text-xs">▼</span>
                  </Button>
                  
                  {showToneDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-border rounded-lg shadow-lg z-10 p-1">
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1 border-b border-border/50 mb-1">
                        Email Tone
                      </div>
                      {toneOptions.map((tone) => (
                        <button
                          key={tone.value}
                          onClick={() => {
                            setSelectedTone(tone.value);
                            setShowToneDropdown(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                            selectedTone === tone.value ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' : 'text-foreground'
                          }`}
                        >
                          <span>{tone.emoji}</span>
                          <span>{tone.label.split(' ')[1]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  onClick={() => handleGenerateContent('content')}
                  disabled={generating !== 'idle'}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 shadow-sm transition-all hover:shadow-md"
                >
                  {generating === 'content' ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Attachments preview */}
            {selectedFiles.length > 0 && (
              <div className="pt-4 border-t border-border/20">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Attachments ({selectedFiles.length})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Total size: {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border/30 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className={`flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${
                        index < selectedFiles.length - 1 ? 'border-b border-border/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">
                            {getFileTypeIcon(file.type, file.name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground truncate" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{formatFileSize(file.size)}</span>
                            {file.type && (
                              <>
                                <span>•</span>
                                <span className="truncate">{file.type}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-red-500 h-8 w-8 p-0 ml-2 flex-shrink-0"
                        title="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={<></>}>
       <EmailSummaryDialog
         isOpen={isSummaryDialogOpen}
         onOpenChange={setIsSummaryDialogOpen}
         summary={summary}
         onEmailClick={handleEmailClickFromSummary}
       />
      </Suspense>

      {/* TLDR Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-2xl p-6 grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              TLDR Summary
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="py-4">
            {emailSummary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div 
                    className="text-foreground leading-relaxed"
                    style={{ 
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: formatTLDRSummary(emailSummary)
                    }}
                  />
                </div>
            </div>
          ) : (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          )}
        </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSummary(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.isOpen} onOpenChange={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}>
        <DialogContent className="p-6 grid gap-4">
          <DialogHeader>
            <DialogTitle>Delete Email</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this email?
            </p>
            <div className="bg-muted/20 p-3 rounded-lg border">
              <p className="font-medium text-sm truncate">{deleteDialog.emailSubject}</p>
              <p className="text-xs text-muted-foreground mt-1">
                This action will move the email to trash. You can restore it later if needed.
              </p>
      </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
