'use client';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ComposeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComposeDialog({ isOpen, onClose }: ComposeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compose (stub)</DialogTitle>
        </DialogHeader>
        <div className="py-12 flex flex-col items-center gap-4 text-muted-foreground">
          <p>Compose dialog placeholder</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComposeDialog; 