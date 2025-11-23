import { useState, useEffect, useRef } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/venice";
import { useLanguage } from "~/contexts/LanguageContext";
import { useGameStatus } from "~/contexts/GameStatusContext";
import { loadWords } from "~/lib/data-loader.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "ko") as "ko" | "en";

  const words = await loadWords(lang);

  return { words, language: lang };
}

interface FallingWord {
  id: number;
  word: string;
  x: number;
  y: number;
  speed: number;
  isVirus?: boolean;
  isHidden?: boolean; // For 숨바꼭질 바이러스
}

type VirusEffect =
  | "sweep" // 싹쓸이
  | "freeze" // 마취
  | "heal" // 재건
  | "speedup" // 날쌘
  | "slowdown" // 굼벵이
  | "hide" // 숨바꼭질
  | "flood" // 패거리
  | "mine" // 지뢰
  | "aids"; // 에이즈

interface Mine {
  x: number;
  y: number;
}

export default function VeniceGame() {
  const { words, language } = useLoaderData<typeof loader>();
  const { t } = useLanguage();
  const { setStatusMessage } = useGameStatus();

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bricks, setBricks] = useState(12);
  const [level, setLevel] = useState(1);
  const [waitingForStart, setWaitingForStart] = useState(true);
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [inputValue, setInputValue] = useState("");
  const nextWordIdRef = useRef(0);
  const [mines, setMines] = useState<Mine[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isAidsInfected, setIsAidsInfected] = useState(false);
  const [virusMessage, setVirusMessage] = useState<string | null>(null);

  // Score submission tracking
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [wordsCaught, setWordsCaught] = useState(0);
  const [wordsMissed, setWordsMissed] = useState(0);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gameLoopIntervalRef = useRef<number | undefined>(undefined);
  const spawnCounterRef = useRef(0);
  const isProcessingCollisionRef = useRef(false);
  const cachedSurvivingWordsRef = useRef<FallingWord[] | null>(null);

  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 528;
  const WAVE_HEIGHT = 16;
  const BRICK_HEIGHT = 64; // 4 rows × 16px
  const INPUT_HEIGHT = 48;
  const WAVE_TOP = GAME_HEIGHT - WAVE_HEIGHT; // 512
  const BRICK_TOP = GAME_HEIGHT - BRICK_HEIGHT; // 464
  const INPUT_TOP = GAME_HEIGHT - BRICK_HEIGHT - INPUT_HEIGHT; // 416
  const BASE_SPEED = 1;

  // Spacebar handler to start game
  useEffect(() => {
    const handleSpace = (e: KeyboardEvent) => {
      if (e.code === "Space" && waitingForStart && !gameStarted) {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, [waitingForStart, gameStarted]);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      inputRef.current?.focus();

      // Clear any existing interval first
      if (gameLoopIntervalRef.current) {
        clearInterval(gameLoopIntervalRef.current);
      }

      // Reset spawn counter when starting/restarting
      spawnCounterRef.current = 0;

      // Game loop interval - speed increases with level
      // Level 1: 1초, Level 8: 0.5초
      const loopDelay = Math.max(500, 1000 - (level - 1) * (500 / 7));
      gameLoopIntervalRef.current = setInterval(() => {
        gameLoop();
      }, loopDelay) as unknown as number;

      return () => {
        if (gameLoopIntervalRef.current) {
          clearInterval(gameLoopIntervalRef.current);
        }
      };
    } else {
      // Game not started or over - clear interval
      if (gameLoopIntervalRef.current) {
        clearInterval(gameLoopIntervalRef.current);
      }
    }
  }, [gameStarted, gameOver, level]);

  // Submit score when game is over
  useEffect(() => {
    const submitScore = async () => {
      if (!gameOver || !sessionToken || !gameStartTime) return;

      const username = localStorage.getItem("typing-practice-username");
      if (!username) return;

      const gameDuration = (Date.now() - gameStartTime) / 1000; // seconds
      const finalAccuracy = score > 0 ? Math.min(100, (score / (score + bricks * 100)) * 100) : 100;

      try {
        await fetch("/api/score/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: sessionToken,
            name: username,
            type: "venice",
            score: score,
            accuracy: finalAccuracy,
            level: level,
            wordsCaught: wordsCaught,
            wordsMissed: wordsMissed,
            gameDuration: gameDuration,
            livesRemaining: bricks,
          }),
        });
      } catch (err) {
        console.error("Failed to submit score:", err);
      }
    };

    submitScore();
  }, [gameOver, sessionToken, gameStartTime, score, bricks, level, wordsCaught, wordsMissed]);

  // Update status bar message
  useEffect(() => {
    let message = "";

    if (waitingForStart && !gameStarted) {
      message = t("스페이스바를 눌러 시작하세요", "Press Space to Start");
    } else if (virusMessage) {
      message = virusMessage;
    } else if (isFrozen) {
      message = `❄️ ${t("마취 상태", "Frozen")}`;
    } else if (isAidsInfected) {
      message = `⚠️ ${t("에이즈 감염 상태", "AIDS Infected")}`;
    }

    setStatusMessage(message);

    // Clear status message when component unmounts
    return () => setStatusMessage("");
  }, [waitingForStart, gameStarted, virusMessage, isFrozen, isAidsInfected, t, setStatusMessage]);

  const spawnNewWord = () => {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const isVirus = Math.random() < 0.15; // 15% 확률로 바이러스

    const newWord: FallingWord = {
      id: nextWordIdRef.current,
      word: randomWord,
      x: Math.random() * (GAME_WIDTH - 100),
      y: 0,
      speed: (BASE_SPEED + level * 0.2) * speedMultiplier,
      isVirus,
    };

    nextWordIdRef.current += 1;
    setFallingWords((prev) => [...prev, newWord]);
  };

  const triggerVirusEffect = (x: number, y: number) => {
    const virusEffects: VirusEffect[] = [
      "sweep", "freeze", "heal", "speedup", "slowdown",
      "hide", "flood", "mine", "aids"
    ];

    // 재건은 레어하게 (5% 확률로만)
    const weights = [15, 15, 5, 10, 15, 10, 15, 10, 5];
    let totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    let selectedEffect: VirusEffect = "sweep";
    for (let i = 0; i < virusEffects.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedEffect = virusEffects[i];
        break;
      }
    }

    applyVirusEffect(selectedEffect, x, y);
  };

  const applyVirusEffect = (effect: VirusEffect, x: number, y: number) => {
    switch (effect) {
      case "sweep":
        setVirusMessage(t("싹쓸이 바이러스!", "Sweep Virus!"));
        setFallingWords([]);
        break;

      case "freeze":
        setVirusMessage(t("마취 바이러스!", "Freeze Virus!"));
        setIsFrozen(true);
        setTimeout(() => setIsFrozen(false), 3000);
        break;

      case "heal":
        setVirusMessage(t("재건 바이러스!", "Heal Virus!"));
        setBricks(12);
        break;

      case "speedup":
        setVirusMessage(t("날쌘 바이러스!", "Speed Up Virus!"));
        setSpeedMultiplier(1.5);
        setTimeout(() => setSpeedMultiplier(1), 5000);
        break;

      case "slowdown":
        setVirusMessage(t("굼벵이 바이러스!", "Slow Down Virus!"));
        setSpeedMultiplier(0.5);
        setTimeout(() => setSpeedMultiplier(1), 5000);
        break;

      case "hide":
        setVirusMessage(t("숨바꼭질 바이러스!", "Hide Virus!"));
        setFallingWords((prev) =>
          prev.map((w) => ({ ...w, isHidden: true }))
        );
        setTimeout(() => {
          setFallingWords((prev) =>
            prev.map((w) => ({ ...w, isHidden: false }))
          );
        }, 4000);
        break;

      case "flood":
        setVirusMessage(t("패거리 바이러스!", "Flood Virus!"));
        const newWords: FallingWord[] = [];
        for (let i = 0; i < 10; i++) {
          const randomWord = words[Math.floor(Math.random() * words.length)];
          newWords.push({
            id: nextWordIdRef.current + i,
            word: randomWord,
            x: Math.random() * (GAME_WIDTH - 100),
            y: -i * 30,
            speed: (BASE_SPEED + level * 0.2) * speedMultiplier,
          });
        }
        nextWordIdRef.current += 10;
        setFallingWords((prev) => [...prev, ...newWords]);
        break;

      case "mine":
        setVirusMessage(t("지뢰 바이러스!", "Mine Virus!"));
        setMines((prev) => [...prev, { x, y }]);
        break;

      case "aids":
        setVirusMessage(t("에이즈 바이러스 퇴치!", "AIDS Virus Defeated!"));
        break;
    }

    // 메시지 자동 제거
    setTimeout(() => setVirusMessage(null), 2000);
  };

  const checkCollisions = (words: FallingWord[]): { surviving: FallingWord[]; removed: FallingWord[] } => {
    console.log(`🔍 [checkCollisions] 시작 - 단어 수: ${words.length}, INPUT_TOP: ${INPUT_TOP}, WAVE_TOP: ${WAVE_TOP}`);

    let remaining = [...words];
    const removed: FallingWord[] = [];

    // 1. 지뢰 충돌 체크
    const beforeMineCheck = remaining.length;
    remaining = remaining.filter((word) => {
      const hitMine = mines.some(
        (mine) =>
          Math.abs(word.x - mine.x) < 50 && Math.abs(word.y - mine.y) < 30
      );
      if (hitMine) {
        console.log(`💣 [checkCollisions] 지뢰 충돌: ${word.word} at y=${word.y}`);
        removed.push(word);
        return false;
      }
      return true;
    });
    if (beforeMineCheck !== remaining.length) {
      console.log(`💣 [checkCollisions] 지뢰 충돌로 제거: ${beforeMineCheck - remaining.length}개`);
    }

    // 2. 입력박스 충돌 체크
    const INPUT_BOX_X = (GAME_WIDTH - 128) / 2;
    const INPUT_BOX_WIDTH = 128;
    const INPUT_BOX_BOTTOM = INPUT_TOP + INPUT_HEIGHT;
    const beforeInputCheck = remaining.length;

    remaining = remaining.filter((word) => {
      const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(word.word);
      const wordWidth = word.word.length * (isKorean ? 16 : 8);

      const verticalCollision = word.y >= INPUT_TOP && word.y < INPUT_BOX_BOTTOM;
      const horizontalCollision = !(
        word.x + wordWidth < INPUT_BOX_X ||
        word.x > INPUT_BOX_X + INPUT_BOX_WIDTH
      );

      if (verticalCollision && horizontalCollision) {
        console.log(`📦 [checkCollisions] 입력박스 충돌: ${word.word} at y=${word.y} (INPUT_TOP=${INPUT_TOP}, INPUT_BOX_BOTTOM=${INPUT_BOX_BOTTOM})`);
        removed.push(word);
        return false;
      }
      return true;
    });
    if (beforeInputCheck !== remaining.length) {
      console.log(`📦 [checkCollisions] 입력박스 충돌로 제거: ${beforeInputCheck - remaining.length}개`);
    }

    // 3. 물결 도달 체크
    const beforeWaveCheck = remaining.length;
    remaining = remaining.filter((word) => {
      if (word.y >= WAVE_TOP) {
        console.log(`🌊 [checkCollisions] 물결 도달: ${word.word} at y=${word.y} (WAVE_TOP=${WAVE_TOP})`);
        removed.push(word);
        return false;
      }
      return true;
    });
    if (beforeWaveCheck !== remaining.length) {
      console.log(`🌊 [checkCollisions] 물결 도달로 제거: ${beforeWaveCheck - remaining.length}개`);
    }

    console.log(`🔍 [checkCollisions] 완료 - 생존: ${remaining.length}, 제거: ${removed.length}`);
    return { surviving: remaining, removed };
  };

  const gameLoop = () => {
    console.log("🔄 [gameLoop] 시작");

    // 마취 상태면 게임 로직 실행 안 함
    if (isFrozen) {
      console.log("❄️ [gameLoop] 마취 상태 - 스킵");
      return;
    }

    // 1. 단어 생성 (카운터 기반)
    spawnCounterRef.current += 1;
    const spawnInterval = Math.max(2, 4 - level * 0.3); // 틱 단위
    if (spawnCounterRef.current >= spawnInterval) {
      spawnNewWord();
      spawnCounterRef.current = 0;
      console.log("✨ [gameLoop] 새 단어 생성");
    }

    // 2. 모든 단어 이동 및 충돌 체크 - 모든 처리를 updater 내부에서 수행
    setFallingWords((prev) => {
      // Strict Mode 중복 실행 방지 - 캐시된 결과 반환
      if (isProcessingCollisionRef.current && cachedSurvivingWordsRef.current) {
        console.log("⚠️ [gameLoop] 중복 실행 감지 - 캐시된 결과 반환");
        return cachedSurvivingWordsRef.current;
      }

      console.log(`📦 [gameLoop] 이동 전 단어 수: ${prev.length}`);

      // 단어 이동
      const movedWords = prev.map((word) => ({
        ...word,
        y: word.y + 16,
      }));
      console.log(`🚀 [gameLoop] 이동 후 단어들:`, movedWords.map(w => ({ word: w.word, y: w.y, isVirus: w.isVirus })));

      // 충돌 체크
      const { surviving, removed } = checkCollisions(movedWords);
      console.log(`✅ [gameLoop] 충돌 체크 완료 - 생존: ${surviving.length}, 제거: ${removed.length}`);
      console.log(`❌ [gameLoop] 제거된 단어들:`, removed.map(w => ({ word: w.word, y: w.y, isVirus: w.isVirus })));

      // 캐시에 저장
      cachedSurvivingWordsRef.current = surviving;

      // 3. 제거된 단어에 따른 처리
      if (removed.length > 0) {
        isProcessingCollisionRef.current = true;
        console.log(`📋 [gameLoop] 제거된 단어 처리 시작: ${removed.length}개`);

        // 지뢰로 제거된 단어는 점수 추가
        const mineHits = removed.filter((word) =>
          mines.some((mine) =>
            Math.abs(word.x - mine.x) < 50 && Math.abs(word.y - mine.y) < 30
          )
        );
        if (mineHits.length > 0) {
          const mineScore = mineHits.reduce((sum, w) => sum + w.word.length * 5, 0);
          setScore((prev) => prev + mineScore);
          console.log(`💣 [gameLoop] 지뢰 맞은 단어: ${mineHits.length}개, 점수: +${mineScore}`);
        }

        // 입력박스 또는 물결에 도달한 단어는 벽돌 감소
        const damagingWords = removed.filter(
          (w) => !w.isVirus || isAidsInfected
        );
        console.log(`💥 [gameLoop] 데미지 주는 단어 필터링:`, {
          removed: removed.map(w => ({ word: w.word, isVirus: w.isVirus })),
          isAidsInfected,
          damagingWords: damagingWords.map(w => ({ word: w.word, isVirus: w.isVirus })),
          count: damagingWords.length
        });

        if (damagingWords.length > 0) {
          console.log(`🧱 [gameLoop] 벽돌 감소 실행! 데미지 단어 수: ${damagingWords.length}`);
          setWordsMissed((prev) => prev + damagingWords.length);
          setBricks((prevBricks) => {
            const newBricks = prevBricks - damagingWords.length;
            console.log(`🧱 [gameLoop] setBricks - 이전: ${prevBricks}, 감소량: ${damagingWords.length}, 새 값: ${newBricks}`);
            if (newBricks <= 0) {
              console.log("💀 [gameLoop] 게임 오버!");
              setGameOver(true);
            }
            return Math.max(0, newBricks);
          });
        } else {
          console.log("⚠️ [gameLoop] 바이러스만 제거됨 - 벽돌 감소 안됨");
        }

        // 에이즈 바이러스 체크 - 바이러스를 무시하고 보냈는지
        const ignoredViruses = removed.filter((w) => w.isVirus && w.y >= WAVE_TOP);
        if (ignoredViruses.length > 0 && ignoredViruses.some((w) => w.word.includes("AIDS") || Math.random() < 0.3)) {
          setIsAidsInfected(true);
          setVirusMessage(t("에이즈 바이러스 감염!", "AIDS Infected!"));
          setTimeout(() => setVirusMessage(null), 2000);
          console.log("☣️ [gameLoop] 에이즈 바이러스 감염!");
        }

        // 다음 틱에서 플래그와 캐시 리셋
        setTimeout(() => {
          isProcessingCollisionRef.current = false;
          cachedSurvivingWordsRef.current = null;
        }, 0);
      }

      return surviving;
    });

    console.log("✅ [gameLoop] 완료\n");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 스페이스바가 아닌 일반 입력만 처리
    if (!value.endsWith(" ")) {
      setInputValue(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 스페이스바로 단어 제출
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();

      const value = inputValue.trim();
      if (!value) return;

      // Check if any word matches
      const matchedWord = fallingWords.find((w) => w.word === value);
      if (matchedWord) {
        // Remove the matched word
        setFallingWords((prev) => prev.filter((w) => w.id !== matchedWord.id));

        // 바이러스 단어인 경우 효과 발동
        if (matchedWord.isVirus) {
          triggerVirusEffect(matchedWord.x, matchedWord.y);
        }

        setScore((prev) => prev + matchedWord.word.length * 10);
        setWordsCaught((prev) => prev + 1);
        setInputValue("");

        // Level up every 500 points
        if ((score + matchedWord.word.length * 10) % 500 === 0) {
          setLevel((prev) => prev + 1);
        }
      } else {
        // 틀렸을 경우 입력 초기화
        setInputValue("");
      }
    }
  };

  const startGame = async () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setBricks(12);
    setLevel(1);
    setFallingWords([]);
    setInputValue("");
    nextWordIdRef.current = 0;
    setMines([]);
    setIsFrozen(false);
    setSpeedMultiplier(1);
    setIsAidsInfected(false);
    setVirusMessage(null);
    setWordsCaught(0);
    setWordsMissed(0);
    setGameStartTime(Date.now());
    setWaitingForStart(false);

    // Create practice session
    try {
      const response = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "venice" }),
      });
      const data = await response.json();
      if (data.token) {
        setSessionToken(data.token);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const accuracy = score > 0 ? Math.min(100, (score / (score + bricks * 100)) * 100) : 100;

  if (gameOver) {
    return (
      <div className="p-8">
        <div className="w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-center mb-8 text-gray-900 dark:text-white">
              {t("게임 오버!", "Game Over!")}
            </h1>

            <div className="text-center mb-8">
              <div className="text-purple-600 dark:text-purple-400 mb-4">
                {score.toLocaleString()}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {t("점수", "Score")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-purple-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-gray-600 dark:text-gray-400">
                  {t("레벨", "Level")}
                </div>
                <div className="text-gray-900 dark:text-white">
                  {level}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-gray-600 dark:text-gray-400">
                  {t("정확도", "Accuracy")}
                </div>
                <div className="text-gray-900 dark:text-white">
                  {accuracy.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setWaitingForStart(true);
                  setGameOver(false);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg"
              >
                {t("다시 하기", "Play Again")}
              </button>
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
    <div className="w-full h-full bg-[#008080] flex flex-col items-center justify-end">
      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="relative overflow-visible w-[800px] h-[528px]"
      >
          {/* Score and Level Display */}
          <div className="absolute -top-2 left-1/2 bg-[#008080] transform -translate-x-1/2 text-black leading-4 z-10">
            {t("레벨", "Level")}: {level}  {t("점수", "Score")}: {score}
          </div>

          {/* Falling Words */}
          {fallingWords.map((word) => (
            <div
              key={word.id}
              className={`absolute transition-none ${
                word.isVirus
                  ? "text-yellow-400 dark:text-yellow-300"
                  : "text-black"
              }`}
              style={{ left: word.x, top: word.y, lineHeight: '16px', height: '16px' }}
            >
              {word.isHidden ? "???" : word.word}
            </div>
          ))}

          {/* Mines */}
          {mines.map((mine, index) => (
            <div
              key={`mine-${index}`}
              className="absolute"
              style={{
                left: mine.x,
                top: mine.y,
              }}
            >
              💣
            </div>
          ))}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white">{t("게임 오버", "GAME OVER")}</div>
            </div>
          )}

          {/* Input Box (inside game area) */}
          <div
            className="absolute left-1/2 transform -translate-x-1/2"
            style={{ bottom: `${BRICK_HEIGHT}px`, height: `${INPUT_HEIGHT}px`, width: '128px' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={(e) => e.preventDefault()}
              className="w-full h-full bg-white text-gray-900 text-center focus:outline-none text-base border border-black"
              autoComplete="off"
              spellCheck={false}
              disabled={waitingForStart || gameOver}
            />
          </div>

          {/* Brick Grid (3 columns × 4 rows) */}
          <div
            className="absolute w-full flex justify-center items-center z-10"
            style={{ bottom: 0, height: `${BRICK_HEIGHT}px` }}
          >
            <div className="grid grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className={`w-8 h-4 relative ${
                    index < bricks
                      ? "bg-gradient-to-br from-sky-400 via-sky-500 to-sky-600 border-t-2 border-l-2 border-sky-100 border-r-2 border-b-2 border-r-sky-950 border-b-black shadow-md"
                      : "bg-gradient-to-br from-gray-800 via-gray-900 to-black border-t-2 border-l-2 border-gray-700 border-r-2 border-b-2 border-r-black border-b-black shadow-inner"
                  }`}
                  style={
                    index < bricks
                      ? {
                          backgroundImage:
                            "repeating-linear-gradient(45deg, #5eb8d9, #5eb8d9 2px, #7ec8e3 2px, #7ec8e3 4px)",
                        }
                      : {
                          backgroundImage:
                            "linear-gradient(135deg, #1a1a1a 25%, #2d2d2d 25%, #2d2d2d 50%, #1a1a1a 50%, #1a1a1a 75%, #2d2d2d 75%)",
                          backgroundSize: "4px 4px",
                        }
                  }
                />
              ))}
            </div>
          </div>

          {/* Wave Layer */}
          <div
            className="absolute w-full bg-blue-600 z-0"
            style={{ bottom: 0, height: `${WAVE_HEIGHT}px` }}
          />
      </div>
    </div>
  );
}
