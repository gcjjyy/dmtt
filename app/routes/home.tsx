import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
import { useLanguage } from "~/contexts/LanguageContext";
import { sql } from "~/lib/db.server";
import { DosWindow } from "~/components/DosWindow";

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

export async function loader() {
  try {
    // Fetch top 5 scores for each type
    const rawShortScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'short'
      ORDER BY score DESC
      LIMIT 5
    `;

    const rawLongScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'long'
      ORDER BY score DESC
      LIMIT 5
    `;

    const rawVeniceScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'venice'
      ORDER BY score DESC
      LIMIT 5
    `;

    // Parse extra field if it's a string
    const parseExtra = (scores: Score[]) => scores.map(score => ({
      ...score,
      extra: typeof score.extra === 'string' ? JSON.parse(score.extra) : score.extra
    }));

    return {
      rankings: {
        short: parseExtra(rawShortScores),
        long: parseExtra(rawLongScores),
        venice: parseExtra(rawVeniceScores),
      },
    };
  } catch (error) {
    console.error("Error loading rankings:", error);
    return {
      rankings: {
        short: [],
        long: [],
        venice: [],
      },
    };
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "타자 연습 | Typing Practice" },
    { name: "description", content: "한글/영문 타자 연습 프로그램" },
  ];
}

export default function Home() {
  const { t } = useLanguage();
  const { rankings } = useLoaderData<typeof loader>();

  const rankingTypes = [
    { key: "short", title: t("단문 연습", "Short Practice") },
    { key: "long", title: t("장문 연습", "Long Practice") },
    { key: "venice", title: t("베네치아 게임", "Venice Game") },
  ];

  const currentMonth = new Date().getMonth() + 1;
  const monthNames = {
    ko: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };

  return (
    <div className="w-full h-full bg-[#008080] px-4 pb-4 pt-11 relative flex flex-col">
      {/* Title */}
      <div className="text-center text-white mb-4">
        {t(`이번 달(${monthNames.ko[currentMonth - 1]}) 랭킹`, `This Month (${monthNames.en[currentMonth - 1]}) Rankings`)}
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1">
        {rankingTypes.map((type) => {
          const typeKey = type.key as "short" | "long" | "venice";
          const scores = rankings[typeKey];

          return (
            <DosWindow key={type.key} title={type.title} className="flex-1">
              <div className="p-2 flex flex-col h-full">
                {scores.length === 0 ? (
                  <div className="text-center py-4 text-black flex-1 flex items-center justify-center">
                    {t("아직 기록이 없습니다", "No records yet")}
                  </div>
                ) : (
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-1 text-black border-b border-[#808080] pb-1 mb-1">
                      <div className="w-6">#</div>
                      <div className="flex-1">{t("이름", "Name")}</div>
                      <div className="w-16 text-right">{t("타수", "CPM")}</div>
                    </div>
                    {/* Scores */}
                    <div className="space-y-0.5">
                      {scores.map((score, index) => (
                        <div
                          key={score.id}
                          className={`flex items-center gap-2 px-1 text-black ${index === 0 ? "bg-[#FFFF00]" : ""}`}
                        >
                          <div className="w-6">{index + 1}</div>
                          <div className="flex-1 truncate">{score.name}</div>
                          <div className="w-16 text-right">{score.score.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link
                  to={`/rankings/${type.key}`}
                  className="block mt-2 text-center text-black border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] bg-[#C0C0C0] hover:bg-[#D0D0D0] py-0.5"
                >
                  {t("전체 보기", "View All")}
                </Link>
              </div>
            </DosWindow>
          );
        })}
      </div>
    </div>
  );
}
