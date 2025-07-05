'use client';
import React from 'react';
import { Search, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UserInfo {
  name?: string;
  email?: string;
  picture?: string;
}

export interface HeaderProps {
  userInfo: UserInfo | null;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onLogout: () => void;
}

export function Header({ userInfo, searchQuery, onSearchChange, onSearchKeyDown, onLogout }: HeaderProps) {
  return (
    <header className="h-16 flex items-center px-4 border-b border-border/50 bg-gradient-to-r from-orange-500/10 to-amber-500/10 flex-none">
      {/* Avatar + name */}
      <div className="flex items-center space-x-4 w-64">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8 ring-2 ring-orange-500/20">
            <AvatarImage src={userInfo?.picture} alt={userInfo?.name} />
            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600">
              {userInfo?.name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="font-medium text-sm truncate">
            {userInfo?.name}
            <div className="text-xs text-orange-600/80 truncate">{userInfo?.email}</div>
          </div>
        </div>
      </div>

      {/* search */}
      <div className="flex-1 px-4">
        <div className="relative w-full max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-orange-500/50" />
          <Input
            type="text"
            placeholder="Search in emails..."
            value={searchQuery}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            className="pl-10 pr-4 py-2 h-10 rounded-full bg-white/5 border-orange-500/20 hover:border-orange-500/30 focus:border-orange-500/50 w-full transition-colors"
          />
        </div>
      </div>

      {/* logout */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-orange-500/80 hover:text-orange-500 hover:bg-orange-500/10"
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

export default Header; 