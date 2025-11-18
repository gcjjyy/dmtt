/**
 * Practice Session Start API
 *
 * POST /api/practice/start
 * Issues a session token for score submission
 */

import { createSession } from "~/lib/session.server";
import { checkSessionCreationLimit } from "~/lib/rate-limit.server";

export async function action({ request }: { request: Request }) {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Get IP address for rate limiting
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Check rate limit
  const rateLimit = checkSessionCreationLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "Too many session creation requests. Please try again later.",
        resetAt: rateLimit.resetAt,
      },
      { status: 429 }
    );
  }

  // Parse request body
  let body: { type?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type } = body;

  // Validate practice type
  if (!type || !["short", "long", "venice"].includes(type)) {
    return Response.json(
      { error: "Invalid practice type. Must be 'short', 'long', or 'venice'" },
      { status: 400 }
    );
  }

  // Create session
  const session = createSession(type as "short" | "long" | "venice");

  // Return session token
  return Response.json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
}
