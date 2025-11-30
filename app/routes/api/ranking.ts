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

  // Get current year and month for filtering
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  try {
    const rawRankings = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = ${type}
        AND EXTRACT(YEAR FROM created_at) = ${currentYear}
        AND EXTRACT(MONTH FROM created_at) = ${currentMonth}
      ORDER BY score DESC
      LIMIT 100
    `;

    // Parse extra field if it's a string
    const rankings = rawRankings.map(ranking => ({
      ...ranking,
      extra: typeof ranking.extra === 'string' ? JSON.parse(ranking.extra) : ranking.extra
    }));

    return { rankings };
  } catch (error) {
    console.error("Error loading rankings:", error);
    return { rankings: [] };
  }
}
