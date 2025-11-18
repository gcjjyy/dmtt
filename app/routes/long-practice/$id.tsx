import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLoaderData, redirect } from "react-router";
import type { Route } from "./+types/$id";
import { useLanguage } from "~/contexts/LanguageContext";
import { loadLongText } from "~/lib/data-loader.server";
import {
  calculateTypingStats,
  calculateCorrectKeystrokes,
  formatTime,
  getTypingGrade,
  type TypingStats,
} from "~/lib/typing-engine";

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "ko") as "ko" | "en";

  const textData = await loadLongText(params.id, lang);

  if (!textData) {
    throw redirect("/long-practice");
  }

  return { textData, language: lang };
}

export default function LongPracticeTyping() {
  const { textData, language } = useLoaderData<typeof loader>();
  const { t } = useLanguage();

  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [allTypedLines, setAllTypedLines] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState<TypingStats | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentCPM, setCurrentCPM] = useState(0);

  // Session token for score submission
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Use refs to store latest values for interval
  const currentLineIndexRef = useRef(currentLineIndex);
  const allTypedLinesRef = useRef(allTypedLines);
  const typedTextRef = useRef(typedText);

  // Update refs when values change
  useEffect(() => {
    currentLineIndexRef.current = currentLineIndex;
    allTypedLinesRef.current = allTypedLines;
    typedTextRef.current = typedText;
  }, [currentLineIndex, allTypedLines, typedText]);

  // Filter out empty lines
  const targetLines = useMemo(() =>
    textData.content
      .split("\n")
      .map(line => line.trimEnd())
      .filter(line => line.length > 0),
    [textData.content]
  );

  // Pagination state and calculations
  const [currentPage, setCurrentPage] = useState(0);
  const CONTAINER_HEIGHT = 600; // max-h-[600px]
  const LINE_HEIGHT = 48; // 16px text + 16px typed + 16px margin
  const linesPerPage = Math.floor(CONTAINER_HEIGHT / LINE_HEIGHT);
  const totalPages = Math.ceil(targetLines.length / linesPerPage);

  // Calculate current page's line range
  const pageStartLine = currentPage * linesPerPage;
  const pageEndLine = Math.min((currentPage + 1) * linesPerPage, targetLines.length);

  const currentLine = targetLines[currentLineIndex] || "";

  // Request session token on mount
  useEffect(() => {
    fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "long" }),
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
  }, []);

  // Timer and real-time CPM update
  useEffect(() => {
    if (!startTime || isFinished) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedTime(elapsed);

      // 실시간 CPM 계산 (맞은 타수만 계산)
      const timeElapsed = (now - startTime) / 1000;

      // 지금까지 입력한 모든 텍스트의 맞은 타수 계산
      const idx = currentLineIndexRef.current;
      const allOriginalText = targetLines.slice(0, idx + 1).join("\n");
      const allTypedText = allTypedLinesRef.current.join("\n") + (allTypedLinesRef.current.length > 0 ? "\n" : "") + typedTextRef.current;
      const correctKeystrokes = calculateCorrectKeystrokes(allOriginalText, allTypedText);

      const cpm = timeElapsed > 0 ? (correctKeystrokes / timeElapsed) * 60 : 0;
      setCurrentCPM(Math.round(cpm));
    }, 100); // 100ms마다 업데이트

    return () => clearInterval(interval);
  }, [startTime, isFinished, targetLines]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentLineIndex]);

  // Auto-page change when line index changes
  useEffect(() => {
    const expectedPage = Math.floor(currentLineIndex / linesPerPage);
    if (expectedPage !== currentPage) {
      setCurrentPage(expectedPage);
    }
  }, [currentLineIndex, linesPerPage, currentPage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Start timer on first keypress
    if (!startTime && value.length > 0) {
      setStartTime(Date.now());
    }

    // 원본 줄의 글자수를 넘어가면 자동으로 다음 줄로
    if (value.length > currentLine.length) {
      // 원본 줄 길이만큼만 저장하고 다음 줄로
      const trimmedValue = value.substring(0, currentLine.length);
      handleNextLine(trimmedValue);
    } else {
      setTypedText(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 엔터를 누르면 다음 줄로 (입력한 내용이 있을 때만)
    if (e.key === "Enter" && typedText.length > 0) {
      e.preventDefault();
      handleNextLine(typedText);
    }

    // 백스페이스: 현재 줄이 비어있으면 이전 줄로 돌아가기
    if (e.key === "Backspace" && typedText.length === 0 && currentLineIndex > 0) {
      e.preventDefault();
      handlePreviousLine();
    }
  };

  const handlePreviousLine = () => {
    // 이전 줄로 돌아가기
    const previousLineText = allTypedLines[currentLineIndex - 1] || "";

    // 이전 줄의 마지막 글자 하나 제거
    const newText = previousLineText.slice(0, -1);

    // allTypedLines에서 마지막 항목 제거
    setAllTypedLines((prev) => prev.slice(0, -1));

    // 이전 줄로 인덱스 변경
    setCurrentLineIndex(currentLineIndex - 1);

    // 마지막 글자가 제거된 텍스트를 현재 입력으로 설정
    setTypedText(newText);
  };

  const handleNextLine = (currentTypedText: string = typedText) => {
    // 현재 입력한 텍스트 저장
    setAllTypedLines((prev) => [...prev, currentTypedText]);

    if (currentLineIndex < targetLines.length - 1) {
      setCurrentLineIndex(currentLineIndex + 1);
      setTypedText("");
    } else {
      // 모든 줄 완료
      finishPractice();
    }
  };

  const finishPractice = async () => {
    if (!startTime) return;

    const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
    const allOriginalText = targetLines.join("\n");
    let allTypedText = [...allTypedLines, typedText].join("\n");

    // 마지막 스페이스나 엔터 제거
    allTypedText = allTypedText.trimEnd();

    const calculatedStats = calculateTypingStats(allOriginalText, allTypedText, timeElapsed, "long");

    setStats(calculatedStats);
    setIsFinished(true);

    // Submit score to API
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
              originalText: allOriginalText,
              typedText: allTypedText,
              timeElapsed,
              score: calculatedStats.score,
              accuracy: calculatedStats.accuracy,
              cpm: calculatedStats.cpm,
              sentence: textData.title, // Store title as reference
            }),
          });
        } catch (err) {
          console.error("Failed to submit score:", err);
        }
      }
    }
  };

  const totalChars = targetLines.join("").length;
  const typedChars = allTypedLines.join("").length + typedText.length;
  const progress = (typedChars / totalChars) * 100;

  const renderLine = (line: string, lineIndex: number) => {
    const isCurrentLine = lineIndex === currentLineIndex;
    const isPastLine = lineIndex < currentLineIndex;
    const typedForThisLine = isPastLine ? allTypedLines[lineIndex] || "" : "";

    return (
      <div key={lineIndex} data-line={lineIndex} className="mb-4">
        {/* 원문 */}
        <div className="leading-4 mb-0 text-gray-400 dark:text-gray-600">
          {line}
        </div>
        {/* 입력한 텍스트 (항상 표시, 이전 줄들만 내용 있음) */}
        <div className="leading-4 mb-0 h-4">
          {isPastLine && typedForThisLine.split("").map((char, charIndex) => {
            const isCorrect = line[charIndex] === char;
            const className = isCorrect
              ? "text-gray-900 dark:text-gray-100"
              : "text-red-600 dark:text-red-400";

            return (
              <span key={charIndex} className={className}>
                {char === " " ? "\u00A0" : char}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  if (isFinished && stats) {
    const grade = getTypingGrade(stats.accuracy, stats.cpm);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-center mb-4 text-gray-900 dark:text-white">
              {t("연습 완료!", "Practice Complete!")}
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              {textData.title}
            </p>

            <div className="text-center mb-8">
              <div className="text-blue-600 dark:text-blue-400 mb-4">
                {grade}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {t("등급", "Grade")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-gray-600 dark:text-gray-400">
                  {t("정확도", "Accuracy")}
                </div>
                <div className="text-gray-900 dark:text-white">
                  {stats.accuracy}%
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-gray-600 dark:text-gray-400">
                  {t("타수", "CPM")}
                </div>
                <div className="text-gray-900 dark:text-white">
                  {stats.cpm}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-gray-600 dark:text-gray-400">
                  {t("소요 시간", "Time")}
                </div>
                <div className="text-gray-900 dark:text-white">
                  {formatTime(stats.timeElapsed)}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-gray-600 dark:text-gray-400">
                  {t("점수", "Score")}
                </div>
                <div className="text-gray-900 dark:text-white">
                  {stats.score.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                to="/long-practice"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg text-center"
              >
                {t("다른 글 선택", "Choose Another")}
              </Link>
              <Link
                to="/"
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg text-center"
              >
                {t("메인으로", "Home")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link
            to="/long-practice"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t("돌아가기", "Back")}
          </Link>
          <h1 className="text-gray-900 dark:text-white">
            {textData.title}
          </h1>
          <div className="flex gap-6 items-center">
            <div className="text-center">
              <div className="text-gray-600 dark:text-gray-400">
                {t("타수", "CPM")}
              </div>
              <div className="text-blue-600 dark:text-blue-400">
                {currentCPM}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600 dark:text-gray-400">
                {t("시간", "Time")}
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                {formatTime(elapsedTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
          <div ref={displayRef} className="h-[600px]">
            {/* 이전 줄들 (현재 페이지 내) */}
            {targetLines
              .slice(pageStartLine, currentLineIndex)
              .map((line, idx) => renderLine(line, pageStartLine + idx))}

            {/* 현재 줄 */}
            <div className="mb-4" data-line={currentLineIndex}>
              <div className="leading-4 mb-0 text-gray-400 dark:text-gray-600">
                {currentLine}
              </div>
              {/* 입력창 */}
              <div className="leading-4 mb-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={typedText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="w-full h-4 border-0 focus:outline-none bg-transparent text-gray-900 dark:text-white"
                  placeholder={t("여기에 입력하세요...", "Type here...")}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* 다음 줄들 (현재 페이지 내) */}
            {targetLines
              .slice(currentLineIndex + 1, pageEndLine)
              .map((line, idx) => renderLine(line, currentLineIndex + 1 + idx))}
          </div>

          <div className="mt-6 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-gray-600 dark:text-gray-400">
              {t("줄", "Line")} {currentLineIndex + 1} / {targetLines.length}
              {" · "}
              {t("페이지", "Page")} {currentPage + 1} / {totalPages}
              {" · "}
              {typedChars} / {totalChars} {t("글자", "chars")} ({progress.toFixed(1)}%)
            </div>
            <button
              onClick={() => handleNextLine()}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg"
            >
              {currentLineIndex === targetLines.length - 1
                ? t("완료", "Finish")
                : t("건너뛰기", "Skip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
