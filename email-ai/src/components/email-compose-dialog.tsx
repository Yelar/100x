import { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface EmailComposeDialogProps {
  onEmailSent?: () => void;
  initialSubject?: string;
  initialContent?: string;
}

export interface EmailComposeDialogHandle {
  openDialog: (subject?: string, content?: string) => void;
}

export const EmailComposeDialog = forwardRef<EmailComposeDialogHandle, EmailComposeDialogProps>(
  ({ onEmailSent }, ref) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const { toast } = useToast();

    useImperativeHandle(ref, () => ({
      openDialog: (subjectVal?: string, contentVal?: string) => {
        setSubject(subjectVal || '');
        setContent(contentVal || '');
        setOpen(true);
      },
    }));

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const response = await fetch('/api/emails/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to,
            subject,
            content,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to send email');
        }
        toast({
          title: "Success",
          description: "Email sent successfully",
        });
        setTo('');
        setSubject('');
        setContent('');
        setOpen(false);
        onEmailSent?.();
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to send email",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>New Email</DialogTitle>
              <DialogDescription>
                Compose and send a new email message.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="to" className="text-right">
                  To
                </Label>
                <Input
                  id="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="col-span-3"
                  type="email"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subject" className="text-right">
                  Subject
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="col-span-3"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="content" className="text-right">
                  Message
                </Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="col-span-3"
                  required
                  disabled={loading}
                  rows={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);

EmailComposeDialog.displayName = 'EmailComposeDialog'; 