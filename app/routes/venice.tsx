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
  const [bricks, setBricks] = useState(1);
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
      console.log('🔥 [게임 루프 정지] gameStarted:', gameStarted, 'gameOver:', gameOver, 'isGameOverAnimating:', isGameOverAnimating);
      if (gameLoopIntervalRef.current) {
        clearInterval(gameLoopIntervalRef.current);
      }
    }
  }, [gameStarted, gameOver, isGameOverAnimating, level]);

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
      console.log('🔥 [무너지기 시작] isGameOverAnimating = true');
      const interval = setInterval(() => {
        setInputBoxFallCount((prevCount) => {
          const newCount = prevCount + 1;
          console.log(`🔥 [무너지기 카운트] prevCount=${prevCount}, newCount=${newCount}, 거리=${newCount * 16}px`);

          // 4번 무너지면 애니메이션 종료
          if (newCount > 4) {
            console.log('🔥 [무너지기 완료] 4번 무너짐, 랭킹 표시');
            clearInterval(interval);

            // 랭킹 데이터 fetch
            fetch('/api/ranking?type=venice')
              .then(res => res.json())
              .then(data => setVeniceRankings(data.rankings || []))
              .catch(err => console.error('Failed to fetch rankings:', err));

            // 게임 오버 화면 표시
            setGameOver(true);
            return prevCount; // 카운트 변경 없음
          }

          // 사운드 재생
          console.log(`🔥 [무너지기 실행] ${newCount}번째 무너짐`);
          playGameOverSound();
          return newCount;
        });
      }, 875); // 0.875초마다 (사운드 재생 시간과 동일)

      return () => {
        console.log('🔥 [무너지기 정리] interval cleared');
        clearInterval(interval);
      };
    }
  }, [isGameOverAnimating]);

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
      // 게임 오버 시: 200Hz 0.25초 → 600Hz 0.25초 → 400Hz 0.375초
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // 첫 번째 음: 200Hz, 0.25초
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 200;
      osc1.type = 'square';
      gain1.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain1.gain.setValueAtTime(0.2, audioContext.currentTime + 0.25 * 0.85);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.25);

      // 두 번째 음: 600Hz, 0.25초
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 600;
      osc2.type = 'square';
      gain2.gain.setValueAtTime(0.2, audioContext.currentTime + 0.25);
      gain2.gain.setValueAtTime(0.2, audioContext.currentTime + 0.25 + 0.25 * 0.85);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc2.start(audioContext.currentTime + 0.25);
      osc2.stop(audioContext.currentTime + 0.5);

      // 세 번째 음: 400Hz, 0.375초 (1.5배)
      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.connect(gain3);
      gain3.connect(audioContext.destination);
      osc3.frequency.value = 400;
      osc3.type = 'square';
      gain3.gain.setValueAtTime(0.2, audioContext.currentTime + 0.5);
      gain3.gain.setValueAtTime(0.2, audioContext.currentTime + 0.5 + 0.375 * 0.85);
      gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.875);
      osc3.start(audioContext.currentTime + 0.5);
      osc3.stop(audioContext.currentTime + 0.875);
    } catch (e) {
      console.error('Failed to play game over sound:', e);
    }
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
    let remaining = [...words];
    const removed: FallingWord[] = [];

    // 1. 지뢰 충돌 체크
    remaining = remaining.filter((word) => {
      const hitMine = mines.some(
        (mine) =>
          Math.abs(word.x - mine.x) < 50 && Math.abs(word.y - mine.y) < 30
      );
      if (hitMine) {
        removed.push(word);
        return false;
      }
      return true;
    });

    // 2. 입력박스 충돌 체크
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

    // 3. 물결 도달 체크
    remaining = remaining.filter((word) => {
      if (word.y >= WAVE_TOP) {
        removed.push(word);
        return false;
      }
      return true;
    });

    return { surviving: remaining, removed };
  };

  const gameLoop = () => {
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

      // 단어 이동
      const movedWords = prev.map((word) => ({
        ...word,
        y: word.y + 16,
      }));

      // 충돌 체크
      const { surviving, removed } = checkCollisions(movedWords);

      // 캐시에 저장
      cachedSurvivingWordsRef.current = surviving;

      // 3. 제거된 단어에 따른 처리
      if (removed.length > 0) {
        isProcessingCollisionRef.current = true;

        // 단어가 떨어질 때마다 비프음 (250Hz, 0.125초)
        playBeep(250, 0.125);

        // 지뢰로 제거된 단어는 점수 추가
        const mineHits = removed.filter((word) =>
          mines.some((mine) =>
            Math.abs(word.x - mine.x) < 50 && Math.abs(word.y - mine.y) < 30
          )
        );
        if (mineHits.length > 0) {
          const mineScore = mineHits.reduce((sum, w) => sum + w.word.length * 5, 0);
          setScore((prev) => prev + mineScore);
        }

        // 입력박스 또는 물결에 도달한 단어는 벽돌 감소
        const damagingWords = removed.filter(
          (w) => !w.isVirus || isAidsInfected
        );

        if (damagingWords.length > 0) {
          setWordsMissed((prev) => prev + damagingWords.length);
          setBricks((prevBricks) => {
            const newBricks = prevBricks - damagingWords.length;
            console.log(`🔥 [생명 변경] 이전 생명: ${prevBricks}, 데미지: ${damagingWords.length}, 새 생명: ${newBricks}`);
            if (newBricks <= 0) {
              console.log("🔥 [게임 오버 트리거] 생명 0 이하, 무너지기 시작!");
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
    setBricks(1);
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
    setIsGameOverAnimating(false);
    setInputBoxFallCount(0);
    setVeniceRankings([]);

    // AudioContext 미리 초기화 (딜레이 제거)
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // 무음 오실레이터로 AudioContext 워밍업 (게임 오버 사운드 딜레이 제거)
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0; // 무음
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.001); // 1ms
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

  const accuracy = score > 0 ? Math.min(100, (score / (score + bricks * 100)) * 100) : 100;

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

          {/* Game Over Overlay with Rankings */}
          {gameOver && (
            <div className="absolute inset-0 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl max-w-2xl w-full max-h-[90%] overflow-y-auto">
                <h1 className="text-center mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                  {t("게임 오버!", "Game Over!")}
                </h1>

                {/* Current Score */}
                <div className="text-center mb-6 pb-6 border-b border-gray-300 dark:border-gray-600">
                  <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                    {score.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t("점수", "Score")}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-purple-50 dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t("레벨", "Level")}
                      </div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">
                        {level}
                      </div>
                    </div>
                    <div className="bg-purple-50 dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t("정확도", "Accuracy")}
                      </div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">
                        {accuracy.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rankings */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    {t("베네치아 랭킹", "Venice Rankings")}
                  </h2>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    {veniceRankings.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-300 dark:border-gray-600">
                            <th className="text-left py-2 text-gray-600 dark:text-gray-400">#</th>
                            <th className="text-left py-2 text-gray-600 dark:text-gray-400">{t("이름", "Name")}</th>
                            <th className="text-right py-2 text-gray-600 dark:text-gray-400">{t("점수", "Score")}</th>
                            <th className="text-right py-2 text-gray-600 dark:text-gray-400">{t("레벨", "Level")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {veniceRankings.map((ranking: any, index: number) => (
                            <tr key={ranking.id} className="border-b border-gray-200 dark:border-gray-600">
                              <td className="py-2 text-gray-700 dark:text-gray-300">{index + 1}</td>
                              <td className="py-2 text-gray-900 dark:text-white font-medium">{ranking.name}</td>
                              <td className="py-2 text-right text-gray-900 dark:text-white">{ranking.score.toLocaleString()}</td>
                              <td className="py-2 text-right text-gray-700 dark:text-gray-300">{ranking.extra?.level || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                        {t("랭킹 로딩 중...", "Loading rankings...")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setWaitingForStart(true);
                      setGameOver(false);
                      setIsGameOverAnimating(false);
                      setInputBoxFallCount(0);
                      setVeniceRankings([]);
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                  >
                    {t("다시 하기", "Play Again")}
                  </button>
                  <Link
                    to="/"
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg text-center font-semibold transition-colors"
                  >
                    {t("메인으로", "Home")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Input Box (inside game area) */}
          <div
            className="absolute left-1/2 transform -translate-x-1/2"
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
