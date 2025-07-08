'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Monitor, Settings, ArrowLeft, Trash2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';
import { useAutocompleteSettings } from '@/hooks/use-autocomplete-settings';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isAutocompleteEnabled, toggleAutocomplete } = useAutocompleteSettings();
  const router = useRouter();

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
  };

  const handleAutocompleteToggle = (enabled: boolean) => {
    toggleAutocomplete(enabled);
    toast.success(`AI Autocomplete ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Account deleted');
        localStorage.removeItem('user_info');
        router.push('/login');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete account');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-orange-500" />
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-orange-500" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the appearance of your email client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('light')}
                    className="h-16 flex flex-col gap-2"
                  >
                    <Sun className="h-5 w-5" />
                    <span className="text-sm">Light</span>
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('dark')}
                    className="h-16 flex flex-col gap-2"
                  >
                    <Moon className="h-5 w-5" />
                    <span className="text-sm">Dark</span>
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('system')}
                    className="h-16 flex flex-col gap-2"
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="text-sm">System</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  System theme automatically matches your operating system preference
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                AI Features
              </CardTitle>
              <CardDescription>
                Configure AI-powered features and automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">AI Autocomplete</Label>
                  <p className="text-sm text-muted-foreground">
                    Get intelligent suggestions while composing emails
                  </p>
                </div>
                <Switch
                  checked={isAutocompleteEnabled}
                  onCheckedChange={handleAutocompleteToggle}
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Account
              </CardTitle>
              <CardDescription>
                Permanently remove your account and data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-6 space-y-4">
                  <DialogHeader>
                    <DialogTitle>Are you absolutely sure?</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={handleDeleteAccount}>Yes, delete</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Separator />

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>
                Information about your email client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-medium">1.0.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Theme</span>
                <span className="text-sm font-medium capitalize">{theme}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 