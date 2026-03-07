/**
 * Shared TypeScript types for ssh-exoman
 *
 * These types are the foundational building blocks used across all modules.
 */

// ============================================================================
// Result Type (discriminated union for type narrowing)
// ============================================================================

/**
 * Result type for consistent error handling across all service functions.
 * Use type narrowing based on `success` to access data or error.
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ============================================================================
// Security Types
// ============================================================================

/**
 * Security validation modes:
 * - "blacklist": Block commands matching patterns (safest default)
 * - "whitelist": Only allow commands matching patterns
 * - "disabled": No security validation (use with caution)
 */
export type SecurityMode = "blacklist" | "whitelist" | "disabled";

/**
 * Configuration for the security validator
 */
export interface SecurityConfig {
  mode: SecurityMode;
  patterns: string[];
}

/**
 * Result from security validation
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  matchedPattern?: string;
}

// ============================================================================
// Process Types (for Phase 2 process tracking)
// ============================================================================

/**
 * Status of a background process
 */
export type ProcessStatus = "running" | "completed" | "failed" | "killed";

/**
 * Information about a background process
 */
export interface ProcessInfo {
  processId: string;
  host: string;
  command: string;
  status: ProcessStatus;
  exitCode: number | null;
  signal: string | null;
  startTime: Date;
  endTime: Date | null;
  outputSize: number;
  errorSize: number;
  tempOutputPath: string;
  tempErrorPath: string;
  channel: unknown; // ssh2 Channel (typed as unknown to avoid circular deps)
  connection: unknown; // ssh2 Client
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Log levels for structured logging
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Application configuration loaded from environment variables
 */
export interface AppConfig {
  securityMode: SecurityMode;
  sshConnectTimeout: number; // milliseconds
  commandTimeout: number; // milliseconds
  logLevel: LogLevel;
}
