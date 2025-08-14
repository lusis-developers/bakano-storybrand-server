import type { IBusinessQuestions } from '../models/content.model';

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Sanitize business questions to fit model validations
 * Ensures all text fields comply with the maximum character limits defined in the content model
 */
export function sanitizeContentQuestions(questions: Partial<IBusinessQuestions>): Partial<IBusinessQuestions> {
  if (!questions) return questions;
  
  const sanitized: Partial<IBusinessQuestions> = {};
  
  if (questions.companyName) {
    sanitized.companyName = truncateText(questions.companyName, 100);
  }
  if (questions.productsServices) {
    sanitized.productsServices = truncateText(questions.productsServices, 500);
  }
  if (questions.targetAudience) {
    sanitized.targetAudience = truncateText(questions.targetAudience, 300);
  }
  if (questions.mainProblem) {
    sanitized.mainProblem = truncateText(questions.mainProblem, 400);
  }
  if (questions.solution) {
    sanitized.solution = truncateText(questions.solution, 400);
  }
  if (questions.uniqueCharacteristics) {
    sanitized.uniqueCharacteristics = truncateText(questions.uniqueCharacteristics, 300);
  }
  if (questions.authority) {
    sanitized.authority = truncateText(questions.authority, 300);
  }
  if (questions.steps) {
    sanitized.steps = truncateText(questions.steps, 400);
  }
  
  return { ...questions, ...sanitized };
}

/**
 * Content validation constants
 * These match the validation rules defined in the content model schema
 */
export const CONTENT_VALIDATION_LIMITS = {
  COMPANY_NAME: 100,
  PRODUCTS_SERVICES: 500,
  TARGET_AUDIENCE: 300,
  MAIN_PROBLEM: 400,
  SOLUTION: 400,
  UNIQUE_CHARACTERISTICS: 300,
  AUTHORITY: 300,
  STEPS: 400,
  SOUNDBITE_TEXT: 200,
  TAGLINE_TEXT: 100,
  SCRIPT_TITLE: 100
} as const;