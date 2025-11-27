import { Link, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/$type";
import { useLanguage } from "~/contexts/LanguageContext";
import { sql } from "~/lib/db.server";
import { DosWindow } from "~/components/DosWindow";

export function meta() {
  return [
    { title: "랭킹 | 도·박타자교사" },
  ];
}

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
    timeElapsed?: number;

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
  } | null;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const { type } = params;
  const url = new URL(request.url);

  // Get year and month from query params, default to current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const year = parseInt(url.searchParams.get("year") || String(currentYear));
  const month = parseInt(url.searchParams.get("month") || String(currentMonth));

  if (!["short", "long", "venice"].includes(type)) {
    throw new Response("Invalid type", { status: 400 });
  }

  try {
    // Fetch all scores for this type and time period
    const rawScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = ${type}
        AND EXTRACT(YEAR FROM created_at) = ${year}
        AND EXTRACT(MONTH FROM created_at) = ${month}
      ORDER BY score DESC
    `;

    // Parse extra field if it's a string
    const scores = rawScores.map(score => ({
      ...score,
      extra: typeof score.extra === 'string' ? JSON.parse(score.extra) : score.extra
    }));

    return { scores, type, year, month, currentYear, currentMonth };
  } catch (error) {
    console.error("Error loading scores:", error);
    return { scores: [], type, year, month, currentYear, currentMonth };
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
  const { scores, type, year, month, currentYear, currentMonth } = useLoaderData<typeof loader>();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const typeTitles = {
    short: t("단문 연습", "Short Practice"),
    long: t("장문 연습", "Long Practice"),
    venice: t("베네치아 게임", "Venice Game"),
  };

  const title = typeTitles[type as keyof typeof typeTitles] || type;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
    });
  };

  const handlePrevMonth = () => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    navigate(`/rankings/${type}?year=${newYear}&month=${newMonth}`);
  };

  const handleNextMonth = () => {
    // 현재 월이거나 미래면 이동 불가
    if (year > currentYear || (year === currentYear && month >= currentMonth)) {
      return;
    }

    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    navigate(`/rankings/${type}?year=${newYear}&month=${newMonth}`);
  };

  const isCurrentOrFuture = year > currentYear || (year === currentYear && month >= currentMonth);

  const monthName = t(
    `${month}월`,
    new Date(year, month - 1).toLocaleDateString("en-US", { month: "long" })
  );

  return (
    <div className="w-full h-full bg-[#008080] flex flex-col items-center p-4 gap-2">
      {/* Tab Bar and Date Navigator Row */}
      <div className="flex gap-2">
        {/* Type Selector Buttons - 70% */}
        <div className="w-[70%] bg-[#C0C0C0] border border-black">
          <div className="border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080]">
            <div className="mx-1 my-1 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0]">
              <div className="flex">
                <Link
                  to={`/rankings/short?year=${year}&month=${month}`}
                  className={`w-32 h-5 flex items-center justify-center border-r border-black whitespace-nowrap ${
                    type === "short" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {t("단문", "Short")}
                </Link>
                <Link
                  to={`/rankings/long?year=${year}&month=${month}`}
                  className={`w-32 h-5 flex items-center justify-center border-r border-black whitespace-nowrap ${
                    type === "long" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {t("장문", "Long")}
                </Link>
                <Link
                  to={`/rankings/venice?year=${year}&month=${month}`}
                  className={`w-32 h-5 flex items-center justify-center whitespace-nowrap ${
                    type === "venice" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {t("베네치아", "Venice")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Month Navigator - 30% */}
        <div className="w-[30%] bg-[#C0C0C0] border border-black">
          <div className="border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080]">
            <div className="mx-1 my-1 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0]">
              <div className="flex items-center h-5">
                <button
                  onClick={handlePrevMonth}
                  className="w-5 h-5 flex items-center justify-center text-black bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black"
                >
                  ◀
                </button>
                <div className="flex-1 h-5 flex items-center justify-center px-2 text-black bg-white whitespace-nowrap">
                  {year}{t("년", "")} {monthName}
                </div>
                <button
                  onClick={handleNextMonth}
                  disabled={isCurrentOrFuture}
                  className={`w-5 h-5 flex items-center justify-center border-2 border-t-white border-l-white border-b-black border-r-black ${
                    isCurrentOrFuture ? "text-gray-400 bg-[#C0C0C0] cursor-not-allowed" : "text-black bg-[#C0C0C0]"
                  }`}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings Window */}
      <DosWindow
        title={`${title} ${t("랭킹", "Rankings")} - ${year}${t("년", "")} ${monthName}`}
        className="w-full h-[460px]"
      >
        {scores.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mb-4 text-black">🏆</div>
            <p className="text-black">
              {t("이번 달 기록이 없습니다", "No records this month")}
            </p>
          </div>
        ) : (
          <div className="px-2 py-1.5 overflow-y-auto h-full">
            {/* Table Header */}
            <div className="flex items-center gap-2 px-1 text-black pb-0.5 bg-[#C0C0C0]">
              <div className="w-6"></div>
              <div className="flex-1">{t("이름", "Name")}</div>
              <div className="w-20 text-right">
                {type === "short" || type === "long" ? t("타수", "CPM") : t("점수", "Score")}
              </div>
              {type !== "venice" && (
                <div className="w-20 text-right">{t("정확도", "Accuracy")}</div>
              )}

              {/* Mode-specific columns */}
              {type === "short" && (
                <>
                  <div className="w-20 text-right">{t("WPM", "WPM")}</div>
                  <div className="w-20 text-right">{t("문장수", "Sentences")}</div>
                </>
              )}

              {type === "long" && (
                <>
                  <div className="w-16 text-right">{t("등급", "Grade")}</div>
                  <div className="w-20 text-right">{t("WPM", "WPM")}</div>
                  <div className="w-20 text-right">{t("줄수", "Lines")}</div>
                </>
              )}

              {type === "venice" && (
                <div className="w-16 text-right">{t("단계", "Stage")}</div>
              )}

              <div className="w-20 text-right">{t("날짜", "Date")}</div>
            </div>

            {/* Separator Line */}
            <div className="mb-1">
              <div className="border-b border-[#808080]"></div>
              <div className="border-b border-white"></div>
            </div>

            {/* Table Rows */}
            {scores.map((score, index) => {
              const getRankStyle = (rank: number) => {
                if (rank === 0) return {
                  background: "linear-gradient(135deg, #FFF176 0%, #FFD700 50%, #FFC947 100%)"
                }; // 금색 그라데이션 (중간)
                if (rank === 1) return {
                  background: "linear-gradient(135deg, #F5F5F5 0%, #EEEEEE 50%, #E0E0E0 100%)"
                }; // 은색 그라데이션 (중간)
                if (rank === 2) return {
                  background: "linear-gradient(135deg, #FFCC80 0%, #FFB74D 50%, #FFA726 100%)"
                }; // 동색 그라데이션 (중간)
                return {};
              };

              const getRankDisplay = (rank: number) => {
                if (rank === 0) return "🥇";
                if (rank === 1) return "🥈";
                if (rank === 2) return "🥉";
                return `${rank + 1}`;
              };

              return (
                <div
                  key={score.id}
                  className={`flex items-center gap-2 px-1 text-black`}
                  style={getRankStyle(index)}
                >
                  <div className="w-6 text-center">{getRankDisplay(index)}</div>
                  <div className="flex-1 truncate">{score.name}</div>
                  <div className="w-20 text-right">{score.score.toLocaleString()}</div>
                  {type !== "venice" && (
                    <div className="w-20 text-right">
                      {score.extra?.accuracy ? `${score.extra.accuracy.toFixed(1)}%` : "-"}
                    </div>
                  )}

                  {/* Mode-specific columns */}
                  {type === "short" && (
                    <>
                      <div className="w-20 text-right">
                        {score.extra?.wpm ? score.extra.wpm.toFixed(0) : "-"}
                      </div>
                      <div className="w-20 text-right">
                        {score.extra?.totalSentences || "-"}
                      </div>
                    </>
                  )}

                  {type === "long" && (
                    <>
                      <div className="w-16 text-right">
                        {score.extra?.grade || "-"}
                      </div>
                      <div className="w-20 text-right">
                        {score.extra?.wpm ? score.extra.wpm.toFixed(0) : "-"}
                      </div>
                      <div className="w-20 text-right">
                        {score.extra?.totalLines || "-"}
                      </div>
                    </>
                  )}

                  {type === "venice" && (
                    <div className="w-16 text-right">
                      {score.extra?.level || "-"}
                    </div>
                  )}

                  <div className="w-20 text-right">{formatDate(score.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </DosWindow>
    </div>
  );
}
