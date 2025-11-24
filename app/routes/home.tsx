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
    // Fetch top 10 scores for each type
    const rawShortScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'short'
      ORDER BY score DESC
      LIMIT 10
    `;

    const rawLongScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'long'
      ORDER BY score DESC
      LIMIT 10
    `;

    const rawVeniceScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'venice'
      ORDER BY score DESC
      LIMIT 10
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
    <div className="w-full h-full bg-[#008080] px-4 pb-4 relative flex flex-col items-center justify-center">
      {/* Title */}
      <div className="text-center text-white mb-4">
        {t(`이번 달(${monthNames.ko[currentMonth - 1]}) 랭킹`, `This Month (${monthNames.en[currentMonth - 1]}) Rankings`)}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {rankingTypes.map((type) => {
          const typeKey = type.key as "short" | "long" | "venice";
          const scores = rankings[typeKey];

          return (
            <DosWindow
              key={type.key}
              title={type.title}
              className="h-[380px]"
            >
              <div className="px-2 py-1.5 flex flex-col h-full">
                {scores.length === 0 ? (
                  <div className="text-center py-4 text-black flex-1 flex items-center justify-center">
                    {t("아직 기록이 없습니다", "No records yet")}
                  </div>
                ) : (
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-1 text-black pb-0.5">
                      <div className="w-6"></div>
                      <div className="flex-1">{t("이름", "Name")}</div>
                      <div className={typeKey === "venice" ? "w-12 text-right" : "w-10 text-right"}>
                        {typeKey === "venice" ? t("점수", "Score") : t("타수", "CPM")}
                      </div>
                    </div>
                    {/* Separator Line */}
                    <div className="mb-1">
                      <div className="border-b border-[#808080]"></div>
                      <div className="border-b border-white"></div>
                    </div>
                    {/* Scores */}
                    <div>
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
                            <div className={typeKey === "venice" ? "w-12 text-right" : "w-10 text-right"}>
                              {score.score.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Link
                  to={`/rankings/${type.key}`}
                  className="block mt-1 text-center text-black border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] bg-[#C0C0C0] hover:bg-[#D0D0D0] py-0.5"
                >
                  {t("전체 보기", "View All")}
                </Link>
              </div>
            </DosWindow>
          );
        })}
      </div>

      {/* 도스박물관 링크 */}
      <div className="mt-4 text-center">
        <a
          href="https://cafe.naver.com/olddos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00FFFF] hover:underline"
        >
          도스박물관 - 도스시대의 추억을 간직하는 곳
        </a>
      </div>
    </div>
  );
}
