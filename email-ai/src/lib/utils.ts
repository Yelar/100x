import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import md5 from 'crypto-js/md5'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate Gravatar URL for email address
export function getGravatarUrl(email: string, size: number = 40): string {
  // Extract email from "Name <email@domain.com>" format
  const emailMatch = email.match(/<(.+?)>/);
  const emailAddress = emailMatch ? emailMatch[1] : email;
  
  // Create MD5 hash of email (lowercase, trimmed)
  const hash = md5(emailAddress.toLowerCase().trim()).toString();
  
  // Return Gravatar URL with fallback to a generic avatar
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp&r=g`;
}

// Generate initials from email sender name
export function getInitials(from: string): string {
  // Extract name from "Name <email@domain.com>" format
  const nameMatch = from.match(/^([^<]+)/);
  const name = nameMatch ? nameMatch[1].trim() : from;
  
  // Split by spaces and get first letter of each word
  const words = name.split(' ').filter(word => word.length > 0);
  
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    return words[0][0].toUpperCase();
  } else {
    // Fallback to first letter of email
    const emailMatch = from.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : from;
    return email[0].toUpperCase();
  }
}
