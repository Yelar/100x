import { Email } from '@/types/email';

export interface CacheEntry {
  emails: Email[];
  nextPageToken?: string;
}

const cache: Record<string, CacheEntry> = {};

export function getCache(key: string): CacheEntry | undefined {
  return cache[key];
}

export function setCache(key: string, entry: CacheEntry): void {
  cache[key] = entry;
}

export function clearCache(key?: string): void {
  if (key) {
    delete cache[key];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
} 