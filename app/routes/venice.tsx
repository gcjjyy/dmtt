import { useState, useEffect, useRef } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/venice";
import { useLanguage } from "~/contexts/LanguageContext";
import { useGameStatus } from "~/contexts/GameStatusContext";
import { loadWords } from "~/lib/data-loader.server";
import { DosWindow } from "~/components/DosWindow";

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
  forcedEffect?: VirusEffect; // 테스트용: 강제 바이러스 효과
  isMine?: boolean; // 지뢰로 변환된 단어
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

export default function VeniceGame() {
  const { words, language } = useLoaderData<typeof loader>();
  const { t } = useLanguage();
  const { setStatusMessage } = useGameStatus();

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bricks, setBricks] = useState(1);
  const [level, setLevel] = useState(1);
  const [waitingForStart, setWaitingForStart] = useState(true);
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [inputValue, setInputValue] = useState("");
  const nextWordIdRef = useRef(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isAidsInfected, setIsAidsInfected] = useState(false);
  const [virusMessage, setVirusMessage] = useState<string | null>(null);
  const [isGameOverAnimating, setIsGameOverAnimating] = useState(false);
  const [inputBoxFallCount, setInputBoxFallCount] = useState(0);
  const [veniceRankings, setVeniceRankings] = useState<any[]>([]);

  // fallDistance는 count로부터 계산 (중복 실행 방지)
  const inputBoxFallDistance = inputBoxFallCount * 16;

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const isGameOverAnimatingRef = useRef(false);
  const fallCountRef = useRef(0);

  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 528;
  const WAVE_HEIGHT = 19;
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
    if (gameStarted && !gameOver && !isGameOverAnimating) {
      inputRef.current?.focus();

      // Clear any existing interval first
      if (gameLoopIntervalRef.current) {
        clearInterval(gameLoopIntervalRef.current);
      }

      // Reset spawn counter when starting/restarting
      spawnCounterRef.current = 0;

      // Game loop interval - speed increases with level
      // Level 1: 1초, Level 8: 0.5초
      // speedMultiplier로 나눠서 속도 조절 (1.5 = 빠르게, 0.5 = 느리게)
      const baseDelay = Math.max(500, 1000 - (level - 1) * (500 / 7));
      const loopDelay = baseDelay / speedMultiplier;
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
      console.log(`🔥 [${performance.now().toFixed(2)}ms] [게임 루프 정지] gameStarted:`, gameStarted, 'gameOver:', gameOver, 'isGameOverAnimating:', isGameOverAnimating);
      if (gameLoopIntervalRef.current) {
        clearInterval(gameLoopIntervalRef.current);
      }
    }
  }, [gameStarted, gameOver, isGameOverAnimating, level, speedMultiplier]);

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

  // Game over animation: input box falling
  useEffect(() => {
    if (isGameOverAnimating) {
      console.log(`🔥 [${performance.now().toFixed(2)}ms] [무너지기 useEffect 실행]`);

      // 사운드를 한 번만 호출하여 4번 분량 모두 스케줄링
      playGameOverSound();

      // 1번째 무너짐 (즉시)
      fallCountRef.current = 1;
      setInputBoxFallCount(1);
      console.log(`🔥 [${performance.now().toFixed(2)}ms] [무너지기 실행] 1번째 무너짐, 거리=16px`);

      // 2번째 무너짐 (875ms 후)
      const timer1 = setTimeout(() => {
        fallCountRef.current = 2;
        setInputBoxFallCount(2);
        console.log(`🔥 [${performance.now().toFixed(2)}ms] [무너지기 실행] 2번째 무너짐, 거리=32px`);
      }, 875);

      // 3번째 무너짐 (1750ms 후)
      const timer2 = setTimeout(() => {
        fallCountRef.current = 3;
        setInputBoxFallCount(3);
        console.log(`🔥 [${performance.now().toFixed(2)}ms] [무너지기 실행] 3번째 무너짐, 거리=48px`);
      }, 1750);

      // 4번째 무너짐 (2625ms 후)
      const timer3 = setTimeout(() => {
        fallCountRef.current = 4;
        setInputBoxFallCount(4);
        console.log(`🔥 [${performance.now().toFixed(2)}ms] [무너지기 실행] 4번째 무너짐, 거리=64px`);
        console.log(`🔥 [${performance.now().toFixed(2)}ms] [무너지기 완료] 4번 무너짐, 랭킹 표시`);

        // 랭킹 데이터 fetch
        fetch('/api/ranking?type=venice')
          .then(res => res.json())
          .then(data => setVeniceRankings(data.rankings || []))
          .catch(err => console.error('Failed to fetch rankings:', err));

        setGameOver(true);
      }, 2625);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isGameOverAnimating]);

  const getWordWidth = (word: string) => {
    let width = 0;
    for (const char of word) {
      // 한글: 16px, 영어/숫자: 8px
      if (char >= '\uAC00' && char <= '\uD7A3') {
        width += 16;
      } else {
        width += 8;
      }
    }
    return width;
  };

  const spawnNewWord = () => {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    // 테스트: 4번째 단어(id=3)를 지뢰 바이러스로 강제
    const isVirus = nextWordIdRef.current === 3 ? true : Math.random() < 0.15;

    // 단어 너비 계산
    const wordWidth = getWordWidth(randomWord);

    // x좌표: 최소 8, 최대 GAME_WIDTH - wordWidth - 8 (우측 패딩), 8의 배수
    const minX = 8;
    const maxX = GAME_WIDTH - wordWidth - 8;
    const range = maxX - minX;
    const x = Math.floor(Math.random() * (range / 8)) * 8 + minX;

    const newWord: FallingWord = {
      id: nextWordIdRef.current,
      word: randomWord,
      x,
      y: 0,
      speed: (BASE_SPEED + level * 0.2) * speedMultiplier,
      isVirus,
      // 테스트: 4번째 단어는 강제로 mine 효과
      forcedEffect: nextWordIdRef.current === 3 ? "mine" : undefined,
    };

    nextWordIdRef.current += 1;
    setFallingWords((prev) => [...prev, newWord]);
  };

  const triggerVirusEffect = (word: FallingWord, forcedEffect?: VirusEffect) => {
    let selectedEffect: VirusEffect;

    // 강제 효과가 있으면 그걸 사용 (테스트용)
    if (forcedEffect) {
      selectedEffect = forcedEffect;
    } else {
      // 랜덤 선택
      const virusEffects: VirusEffect[] = [
        "sweep", "freeze", "heal", "speedup", "slowdown",
        "hide", "flood", "mine", "aids"
      ];

      // 재건은 레어하게 (5% 확률로만)
      const weights = [15, 15, 5, 10, 15, 10, 15, 10, 5];
      let totalWeight = weights.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalWeight;

      selectedEffect = "sweep";
      for (let i = 0; i < virusEffects.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedEffect = virusEffects[i];
          break;
        }
      }
    }

    applyVirusEffect(selectedEffect, word);
  };

  const playBeep = (frequency: number, duration: number) => {
    try {
      // GWBASIC SOUND 스타일: SOUND frequency, duration
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'square'; // 레트로한 사각파

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + duration * 0.85); // flat하게 유지
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.error('Failed to play beep:', e);
    }
  };

  const playCatchSound = () => {
    try {
      // 단어 제거 시: 250Hz 0.1초 → 500Hz 0.1초
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // 첫 번째 음: 250Hz, 0.1초
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 250;
      osc1.type = 'square';
      gain1.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain1.gain.setValueAtTime(0.2, audioContext.currentTime + 0.1 * 0.85);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.1);

      // 두 번째 음: 500Hz, 0.1초
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 500;
      osc2.type = 'square';
      gain2.gain.setValueAtTime(0.2, audioContext.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.2, audioContext.currentTime + 0.1 + 0.1 * 0.85);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      osc2.start(audioContext.currentTime + 0.1);
      osc2.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.error('Failed to play catch sound:', e);
    }
  };

  const playGameOverSound = () => {
    try {
      const startTime = Date.now();
      console.log(`🔊 [${startTime}] [사운드 시작] 4번 무너짐 사운드 모두 스케줄링`);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const baseTime = audioContext.currentTime;

      // 4번 무너짐 사운드를 한 번에 모두 스케줄링 (각각 875ms 간격)
      for (let i = 0; i < 4; i++) {
        const offset = i * 0.875; // 0ms, 875ms, 1750ms, 2625ms

        // 200Hz, 0.25초
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.frequency.value = 200;
        osc1.type = 'square';
        gain1.gain.setValueAtTime(0.2, baseTime + offset);
        gain1.gain.setValueAtTime(0.2, baseTime + offset + 0.25 * 0.85);
        gain1.gain.exponentialRampToValueAtTime(0.01, baseTime + offset + 0.25);
        osc1.start(baseTime + offset);
        osc1.stop(baseTime + offset + 0.25);

        // 600Hz, 0.25초
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 600;
        osc2.type = 'square';
        gain2.gain.setValueAtTime(0.2, baseTime + offset + 0.25);
        gain2.gain.setValueAtTime(0.2, baseTime + offset + 0.5 * 0.85);
        gain2.gain.exponentialRampToValueAtTime(0.01, baseTime + offset + 0.5);
        osc2.start(baseTime + offset + 0.25);
        osc2.stop(baseTime + offset + 0.5);

        // 400Hz, 0.375초
        const osc3 = audioContext.createOscillator();
        const gain3 = audioContext.createGain();
        osc3.connect(gain3);
        gain3.connect(audioContext.destination);
        osc3.frequency.value = 400;
        osc3.type = 'square';
        gain3.gain.setValueAtTime(0.2, baseTime + offset + 0.5);
        gain3.gain.setValueAtTime(0.2, baseTime + offset + 0.5 + 0.375 * 0.85);
        gain3.gain.exponentialRampToValueAtTime(0.01, baseTime + offset + 0.875);
        osc3.start(baseTime + offset + 0.5);
        osc3.stop(baseTime + offset + 0.875);

        console.log(`🔊 [${startTime + offset * 1000}] [${i + 1}번째 무너짐 사운드] ${offset * 1000}ms에 스케줄링`);
      }

      // 마지막에 200Hz, 0.1초 추가 (4번째 무너짐 이후)
      const finalOffset = 3 * 0.875 + 0.875; // 2625ms + 875ms = 3500ms
      const osc4 = audioContext.createOscillator();
      const gain4 = audioContext.createGain();
      osc4.connect(gain4);
      gain4.connect(audioContext.destination);
      osc4.frequency.value = 200;
      osc4.type = 'square';
      gain4.gain.setValueAtTime(0.2, baseTime + finalOffset);
      gain4.gain.setValueAtTime(0.2, baseTime + finalOffset + 0.1 * 0.85);
      gain4.gain.exponentialRampToValueAtTime(0.01, baseTime + finalOffset + 0.1);
      osc4.start(baseTime + finalOffset);
      osc4.stop(baseTime + finalOffset + 0.1);

      console.log(`🔊 [사운드 스케줄링 완료] 4번 무너짐 사운드 모두 예약됨`);
    } catch (e) {
      console.error('Failed to play game over sound:', e);
    }
  };

  const applyVirusEffect = (effect: VirusEffect, word: FallingWord) => {
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
        setTimeout(() => setSpeedMultiplier(1), 30000);
        break;

      case "slowdown":
        setVirusMessage(t("굼벵이 바이러스!", "Slow Down Virus!"));
        setSpeedMultiplier(0.5);
        setTimeout(() => setSpeedMultiplier(1), 30000);
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
        // 단어를 지뢰로 변환 (이미 제거된 상태이므로 다시 추가)
        setFallingWords((prev) => [
          ...prev,
          { ...word, isMine: true, isVirus: false }
        ]);
        break;

      case "aids":
        setVirusMessage(t("에이즈 바이러스 퇴치!", "AIDS Virus Defeated!"));
        break;
    }

    // 메시지 자동 제거
    setTimeout(() => setVirusMessage(null), 4000);
  };

  const checkCollisions = (words: FallingWord[]): { surviving: FallingWord[]; removed: FallingWord[]; wordsHitByMines: Set<number> } => {
    let remaining = [...words];
    const removed: FallingWord[] = [];

    // 1. 입력박스 충돌 체크
    const INPUT_BOX_X = (GAME_WIDTH - 128) / 2;
    const INPUT_BOX_WIDTH = 128;
    const INPUT_BOX_BOTTOM = INPUT_TOP + INPUT_HEIGHT;

    remaining = remaining.filter((word) => {
      const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(word.word);
      const wordWidth = word.word.length * (isKorean ? 16 : 8);

      const verticalCollision = word.y >= INPUT_TOP && word.y < INPUT_BOX_BOTTOM;
      const horizontalCollision = !(
        word.x + wordWidth < INPUT_BOX_X ||
        word.x > INPUT_BOX_X + INPUT_BOX_WIDTH
      );

      if (verticalCollision && horizontalCollision) {
        removed.push(word);
        return false;
      }
      return true;
    });

    // 2. 물결 도달 체크
    remaining = remaining.filter((word) => {
      if (word.y >= WAVE_TOP) {
        removed.push(word);
        return false;
      }
      return true;
    });

    // 3. 지뢰 충돌 체크 - 일반 단어와 지뢰 단어 충돌 시 둘 다 제거
    const mineWords = remaining.filter((w) => w.isMine);
    const nonMineWords = remaining.filter((w) => !w.isMine);

    const wordsHitByMines = new Set<number>();
    const minesHitByWords = new Set<number>();

    nonMineWords.forEach((word) => {
      const wordWidth = getWordWidth(word.word);

      mineWords.forEach((mine) => {
        const mineWidth = getWordWidth(mine.word);

        // 충돌 체크
        const verticalCollision = Math.abs(word.y - mine.y) < 16;
        const horizontalCollision = !(
          word.x + wordWidth < mine.x ||
          word.x > mine.x + mineWidth
        );

        if (verticalCollision && horizontalCollision) {
          wordsHitByMines.add(word.id);
          minesHitByWords.add(mine.id);
        }
      });
    });

    // 충돌한 단어와 지뢰 모두 제거
    remaining = remaining.filter((word) =>
      !wordsHitByMines.has(word.id) && !minesHitByWords.has(word.id)
    );

    // 지뢰 충돌로 제거된 단어만 추가 (입력박스/물결로 이미 제거된 단어 제외)
    const alreadyRemovedIds = new Set(removed.map(w => w.id));
    removed.push(
      ...nonMineWords.filter((w) => wordsHitByMines.has(w.id) && !alreadyRemovedIds.has(w.id)),
      ...mineWords.filter((m) => minesHitByWords.has(m.id))
    );

    return { surviving: remaining, removed, wordsHitByMines };
  };

  const gameLoop = () => {
    // 게임 오버 애니메이션 중이면 즉시 리턴
    if (isGameOverAnimatingRef.current) {
      console.log(`🔥 [${performance.now().toFixed(2)}ms] [게임 루프 스킵] 무너지는 중`);
      return;
    }

    // 마취 상태면 게임 로직 실행 안 함
    if (isFrozen) {
      return;
    }

    // 1. 단어 생성 (카운터 기반)
    spawnCounterRef.current += 1;
    const spawnInterval = Math.max(2, 4 - level * 0.3); // 틱 단위
    if (spawnCounterRef.current >= spawnInterval) {
      spawnNewWord();
      spawnCounterRef.current = 0;
    }

    // 2. 모든 단어 이동 및 충돌 체크 - 모든 처리를 updater 내부에서 수행
    setFallingWords((prev) => {
      // Strict Mode 중복 실행 방지 - 캐시된 결과 반환
      if (isProcessingCollisionRef.current && cachedSurvivingWordsRef.current) {
        return cachedSurvivingWordsRef.current;
      }

      // 단어 이동 (지뢰는 이동하지 않음)
      const movedWords = prev.map((word) => ({
        ...word,
        y: word.isMine ? word.y : word.y + 16,
      }));

      // 충돌 체크
      const { surviving, removed, wordsHitByMines } = checkCollisions(movedWords);

      // 캐시에 저장
      cachedSurvivingWordsRef.current = surviving;

      // 3. 제거된 단어에 따른 처리
      if (removed.length > 0) {
        isProcessingCollisionRef.current = true;

        // 지뢰와 충돌로 제거된 단어들 (점수 추가, 벽돌 감소 없음)
        const mineCollisions = removed.filter((word) => word.isMine);
        const wordsHitMinesFiltered = removed.filter((word) => !word.isMine && wordsHitByMines.has(word.id));
        const mineCollisionIds = new Set([...mineCollisions.map(w => w.id), ...wordsHitMinesFiltered.map(w => w.id)]);

        if (mineCollisions.length > 0 || wordsHitMinesFiltered.length > 0) {
          // 지뢰 폭파 소리 재생 (단어 제거 소리)
          playCatchSound();

          // 지뢰 단어 점수 + 충돌한 일반 단어 점수
          const mineScore = mineCollisions.reduce((sum, w) => sum + w.word.length * 10, 0);
          const wordScore = wordsHitMinesFiltered.reduce((sum, w) => sum + w.word.length * 10, 0);
          const totalScore = mineScore + wordScore;

          if (totalScore > 0) {
            setScore((prev) => prev + totalScore);
          }
        }

        // 입력박스 또는 물결에 도달한 단어는 벽돌 감소 (지뢰 충돌로 제거된 단어는 제외)
        const damagingWords = removed.filter(
          (w) => (!w.isVirus || isAidsInfected) && !mineCollisionIds.has(w.id)
        );

        // 일반 단어가 떨어졌을 때 소리 재생 (지뢰 충돌 제외, 게임 오버 예정이 아닐 때만)
        if (damagingWords.length > 0) {
          const willGameOver = bricks - damagingWords.length <= 0;
          if (!willGameOver) {
            playBeep(250, 0.125);
          }
        }

        if (damagingWords.length > 0) {
          setWordsMissed((prev) => prev + damagingWords.length);
          setBricks((prevBricks) => {
            const newBricks = prevBricks - damagingWords.length;
            console.log(`🔥 [${performance.now().toFixed(2)}ms] [생명 변경] 이전 생명: ${prevBricks}, 데미지: ${damagingWords.length}, 새 생명: ${newBricks}`);
            if (newBricks <= 0) {
              console.log(`🔥 [${performance.now().toFixed(2)}ms] [게임 오버 트리거] 생명 0 이하, 무너지기 트리거`);
              isGameOverAnimatingRef.current = true;
              setIsGameOverAnimating(true);
            }
            return Math.max(0, newBricks);
          });
        }

        // 에이즈 바이러스 체크 - 바이러스를 무시하고 보냈는지
        const ignoredViruses = removed.filter((w) => w.isVirus && w.y >= WAVE_TOP);
        if (ignoredViruses.length > 0 && ignoredViruses.some((w) => w.word.includes("AIDS") || Math.random() < 0.3)) {
          setIsAidsInfected(true);
          setVirusMessage(t("에이즈 바이러스 감염!", "AIDS Infected!"));
          setTimeout(() => setVirusMessage(null), 2000);
        }

        // 다음 틱에서 플래그와 캐시 리셋
        setTimeout(() => {
          isProcessingCollisionRef.current = false;
          cachedSurvivingWordsRef.current = null;
        }, 0);
      }

      return surviving;
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

        // 단어 제거 성공 사운드 (250Hz 0.25초 → 500Hz 0.25초)
        playCatchSound();

        // 바이러스 단어인 경우 효과 발동
        if (matchedWord.isVirus) {
          triggerVirusEffect(matchedWord, matchedWord.forcedEffect);
        } else {
          // 일반 단어만 점수 추가
          const points = matchedWord.word.length * 10;
          setScore((prev) => prev + points);

          // Level up every 500 points (일반 단어만)
          if ((score + points) % 500 === 0) {
            setLevel((prev) => prev + 1);
          }
        }

        setWordsCaught((prev) => prev + 1);
        setInputValue("");
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
    setBricks(1);
    setLevel(1);
    setFallingWords([]);
    setInputValue("");
    nextWordIdRef.current = 0;
    setIsFrozen(false);
    setSpeedMultiplier(1);
    setIsAidsInfected(false);
    setVirusMessage(null);
    setWordsCaught(0);
    setWordsMissed(0);
    setGameStartTime(Date.now());
    setWaitingForStart(false);
    setIsGameOverAnimating(false);
    setInputBoxFallCount(0);
    setVeniceRankings([]);
    isGameOverAnimatingRef.current = false;

    // AudioContext 미리 초기화 및 모든 사운드 워밍업 (딜레이 제거)
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioContext = audioContextRef.current;
      let currentTime = audioContext.currentTime;

      // 1. 단어 떨어지는 소리 워밍업: 250Hz, 0.125초
      const fall1 = audioContext.createOscillator();
      const fallGain1 = audioContext.createGain();
      fall1.connect(fallGain1);
      fallGain1.connect(audioContext.destination);
      fall1.frequency.value = 250;
      fall1.type = 'square';
      fallGain1.gain.value = 0;
      fall1.start(currentTime);
      fall1.stop(currentTime + 0.125);
      currentTime += 0.125;

      // 2. 단어 잡는 소리 워밍업: 250Hz 0.1초 → 500Hz 0.1초
      const catch1 = audioContext.createOscillator();
      const catchGain1 = audioContext.createGain();
      catch1.connect(catchGain1);
      catchGain1.connect(audioContext.destination);
      catch1.frequency.value = 250;
      catch1.type = 'square';
      catchGain1.gain.value = 0;
      catch1.start(currentTime);
      catch1.stop(currentTime + 0.1);

      const catch2 = audioContext.createOscillator();
      const catchGain2 = audioContext.createGain();
      catch2.connect(catchGain2);
      catchGain2.connect(audioContext.destination);
      catch2.frequency.value = 500;
      catch2.type = 'square';
      catchGain2.gain.value = 0;
      catch2.start(currentTime + 0.1);
      catch2.stop(currentTime + 0.2);
      currentTime += 0.2;

      // 3. 게임 오버 사운드 워밍업: 200Hz 0.25초 → 600Hz 0.25초 → 400Hz 0.375초
      const over1 = audioContext.createOscillator();
      const overGain1 = audioContext.createGain();
      over1.connect(overGain1);
      overGain1.connect(audioContext.destination);
      over1.frequency.value = 200;
      over1.type = 'square';
      overGain1.gain.value = 0;
      over1.start(currentTime);
      over1.stop(currentTime + 0.25);

      const over2 = audioContext.createOscillator();
      const overGain2 = audioContext.createGain();
      over2.connect(overGain2);
      overGain2.connect(audioContext.destination);
      over2.frequency.value = 600;
      over2.type = 'square';
      overGain2.gain.value = 0;
      over2.start(currentTime + 0.25);
      over2.stop(currentTime + 0.5);

      const over3 = audioContext.createOscillator();
      const overGain3 = audioContext.createGain();
      over3.connect(overGain3);
      overGain3.connect(audioContext.destination);
      over3.frequency.value = 400;
      over3.type = 'square';
      overGain3.gain.value = 0;
      over3.start(currentTime + 0.5);
      over3.stop(currentTime + 0.875);

      console.log('🔊 [게임 시작] 모든 사운드 워밍업 완료 (떨어짐, 잡기, 게임오버)');
    } catch (err) {
      console.error("Failed to initialize audio:", err);
    }

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

          {/* Game Over Overlay with Rankings */}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center z-50">
              <DosWindow title={t("베네치아 랭킹", "Venice Rankings")} className="w-96">
                <div className="p-2">
                  {veniceRankings.length > 0 ? (
                    (() => {
                      const username = localStorage.getItem('typing-practice-username') || '';
                      // 내 위치 찾기
                      const myIndex = veniceRankings.findIndex((r: any) => r.name === username);

                      // 표시할 랭킹 추출 (내 위 4명, 아래 4명, 최대 9명)
                      let displayRankings: any[] = [];
                      if (myIndex !== -1) {
                        const start = Math.max(0, myIndex - 4);
                        const end = Math.min(veniceRankings.length, myIndex + 5);
                        displayRankings = veniceRankings.slice(start, end);
                      } else {
                        displayRankings = veniceRankings.slice(0, 9);
                      }

                      return (
                        <>
                          {/* Header */}
                          <div className="flex items-center gap-2 px-1 text-black border-b border-[#808080] pb-1 mb-1">
                            <div className="w-8">#</div>
                            <div className="flex-1">{t("이름", "Name")}</div>
                            <div className="w-12 text-right">{t("단계", "Lv")}</div>
                            <div className="w-24 text-right">{t("점수", "Score")}</div>
                          </div>
                          {/* Scores */}
                          <div className="space-y-0.5">
                            {displayRankings.map((ranking: any) => {
                              const actualRank = veniceRankings.findIndex((r: any) => r.id === ranking.id) + 1;
                              const isMe = ranking.name === username;
                              return (
                                <div
                                  key={ranking.id}
                                  className={`flex items-center gap-2 px-1 ${isMe ? 'bg-black text-[#FFFF00]' : 'text-black'}`}
                                >
                                  <div className="w-8">{actualRank}</div>
                                  <div className="flex-1 truncate">{ranking.name}</div>
                                  <div className="w-12 text-right">{ranking.extra?.level || '-'}</div>
                                  <div className="w-24 text-right">{ranking.score.toLocaleString()}</div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Buttons */}
                          <div className="flex gap-2 mt-2 pt-2 border-t border-[#808080]">
                            <button
                              onClick={() => {
                                // 게임 오버 상태 초기화
                                setGameOver(false);
                                setIsGameOverAnimating(false);
                                setInputBoxFallCount(0);
                                setVeniceRankings([]);
                                isGameOverAnimatingRef.current = false;

                                // 게임 상태 완전 초기화
                                setGameStarted(false);
                                setScore(0);
                                setBricks(12);
                                setLevel(1);
                                setFallingWords([]);
                                setInputValue("");
                                nextWordIdRef.current = 0;
                                setIsFrozen(false);
                                setSpeedMultiplier(1);
                                setIsAidsInfected(false);
                                setVirusMessage(null);
                                setWordsCaught(0);
                                setWordsMissed(0);
                                setGameStartTime(0);

                                // 대기 상태로
                                setWaitingForStart(true);
                              }}
                              className="flex-1 text-center text-black border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] bg-[#C0C0C0] hover:bg-[#D0D0D0] h-7 flex items-center justify-center"
                            >
                              {t("다시하기", "Retry")}
                            </button>
                            <Link
                              to="/"
                              className="flex-1 text-center text-black border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] bg-[#C0C0C0] hover:bg-[#D0D0D0] h-7 flex items-center justify-center"
                            >
                              {t("홈으로", "Home")}
                            </Link>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="text-center py-4 text-black">
                      {t("랭킹 로딩 중...", "Loading...")}
                    </div>
                  )}
                </div>
              </DosWindow>
            </div>
          )}

          {/* Input Box (inside game area) */}
          <div
            className="absolute left-1/2 transform -translate-x-1/2 z-30"
            style={{
              ...(isGameOverAnimating
                ? { top: `${INPUT_TOP + inputBoxFallDistance}px` }
                : { bottom: `${BRICK_HEIGHT}px` }),
              height: `${INPUT_HEIGHT}px`,
              width: '128px'
            }}
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
              {Array.from({ length: 12 }).map((_, index) => {
                // 무너진 블럭은 숨김 (윗줄부터 1줄씩)
                // index 0,1,2 = 1번째 줄 (맨 위)
                // index 3,4,5 = 2번째 줄
                // index 6,7,8 = 3번째 줄
                // index 9,10,11 = 4번째 줄 (맨 아래)
                const shouldHide = index < inputBoxFallCount * 3;

                return (
                  <div
                    key={index}
                    className={`w-8 h-4 relative ${
                      index < bricks
                        ? "bg-gradient-to-br from-sky-400 via-sky-500 to-sky-600 border-t-2 border-l-2 border-sky-100 border-r-2 border-b-2 border-r-sky-950 border-b-black shadow-md"
                        : "bg-gradient-to-br from-gray-800 via-gray-900 to-black border-t-2 border-l-2 border-gray-700 border-r-2 border-b-2 border-r-black border-b-black shadow-inner"
                    }`}
                    style={{
                      ...(index < bricks
                        ? {
                            backgroundImage:
                              "repeating-linear-gradient(45deg, #5eb8d9, #5eb8d9 2px, #7ec8e3 2px, #7ec8e3 4px)",
                          }
                        : {
                            backgroundImage:
                              "linear-gradient(135deg, #1a1a1a 25%, #2d2d2d 25%, #2d2d2d 50%, #1a1a1a 50%, #1a1a1a 75%, #2d2d2d 75%)",
                            backgroundSize: "4px 4px",
                          }),
                      visibility: shouldHide ? 'hidden' : 'visible'
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Wave Layer */}
          <div
            className="absolute w-full z-0 overflow-hidden"
            style={{ bottom: 0, height: `${WAVE_HEIGHT}px` }}
          >
            <svg
              className="absolute w-full h-full"
              viewBox="0 0 800 19"
              preserveAspectRatio="none"
              style={{ display: 'block' }}
            >
              {/* 뒤쪽 파도 (어두운 파랑) */}
              <path
                d="M0,4 Q100,10 200,4 T400,4 T600,4 T800,4 L800,19 L0,19 Z"
                fill="#2563eb"
                opacity="0.85"
              >
                <animate
                  attributeName="d"
                  dur="3s"
                  repeatCount="indefinite"
                  values="
                    M0,4 Q100,10 200,4 T400,4 T600,4 T800,4 L800,19 L0,19 Z;
                    M0,4 Q100,0 200,4 T400,4 T600,4 T800,4 L800,19 L0,19 Z;
                    M0,4 Q100,10 200,4 T400,4 T600,4 T800,4 L800,19 L0,19 Z
                  "
                />
              </path>
              {/* 중간 파도 (중간 파랑) */}
              <path
                d="M0,8 Q100,14 200,8 T400,8 T600,8 T800,8 L800,19 L0,19 Z"
                fill="#3b82f6"
                opacity="0.9"
              >
                <animate
                  attributeName="d"
                  dur="2s"
                  repeatCount="indefinite"
                  values="
                    M0,8 Q100,14 200,8 T400,8 T600,8 T800,8 L800,19 L0,19 Z;
                    M0,8 Q100,2 200,8 T400,8 T600,8 T800,8 L800,19 L0,19 Z;
                    M0,8 Q100,14 200,8 T400,8 T600,8 T800,8 L800,19 L0,19 Z
                  "
                />
              </path>
              {/* 앞쪽 파도 (밝은 파랑) */}
              <path
                d="M0,12 Q100,15 200,12 T400,12 T600,12 T800,12 L800,19 L0,19 Z"
                fill="#4e94f8"
                opacity="0.95"
              >
                <animate
                  attributeName="d"
                  dur="2.5s"
                  repeatCount="indefinite"
                  values="
                    M0,12 Q100,15 200,12 T400,12 T600,12 T800,12 L800,19 L0,19 Z;
                    M0,12 Q100,9 200,12 T400,12 T600,12 T800,12 L800,19 L0,19 Z;
                    M0,12 Q100,15 200,12 T400,12 T600,12 T800,12 L800,19 L0,19 Z
                  "
                />
              </path>
            </svg>
          </div>
      </div>
    </div>
  );
}
