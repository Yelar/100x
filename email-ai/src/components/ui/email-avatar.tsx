import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getGravatarUrl } from '@/lib/utils';

interface EmailAvatarProps {
  from: string;
  avatar?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8', 
  lg: 'h-10 w-10'
};

const fallbackSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

export function EmailAvatar({ from, avatar, size = 'md', className = '' }: EmailAvatarProps) {
  // Generate avatar URL if not provided
  const avatarUrl = avatar || getGravatarUrl(from, size === 'sm' ? 24 : size === 'lg' ? 40 : 32);
  
  // Debug logging
  console.log('EmailAvatar render:', { from, avatar, avatarUrl, size });
  
  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarImage src={avatarUrl} alt={from} />
      <AvatarFallback className={`bg-muted text-foreground font-medium ${fallbackSizeClasses[size]}`}>
        {getInitials(from)}
      </AvatarFallback>
    </Avatar>
  );
}

export default EmailAvatar; 