import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Interface for rate limit configuration
interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Maximum number of requests in the window
}

// Interface for rate limit info
interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// Rate limit configurations for different endpoints
const rateLimits: Record<string, RateLimitConfig> = {
  // General API endpoints - browsing emails, checking folders, etc.
  default: {
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute (5 per second)
  },
  // Authentication related endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes (allows for multiple login attempts)
  },
  // Email sending endpoints
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500, // 500 emails per hour (reasonable for business users)
  },
  // AI/ML endpoints (more restrictive due to cost)
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute (slightly increased for better UX)
  },
};

// In-memory storage for rate limits
const rateLimit = new Map<string, RateLimitInfo>();

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of rateLimit.entries()) {
    if (info.resetTime <= now) {
      rateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Get client IP from various headers and fallback to a default
function getClientIP(request: NextRequest): string {
  // Try to get IP from Cloudflare or other proxy headers
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  const xForwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0];
  const xRealIp = request.headers.get('x-real-ip');
  
  // Return the first available IP or fallback to localhost
  return cfConnectingIp || xForwardedFor || xRealIp || '127.0.0.1';
}

/**
 * Apply rate limiting to a request
 * @param request - The incoming request
 * @param limiterKey - The type of rate limit to apply (default, auth, email, ai)
 * @returns NextResponse if rate limit is exceeded, null otherwise
 */
export async function applyRateLimit(
  request: NextRequest,
  limiterKey: keyof typeof rateLimits = 'default'
): Promise<NextResponse | null> {
  try {
    const now = Date.now();
    const ip = getClientIP(request);
    const config = rateLimits[limiterKey];
    const key = `${limiterKey}:${ip}`;

    // Get or create rate limit info
    let info = rateLimit.get(key);
    if (!info || info.resetTime <= now) {
      info = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    // Increment request count
    info.count++;
    rateLimit.set(key, info);

    // Calculate remaining requests and time until reset
    const remaining = Math.max(0, config.max - info.count);
    const resetIn = Math.max(0, info.resetTime - now);

    // Set rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', String(config.max));
    headers.set('X-RateLimit-Remaining', String(remaining));
    headers.set('X-RateLimit-Reset', String(Math.ceil(resetIn / 1000)));

    // Check if rate limit is exceeded
    if (info.count > config.max) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Too many requests, please try again later.',
          retryAfter: Math.ceil(resetIn / 1000)
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers),
            'Retry-After': String(Math.ceil(resetIn / 1000))
          }
        }
      );
    }

    // Add headers to the original request for tracking
    for (const [key, value] of headers.entries()) {
      request.headers.set(key, value);
    }


    return null;
  } catch (error) {
    console.error('Rate limit error:', error);
    return null; // Continue without rate limiting on error
  }
} 