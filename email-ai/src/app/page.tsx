'use client';

import { Button } from "@/components/ui/button";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Bot, Activity } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { MagneticButton, TiltCard, RevealText, MorphingBackground, FloatingElement, GlitchText, ScrollProgress } from "@/components/ui/animations";
import { DemoChatWith100x } from "@/components/demo-chat-with-100x";

// Mock data for components
const mockEmail = {
  id: "mock-1",
  subject: "Project Update Meeting",
  from: "sarah@company.com",
  to: "team@company.com",
  content: "Hi team,\n\nLet's sync up on the project progress tomorrow at 2 PM.\n\nBest,\nSarah",
  date: new Date().toISOString(),
};

// Wrapper component to prevent scrolling
const ScrollLock = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Save original styles
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const originalHtmlStyle = window.getComputedStyle(document.documentElement).overflow;
    const originalPosition = window.getComputedStyle(document.body).position;
    
    // Lock scroll
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Force scroll to top
    window.scrollTo(0, 0);
    
    // Unlock after 500ms
    const timer = setTimeout(() => {
      document.body.style.overflow = originalStyle;
      document.documentElement.style.overflow = originalHtmlStyle;
      document.body.style.position = originalPosition;
      document.body.style.width = 'auto';
      document.body.style.top = 'auto';
      document.body.style.left = 'auto';
    }, 500);
    
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalStyle;
      document.documentElement.style.overflow = originalHtmlStyle;
      document.body.style.position = originalPosition;
      document.body.style.width = 'auto';
      document.body.style.top = 'auto';
      document.body.style.left = 'auto';
    };
  }, []);
  
  return <>{children}</>;
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const featuresRef = useRef<HTMLElement>(null);
  const resourcesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    
    // Disable any auto-scroll
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Force scroll to top
    window.scrollTo(0, 0);
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
    <ScrollLock>
      <div className="flex flex-col min-h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)] relative overflow-x-hidden">
        {/* Scroll Progress Bar */}
        <ScrollProgress />

        {/* Animated Background */}
        <MorphingBackground />

        {/* Fixed Header with Magnetic Effect */}
        <header className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-lg border-b z-50 transition-all duration-300">
          <FloatingElement className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center shadow-neon relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity" />
              <Mail className="w-5 h-5 text-white relative z-10" />
            </div>
            <GlitchText text="100x Email" className="font-semibold text-lg" />
          </FloatingElement>
          <nav className="hidden md:flex gap-8 text-sm font-medium">
            {[
              { name: 'Features', ref: 'features' },
              { name: 'Resources', ref: 'resources' }
            ].map((item) => (
              <MagneticButton 
                key={item.name} 
                className="hover:text-orange-500 transition-colors"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  scrollToSection(item.ref as 'features' | 'resources');
                }}
              >
                {item.name}
              </MagneticButton>
            ))}
          </nav>
          <Link href="/login">
            <MagneticButton className="relative inline-flex items-center justify-center px-4 py-2 overflow-hidden font-medium transition-all bg-orange-500 rounded-lg hover:bg-orange-600 group">
              <span className="w-full h-full bg-gradient-to-br from-orange-600 absolute"></span>
              <span className="relative text-white">Sign in</span>
            </MagneticButton>
          </Link>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pt-24">
          {/* Hero Section */}
          <section className="flex flex-col items-center mt-12 mb-16 text-center max-w-3xl mx-auto relative">
            <RevealText
              text="Control your email 100X more effective"
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            />
            <RevealText
              text="Your intelligent email assistant that understands your inbox and helps you stay productive"
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
            />
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <MagneticButton className="relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-medium transition-all bg-orange-500 rounded-lg hover:bg-orange-600 group">
                <span className="w-full h-full bg-gradient-to-br from-orange-600 absolute"></span>
                <span className="relative text-white">Get started for free</span>
              </MagneticButton>
              <MagneticButton className="relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-medium transition-all bg-white/10 rounded-lg border border-orange-200/30 hover:bg-white/20 group">
                <span className="relative">Watch demo</span>
              </MagneticButton>
            </div>
          </section>

          {/* App Preview */}
          <TiltCard className="w-full max-w-5xl mb-24 px-4">
            <div className="rounded-2xl border shadow-2xl shadow-orange-500/10 overflow-hidden bg-background/50 backdrop-blur-sm hover:shadow-3xl hover:shadow-orange-500/20 transition-all duration-500">
              <Image
                src="/app-screenshot.png"
                alt="Email AI app interface showing inbox and chat"
                width={1200}
                height={800}
                className="w-full transition-transform duration-500"
                priority
              />
            </div>
          </TiltCard>

          {/* Features Section */}
          <section ref={featuresRef} className="flex flex-col gap-32 w-full items-center mb-24">
            {/* Email Dialog */}
            <FloatingElement className="flex flex-col items-center w-full group">
              <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <RevealText text="Write lightning fast emails with AI" />
                <Bot className="w-7 h-7 text-orange-500" />
              </h2>
              <TiltCard className="w-full max-w-lg overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
                <EmailPreviewDialog
                  isOpen={false}
                  emailId={mockEmail.id}
                  onOpenChange={() => {}}
                />
              </TiltCard>
            </FloatingElement>

            {/* Summary Component */}
            <FloatingElement className="flex flex-col items-center w-full group">
              <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <RevealText text="Stay on top of your inbox" />
                <Activity className="w-7 h-7 text-orange-500" />
              </h2>
              <TiltCard className="w-full max-w-lg p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Today&apos;s Overview</span>
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Live</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl hover:bg-orange-100/50 dark:hover:bg-orange-950/30 transition-colors">
                      <GlitchText text="24" className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text" />
                      <div className="text-sm font-medium text-orange-600/80">New Emails</div>
                    </div>
                    <div className="p-6 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl hover:bg-orange-100/50 dark:hover:bg-orange-950/30 transition-colors">
                      <GlitchText text="5" className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text" />
                      <div className="text-sm font-medium text-orange-600/80">Need Action</div>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </FloatingElement>

            {/* Chat Component */}
            <FloatingElement className="flex flex-col items-center w-full group">
              <h2 className="text-3xl font-bold mb-8 text-center">
                Chat with your email,<br />get things done faster
              </h2>
              <div className="w-full max-w-sm shadow-xl hover:shadow-2xl transition-shadow duration-300 group-hover:scale-[1.02] transition-transform">
                <DemoChatWith100x />
              </div>
            </FloatingElement>
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
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 text-white px-8 py-6 text-lg font-semibold"
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
    </ScrollLock>
  );
}
