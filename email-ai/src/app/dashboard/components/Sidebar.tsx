'use client';
import React from 'react';
import { Inbox, Star, Send, Shield, Trash, FileText, Plus, Bell, Keyboard, X } from 'lucide-react';
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
  onShowShortcuts: () => void;
  isOpen?: boolean;
  onClose?: () => void;
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
  onShowShortcuts,
  isOpen = true,
  onClose,
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
      onClick={() => {
        onFolderChange(folder);
        // Close sidebar on mobile after folder selection
        if (onClose) onClose();
      }}
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
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-64 border-r border-border/50 
        bg-background md:bg-gradient-to-b md:from-orange-500/5 md:to-amber-500/5 
        flex flex-col overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4">
          {/* Mobile close button */}
          {onClose && (
            <div className="flex justify-end mb-4 md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}

          <Button
            className="rounded-full px-6 py-2 h-12 w-full justify-center font-medium shadow-sm mb-6 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
            onClick={() => {
              onCompose();
              // Close sidebar on mobile after compose
              if (onClose) onClose();
            }}
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
            onClick={() => {
              onToggleStarred();
              // Close sidebar on mobile after toggle
              if (onClose) onClose();
            }}
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
            onClick={() => {
              onReminderClick();
              // Close sidebar on mobile after reminder click
              if (onClose) onClose();
            }}
            className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10"
          >
            <Bell className="mr-2 h-5 w-5" />
            Reminders
          </Button>

          {/* Shortcuts */}
          <Button
            variant="ghost"
            onClick={() => {
              onShowShortcuts();
              // Close sidebar on mobile after shortcuts click
              if (onClose) onClose();
            }}
            className="w-full justify-start font-medium text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10"
          >
            <Keyboard className="mr-2 h-5 w-5" />
            Shortcuts
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
                onClick={() => {
                  onSelectFlag(selectedFlag === flag ? null : flag);
                  // Close sidebar on mobile after flag selection
                  if (onClose) onClose();
                }}
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
    </>
  );
}

export default Sidebar; 