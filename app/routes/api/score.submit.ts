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
  originalText: string;
  typedText: string;
  timeElapsed: number;
  score: number;
  accuracy: number;
  cpm: number;
  sentence?: string; // Optional reference info
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
    originalText,
    typedText,
    timeElapsed,
    score,
    accuracy,
    cpm,
    sentence,
  } = body;

  // Validate required fields
  if (!token || !name || !originalText || !typedText || timeElapsed === undefined) {
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

  // 6. Validate text content
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
    timeElapsed,
    score,
    accuracy,
    cpm,
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
    // Prepare extra data (include sentence as reference)
    const extra = {
      accuracy,
      cpm,
      sentence: sentence || null,
    };

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
