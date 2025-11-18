/**
 * Rate Limiting System
 *
 * Tracks API requests by IP and name to prevent abuse
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// IP-based rate limiting: 10 requests per minute
const ipLimits = new Map<string, RateLimitEntry>();
const IP_LIMIT = 10;
const IP_WINDOW = 60 * 1000; // 1 minute

// Name-based rate limiting: 50 requests per hour
const nameLimits = new Map<string, RateLimitEntry>();
const NAME_LIMIT = 50;
const NAME_WINDOW = 60 * 60 * 1000; // 1 hour

// Session creation rate limiting: 3 per minute per IP
const sessionLimits = new Map<string, RateLimitEntry>();
const SESSION_LIMIT = 3;
const SESSION_WINDOW = 60 * 1000; // 1 minute

/**
 * Check rate limit for a key
 */
function checkLimit(
  map: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  window: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = map.get(key);

  // No entry or expired entry - allow and create new
  if (!entry || now > entry.resetAt) {
    map.set(key, {
      count: 1,
      resetAt: now + window,
    });

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + window,
    };
  }

  // Entry exists and not expired - check limit
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;
  map.set(key, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check IP-based rate limit (10 requests per minute)
 */
export function checkIpRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return checkLimit(ipLimits, ip, IP_LIMIT, IP_WINDOW);
}

/**
 * Check name-based rate limit (50 requests per hour)
 */
export function checkNameRateLimit(name: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  // Normalize name (case-insensitive, trim whitespace)
  const normalizedName = name.trim().toLowerCase();
  return checkLimit(nameLimits, normalizedName, NAME_LIMIT, NAME_WINDOW);
}

/**
 * Check session creation rate limit (3 per minute per IP)
 */
export function checkSessionCreationLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  return checkLimit(sessionLimits, ip, SESSION_LIMIT, SESSION_WINDOW);
}

/**
 * Clean up expired entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of ipLimits.entries()) {
    if (now > entry.resetAt) {
      ipLimits.delete(key);
    }
  }

  for (const [key, entry] of nameLimits.entries()) {
    if (now > entry.resetAt) {
      nameLimits.delete(key);
    }
  }

  for (const [key, entry] of sessionLimits.entries()) {
    if (now > entry.resetAt) {
      sessionLimits.delete(key);
    }
  }
}

// Periodic cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 1000 * 60 * 5);
