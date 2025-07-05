'use client';
import React from 'react';

export interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="h-16 flex items-center px-4 border-b border-border/50 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
      {/* TODO: replace with real header content */}
      <div className="text-sm text-muted-foreground">Header placeholder</div>
      {children}
    </header>
  );
}

export default Header; 