/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback } from 'react';

/**
 * Stub version of a hook that will eventually host all email-mutating
 * operations (star, delete, restore, etc.).  For now it only exposes
 * typed no-op callbacks so we can safely import it while we incrementally
 * move logic out of the DashboardContent mega-component.
 */
export function useEmailActions() {
  const starEmail = useCallback((_messageId: string, _starred: boolean) => {
    /* TODO: implement */
  }, []);

  const deleteEmail = useCallback(
    (_messageId: string, _action: 'trash' | 'permanent' = 'trash') => {
      /* TODO: implement */
    },
    [],
  );

  const restoreEmail = useCallback((_messageId: string) => {
    /* TODO: implement */
  }, []);

  const summarizeEmails = useCallback(async (_ids: string[]) => {
    /* TODO: implement */
    return null as unknown;
  }, []);

  const generateTldr = useCallback(async (_messageId: string) => {
    /* TODO: implement */
    return null as unknown;
  }, []);

  return {
    starEmail,
    deleteEmail,
    restoreEmail,
    summarizeEmails,
    generateTldr,
  };
} 