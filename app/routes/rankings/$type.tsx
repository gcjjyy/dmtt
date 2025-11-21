import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/$type";
import { useLanguage } from "~/contexts/LanguageContext";
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
  } | null;
}

export async function loader({ params }: Route.LoaderArgs) {
  const { type } = params;

  if (!["short", "long", "venice"].includes(type)) {
    throw new Response("Invalid type", { status: 400 });
  }

  try {
    // Fetch top 20 scores for this type
    const scores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = ${type}
      ORDER BY score DESC
      LIMIT 20
    `;

    return { scores, type };
  } catch (error) {
    console.error("Error loading scores:", error);
    return { scores: [], type };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const score = parseInt(formData.get("score") as string);
  const extraData = formData.get("extra") as string;
  const extra = extraData ? JSON.parse(extraData) : null;

  try {
    // Use INSERT ON CONFLICT to update if same name and type exists
    await sql`
      INSERT INTO scores (name, type, score, extra, created_at)
      VALUES (${name}, ${type}, ${score}, ${extra}, NOW())
      ON CONFLICT (name, type)
      DO UPDATE SET
        score = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.score ELSE scores.score END,
        extra = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.extra ELSE scores.extra END,
        created_at = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.created_at ELSE scores.created_at END
    `;

    return { success: true };
  } catch (error) {
    console.error("Error saving score:", error);
    return { success: false, error: "Failed to save score" };
  }
}

export default function Rankings() {
  const { scores, type } = useLoaderData<typeof loader>();
  const { t } = useLanguage();

  const typeTitles = {
    short: t("단문 연습", "Short Practice"),
    long: t("장문 연습", "Long Practice"),
    venice: t("베네치아 게임", "Venice Game"),
  };

  const title = typeTitles[type as keyof typeof typeTitles] || type;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-8">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t("돌아가기", "Back")}
          </Link>
          <h1 className="text-gray-900 dark:text-white">
            {t("랭킹", "Rankings")} - {title}
          </h1>
          <div className="w-20"></div>
        </div>

        {/* Type selector */}
        <div className="flex gap-4 mb-6 justify-center">
          <Link
            to="/rankings/short"
            className={`px-6 py-3 rounded-lg transition-all ${
              type === "short"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-100 dark:hover:bg-gray-700"
            }`}
          >
            {t("단문", "Short")}
          </Link>
          <Link
            to="/rankings/long"
            className={`px-6 py-3 rounded-lg transition-all ${
              type === "long"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-100 dark:hover:bg-gray-700"
            }`}
          >
            {t("장문", "Long")}
          </Link>
          <Link
            to="/rankings/venice"
            className={`px-6 py-3 rounded-lg transition-all ${
              type === "venice"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-100 dark:hover:bg-gray-700"
            }`}
          >
            {t("베네치아", "Venice")}
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {scores.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mb-4">🏆</div>
              <p className="text-gray-600 dark:text-gray-400">
                {t("아직 랭킹이 없습니다", "No rankings yet")}
              </p>
              <p className="text-gray-500 dark:text-gray-500 mt-2">
                {t("첫 번째 기록을 세워보세요!", "Be the first to set a record!")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-900 dark:text-white">
                      {t("순위", "Rank")}
                    </th>
                    <th className="px-6 py-4 text-left text-gray-900 dark:text-white">
                      {t("이름", "Name")}
                    </th>
                    <th className="px-6 py-4 text-center text-gray-900 dark:text-white">
                      {type === "short" || type === "long" ? t("타수", "CPM") : t("점수", "Score")}
                    </th>
                    <th className="px-6 py-4 text-center text-gray-900 dark:text-white">
                      {t("정확도", "Accuracy")}
                    </th>
                    <th className="px-6 py-4 text-center text-gray-900 dark:text-white">
                      {t("날짜", "Date")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {scores.map((score, index) => (
                    <tr
                      key={score.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        index < 3 ? "bg-yellow-50 dark:bg-yellow-900/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : ""}
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 dark:text-white">
                          {score.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-blue-600 dark:text-blue-400">
                          {score.score.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-gray-900 dark:text-white">
                          {score.extra?.accuracy ? `${score.extra.accuracy.toFixed(1)}%` : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-gray-600 dark:text-gray-400">
                          {formatDate(score.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
