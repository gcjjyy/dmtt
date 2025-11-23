/**
 * Server-side Score Validation
 *
 * Validates scores to prevent manipulation
 */

import { calculateTypingStats } from "~/lib/typing-engine";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate score submission
 */
export function validateScore(
  originalText: string,
  typedText: string,
  timeElapsed: number,
  submittedScore: number,
  submittedAccuracy: number,
  submittedCPM: number,
  mode: "short" | "long" | "venice"
): ValidationResult {
  const errors: string[] = [];

  // Recalculate stats server-side
  const calculatedStats = calculateTypingStats(originalText, typedText, timeElapsed, mode);

  // Validate time (minimum 1 second)
  if (timeElapsed < 1) {
    errors.push("Time elapsed too short");
  }

  // Validate accuracy range (0-100)
  if (submittedAccuracy < 0 || submittedAccuracy > 100) {
    errors.push("Accuracy out of range");
  }

  // Validate CPM range (0-2000)
  if (submittedCPM < 0 || submittedCPM > 2000) {
    errors.push("CPM out of range");
  }

  // Tolerance for floating point calculations (1% difference allowed)
  const accuracyTolerance = 1;
  const cpmTolerance = calculatedStats.cpm * 0.01;
  const scoreTolerance = calculatedStats.score * 0.01;

  // Check if submitted values match calculated values (within tolerance)
  if (Math.abs(submittedAccuracy - calculatedStats.accuracy) > accuracyTolerance) {
    errors.push(
      `Accuracy mismatch: submitted ${submittedAccuracy}, expected ${calculatedStats.accuracy}`
    );
  }

  if (Math.abs(submittedCPM - calculatedStats.cpm) > cpmTolerance) {
    errors.push(
      `CPM mismatch: submitted ${submittedCPM}, expected ${calculatedStats.cpm}`
    );
  }

  if (Math.abs(submittedScore - calculatedStats.score) > scoreTolerance) {
    errors.push(
      `Score mismatch: submitted ${submittedScore}, expected ${calculatedStats.score}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate text content (not empty, reasonable length)
 */
export function validateText(text: string, maxLength: number = 10000): ValidationResult {
  const errors: string[] = [];

  if (!text || text.trim().length === 0) {
    errors.push("Text is empty");
  }

  if (text.length > maxLength) {
    errors.push(`Text too long (max ${maxLength} characters)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate name length (Korean = 2, others = 1)
 */
function calculateNameLength(name: string): number {
  let length = 0;
  for (const char of name) {
    // 한글 유니코드 범위: AC00-D7A3
    if (char >= '\uAC00' && char <= '\uD7A3') {
      length += 2;
    } else {
      length += 1;
    }
  }
  return length;
}

/**
 * Validate name
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push("Name is required");
  }

  // Check for reasonable characters (allow Korean, English, numbers, spaces, dots, hyphens)
  const validNamePattern = /^[가-힣a-zA-Z0-9\s.\-]+$/;
  if (!validNamePattern.test(name.trim())) {
    errors.push("Name contains invalid characters");
  }

  // 길이 체크 (한글=2, 영문/숫자/공백=1, 최대 16)
  const nameLength = calculateNameLength(name.trim());
  if (nameLength > 16) {
    errors.push("Name too long (Korean: 8 chars max, English: 16 chars max)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
