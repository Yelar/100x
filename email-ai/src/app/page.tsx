'use client';

import { Button } from "@/components/ui/button";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Bot, Activity } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { DemoChatWith100x } from "@/components/demo-chat-with-100x";

// Mock data for components
const mockEmail = {
  id: "mock-1",
  subject: "Project Update Meeting",
  from: "sarah@company.com",
  to: "team@company.com",
  content: "Hi team,\n\nLet's sync up on the project progress tomorrow at 2 PM.\n\nBest,\nSarah",
  date: "2024-01-15T10:00:00.000Z",
};

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const featuresRef = useRef<HTMLElement>(null);
  const resourcesRef = useRef<HTMLElement>(null);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'success' | 'duplicate' | 'error'>('idle');
  const [waitlistMsg, setWaitlistMsg] = useState('');
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [waitlistCountLoading, setWaitlistCountLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    // Check if user is already logged in and redirect to dashboard
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      router.push('/dashboard');
      return;
    }
  }, [router]);

  useEffect(() => {
    const fetchWaitlistCount = async () => {
      try {
        setWaitlistCountLoading(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const res = await fetch('/api/waitlist/count', {
          signal: controller.signal,
          cache: 'no-store' // Ensure fresh data
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === 'number') {
            setWaitlistCount(data.count);
          }
        }
      } catch (error) {
        console.log('Waitlist count fetch failed:', error);
        // Don't show error, just hide the counter
      } finally {
        setWaitlistCountLoading(false);
      }
    };
    
    fetchWaitlistCount();
  }, []);

  const scrollToSection = (section: 'features' | 'resources') => {
    const refs = {
      features: featuresRef,
      resources: resourcesRef
    };
    
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)] relative overflow-x-hidden dark">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-lg border-b z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg">100x Email</span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          <button 
            className="hover:text-orange-500 transition-colors"
            onClick={() => scrollToSection('features')}
          >
            Features
          </button>
          <button 
            className="hover:text-orange-500 transition-colors"
            onClick={() => scrollToSection('resources')}
          >
            Resources
          </button>
        </nav>
        <Link href="/login">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            Sign in
          </Button>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pt-24">
        {/* Hero Section */}
        <section className="flex flex-col items-center mt-12 mb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Control your email 100X more effective
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Your intelligent email assistant that understands your inbox and helps you stay productive
          </p>
          <form
            className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-lg mx-auto"
            onSubmit={async (e) => {
              e.preventDefault();
              setWaitlistStatus('idle');
              setWaitlistMsg('');
              const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: waitlistEmail }),
              });
              const data = await res.json();
              if (data.message === 'Added to waitlist') {
                setWaitlistStatus('success');
                setWaitlistMsg('You are on the waitlist! You might become one of the first beta users, yay!');
              } else if (data.message === 'Already on waitlist') {
                setWaitlistStatus('duplicate');
                setWaitlistMsg('You are already on the waitlist!');
              } else {
                setWaitlistStatus('error');
                setWaitlistMsg('Something went wrong. Please try again.');
              }
            }}
          >
            <input
              type="email"
              required
              value={waitlistEmail}
              onChange={e => setWaitlistEmail(e.target.value)}
              placeholder="Enter your email"
              className="rounded-lg px-4 py-3 w-full sm:w-72 bg-background border border-orange-300 focus:border-orange-500 outline-none text-lg text-foreground transition-all duration-300 hover:border-orange-400"
              disabled={waitlistStatus === 'success'}
            />
            <Button
              type="submit"
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3 text-lg font-semibold"
              disabled={waitlistStatus === 'success'}
            >
              Join Waitlist
            </Button>
          </form>
          {waitlistMsg && (
            <p className={`mt-4 text-lg font-medium ${
              waitlistStatus === 'success' ? 'text-green-600' :
              waitlistStatus === 'duplicate' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {waitlistMsg}
            </p>
          )}
          {waitlistCountLoading ? (
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Loading waitlist count...</span>
            </div>
          ) : waitlistCount !== null && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <span className="text-sm text-muted-foreground font-medium">
                <span className="text-green-600">{waitlistCount}</span> people have joined the waitlist
              </span>
            </div>
          )}
        </section>

        {/* App Preview */}
        <div className="w-full max-w-5xl mb-24 px-4">
          <div className="rounded-2xl border shadow-2xl overflow-hidden bg-background/50 backdrop-blur-sm">
            <Image
              src="/app-screenshot.png"
              alt="Email AI app interface showing inbox and chat"
              width={1200}
              height={800}
              className="w-full"
              priority
            />
          </div>
        </div>

        {/* Features Section */}
        <section ref={featuresRef} className="flex flex-col gap-32 w-full items-center mb-24">
          {/* Email Dialog */}
          <div className="flex flex-col items-center w-full">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              Write lightning fast emails with AI
              <Bot className="w-7 h-7 text-orange-500" />
            </h2>
            <div className="w-full max-w-lg overflow-hidden shadow-xl">
              <EmailPreviewDialog
                isOpen={false}
                emailId={mockEmail.id}
                onOpenChange={() => {}}
              />
            </div>
          </div>

          {/* Summary Component */}
          <div className="flex flex-col items-center w-full">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              Stay on top of your inbox
              <Activity className="w-7 h-7 text-orange-500" />
            </h2>
            <div className="w-full max-w-lg p-8 shadow-xl border rounded-lg">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Today&apos;s Overview</span>
                  <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Live</Badge>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl">
                    <div className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">24</div>
                    <div className="text-sm font-medium text-orange-600/80">New Emails</div>
                  </div>
                  <div className="p-6 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl">
                    <div className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">5</div>
                    <div className="text-sm font-medium text-orange-600/80">Need Action</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Component */}
          <div className="flex flex-col items-center w-full">
            <h2 className="text-3xl font-bold mb-8 text-center">
              Chat with your email,<br />get things done faster
            </h2>
            <div className="w-full max-w-sm shadow-xl">
              <DemoChatWith100x />
            </div>
          </div>
        </section>

        {/* Resources Section */}
        <section ref={resourcesRef} className="w-full max-w-6xl mx-auto mb-24 px-4">
          {/* Add resources content if needed */}
        </section>

        {/* Personalized Section */}
        <section className="my-24 text-center max-w-3xl mx-auto px-6">
          <p className="text-2xl leading-relaxed mb-6">
            Your truly personalized email assistant that{' '}
            <span className="font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">knows you</span>,
            can <span className="font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">act</span> on your behalf,{' '}
            <span className="font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">speed up</span> your workflows.
          </p>
          <p className="text-lg text-muted-foreground italic">One shall not fear AI, but embrace it.</p>
        </section>

        {/* Final CTA */}
        <section className="flex flex-col items-center mb-24 px-6">
          <h2 className="text-3xl font-bold mb-8">Transform your email today</h2>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-6 text-lg font-semibold"
          >
            Get started for free
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 bg-background/80 backdrop-blur-lg text-center text-muted-foreground border-t">
        <div className="flex items-center justify-center gap-4">
          <Mail className="w-4 h-4 text-orange-500" />
          <span className="font-medium">100x Email &copy; 2025</span>
          <Link href="/privacy" className="text-sm hover:text-orange-500 transition-colors">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
