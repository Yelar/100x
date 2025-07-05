'use client';
import React from 'react';
import { Inbox, Star, Send, Shield, Trash, FileText, Plus, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FLAG_LABELS, FLAG_COLORS } from '../utils/flags';

export type Folder = 'inbox' | 'sent' | 'spam' | 'trash' | 'drafts';

interface SidebarProps {
  currentFolder: Folder;
  onFolderChange: (folder: Folder) => void;
  showStarredOnly: boolean;
  onToggleStarred: () => void;
  selectedFlag: string | null;
  onSelectFlag: (flag: string | null) => void;
  flaggedEmails: Record<string, { flag: string }>;
  onCompose: () => void;
  onReminderClick: () => void;
}

export function Sidebar({
  currentFolder,
  onFolderChange,
  showStarredOnly,
  onToggleStarred,
  selectedFlag,
  onSelectFlag,
  flaggedEmails,
  onCompose,
  onReminderClick,
}: SidebarProps) {
  const folderBtn = (
    icon: React.ReactNode,
    label: string,
    folder: Folder,
  ) => (
    <Button
      key={folder}
      variant="ghost"
      className={`w-full justify-start font-medium ${
        currentFolder === folder
          ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10'
          : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'
      }`}
      onClick={() => onFolderChange(folder)}
    >
      {icon}
      {label}
    </Button>
  );

  const flagCounts = Object.values(flaggedEmails).reduce<Record<string, number>>((acc, fe) => {
    acc[fe.flag] = (acc[fe.flag] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="w-64 border-r border-border/50 bg-gradient-to-b from-orange-500/5 to-amber-500/5 flex flex-col overflow-y-auto">
      <div className="p-4">
        <Button
          className="rounded-full px-6 py-2 h-12 w-full justify-center font-medium shadow-sm mb-6 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
          onClick={onCompose}
        >
          <Plus className="mr-2 h-5 w-5" />
          Compose
        </Button>

        {folderBtn(<Inbox className="mr-2 h-5 w-5" />, 'Inbox', 'inbox')}
        <Button
          variant="ghost"
          className={`w-full justify-start font-medium ${
            showStarredOnly
              ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10'
              : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'
          }`}
          onClick={onToggleStarred}
        >
          <Star className={`mr-2 h-5 w-5 ${showStarredOnly ? 'fill-current text-amber-500' : ''}`} />
          Starred
        </Button>
        {folderBtn(<Send className="mr-2 h-5 w-5" />, 'Sent', 'sent')}
        {folderBtn(<Shield className="mr-2 h-5 w-5" />, 'Spam', 'spam')}
        {folderBtn(<Trash className="mr-2 h-5 w-5" />, 'Trash', 'trash')}
        {folderBtn(<FileText className="mr-2 h-5 w-5" />, 'Drafts', 'drafts')}

        {/* Reminders */}
        <Button
          variant="ghost"
          onClick={onReminderClick}
          className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10"
        >
          <Bell className="mr-2 h-5 w-5" />
          Reminders
        </Button>

        {/* Flag filters */}
        <div className="mt-2 space-y-1">
          {Object.entries(FLAG_LABELS).map(([flag, label]) => (
            <Button
              key={flag}
              variant="ghost"
              className={`w-full justify-start font-medium flex items-center gap-2 ${
                selectedFlag === flag
                  ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10'
                  : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10'
              }`}
              onClick={() => onSelectFlag(selectedFlag === flag ? null : flag)}
            >
              <span className={`inline-block w-3 h-3 rounded-full ${FLAG_COLORS[flag]}`} />
              {label}
              <span className="ml-auto text-xs text-muted-foreground">
                {flagCounts[flag] ?? 0}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar; 