import { useState, useEffect, useRef } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/venice";
import { useLanguage } from "~/contexts/LanguageContext";
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

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [level, setLevel] = useState(1);
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [inputValue, setInputValue] = useState("");
  const nextWordIdRef = useRef(0);
  const [mines, setMines] = useState<Mine[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isAidsInfected, setIsAidsInfected] = useState(false);
  const [virusMessage, setVirusMessage] = useState<string | null>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 600;
  const BASE_SPEED = 1;
  const WORD_SPAWN_INTERVAL = 2000; // milliseconds

  useEffect(() => {
    if (gameStarted && !gameOver) {
      inputRef.current?.focus();

      // Spawn new words periodically
      const spawnInterval = setInterval(() => {
        spawnNewWord();
      }, Math.max(1000, WORD_SPAWN_INTERVAL - level * 100));

      // Step animation - speed increases with level
      // Level 1: 1초, Level 8: 0.5초
      const stepDelay = Math.max(500, 1000 - (level - 1) * (500 / 7));
      const stepInterval = setInterval(() => {
        updateWordPositions();
      }, stepDelay);

      return () => {
        clearInterval(spawnInterval);
        clearInterval(stepInterval);
      };
    }
  }, [gameStarted, gameOver, level]);

  const spawnNewWord = () => {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const isVirus = Math.random() < 0.15; // 15% 확률로 바이러스

    const newWord: FallingWord = {
      id: nextWordIdRef.current,
      word: randomWord,
      x: Math.random() * (GAME_WIDTH - 100),
      y: -50,
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
        setLives(5);
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
            y: -50 - i * 30,
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

  const updateWordPositions = () => {
    if (isFrozen) return; // 마취 상태면 업데이트 안 함

    setFallingWords((prev) => {
      let updated = prev.map((word) => ({
        ...word,
        y: word.y + 16, // 1초에 16px씩 이동
      }));

      // 지뢰와 충돌 체크
      updated = updated.filter((word) => {
        const hitMine = mines.some(
          (mine) =>
            Math.abs(word.x - mine.x) < 50 && Math.abs(word.y - mine.y) < 30
        );
        if (hitMine) {
          // 지뢰에 맞은 단어는 제거하고 점수 추가
          setScore((prev) => prev + word.word.length * 5);
          return false;
        }
        return true;
      });

      // 바닥에 도달한 단어들
      const reachedBottom = updated.filter((w) => w.y >= GAME_HEIGHT);
      if (reachedBottom.length > 0) {
        // 바이러스가 아니거나, 에이즈 감염 상태에서는 생명 감소
        const damagingWords = reachedBottom.filter(
          (w) => !w.isVirus || isAidsInfected
        );

        if (damagingWords.length > 0) {
          setLives((prevLives) => {
            const newLives = prevLives - damagingWords.length;
            if (newLives <= 0) {
              setGameOver(true);
            }
            return Math.max(0, newLives);
          });
        }

        // 에이즈 바이러스 체크 - 바이러스를 무시하고 보냈는지
        const ignoredViruses = reachedBottom.filter((w) => w.isVirus);
        if (ignoredViruses.length > 0 && ignoredViruses.some((w) => w.word.includes("AIDS") || Math.random() < 0.3)) {
          setIsAidsInfected(true);
          setVirusMessage(t("에이즈 바이러스 감염!", "AIDS Infected!"));
          setTimeout(() => setVirusMessage(null), 2000);
        }
      }

      // 화면에 남아있는 단어만 유지
      return updated.filter((w) => w.y < GAME_HEIGHT);
    });
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

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setLives(5);
    setLevel(1);
    setFallingWords([]);
    setInputValue("");
    nextWordIdRef.current = 0;
    setMines([]);
    setIsFrozen(false);
    setSpeedMultiplier(1);
    setIsAidsInfected(false);
    setVirusMessage(null);
  };

  const accuracy = score > 0 ? Math.min(100, (score / (score + lives * 100)) * 100) : 100;

  if (!gameStarted || gameOver) {
    return (
      <div className="p-8">
        <div className="w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
            {gameOver ? (
              <>
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
                    onClick={startGame}
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
              </>
            ) : (
              <>
                <h1 className="text-center mb-4 text-gray-900 dark:text-white">
                  {t("베네치아 게임", "Venice Game")}
                </h1>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
                  {t(
                    "떨어지는 단어를 입력해서 제거하세요!",
                    "Type the falling words to remove them!"
                  )}
                </p>

                <div className="mb-8 space-y-4">
                  <div className="flex items-center gap-4">
                    <span>⌨️</span>
                    <div>
                      <h3 className="text-gray-900 dark:text-white">
                        {t("단어를 입력하세요", "Type the words")}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {t("정확히 입력하면 단어가 사라집니다", "Type exactly to remove words")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>❤️</span>
                    <div>
                      <h3 className="text-gray-900 dark:text-white">
                        {t("생명 5개", "5 Lives")}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {t("바닥에 닿으면 생명 감소", "Lose life when word reaches bottom")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>⚡</span>
                    <div>
                      <h3 className="text-gray-900 dark:text-white">
                        {t("레벨업", "Level Up")}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {t("점수가 오르면 속도 증가", "Speed increases with score")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={startGame}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-lg"
                  >
                    {t("게임 시작", "Start Game")}
                  </button>
                  <Link
                    to="/"
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-4 px-6 rounded-lg text-center"
                  >
                    {t("돌아가기", "Back")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#008080] p-4">
      <div className="w-full">
        {/* Stats */}
        <div className="flex justify-between items-center mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-3 shadow-lg">
            <div className="text-gray-600 dark:text-gray-400">
              {t("점수", "Score")}
            </div>
            <div className="text-purple-600 dark:text-purple-400">
              {score.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-3 shadow-lg">
            <div className="text-gray-600 dark:text-gray-400">{t("레벨", "Level")}</div>
            <div className="text-gray-900 dark:text-white">{level}</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-3 shadow-lg">
            <div className="text-gray-600 dark:text-gray-400">{t("생명", "Lives")}</div>
            <div className="text-red-600 dark:text-red-400">
              {"❤️".repeat(lives)}
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div
          ref={gameAreaRef}
          className="relative bg-gradient-to-b from-teal-500 to-teal-600 dark:from-teal-700 dark:to-teal-800 rounded-2xl shadow-2xl overflow-hidden w-[800px] h-[600px] mx-auto"
        >
          {/* Falling Words */}
          {fallingWords.map((word) => (
            <div
              key={word.id}
              className={`absolute transition-none ${
                word.isVirus
                  ? "text-yellow-400 dark:text-yellow-300"
                  : "text-gray-900 dark:text-white"
              }`}
              style={{ left: word.x, top: word.y }}
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

          {/* Virus Message */}
          {virusMessage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/80 text-white px-8 py-4 rounded-2xl animate-bounce">
                {virusMessage}
              </div>
            </div>
          )}

          {/* AIDS Infection Warning */}
          {isAidsInfected && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-lg shadow-lg">
              ⚠️ {t("에이즈 감염 상태", "AIDS Infected")} ⚠️
            </div>
          )}

          {/* Frozen Effect */}
          {isFrozen && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-lg shadow-lg">
              ❄️ {t("마취 상태", "Frozen")} ❄️
            </div>
          )}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white">{t("게임 오버", "GAME OVER")}</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-6">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={(e) => e.preventDefault()}
            className="w-full p-4 border-4 border-purple-500 rounded-lg focus:border-purple-600 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center"
            placeholder={t("단어를 입력하고 스페이스바를 누르세요...", "Type words and press spacebar...")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
