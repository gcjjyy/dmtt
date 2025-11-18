import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Link, useLoaderData } from "react-router";
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

export async function loader() {
  try {
    // Fetch top 5 scores for each type
    const shortScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'short'
      ORDER BY score DESC
      LIMIT 5
    `;

    const longScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'long'
      ORDER BY score DESC
      LIMIT 5
    `;

    const veniceScores = await sql<Score[]>`
      SELECT id, name, type, score, created_at, extra
      FROM scores
      WHERE type = 'venice'
      ORDER BY score DESC
      LIMIT 5
    `;

    return {
      rankings: {
        short: shortScores,
        long: longScores,
        venice: veniceScores,
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
  const { t, language } = useLanguage();
  const { rankings } = useLoaderData<typeof loader>();

  // Get username from localStorage (client-side only)
  const [username, setUsername] = useState("");

  useEffect(() => {
    const savedUsername = localStorage.getItem("typing-practice-username") || "";
    setUsername(savedUsername);
  }, []);

  const menuItems = [
    {
      to: `/short-practice?lang=${language}`,
      title: t("단문 연습", "Short Sentences"),
      desc: t("짧은 문장으로 연습하기", "Practice with short sentences"),
      icon: "📝",
    },
    {
      to: `/long-practice?lang=${language}`,
      title: t("장문 연습", "Long Texts"),
      desc: t("긴 글로 연습하기", "Practice with long texts"),
      icon: "📖",
    },
    {
      to: `/venice?lang=${language}`,
      title: t("베네치아 게임", "Venice Game"),
      desc: t("떨어지는 단어 게임", "Falling words game"),
      icon: "🎮",
    },
    {
      to: "/settings",
      title: t("설정", "Settings"),
      desc: t("언어 및 설정 변경", "Change language and settings"),
      icon: "⚙️",
    },
  ];

  const rankingTypes = [
    { key: "short", title: t("단문 연습", "Short Practice"), icon: "📝" },
    { key: "long", title: t("장문 연습", "Long Practice"), icon: "📖" },
    { key: "venice", title: t("베네치아 게임", "Venice Game"), icon: "🎮" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* User Info Bar */}
        <div className="flex justify-end items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="text-gray-900 dark:text-white">
              {username}{t("님", "")}
            </div>
            <Link
              to="/settings"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title={t("설정", "Settings")}
            >
              ⚙️
            </Link>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-gray-900 dark:text-white mb-4">
            {t("타자 연습", "Typing Practice")}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {t("한글과 영문 타자 실력을 향상시켜보세요", "Improve your Korean and English typing skills")}
          </p>
        </div>

        {/* Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-blue-500"
            >
              <div className="mb-4">{item.icon}</div>
              <h2 className="text-gray-900 dark:text-white mb-2">
                {item.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{item.desc}</p>
            </Link>
          ))}
        </div>

        {/* Rankings Section */}
        <div className="max-w-7xl mx-auto">
          <h2 className="text-gray-900 dark:text-white mb-8 text-center">
            🏆 {t("랭킹", "Rankings")}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {rankingTypes.map((type) => {
              const typeKey = type.key as "short" | "long" | "venice";
              const scores = rankings[typeKey];

              return (
                <div
                  key={type.key}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span>{type.icon}</span>
                    <h3 className="text-gray-900 dark:text-white">
                      {type.title}
                    </h3>
                  </div>

                  {scores.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {t("아직 기록이 없습니다", "No records yet")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scores.map((score, index) => (
                        <div
                          key={score.id}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            index === 0
                              ? "bg-yellow-50 dark:bg-yellow-900/20"
                              : index === 1
                              ? "bg-gray-100 dark:bg-gray-700/50"
                              : index === 2
                              ? "bg-orange-50 dark:bg-orange-900/20"
                              : "bg-gray-50 dark:bg-gray-700/30"
                          }`}
                        >
                          <div className="w-8 text-center">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 dark:text-white truncate">
                              {score.name}
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {score.extra?.accuracy && (
                                <span>{t("정확도", "Accuracy")} {score.extra.accuracy.toFixed(1)}%</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-600 dark:text-blue-400">
                              {score.score.toLocaleString()}
                            </div>
                            <div className="text-gray-500 dark:text-gray-500">
                              {t("타수", "CPM")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    to={`/rankings/${type.key}`}
                    className="block mt-4 text-center text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("전체 보기", "View All")} →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
