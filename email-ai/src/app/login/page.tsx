'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      router.push('/dashboard');
      return;
    }

    // Check for error parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      console.error('Authentication error:', error);
      alert('Authentication failed. Please try again.');
    }
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('/api/auth/google');
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No auth URL received');
      }
    } catch (error) {
      console.error('Error initiating Google login:', error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground font-[family-name:var(--font-geist-sans)] relative overflow-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-100/20 via-transparent to-yellow-100/20 animate-gradient" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-yellow-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-subtle-bounce">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">100x Email</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md space-y-8 p-8 shadow-xl border-orange-200/50 backdrop-blur-sm bg-background/50">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <Button
            onClick={handleGoogleLogin}
            size="lg"
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
              />
            </svg>
            Sign in with Google
          </Button>
        </Card>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 bg-background/80 backdrop-blur-lg text-center text-muted-foreground border-t">
        <div className="flex items-center justify-center gap-2">
          <Mail className="w-4 h-4 text-orange-500" />
          <span className="font-medium">100x Email &copy; 2024</span>
        </div>
      </footer>

      {/* Add keyframes for custom animations */}
      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes subtle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-gradient {
          animation: gradient 15s ease infinite;
          background-size: 200% 200%;
        }
        .animate-subtle-bounce {
          animation: subtle-bounce 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}