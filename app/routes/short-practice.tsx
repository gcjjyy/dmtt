import { useState, useEffect, useRef } from "react";
import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/short-practice";
import { useLanguage } from "~/contexts/LanguageContext";
import { loadProverbs } from "~/lib/data-loader.server";
import { calculateTypingStats, calculateCorrectKeystrokes } from "~/lib/typing-engine";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "ko") as "ko" | "en";
  const allProverbs = await loadProverbs(lang);
  return { proverbs: allProverbs, language: lang };
}

export default function ShortPractice() {
  const { proverbs } = useLoaderData<typeof loader>();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [sentenceStartTime, setSentenceStartTime] = useState<number | null>(null);
  const [currentCPM, setCurrentCPM] = useState(0);
  const [highestCPM, setHighestCPM] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [shuffledProverbs, setShuffledProverbs] = useState<string[]>([]);
  const [totalSentences, setTotalSentences] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const typedTextRef = useRef(typedText);

  useEffect(() => {
    typedTextRef.current = typedText;
  }, [typedText]);

  useEffect(() => {
    const shuffled = [...proverbs].sort(() => Math.random() - 0.5);
    setShuffledProverbs(shuffled);

    fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "short" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.token) setSessionToken(data.token);
      })
      .catch((err) => console.error("Failed to create session:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProverb = shuffledProverbs[currentIndex % shuffledProverbs.length] || "";

  // 실시간 CPM 업데이트
  useEffect(() => {
    if (!sentenceStartTime) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - sentenceStartTime) / 1000;
      const typed = typedTextRef.current;

      if (typed.length > 0) {
        const { correct: correctKeystrokes, total: totalKeystrokes } = calculateCorrectKeystrokes(currentProverb, typed);
        const cpm = elapsed > 0 ? Math.round((correctKeystrokes / elapsed) * 60) : 0;
        setCurrentCPM(cpm);
        setCurrentAccuracy(totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 0);
      } else {
        setCurrentCPM(0);
        setCurrentAccuracy(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sentenceStartTime, currentProverb]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentIndex]);

  // ESC key handler to go home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (!sentenceStartTime && value.length > 0) {
      setSentenceStartTime(Date.now());
    }

    setTypedText(value);

    if (value.length > currentProverb.length) {
      handleNext();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // kimtaja 방식: 원본 길이 이상 입력해야 엔터로 넘어감
    if (e.key === "Enter" && typedText.length >= currentProverb.length) {
      e.preventDefault();
      handleNext();
    }
  };

  const handleNext = async () => {
    if (!sentenceStartTime || typedText.length === 0) return;

    const timeElapsed = (Date.now() - sentenceStartTime) / 1000;
    if (timeElapsed < 0.1) return;

    const sentenceStats = calculateTypingStats(currentProverb, typedText, timeElapsed, "short");

    // 현재 속도와 정확도를 최종 계산값으로 업데이트
    setCurrentCPM(sentenceStats.cpm);
    setCurrentAccuracy(sentenceStats.accuracy);
    setHighestCPM((prev) => Math.max(prev, sentenceStats.cpm));
    setTotalSentences((prev) => prev + 1);

    if (sessionToken) {
      const username = localStorage.getItem("typing-practice-username");
      if (username) {
        try {
          await fetch("/api/score/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: sessionToken,
              name: username,
              type: "short",
              score: sentenceStats.score,
              accuracy: sentenceStats.accuracy,
              cpm: sentenceStats.cpm,
              wpm: sentenceStats.wpm,
              totalChars: sentenceStats.totalChars,
              correctChars: sentenceStats.correctChars,
              timeElapsed: timeElapsed,
              totalSentences: totalSentences + 1,
            }),
          });
        } catch (err) {
          console.error("Failed to submit score:", err);
        }
      }
    }

    setCurrentIndex((prev) => prev + 1);
    setTypedText("");
    setSentenceStartTime(null);
    // CPM과 정확도는 새 문장 입력 시작할 때 리셋

    if ((currentIndex + 1) % shuffledProverbs.length === 0) {
      const reshuffled = [...proverbs].sort(() => Math.random() - 0.5);
      setShuffledProverbs(reshuffled);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="w-full h-full bg-[#008080] flex items-center justify-center p-4">
      {/* Window */}
      <div
        className="w-[640px] h-[280px] bg-[#C0C0C0] border border-black flex flex-col"
        onClick={handleContainerClick}
      >
        {/* Raised 3D effect */}
        <div className="w-full h-full border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex flex-col">
          {/* Title */}
          <div className="text-[#0000AA] py-0.5 flex items-center justify-center">
            {t("단문          연습", "Short          Practice")}
          </div>

          {/* Inner Sunken Box */}
          <div className="flex-1 mx-1.5 mb-1.5 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0] flex flex-col">
            {/* Sentence Area */}
            <div className="flex-1 flex flex-col justify-center px-6 py-4">
              {/* Original Text */}
              <div className="text-black mb-1">
                {currentProverb}
              </div>

              {/* Typed Text / Cursor */}
              <div className="h-6">
                {typedText.split("").map((char, i) => {
                  const isCorrect = char === currentProverb[i];
                  return (
                    <span key={i} className={isCorrect ? "text-black" : "text-red-600"}>
                      {char === " " ? "\u00A0" : char}
                    </span>
                  );
                })}
                <span className="inline-block w-2 h-5 bg-[#808080] animate-pulse"></span>
              </div>
            </div>

            {/* Stats Panel */}
            <div className="mx-4 mb-4 border border-[#808080]">
              {/* Top Row - Headers */}
              <div className="flex border-t border-l border-[#EFEFEF]">
                <div className="flex-[3] text-center py-0.5 text-black">
                  {t("속도(타수/분)", "Speed(CPM)")}
                </div>
                <div className="flex-1 text-center py-0.5 text-black">
                  {t("정확도", "Accuracy")}
                </div>
              </div>

              {/* Bottom Row - Gauges */}
              <div className="h-px bg-[#808080]"></div>
              <div className="flex border-t border-l border-[#EFEFEF]">
                {/* Left 3 columns - Speed gauges (4x3 grid) */}
                <div className="flex-[3] grid grid-cols-4 gap-y-0 px-2 pt-4 pb-4">
                  {/* Row 1: Empty + Scale */}
                  <div></div>
                  <div className="col-span-3 flex items-end justify-between pl-4">
                    {[...Array(13)].map((_, i) => (
                      <div key={i} className={`w-px bg-black ${i % 2 === 0 ? 'h-3' : 'h-1.5'}`}></div>
                    ))}
                  </div>

                  {/* Row 2: 최고 속도 + Gauge */}
                  <div className="text-black text-right pr-2 whitespace-nowrap flex items-center justify-end">
                    {t("최고 속도", "Best")}
                  </div>
                  <div className="col-span-3 flex items-center">
                    <div className="w-full h-4 bg-white border border-black relative">
                      <div
                        className="absolute top-0 left-0 h-full bg-[#0000AA]"
                        style={{ width: `calc(${(1 - Math.min(highestCPM / 700, 1)) * 16}px + ${Math.min(highestCPM / 700, 1) * 100}%)` }}
                      ></div>
                      <span className="absolute left-0.5 top-0 h-full flex items-center text-white z-10">
                        {highestCPM}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: 현재 속도 + Gauge */}
                  <div className="text-black text-right pr-2 whitespace-nowrap flex items-center justify-end mt-2">
                    {t("현재 속도", "Current")}
                  </div>
                  <div className="col-span-3 flex items-center mt-2">
                    <div className="w-full h-4 bg-white border border-black relative">
                      <div
                        className="absolute top-0 left-0 h-full bg-[#0000AA]"
                        style={{ width: `calc(${(1 - Math.min(currentCPM / 700, 1)) * 16}px + ${Math.min(currentCPM / 700, 1) * 100}%)` }}
                      ></div>
                      <span className="absolute left-0.5 top-0 h-full flex items-center text-white z-10">
                        {currentCPM}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right 1 column - Accuracy */}
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-2xl text-black">{currentAccuracy}</span>
                  <span className="text-xl text-black">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Input */}
        <input
          ref={inputRef}
          type="text"
          value={typedText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={(e) => e.preventDefault()}
          className="absolute opacity-0 pointer-events-none"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
