/**
 * Session Management for Practice Score Submission
 *
 * Sessions are issued at the start of a practice session and allow
 * multiple score submissions with security checks.
 */

import { randomUUID } from "crypto";

export interface Session {
  token: string;
  name: string | null; // Name is set on first submission
  createdAt: number;
  expiresAt: number;
  submissionCount: number;
  lastSubmissionAt: number | null;
  type: "short" | "long" | "venice"; // Practice type
}

// In-memory session storage
const sessions = new Map<string, Session>();

// Constants
const SESSION_DURATION = 1000 * 60 * 60; // 1 hour
const MAX_SUBMISSIONS_PER_SESSION = 100;
const MIN_SUBMISSION_INTERVAL = 2000; // 2 seconds

/**
 * Create a new session
 */
export function createSession(type: "short" | "long" | "venice"): Session {
  const token = randomUUID();
  const now = Date.now();

  const session: Session = {
    token,
    name: null,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
    submissionCount: 0,
    lastSubmissionAt: null,
    type,
  };

  sessions.set(token, session);

  // Clean up expired sessions
  cleanupExpiredSessions();

  return session;
}

/**
 * Validate session token
 */
export function validateSession(token: string): Session | null {
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Check if session can submit a score
 */
export function canSubmit(session: Session): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // Check submission count
  if (session.submissionCount >= MAX_SUBMISSIONS_PER_SESSION) {
    return { allowed: false, reason: "Maximum submissions reached" };
  }

  // Check submission interval
  if (session.lastSubmissionAt) {
    const timeSinceLastSubmission = now - session.lastSubmissionAt;
    if (timeSinceLastSubmission < MIN_SUBMISSION_INTERVAL) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil((MIN_SUBMISSION_INTERVAL - timeSinceLastSubmission) / 1000)} seconds`
      };
    }
  }

  return { allowed: true };
}

/**
 * Record a submission and update session
 */
export function recordSubmission(token: string, name?: string): boolean {
  const session = sessions.get(token);

  if (!session) {
    return false;
  }

  const now = Date.now();

  // Update session
  session.submissionCount += 1;
  session.lastSubmissionAt = now;

  // Set name on first submission if provided
  if (name && !session.name) {
    session.name = name;
  }

  sessions.set(token, session);

  return true;
}

/**
 * Get session by token
 */
export function getSession(token: string): Session | null {
  return sessions.get(token) || null;
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

// Periodic cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 1000 * 60 * 5);
