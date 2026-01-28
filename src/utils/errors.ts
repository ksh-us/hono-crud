/**
 * Error utility functions for consistent error handling across the codebase.
 */

/**
 * Converts an unknown value to an Error instance.
 * If the value is already an Error, returns it as-is.
 * Otherwise, creates a new Error with the string representation.
 *
 * @param value - Any value that might be an error
 * @returns An Error instance
 *
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (e) {
 *   const error = toError(e);
 *   console.error(error.message);
 * }
 * ```
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

/**
 * Wraps an error with additional context.
 * Preserves the original error as the cause.
 *
 * @param error - The original error (can be unknown type)
 * @param context - Context description to prepend to the message
 * @returns A new Error with the context and original error as cause
 *
 * @example
 * ```ts
 * try {
 *   await storage.save(data);
 * } catch (e) {
 *   throw wrapError(e, 'Failed to save data');
 * }
 * // Results in: "Failed to save data: Original error message"
 * ```
 */
export function wrapError(error: unknown, context: string): Error {
  const base = toError(error);
  const wrapped = new Error(`${context}: ${base.message}`);
  wrapped.cause = base;
  return wrapped;
}

/**
 * Extracts a safe error message from an unknown error value.
 * Useful for logging or displaying error messages.
 *
 * @param error - Any value that might be an error
 * @returns The error message string
 *
 * @example
 * ```ts
 * catch (e) {
 *   console.error('Operation failed:', getErrorMessage(e));
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
