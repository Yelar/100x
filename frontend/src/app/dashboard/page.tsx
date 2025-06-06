'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

const cp1251Map: Record<string, string> = {
  'Р•': 'Е',  // E
  'Р': 'Р',   // R
  'Р»': 'л',  // l
  'Р°': 'а',  // a
  'СЂ': 'р',  // r
  'С‹': 'ы',  // y
  'СЃ': 'с',  // s
  'С‚': 'т',  // t
  'Р№': 'й',  // i
  'Т±': 'ұ',  // u
};

function tryDecodeBase64(str: string): string {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return str;
  }
}

function decodeCP1251(str: string): string {
  // Try Base64 first
  const base64Decoded = tryDecodeBase64(str);
  if (base64Decoded !== str) {
    return base64Decoded;
  }
  
  // If not Base64, try CP1251 mapping
  return str.replace(/[^\x00-\x7F]+/g, match => cp1251Map[match] || match);
}

function getInitials(name: string): string {
  const decoded = decodeCP1251(name);
  return decoded
    .split(/\s+/)
    .map(word => [...word][0])
    .join('')
    .toUpperCase();
}

function formatName(name: string): string {
  return decodeCP1251(name);
}

export default function Dashboard() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [decodingAttempts, setDecodingAttempts] = useState<string[]>([]);

  useEffect(() => {
    // Check if user is authenticated
    const storedUserInfo = localStorage.getItem('user_info');
    if (!storedUserInfo) {
      router.push('/login');
      return;
    }
    try {
      const parsedInfo = JSON.parse(storedUserInfo);
      
      // Try different decoding methods and store results
      const originalName = parsedInfo.name;
      const attempts = [
        { method: 'Original', text: originalName },
        { method: 'decodeURI', text: decodeURI(originalName) },
        { method: 'decodeURIComponent', text: decodeURIComponent(originalName) },
        { method: 'Base64', text: tryDecodeBase64(originalName) },
        { method: 'CP1251', text: decodeCP1251(originalName) }
      ];
      
      setDecodingAttempts(attempts.map(a => `${a.method}: ${a.text}`));
      
      // Use our best attempt at decoding
      parsedInfo.name = formatName(parsedInfo.name);
      setUserInfo(parsedInfo);
    } catch (error) {
      console.error('Failed to parse user info:', error);
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    router.push('/login');
  };

  if (!userInfo) {
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

  const initials = getInitials(userInfo.name);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
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
                <AvatarFallback 
                  className="bg-primary text-primary-foreground text-xl font-medium"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 
                  className="text-2xl font-semibold tracking-tight text-foreground break-words"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  {userInfo.name}
                </h2>
                <p className="text-sm text-muted-foreground font-medium break-words">
                  {userInfo.email}
                </p>
                {/* Debug section - only visible in development */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
                    <p className="font-bold">Decoding attempts:</p>
                    {decodingAttempts.map((attempt, i) => (
                      <p key={i} className="font-mono">{attempt}</p>
                    ))}
                  </div>
                )}
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
      </div>
    </div>
  );
} 