import { useState } from 'react';

/**
 * Minimal placeholder for the compose-email state machine.  It will handle
 * chips, tone, attachments, and AI generation in future iterations.
 */
export function useCompose() {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    isOpen,
    open,
    close,
  };
} 