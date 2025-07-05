'use client';
import React from 'react';

export interface SidebarProps {
  children?: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-border/50 bg-gradient-to-b from-orange-500/5 to-amber-500/5 p-4 overflow-y-auto">
      {/* TODO: sidebar nav items go here */}
      <div className="text-sm text-muted-foreground">Sidebar placeholder</div>
      {children}
    </aside>
  );
}

export default Sidebar; 