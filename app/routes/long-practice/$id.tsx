import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLoaderData, redirect, useNavigate } from "react-router";
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
  const navigate = useNavigate();

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
  const CONTAINER_HEIGHT = 288; // h-72 = 288px, shows 6 lines
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
      const { correct: correctKeystrokes } = calculateCorrectKeystrokes(allOriginalText, allTypedText);

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
    // ESC를 누르면 장문 선택 페이지로
    if (e.key === "Escape") {
      e.preventDefault();
      navigate(`/long-practice?lang=${language}`);
      return;
    }

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
    const grade = getTypingGrade(calculatedStats.accuracy, calculatedStats.cpm);

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
              type: "long",
              score: calculatedStats.score,
              accuracy: calculatedStats.accuracy,
              cpm: calculatedStats.cpm,
              wpm: calculatedStats.wpm,
              timeElapsed: timeElapsed,
              grade: grade,
              totalLines: targetLines.length,
              completionRate: 100,
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

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const renderLine = (line: string, lineIndex: number) => {
    const isPastLine = lineIndex < currentLineIndex;
    const typedForThisLine = isPastLine ? allTypedLines[lineIndex] || "" : "";

    return (
      <div key={lineIndex} data-line={lineIndex} className="mb-4">
        {/* 원문 */}
        <div className="leading-4 mb-0 text-black">
          {line}
        </div>
        {/* 입력한 텍스트 (항상 표시, 이전 줄들만 내용 있음) */}
        <div className="leading-4 mb-0 h-4 flex items-center">
          {isPastLine && typedForThisLine.split("").map((char, charIndex) => {
            const isCorrect = line[charIndex] === char;
            const className = isCorrect ? "text-black" : "text-red-600";

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
      <div className="w-full h-full bg-[#008080] flex items-center justify-center p-4">
        {/* DOS Result Window */}
        <div className="w-[640px] bg-[#C0C0C0] border border-black flex flex-col">
          {/* Raised 3D effect */}
          <div className="w-full border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex flex-col">
            {/* Title */}
            <div className="text-[#0000AA] py-0.5 flex items-center justify-center">
              {t("연습 완료!", "Practice Complete!")}
            </div>

            {/* Inner Sunken Box */}
            <div className="mx-1.5 mb-1.5 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0] p-6">
              {/* Text Title */}
              <div className="text-center text-black mb-6">
                {textData.title}
              </div>

              {/* Grade */}
              <div className="text-center mb-6">
                <div className="text-4xl text-[#0000AA] mb-2">{grade}</div>
                <div className="text-black">{t("등급", "Grade")}</div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 bg-[#C0C0C0]">
                  <div className="text-black text-sm">{t("정확도", "Accuracy")}</div>
                  <div className="text-black text-xl">{stats.accuracy}%</div>
                </div>
                <div className="border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 bg-[#C0C0C0]">
                  <div className="text-black text-sm">{t("타수", "CPM")}</div>
                  <div className="text-black text-xl">{stats.cpm}</div>
                </div>
                <div className="border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 bg-[#C0C0C0]">
                  <div className="text-black text-sm">{t("소요 시간", "Time")}</div>
                  <div className="text-black text-xl">{formatTime(stats.timeElapsed)}</div>
                </div>
                <div className="border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 bg-[#C0C0C0]">
                  <div className="text-black text-sm">{t("점수", "Score")}</div>
                  <div className="text-black text-xl">{stats.score.toLocaleString()}</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <Link
                  to="/long-practice"
                  className="flex-1 text-center text-black border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] bg-[#C0C0C0] hover:bg-[#D0D0D0] py-2"
                >
                  {t("다른 글 선택", "Choose Another")}
                </Link>
                <Link
                  to="/"
                  className="flex-1 text-center text-black border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] bg-[#C0C0C0] hover:bg-[#D0D0D0] py-2"
                >
                  {t("메인으로", "Home")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#008080] flex items-center justify-center p-4">
      {/* DOS Window */}
      <div
        className="w-[800px] h-[480px] bg-[#C0C0C0] border border-black flex flex-col"
        onClick={handleContainerClick}
      >
        {/* Raised 3D effect */}
        <div className="w-full h-full border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex flex-col">
          {/* Title */}
          <div className="text-[#0000AA] py-0.5 flex items-center justify-center">
            {textData.title}
          </div>

          {/* Inner Sunken Box */}
          <div className="flex-1 mx-1.5 mb-1.5 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0] flex flex-col">
            {/* Text Area */}
            <div className="flex-1 px-6 py-4 overflow-hidden">
              <div ref={displayRef} className="h-72">
                {/* 이전 줄들 (현재 페이지 내) */}
                {targetLines
                  .slice(pageStartLine, currentLineIndex)
                  .map((line, idx) => renderLine(line, pageStartLine + idx))}

                {/* 현재 줄 */}
                <div className="mb-4" data-line={currentLineIndex}>
                  <div className="leading-4 mb-0 text-black">
                    {currentLine}
                  </div>
                  {/* 입력 표시 */}
                  <div className="leading-4 mb-0 h-4 flex items-center">
                    {typedText.split("").map((char, i) => {
                      const isCorrect = char === currentLine[i];
                      return (
                        <span key={i} className={isCorrect ? "text-black" : "text-red-600"}>
                          {char === " " ? "\u00A0" : char}
                        </span>
                      );
                    })}
                    <span className="inline-block w-2 h-5 bg-[#808080] animate-pulse"></span>
                  </div>
                </div>

                {/* 다음 줄들 (현재 페이지 내) */}
                {targetLines
                  .slice(currentLineIndex + 1, pageEndLine)
                  .map((line, idx) => renderLine(line, currentLineIndex + 1 + idx))}
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
                  {t("진행률", "Progress")}
                </div>
                <div className="flex-1 text-center py-0.5 text-black">
                  {t("시간", "Time")}
                </div>
                <div className="flex-1 text-center py-0.5 text-black">
                  {t("페이지", "Page")}
                </div>
              </div>

              {/* Bottom Row - Gauges */}
              <div className="h-px bg-[#808080]"></div>
              <div className="flex border-t border-l border-[#EFEFEF]">
                {/* Speed gauge */}
                <div className="flex-[3] grid grid-cols-4 gap-y-0 px-2 pt-4 pb-4">
                  {/* Row 1: Empty + Scale */}
                  <div></div>
                  <div className="col-span-3 flex items-end justify-between pl-4">
                    {[...Array(13)].map((_, i) => (
                      <div key={i} className={`w-px bg-black ${i % 2 === 0 ? 'h-3' : 'h-1.5'}`}></div>
                    ))}
                  </div>

                  {/* Row 2: 현재 속도 + Gauge */}
                  <div className="text-black text-right pr-2 whitespace-nowrap flex items-center justify-end">
                    {t("현재 속도", "Current")}
                  </div>
                  <div className="col-span-3 flex items-center">
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

                {/* Progress */}
                <div className="flex-1 flex items-center justify-center text-black">
                  {progress.toFixed(1)}%
                </div>

                {/* Time */}
                <div className="flex-1 flex items-center justify-center text-black">
                  {formatTime(elapsedTime)}
                </div>

                {/* Page */}
                <div className="flex-1 flex items-center justify-center text-black">
                  {currentPage + 1}/{totalPages}
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
