'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatWith100x } from "@/components/chat-with-100x";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Bot, Activity } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Mock data for components
const mockEmail = {
  id: "mock-1",
  subject: "Project Update Meeting",
  from: "sarah@company.com",
  to: "team@company.com",
  content: "Hi team,\n\nLet's sync up on the project progress tomorrow at 2 PM.\n\nBest,\nSarah",
  date: new Date().toISOString(),
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)] relative overflow-x-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-100/20 via-transparent to-yellow-100/20 animate-gradient" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-yellow-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-lg border-b z-50 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-subtle-bounce">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">100x Email</span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          <a href="#features" className="hover:text-orange-500 transition-colors">Features</a>
          <a href="#resources" className="hover:text-orange-500 transition-colors">Resources</a>
          <a href="#pricing" className="hover:text-orange-500 transition-colors">Pricing</a>
        </nav>
        <Link href="/login">
          <Button 
            variant="ghost" 
            className="text-sm font-medium hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
          >
            Sign in
          </Button>
        </Link>
      </header>

      {/* Main Content with padding-top to account for fixed header */}
      <main className="flex-1 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pt-24">
        {/* Hero Section */}
        <section className="flex flex-col items-center mt-12 mb-16 text-center max-w-3xl mx-auto relative">
          <div className="mb-12 animate-fade-in space-y-6">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              Control your email{' '}
              <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">
                100X
              </span>
              <br />more effective
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your intelligent email assistant that understands your inbox and helps you stay productive
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 text-white px-8 py-6 text-lg font-semibold"
              >
                Get started for free
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors px-8 py-6 text-lg font-semibold"
              >
                Watch demo
              </Button>
            </div>
          </div>
        </section>

        {/* App Preview with enhanced shadow and scaling */}
        <div className="w-full max-w-5xl mb-24 px-4 animate-float">
          <div className="rounded-2xl border shadow-2xl shadow-orange-500/10 overflow-hidden bg-background/50 backdrop-blur-sm hover:shadow-3xl hover:shadow-orange-500/20 transition-all duration-500">
            <Image
              src="/app-screenshot.png"
              alt="Email AI app interface showing inbox and chat"
              width={1200}
              height={800}
              className="w-full hover:scale-[1.02] transition-transform duration-500"
              priority
            />
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="flex flex-col gap-32 w-full items-center mb-24">
          {/* Email Dialog */}
          <div className="flex flex-col items-center w-full group">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              Write lightning fast emails with AI
              <Bot className="w-7 h-7 text-orange-500 animate-bounce" />
            </h2>
            <Card className="w-full max-w-lg overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300 group-hover:scale-[1.02] transition-transform border-orange-200/50">
              <EmailPreviewDialog
                isOpen={false}
                emailId={mockEmail.id}
                onOpenChange={() => {}}
              />
            </Card>
          </div>

          {/* Summary Component */}
          <div className="flex flex-col items-center w-full group">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              Stay on top of your inbox
              <Activity className="w-7 h-7 text-orange-500 animate-pulse" />
            </h2>
            <Card className="w-full max-w-lg p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300 group-hover:scale-[1.02] transition-transform border-orange-200/50">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Today&apos;s Overview</span>
                  <Badge variant="outline" className="animate-pulse bg-orange-50 text-orange-600 border-orange-200">Live</Badge>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl hover:bg-orange-100/50 dark:hover:bg-orange-950/30 transition-colors">
                    <div className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">24</div>
                    <div className="text-sm font-medium text-orange-600/80">New Emails</div>
                  </div>
                  <div className="p-6 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl hover:bg-orange-100/50 dark:hover:bg-orange-950/30 transition-colors">
                    <div className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-transparent bg-clip-text">5</div>
                    <div className="text-sm font-medium text-orange-600/80">Need Action</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Chat Component */}
          <div className="flex flex-col items-center w-full group">
            <h2 className="text-3xl font-bold mb-8 text-center">
              Chat with your email,<br />get things done faster
            </h2>
            <div className="w-full max-w-sm shadow-xl hover:shadow-2xl transition-shadow duration-300 group-hover:scale-[1.02] transition-transform">
              <ChatWith100x />
            </div>
          </div>
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
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-gradient {
          animation: gradient 15s ease infinite;
          background-size: 400% 400%;
        }
        .animate-subtle-bounce {
          animation: subtle-bounce 2s ease-in-out infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
