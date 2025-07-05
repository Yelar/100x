import { useCallback } from 'react'

/**
 * Temporary stub hook extracted from DashboardContent so we can gradually
 * move email-fetching logic out of the mega-component. For now it does
 * nothing except return no-ops, but calling it inside DashboardContent
 * ensures that later refactors can happen without touching that file's
 * signature again.
 */
export function useEmails() {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchEmails = useCallback(() => {}, [])

  return {
    fetchEmails,
  }
} 