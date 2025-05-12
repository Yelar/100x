'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import api from '@/lib/axios';

interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
}

interface EmailsResponse {
  emails: Email[];
}

export default function Dashboard() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

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
          router.push('/login');
          return;
        }
        setUserInfo(JSON.parse(storedUserInfo));

        const response = await api.get<EmailsResponse>('/api/emails');
        setEmails(response.data.emails);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    router.push('/login');
  };

  if (!userInfo || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-80 border-r border-border bg-card">
            <div className="p-4">
              <Skeleton className="h-8 w-24 mb-4" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex-1 p-6">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-80 border-r border-border bg-card overflow-hidden flex flex-col">
          {/* User info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3 mb-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={userInfo.picture} alt={userInfo.name} />
                <AvatarFallback>{userInfo.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-medium truncate">{userInfo.name}</h2>
                <p className="text-xs text-muted-foreground truncate">{userInfo.email}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-auto">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`w-full text-left p-4 border-b border-border hover:bg-accent/50 transition-colors ${
                  selectedEmail?.id === email.id ? 'bg-accent' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-sm truncate flex-1">{email.subject}</h3>
                    <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                      {new Date(email.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{email.from}</p>
                  <p className="text-xs truncate">{email.snippet}</p>
                </div>
              </button>
            ))}
            {emails.length === 0 && !loading && (
              <p className="text-center text-muted-foreground p-4">No emails found</p>
            )}
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-1 p-6 overflow-auto">
          {selectedEmail ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-2">{selectedEmail.subject}</h1>
                <p className="text-sm text-muted-foreground">From: {selectedEmail.from}</p>
                <p className="text-sm text-muted-foreground">
                  Date: {new Date(selectedEmail.date).toLocaleString()}
                </p>
              </div>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select an email to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 