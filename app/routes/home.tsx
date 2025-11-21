import { useState, useEffect, useRef } from "react";
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

function AnalogClock() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 56;
    const center = size / 2;
    const radius = center - 2;

    // Disable anti-aliasing
    ctx.imageSmoothingEnabled = false;

    // Clear
    ctx.fillStyle = "#FFFF00";
    ctx.fillRect(0, 0, size, size);

    // Hour marks (dots)
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6 - Math.PI / 2;
      const x = center + Math.cos(angle) * (radius - 2);
      const y = center + Math.sin(angle) * (radius - 2);
      ctx.fillStyle = "#000";
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    const hours = time.getHours() % 12;
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();

    // Hour hand
    const hourAngle = ((hours + minutes / 60) * Math.PI) / 6 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.cos(hourAngle) * (radius * 0.5), center + Math.sin(hourAngle) * (radius * 0.5));
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Minute hand
    const minuteAngle = ((minutes + seconds / 60) * Math.PI) / 30 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.cos(minuteAngle) * (radius * 0.7), center + Math.sin(minuteAngle) * (radius * 0.7));
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Second hand
    const secondAngle = (seconds * Math.PI) / 30 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.cos(secondAngle) * (radius * 0.8), center + Math.sin(secondAngle) * (radius * 0.8));
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "#000";
    ctx.fillRect(center - 1, center - 1, 2, 2);
  }, [time]);

  return (
    <canvas
      ref={canvasRef}
      width={56}
      height={56}
      className="border-l border-b border-black"
    />
  );
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
      {/* Analog Clock */}
      <div className="absolute -top-[20px] right-0 z-20">
        <AnalogClock />
      </div>

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
