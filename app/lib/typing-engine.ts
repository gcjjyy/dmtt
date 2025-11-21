/**
 * Typing Engine - Calculate accuracy, WPM, CPM
 */

export interface TypingStats {
  totalChars: number;
  correctChars: number;
  accuracy: number; // 0-100
  timeElapsed: number; // in seconds
  cpm: number; // Characters per minute (correct keystrokes only)
  wpm: number; // Words per minute (assuming 5 chars = 1 word)
  score: number; // Combined score (accuracy * speed)
}

/**
 * 한글 글자를 자모 인덱스로 분해
 */
function decomposeKorean(char: string): { cho: number; jung: number; jong: number } | null {
  const code = char.charCodeAt(0);

  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (code < 0xAC00 || code > 0xD7A3) {
    return null;
  }

  const index = code - 0xAC00;
  const choIndex = Math.floor(index / 28 / 21);
  const jungIndex = Math.floor(index / 28) % 21;
  const jongIndex = index % 28;

  return {
    cho: choIndex,
    jung: jungIndex,
    jong: jongIndex,
  };
}

/**
 * 한글 글자의 타수 계산 (초성 + 중성 + 종성)
 */
export function getKoreanKeystrokes(char: string): number {
  const decomposed = decomposeKorean(char);
  if (!decomposed) return 1; // 한글이 아니면 1타

  // 종성이 있으면 3타, 없으면 2타
  return decomposed.jong > 0 ? 3 : 2;
}

/**
 * 두 글자를 비교하여 맞은 타수 반환
 * - 한글: 초성/중성/종성 각각 비교하여 맞은 만큼 타수 부여
 * - 기타: 일치하면 1타
 */
function compareChars(original: string, typed: string): { correct: number; total: number } {
  // 줄바꿈은 타수에서 제외
  if (original === '\n' || typed === '\n') {
    return { correct: 0, total: 0 };
  }

  const originalDecomposed = decomposeKorean(original);
  const typedDecomposed = decomposeKorean(typed);

  // 둘 다 한글인 경우
  if (originalDecomposed && typedDecomposed) {
    let correct = 0;
    let total = 0;

    // 초성 비교 (1타)
    total += 1;
    if (originalDecomposed.cho === typedDecomposed.cho) correct += 1;

    // 중성 비교 (1타)
    total += 1;
    if (originalDecomposed.jung === typedDecomposed.jung) correct += 1;

    // 종성 비교 (있는 경우만)
    if (originalDecomposed.jong > 0) {
      total += 1;
      if (originalDecomposed.jong === typedDecomposed.jong) correct += 1;
    }

    return { correct, total };
  }

  // 한글이 아닌 경우 (영문, 숫자, 특수문자 등)
  const total = 1;
  const correct = original === typed ? 1 : 0;
  return { correct, total };
}

/**
 * Calculate typing accuracy
 */
export function calculateAccuracy(correctChars: number, totalChars: number): number {
  if (totalChars === 0) return 100;
  return Math.round((correctChars / totalChars) * 100 * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate Characters Per Minute (CPM)
 */
export function calculateCPM(totalChars: number, timeInSeconds: number): number {
  if (timeInSeconds === 0) return 0;
  const minutes = timeInSeconds / 60;
  return Math.round((totalChars / minutes) * 10) / 10;
}

/**
 * Calculate Words Per Minute (WPM)
 * Standard: 5 characters = 1 word
 */
export function calculateWPM(totalChars: number, timeInSeconds: number): number {
  if (timeInSeconds === 0) return 0;
  const minutes = timeInSeconds / 60;
  const words = totalChars / 5;
  return Math.round((words / minutes) * 10) / 10;
}

/**
 * Calculate combined score (accuracy × speed)
 * Returns a score from 0 to 10000 (100% accuracy × 100 WPM = 10000)
 */
export function calculateScore(accuracy: number, cpm: number): number {
  return Math.round(accuracy * cpm);
}

/**
 * Calculate correct keystrokes between original and typed text
 */
export function calculateCorrectKeystrokes(originalText: string, typedText: string): { correct: number; total: number } {
  let totalCorrectKeystrokes = 0;
  let totalPossibleKeystrokes = 0;

  const maxLength = Math.max(originalText.length, typedText.length);

  for (let i = 0; i < maxLength; i++) {
    const originalChar = originalText[i] || '';
    const typedChar = typedText[i] || '';

    if (originalChar && originalChar !== '\n') {
      totalPossibleKeystrokes += getKoreanKeystrokes(originalChar);
    }

    if (typedChar) {
      const result = compareChars(originalChar, typedChar);
      totalCorrectKeystrokes += result.correct;
    }
  }

  return { correct: totalCorrectKeystrokes, total: totalPossibleKeystrokes };
}

/**
 * Calculate all typing statistics
 * kimtaja 방식: 맞은 타수만 CPM에 반영
 */
export function calculateTypingStats(
  originalText: string,
  typedText: string,
  timeInSeconds: number,
  mode: "short" | "long" | "venice" = "long"
): TypingStats {
  let totalCorrectKeystrokes = 0;
  let totalPossibleKeystrokes = 0;

  // Calculate keystrokes (한글: 초성/중성/종성, 기타: 1타)
  const maxLength = Math.max(originalText.length, typedText.length);

  for (let i = 0; i < maxLength; i++) {
    const originalChar = originalText[i] || '';
    const typedChar = typedText[i] || '';

    if (originalChar && originalChar !== '\n') {
      totalPossibleKeystrokes += getKoreanKeystrokes(originalChar);
    }

    if (typedChar && typedChar !== '\n') {
      const result = compareChars(originalChar, typedChar);
      totalCorrectKeystrokes += result.correct;
    }
  }

  const accuracy = calculateAccuracy(totalCorrectKeystrokes, totalPossibleKeystrokes);
  // CPM은 맞은 타수 기준으로 계산 (kimtaja 방식)
  const cpm = calculateCPM(totalCorrectKeystrokes, timeInSeconds);
  const wpm = calculateWPM(totalCorrectKeystrokes, timeInSeconds);

  // 단문/장문 연습은 점수 = CPM, 베네치아는 정확도 * CPM
  const score = (mode === "short" || mode === "long") ? Math.round(cpm) : calculateScore(accuracy, cpm);

  return {
    totalChars: typedText.length,
    correctChars: totalCorrectKeystrokes,
    accuracy,
    timeElapsed: timeInSeconds,
    cpm: Math.round(cpm),
    wpm: Math.round(wpm),
    score,
  };
}

/**
 * Check if character at position is correct
 */
export function isCharCorrect(
  originalText: string,
  typedText: string,
  position: number
): boolean | null {
  if (position >= typedText.length) return null; // Not typed yet
  return typedText[position] === originalText[position];
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get typing grade based on accuracy and speed
 */
export function getTypingGrade(accuracy: number, cpm: number): string {
  const score = accuracy * cpm;

  if (score >= 8000 && accuracy >= 95) return "S";
  if (score >= 6000 && accuracy >= 90) return "A";
  if (score >= 4000 && accuracy >= 85) return "B";
  if (score >= 2000 && accuracy >= 80) return "C";
  if (score >= 1000 && accuracy >= 70) return "D";
  return "F";
}
