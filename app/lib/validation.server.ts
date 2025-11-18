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
 * Validate name
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push("Name is required");
  }

  if (name.length > 50) {
    errors.push("Name too long (max 50 characters)");
  }

  // Check for reasonable characters (allow Korean, English, numbers, spaces)
  const validNamePattern = /^[가-힣a-zA-Z0-9\s]+$/;
  if (!validNamePattern.test(name.trim())) {
    errors.push("Name contains invalid characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
