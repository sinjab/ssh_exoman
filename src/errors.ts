/**
 * Error codes and factory functions for ssh-exoman
 *
 * Provides consistent error handling across all modules.
 */

import type { Result } from "./types";

// ============================================================================
// Error Code Enum
// ============================================================================

/**
 * Machine-readable error codes for consistent error handling.
 * String values provide better debuggability and API responses.
 */
export enum ErrorCode {
  // Security errors
  SECURITY_BLOCKED = "SECURITY_BLOCKED",

  // Process errors
  PROCESS_NOT_FOUND = "PROCESS_NOT_FOUND",
  PROCESS_TIMEOUT = "PROCESS_TIMEOUT",

  // Input validation errors
  INVALID_INPUT = "INVALID_INPUT",

  // Configuration errors
  CONFIG_ERROR = "CONFIG_ERROR",

  // SSH errors (for Phase 2)
  SSH_CONNECTION_FAILED = "SSH_CONNECTION_FAILED",
  SSH_AUTH_FAILED = "SSH_AUTH_FAILED",

  // Internal errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Shape of a service error object
 */
export interface ServiceError {
  code: ErrorCode;
  message: string;
}

/**
 * Creates a consistent error object.
 *
 * @param code - The error code from the ErrorCode enum
 * @param message - Human-readable error message
 * @returns A ServiceError object with code and message
 */
export function createError(code: ErrorCode, message: string): ServiceError {
  return { code, message };
}

/**
 * Creates a failure Result for functions that return Result<T>.
 *
 * @param code - The error code from the ErrorCode enum
 * @param message - Human-readable error message
 * @returns A Result<T> with success: false
 */
export function errorResult<T>(code: ErrorCode, message: string): Result<T> {
  return { success: false, error: { code, message } };
}
