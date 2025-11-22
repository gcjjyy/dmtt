/**
 * Score Submission API
 *
 * POST /api/score/submit
 * Validates and records a score
 */

import { sql } from "~/lib/db.server";
import { validateSession, canSubmit, recordSubmission } from "~/lib/session.server";
import { checkIpRateLimit, checkNameRateLimit } from "~/lib/rate-limit.server";
import { validateScore, validateText, validateName } from "~/lib/validation.server";

interface SubmitScoreRequest {
  token: string;
  name: string;
  type?: string; // Practice mode type
  originalText?: string; // Optional for venice game
  typedText?: string; // Optional for venice game
  timeElapsed?: number;
  score: number;
  accuracy: number;
  cpm?: number;

  // Common fields
  wpm?: number;

  // Short practice fields
  totalChars?: number;
  correctChars?: number;
  totalSentences?: number;

  // Long practice fields
  grade?: string;
  totalLines?: number;
  completionRate?: number;

  // Venice game fields
  level?: number;
  wordsCaught?: number;
  wordsMissed?: number;
  gameDuration?: number;
  livesRemaining?: number;

  // Deprecated
  sentence?: string;
}

export async function action({ request }: { request: Request }) {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Get IP address for rate limiting
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Parse request body
  let body: SubmitScoreRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    token,
    name,
    type: submittedType,
    originalText,
    typedText,
    timeElapsed,
    score,
    accuracy,
    cpm,
    wpm,
    totalChars,
    correctChars,
    totalSentences,
    grade,
    totalLines,
    completionRate,
    level,
    wordsCaught,
    wordsMissed,
    gameDuration,
    livesRemaining,
    sentence,
  } = body;

  // Validate required fields (originalText/typedText not required for venice)
  if (!token || !name) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // 1. Validate session token
  const session = validateSession(token);
  if (!session) {
    return Response.json(
      { error: "Invalid or expired session token" },
      { status: 401 }
    );
  }

  // 2. Check if session can submit
  const canSubmitResult = canSubmit(session);
  if (!canSubmitResult.allowed) {
    return Response.json(
      { error: canSubmitResult.reason },
      { status: 429 }
    );
  }

  // 3. Validate name
  const nameValidation = validateName(name);
  if (!nameValidation.valid) {
    return Response.json(
      { error: "Invalid name", details: nameValidation.errors },
      { status: 400 }
    );
  }

  // 4. Check IP rate limit
  const ipRateLimit = checkIpRateLimit(ip);
  if (!ipRateLimit.allowed) {
    return Response.json(
      {
        error: "Too many requests from this IP. Please try again later.",
        resetAt: ipRateLimit.resetAt,
      },
      { status: 429 }
    );
  }

  // 5. Check name rate limit
  const nameRateLimit = checkNameRateLimit(name);
  if (!nameRateLimit.allowed) {
    return Response.json(
      {
        error: "Too many submissions for this name. Please try again later.",
        resetAt: nameRateLimit.resetAt,
      },
      { status: 429 }
    );
  }

  // 6. Validate text content (only for non-venice games)
  if (originalText && typedText) {
    const textValidation = validateText(originalText);
    if (!textValidation.valid) {
      return Response.json(
        { error: "Invalid original text", details: textValidation.errors },
        { status: 400 }
      );
    }

    const typedTextValidation = validateText(typedText);
    if (!typedTextValidation.valid) {
      return Response.json(
        { error: "Invalid typed text", details: typedTextValidation.errors },
        { status: 400 }
      );
    }

    // 7. Validate score (server-side recalculation)
    const scoreValidation = validateScore(
      originalText,
      typedText,
      timeElapsed || 0,
      score,
      accuracy,
      cpm || 0,
      session.type
    );

    if (!scoreValidation.valid) {
      console.error("Score validation failed:", scoreValidation.errors);
      return Response.json(
        {
          error: "Score validation failed",
          details: scoreValidation.errors,
        },
        { status: 400 }
      );
    }
  }

  // 8. Record submission in session
  const recorded = recordSubmission(token, name);
  if (!recorded) {
    return Response.json(
      { error: "Failed to record submission" },
      { status: 500 }
    );
  }

  // 9. Save to database using PostgreSQL function
  try {
    // Prepare extra data with all available fields
    const extra: Record<string, any> = {
      accuracy,
    };

    // Add optional common fields
    if (cpm !== undefined) extra.cpm = cpm;
    if (wpm !== undefined) extra.wpm = wpm;
    if (timeElapsed !== undefined) extra.timeElapsed = timeElapsed;

    // Short practice specific
    if (totalChars !== undefined) extra.totalChars = totalChars;
    if (correctChars !== undefined) extra.correctChars = correctChars;
    if (totalSentences !== undefined) extra.totalSentences = totalSentences;

    // Long practice specific
    if (grade !== undefined) extra.grade = grade;
    if (totalLines !== undefined) extra.totalLines = totalLines;
    if (completionRate !== undefined) extra.completionRate = completionRate;

    // Venice game specific
    if (level !== undefined) extra.level = level;
    if (wordsCaught !== undefined) extra.wordsCaught = wordsCaught;
    if (wordsMissed !== undefined) extra.wordsMissed = wordsMissed;
    if (gameDuration !== undefined) extra.gameDuration = gameDuration;
    if (livesRemaining !== undefined) extra.livesRemaining = livesRemaining;

    // Deprecated field for backward compatibility
    if (sentence) extra.sentence = sentence;

    // Call upsert_score function
    // The function handles: only update if new score > old score
    await sql`
      SELECT upsert_score(
        ${name},
        ${session.type},
        ${score},
        ${JSON.stringify(extra)}::jsonb
      )
    `;

    return Response.json({
      success: true,
      score,
      accuracy,
      cpm,
    });
  } catch (error) {
    console.error("Database error:", error);
    return Response.json(
      { error: "Failed to save score to database" },
      { status: 500 }
    );
  }
}
