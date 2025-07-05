/**
 * Centralised definition of email flag labels / colours plus
 * localStorage helpers used by the dashboard.
 */
export const FLAG_LABELS: Record<string, string> = {
  promotional: 'Promotional',
  work: 'Work',
  to_reply: 'To Reply',
  other: 'Other',
};

export const FLAG_COLORS: Record<string, string> = {
  promotional: 'bg-pink-500',
  work: 'bg-blue-500',
  to_reply: 'bg-amber-500',
  other: 'bg-gray-400',
};

export interface FlagMeta {
  flag: string;
  subject: string;
  snippet: string;
  sender: string;
  flaggedAt: number;
}

const LS_KEY = 'flagged_emails';

export function getFlaggedEmailsLS(): Record<string, FlagMeta> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FlagMeta>) : {};
  } catch {
    return {};
  }
}

export function setFlaggedEmailsLS(flags: Record<string, FlagMeta>): void {
  // Only keep the latest 40 (delete the oldest if more than 40)
  const sorted = Object.entries(flags)
    .sort((a, b) => b[1].flaggedAt - a[1].flaggedAt) // newest first
    .slice(0, 40); // keep only the newest 40
  const obj = Object.fromEntries(sorted);
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
} 