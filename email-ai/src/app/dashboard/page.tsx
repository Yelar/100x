'use client';

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
}

interface EmailsResponse {
  emails: Email[];
}

export default function Dashboard() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user info from temporary cookie
        const cookies = document.cookie.split(';');
        const userInfoCookie = cookies
          .find(c => c.trim().startsWith('temp_user_info='))
          ?.split('=')?.[1];

        if (userInfoCookie) {
          // Parse and store user info
          const userInfo = JSON.parse(decodeURIComponent(userInfoCookie));
          localStorage.setItem('user_info', JSON.stringify(userInfo));
          // Remove the temporary cookie
          document.cookie = 'temp_user_info=; max-age=0; path=/;';
        }

        // Check stored user info
        const storedUserInfo = localStorage.getItem('user_info');
        if (!storedUserInfo) {
          router.push('/login');
          return;
        }
        setUserInfo(JSON.parse(storedUserInfo));

        // Fetch emails
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
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-2">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center justify-between">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-10 w-20" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-2">
          <CardHeader className="space-y-1 border-b bg-muted/10">
            <CardTitle className="flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">Dashboard</span>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="ml-4 bg-red-600 hover:bg-red-700"
              >
                Logout
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-6">
              <Avatar className="h-20 w-20 ring-2 ring-primary">
                <AvatarImage src={userInfo.picture} alt={userInfo.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {userInfo.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{userInfo.name}</h2>
                <p className="text-sm text-muted-foreground font-medium">{userInfo.email}</p>
              </div>
            </div>
            
            {/* Additional Dashboard Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <Card className="border shadow-sm">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-lg font-semibold text-foreground">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-4">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Edit Profile
                  </Button>
                  <Button className="w-full" variant="outline">
                    View Settings
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="border shadow-sm">
                <CardHeader className="bg-muted/10 border-b">
                  <CardTitle className="text-lg font-semibold text-foreground">Account Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-sm space-y-2">
                    <p className="flex items-center text-foreground">
                      <span className="text-green-600 mr-2">✓</span> Email verified
                    </p>
                    <p className="flex items-center text-foreground">
                      <span className="text-green-600 mr-2">✓</span> Google account linked
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle>Recent Emails</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {emails.map((email) => (
                <Card key={email.id} className="border p-4 hover:bg-muted/50 transition-colors">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-foreground">{email.subject}</h3>
                      <span className="text-sm text-muted-foreground">{new Date(email.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{email.from}</p>
                    <p className="text-sm text-foreground">{email.snippet}</p>
                  </div>
                </Card>
              ))}
              {emails.length === 0 && !loading && (
                <p className="text-center text-muted-foreground">No emails found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 