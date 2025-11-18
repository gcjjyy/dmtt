import { useState, useEffect, useRef } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/short-practice";
import { useLanguage } from "~/contexts/LanguageContext";
import { loadProverbs } from "~/lib/data-loader.server";
import {
  calculateTypingStats,
  calculateCorrectKeystrokes,
  formatTime,
  getTypingGrade,
  type TypingStats,
} from "~/lib/typing-engine";

export async function loader({ request }: Route.LoaderArgs) {
  // Get language from URL or default to Korean
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "ko") as "ko" | "en";

  // Load all proverbs for infinite mode
  const allProverbs = await loadProverbs(lang);

  return { proverbs: allProverbs, language: lang };
}

export default function ShortPractice() {
  const { proverbs, language } = useLoaderData<typeof loader>();
  const { t } = useLanguage();

  // Practice state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [allTypedTexts, setAllTypedTexts] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [sentenceStartTime, setSentenceStartTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState<TypingStats | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentCPM, setCurrentCPM] = useState(0);

  // Session and scoring state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [highestCPM, setHighestCPM] = useState(0);
  const [totalCPM, setTotalCPM] = useState(0);

  // Shuffled proverbs for infinite mode
  const [shuffledProverbs, setShuffledProverbs] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Use refs to store latest values for interval
  const currentIndexRef = useRef(currentIndex);
  const allTypedTextsRef = useRef(allTypedTexts);
  const typedTextRef = useRef(typedText);

  // Update refs when values change
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    allTypedTextsRef.current = allTypedTexts;
    typedTextRef.current = typedText;
  }, [currentIndex, allTypedTexts, typedText]);

  // Initialize session and shuffled proverbs
  useEffect(() => {
    // Initialize shuffled proverbs
    const shuffled = [...proverbs].sort(() => Math.random() - 0.5);
    setShuffledProverbs(shuffled);

    // Request session token (only once on mount)
    fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "short" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.token) {
          setSessionToken(data.token);
        }
      })
      .catch((err) => {
        console.error("Failed to create session:", err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProverb = shuffledProverbs[currentIndex % shuffledProverbs.length] || "";

  // Timer and real-time CPM update (only for current sentence)
  useEffect(() => {
    if (!sentenceStartTime || isFinished) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - sentenceStartTime) / 1000;

      // Calculate CPM for current sentence only
      const originalText = currentProverb;
      const correctKeystrokes = calculateCorrectKeystrokes(originalText, typedTextRef.current);

      const cpm = elapsed > 0 ? (correctKeystrokes / elapsed) * 60 : 0;
      setCurrentCPM(Math.round(cpm));
    }, 100); // 100ms마다 업데이트

    return () => clearInterval(interval);
  }, [sentenceStartTime, isFinished, currentProverb]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Start timer on first keypress of first sentence
    if (!startTime) {
      setStartTime(Date.now());
    }

    // Start sentence timer on first keypress of sentence
    if (!sentenceStartTime && value.length > 0) {
      setSentenceStartTime(Date.now());
    }

    setTypedText(value);

    // 원본 글자수를 넘어가면 자동으로 다음으로
    if (value.length > currentProverb.length) {
      handleNext();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 엔터를 누르면 다음으로 (입력한 내용이 있을 때만)
    if (e.key === "Enter" && typedText.length > 0) {
      e.preventDefault();
      handleNext();
    }
  };

  const handleNext = async () => {
    if (!sentenceStartTime || typedText.length === 0) return;

    // Calculate stats for this sentence
    const timeElapsed = Math.floor((Date.now() - sentenceStartTime) / 1000);
    if (timeElapsed === 0) return; // Prevent division by zero

    const sentenceStats = calculateTypingStats(
      currentProverb,
      typedText,
      timeElapsed,
      "short"
    );

    // Update cumulative stats
    setCompletedCount((prev) => prev + 1);
    setHighestCPM((prev) => Math.max(prev, sentenceStats.cpm));
    setTotalCPM((prev) => prev + sentenceStats.cpm);

    // Submit score to API
    if (sessionToken) {
      // Get username from localStorage
      const username = localStorage.getItem("typing-practice-username");

      if (username) {
        // Submit score
        try {
          await fetch("/api/score/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: sessionToken,
              name: username,
              originalText: currentProverb,
              typedText: typedText,
              timeElapsed,
              score: sentenceStats.score,
              accuracy: sentenceStats.accuracy,
              cpm: sentenceStats.cpm,
              sentence: currentProverb,
            }),
          });
        } catch (err) {
          console.error("Failed to submit score:", err);
        }
      }
    }

    // Move to next sentence (infinite mode)
    setCurrentIndex((prev) => prev + 1);
    setTypedText("");
    setSentenceStartTime(null);
    setCurrentCPM(0);

    // Re-shuffle when we've gone through all proverbs
    if ((currentIndex + 1) % shuffledProverbs.length === 0) {
      const reshuffled = [...proverbs].sort(() => Math.random() - 0.5);
      setShuffledProverbs(reshuffled);
    }
  };

  const renderText = () => {
    return (
      <div className="leading-relaxed">
        {currentProverb.split("").map((char, i) => {
          let className = "text-gray-400";

          if (i < typedText.length) {
            className =
              typedText[i] === char
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
          }

          return (
            <span key={i} className={className}>
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })}
      </div>
    );
  };

  const averageCPM = completedCount > 0 ? Math.round(totalCPM / completedCount) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t("돌아가기", "Back")}
          </Link>
          <div className="text-center">
            <div className="text-gray-600 dark:text-gray-400">
              {t("무한 연습 모드", "Infinite Mode")}
            </div>
          </div>
          <div className="w-20"></div>
        </div>

        {/* Cumulative Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-gray-600 dark:text-gray-400 mb-1">
              {t("완료", "Completed")}
            </div>
            <div className="text-gray-900 dark:text-white">
              {completedCount}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-gray-600 dark:text-gray-400 mb-1">
              {t("현재 타수", "Current CPM")}
            </div>
            <div className="text-blue-600 dark:text-blue-400">
              {currentCPM}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-gray-600 dark:text-gray-400 mb-1">
              {t("최고 타수", "Highest CPM")}
            </div>
            <div className="text-green-600 dark:text-green-400">
              {highestCPM}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-gray-600 dark:text-gray-400 mb-1">
              {t("평균 타수", "Average CPM")}
            </div>
            <div className="text-purple-600 dark:text-purple-400">
              {averageCPM}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-xl">
          <div className="mb-8 text-center">{renderText()}</div>

          <input
            ref={inputRef}
            type="text"
            value={typedText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={(e) => e.preventDefault()}
            className="w-full p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder={t("여기에 입력하세요...", "Type here...")}
            autoComplete="off"
            spellCheck={false}
          />

          <div className="mt-8 flex justify-between items-center">
            <div className="text-gray-600 dark:text-gray-400">
              {t(
                "문장을 입력하고 엔터를 누르면 자동으로 점수가 기록됩니다",
                "Type the sentence and press Enter to automatically record your score"
              )}
            </div>
            <button
              onClick={handleNext}
              disabled={typedText.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {t("다음", "Next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
