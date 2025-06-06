import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Send, User } from "lucide-react";

export function DemoChatWith100x() {
  return (
    <Card className="w-full">
      <div className="flex flex-col h-[500px]">
        {/* Chat Header */}
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-orange-500" />
            Chat with 100x
          </h3>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-start gap-2">
            <User className="w-6 h-6 mt-1" />
            <div className="bg-muted p-3 rounded-lg">
              Can you help me write an email to my team about the project update?
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Bot className="w-6 h-6 mt-1 text-orange-500" />
            <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
              I&apos;d be happy to help you draft an email for your team. Would you like me to create a professional and concise update email?
            </div>
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              className="flex-1"
              disabled
            />
            <Button size="icon" disabled>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            This is a demo. Sign up to chat with 100x Email AI.
          </p>
        </div>
      </div>
    </Card>
  );
} 