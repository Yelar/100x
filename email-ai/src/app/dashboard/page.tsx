'use client';

import * as React from 'react';
import { useEffect, useState, useRef, useCallback, Suspense, lazy } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Mail, LogOut, Inbox, FileText, Send, Trash, Plus, ChevronLeft, ChevronRight, MoreVertical, Star, Tag, Flag, Archive, Sparkles, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import api from '@/lib/axios';
import debounce from 'lodash/debounce';
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { ResizableHandleWithReset } from "@/components/ui/resizable-handle-with-reset";
import { useEmailPanelLayout } from "@/hooks/use-email-panel-layout";
import { toast } from 'sonner';

interface UserInfo {
  email: string;
  name: string;
  picture: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState<'idle' | 'subject' | 'content'>('idle');
  const observer = useRef<IntersectionObserver | null>(null); // Fixed linter error
  const debouncedSearchRef = useRef(
    debounce((query: string, callback: (query: string) => void) => {
      callback(query);
    }, 800)
  ).current;
  const [isReplying, setIsReplying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<EmailSummary | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<'inbox' | 'sent' | 'spam'>('inbox');
  const [flaggedEmails, setFlaggedEmails] = useState<Record<string, { flag: string, subject: string, snippet: string, sender: string, flaggedAt: number }>>({});
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<Record<string, EmailThread>>({});
  const loadingThreadIds = useRef<Set<string>>(new Set());

  const { refs, sizes, onResize } = useEmailPanelLayout();

  // Initialize flagged emails from localStorage on mount
  useEffect(() => {
    const flaggedLS = getFlaggedEmailsLS();
    setFlaggedEmails(flaggedLS);
  }, []);

  // Update URL when folder changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('folder', currentFolder);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [currentFolder, router]);

  // Initialize folder from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get('folder');
    if (folder === 'sent' || folder === 'inbox' || folder === 'spam') {
      setCurrentFolder(folder);
    }
  }, []);

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
    const cacheKey = `${currentFolder}:${query || ''}`;
    if (!pageToken && emailCache[cacheKey]) {
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
      if (pageToken) {
        setEmails(prev => {
          const uniqueMessages = messages.filter(
            newEmail => !prev.some(existingEmail => existingEmail.id === newEmail.id)
          );
          const updated = [...prev, ...uniqueMessages];
          emailCache[cacheKey] = { emails: updated, nextPageToken };
          return updated;
        });
      } else {
        setEmails(messages || []);
        emailCache[cacheKey] = { emails: messages || [], nextPageToken };
      }
      setNextPageToken(nextPageToken);
      setHasMore(!!nextPageToken);
      // Prefetch next page in background
      if (nextPageToken) {
        api.get<EmailsResponse>(`/api/emails?${params.toString()}&pageToken=${nextPageToken}`)
          .then(res => {
            const { messages: nextMessages, nextPageToken: nextToken } = res.data;
            emailCache[`${cacheKey}:page:${nextPageToken}`] = { emails: nextMessages, nextPageToken: nextToken };
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
  }, [currentFolder]);

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
  }, [fetchEmails, setSearchLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSearchRef.cancel();
    };
  }, [debouncedSearchRef]);

  useEffect(() => {
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
        setUserInfo(JSON.parse(storedUserInfo));

        await fetchEmails(undefined, '');
        
        // After emails are loaded, check if there's a threadId in URL that needs loading
        const urlThreadId = searchParams.get('threadId');
        if (urlThreadId) {
          console.log('Page loaded with threadId in URL:', urlThreadId);
          // The URL navigation effect will handle this, but we may need to fetch it if not in list
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [router, fetchEmails, setUserInfo, setLoading, searchParams]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    debouncedSearchRef(e.target.value, search);
  }, [search, debouncedSearchRef]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    router.push('/login');
  };

  const handleSendEmail = async () => {
    if (!newEmail.to || !newEmail.subject || !newEmail.content) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setSending(true);
      const response = await api.post<{ success: boolean }>('/api/emails/send', newEmail);
      if (response.data.success) {
        setComposing(false);
        setNewEmail({ to: '', subject: '', content: '' });
        // Optionally refresh the sent emails list
        fetchEmails(undefined);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleGenerateContent = async (type: 'subject' | 'content') => {
    let prompt = '';
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
    }

    try {
      setGenerating(type);
      const response = await api.post('/api/generate', {
        prompt,
        type,
        userName: userInfo?.name || '',
      });

      const data = response.data as { subject?: string; content?: string };
      
      if (type === 'subject' && data.subject) {
        setNewEmail({ ...newEmail, subject: data.subject });
      } else if (type === 'content' && data.content) {
        setNewEmail({ ...newEmail, content: data.content });
      }
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      alert(`Failed to generate ${type}. Please try again.`);
    } finally {
      setGenerating('idle');
    }
  };

  const handleReplyComplete = () => {
    setIsReplying(false);
    // Optionally refresh the emails list
    fetchEmails(undefined);
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
    // Find up to 20 unflagged emails
    const toFlag = emails.filter(e => !flaggedLS[e.id]).slice(0, 20).map(e => ({ id: e.id, subject: e.subject, snippet: e.snippet, sender: e.from }));
    if (toFlag.length === 0) return;
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
            newFlags[f.id] = {
              flag: f.flag,
              subject: f.subject,
              snippet: f.snippet,
              sender: f.sender,
              flaggedAt: now,
            };
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

        {/* Main content skeleton */}
        <div className="flex-1 flex">
          {/* Left sidebar skeleton */}
          <div className="w-[20%] border-r border-border/50 bg-gradient-to-b from-orange-500/5 to-amber-500/5">
            <div className="p-4">
              <Skeleton className="h-12 w-full rounded-full mb-6" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            </div>
          </div>

          {/* Email list skeleton */}
          <div className="w-[35%] border-r border-border/50">
            <div className="h-12 border-b border-border/50 flex items-center px-4">
              <div className="flex space-x-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex space-x-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
            </div>
            <div className="p-4 space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="h-6 w-6 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Email content skeleton */}
          <div className="flex-1 bg-gradient-to-b from-white/50 to-white/30 dark:from-background/50 dark:to-background/30">
            <div className="h-12 border-b border-border/50 flex items-center justify-between px-4">
              <div className="flex space-x-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
              <div className="flex space-x-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
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
        <div className="w-64 border-r border-border/50 bg-gradient-to-b from-orange-500/5 to-amber-500/5 flex flex-col overflow-hidden">
          <div className="p-4">
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
              <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10">
                <Star className="mr-2 h-5 w-5" />
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
              <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10">
                <FileText className="mr-2 h-5 w-5" />
                Drafts
              </Button>
              <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10">
                <Trash className="mr-2 h-5 w-5" />
                Trash
              </Button>
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
                  if (!selectedFlag) return true;
                  const flag = flaggedEmails[email.id]?.flag;
                  return flag === selectedFlag;
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
                    <div className="flex items-center justify-between mb-3">
                      <h1 className="text-xl font-bold text-foreground">{selectedEmail.subject}</h1>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <Archive className="h-5 w-5" />
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
                        className="email-content-wrapper animate-in fade-in duration-300"
                        style={{
                          minHeight: "300px",
                          padding: '16px',
                          borderRadius: '8px',
                          backgroundColor: 'hsl(var(--card))',
                          color: 'hsl(var(--card-foreground))'
                        }}
                      >
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: selectedEmail.body
                              .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts for security
                              .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove original styles
                          }} 
                        />
                        </div>
                          </div>
                        </div>
                        
                  {/* Thread conversation */}
                  {selectedEmail.threadId && threadData[selectedEmail.threadId] && threadData[selectedEmail.threadId].messages.length > 1 && (
                    <div className="mt-8 border-t border-border/50 pt-6">
                      <h3 className="text-lg font-semibold mb-4 text-foreground">Conversation ({threadData[selectedEmail.threadId].messages.length} messages)</h3>
                      <div className="space-y-4">
                        {threadData[selectedEmail.threadId].messages
                          .sort((a, b) => {
                            const aTime = a.internalDate ? parseInt(a.internalDate) : new Date(a.date).getTime();
                            const bTime = b.internalDate ? parseInt(b.internalDate) : new Date(b.date).getTime();
                            return aTime - bTime;
                          })
                          .map((threadMsg) => (
                            <div
                              key={threadMsg.id}
                              className={`border border-border/50 rounded-lg overflow-hidden ${
                                threadMsg.id === selectedEmail.id ? 'ring-2 ring-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20' : 'bg-card/50'
                              }`}
                            >
                              <div className="p-3 border-b border-border/50 bg-muted/20">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-7 w-7">
                                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                        {threadMsg.from.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium text-sm text-foreground">
                                        {threadMsg.from.split('<')[0] || threadMsg.from}
                          </div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(threadMsg.date).toLocaleString()}
                      </div>
                                    </div>
                                  </div>
                                  {threadMsg.id === selectedEmail.id && (
                                    <span className="text-xs px-2 py-1 bg-orange-500 text-white rounded-full">Current</span>
                                  )}
                                </div>
                              </div>
                              {threadMsg.id !== selectedEmail.id && (
                                <div className="p-3">
                                  <div 
                                    className="prose prose-sm dark:prose-invert max-w-none text-sm"
                                    dangerouslySetInnerHTML={{ 
                                      __html: threadMsg.body
                                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                                    }} 
                        />
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
                        onSend={handleReplyComplete}
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

      {/* Email compose dialog */}
      <Dialog open={composing} onOpenChange={setComposing}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Email</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="to" className="text-right font-medium text-sm">
                To:
              </label>
              <Input
                id="to"
                value={newEmail.to}
                onChange={(e) => setNewEmail({ ...newEmail, to: e.target.value })}
                className="col-span-3"
                type="email"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="subject" className="text-right font-medium text-sm">
                Subject:
              </label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="subject"
                  value={newEmail.subject}
                  onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handleGenerateContent('subject')}
                  disabled={generating !== 'idle'}
                  title="Rephrase subject with AI"
                >
                  {generating === 'subject' ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-right font-medium text-sm pt-2">
                Content:
              </div>
              <div className="col-span-3 flex flex-col gap-2">
                <div className="flex justify-between mb-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleGenerateContent('content')}
                    disabled={generating !== 'idle'}
                    className="h-8"
                    title="Rewrite/generate email with AI"
                  >
                    {generating === 'content' ? (
                      <span className="animate-spin mr-2">⟳</span>
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    AI Generate
                  </Button>
                </div>
                <textarea
                  value={newEmail.content}
                  onChange={(e) => setNewEmail({ ...newEmail, content: e.target.value })}
                  className="border border-border rounded-md h-64 p-2 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setComposing(false)}>
              Discard
            </Button>
            <Button type="button" onClick={handleSendEmail} disabled={sending}>
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
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
    </div>
 )
 ;
} 



