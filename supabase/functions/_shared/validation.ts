/**
 * Shared validation utilities for edge functions
 * Provides consistent input validation and error handling
 */

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Safely parse JSON request body with error handling
 */
export async function parseRequestBody<T = any>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return body as T;
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Validate required fields exist and are not empty
 */
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): void {
  const missing: string[] = [];

  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      missing[0]
    );
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string, fieldName = 'email'): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError(`Invalid email format: ${email}`, fieldName);
  }
}

/**
 * Validate array of emails
 */
export function validateEmailArray(
  emails: any,
  fieldName = 'emails'
): string[] {
  if (!Array.isArray(emails)) {
    throw new ValidationError(`${fieldName} must be an array`, fieldName);
  }

  if (emails.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  if (emails.length > 100) {
    throw new ValidationError(
      `${fieldName} cannot contain more than 100 addresses`,
      fieldName
    );
  }

  const validEmails: string[] = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (typeof email !== 'string') {
      throw new ValidationError(
        `${fieldName}[${i}] must be a string`,
        fieldName
      );
    }
    validateEmail(email, `${fieldName}[${i}]`);
    validEmails.push(email);
  }

  return validEmails;
}

/**
 * Validate UUID format
 */
export function validateUUID(value: string, fieldName = 'id'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid UUID format for ${fieldName}`, fieldName);
  }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: any,
  fieldName: string
): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName);
  }
  if (num <= 0) {
    throw new ValidationError(`${fieldName} must be positive`, fieldName);
  }
  if (!isFinite(num)) {
    throw new ValidationError(`${fieldName} must be finite`, fieldName);
  }
  return num;
}

/**
 * Validate non-negative number (allows zero)
 */
export function validateNonNegativeNumber(
  value: any,
  fieldName: string
): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName);
  }
  if (num < 0) {
    throw new ValidationError(`${fieldName} cannot be negative`, fieldName);
  }
  if (!isFinite(num)) {
    throw new ValidationError(`${fieldName} must be finite`, fieldName);
  }
  return num;
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number }
): void {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  if (options.min !== undefined && value.length < options.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.min} characters`,
      fieldName
    );
  }

  if (options.max !== undefined && value.length > options.max) {
    throw new ValidationError(
      `${fieldName} must be at most ${options.max} characters`,
      fieldName
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: any,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      fieldName
    );
  }
  return value as T;
}

/**
 * Validate boolean
 */
export function validateBoolean(value: any, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean`, fieldName);
  }
  return value;
}

/**
 * Validate URL format
 */
export function validateURL(value: string, fieldName: string): void {
  try {
    new URL(value);
  } catch {
    throw new ValidationError(`Invalid URL format for ${fieldName}`, fieldName);
  }
}

/**
 * Sanitize string input (remove control characters, limit length)
 */
export function sanitizeString(
  value: string,
  maxLength = 10000
): string {
  if (typeof value !== 'string') {
    return '';
  }

  // Remove control characters except newlines and tabs
  const sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim to max length
  return sanitized.slice(0, maxLength);
}

/**
 * Validate payment amount for Stripe (must be at least $0.50 USD)
 */
export function validatePaymentAmount(
  amount: any,
  fieldName = 'amount'
): number {
  const num = validatePositiveNumber(amount, fieldName);

  if (num < 0.5) {
    throw new ValidationError(
      `${fieldName} must be at least $0.50 USD`,
      fieldName
    );
  }

  if (num > 999999.99) {
    throw new ValidationError(
      `${fieldName} cannot exceed $999,999.99`,
      fieldName
    );
  }

  // Validate max 2 decimal places
  if (!Number.isInteger(num * 100)) {
    throw new ValidationError(
      `${fieldName} cannot have more than 2 decimal places`,
      fieldName
    );
  }

  return num;
}
