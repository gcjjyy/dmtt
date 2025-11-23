import type { Route } from "./+types/ranking";
import { sql } from "~/lib/db.server";

interface Score {
  id: number;
  name: string;
  type: string;
  score: number;
  created_at: string;
  extra: {
    accuracy?: number;
    cpm?: number;
    wpm?: number;
    level?: number;
  } | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "venice";

  try {
    const rankings = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = ${type}
      ORDER BY score DESC
      LIMIT 10
    `;

    return { rankings };
  } catch (error) {
    console.error("Error loading rankings:", error);
    return { rankings: [] };
  }
}
