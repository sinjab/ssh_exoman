/**
 * Configuration module for ssh-exoman
 *
 * Loads all settings from environment variables with safe defaults.
 * Bun auto-loads .env files, so process.env is populated automatically.
 */

import type { SecurityMode, LogLevel, AppConfig } from "./types";

// ============================================================================
// Environment Variable Names
// ============================================================================

const ENV_KEYS = {
  SECURITY_MODE: "SSH_EXOMAN_SECURITY_MODE",
  CONNECT_TIMEOUT: "SSH_EXOMAN_CONNECT_TIMEOUT",
  COMMAND_TIMEOUT: "SSH_EXOMAN_COMMAND_TIMEOUT",
  LOG_LEVEL: "SSH_EXOMAN_LOG_LEVEL",
} as const;

// ============================================================================
// Default Values
// ============================================================================

const DEFAULTS = {
  SECURITY_MODE: "blacklist" as SecurityMode, // Safest default
  CONNECT_TIMEOUT: 30000, // 30 seconds
  COMMAND_TIMEOUT: 60000, // 60 seconds
  LOG_LEVEL: "info" as LogLevel,
} as const;

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse and validate security mode from environment value.
 * Falls back to "blacklist" (safest option) for any invalid input.
 */
function parseSecurityMode(value: string | undefined): SecurityMode {
  if (value === "blacklist" || value === "whitelist" || value === "disabled") {
    return value;
  }
  return DEFAULTS.SECURITY_MODE;
}

/**
 * Parse and validate log level from environment value.
 * Falls back to "info" for any invalid input.
 */
function parseLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return DEFAULTS.LOG_LEVEL;
}

/**
 * Parse and validate timeout value from environment.
 * Falls back to provided default for invalid, negative, or missing values.
 * Zero is considered a valid value (may be used for "no timeout" scenarios).
 */
function parseTimeout(value: string | undefined, defaultMs: number): number {
  if (!value) return defaultMs;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) return defaultMs;
  return parsed;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load application configuration from environment variables.
 *
 * All settings have safe defaults:
 * - securityMode: "blacklist" (safest option)
 * - sshConnectTimeout: 30000ms (30 seconds)
 * - commandTimeout: 60000ms (60 seconds)
 * - logLevel: "info"
 *
 * Invalid values fall back to defaults rather than throwing errors.
 */
export function loadConfig(): AppConfig {
  return {
    securityMode: parseSecurityMode(process.env[ENV_KEYS.SECURITY_MODE]),
    sshConnectTimeout: parseTimeout(
      process.env[ENV_KEYS.CONNECT_TIMEOUT],
      DEFAULTS.CONNECT_TIMEOUT
    ),
    commandTimeout: parseTimeout(
      process.env[ENV_KEYS.COMMAND_TIMEOUT],
      DEFAULTS.COMMAND_TIMEOUT
    ),
    logLevel: parseLogLevel(process.env[ENV_KEYS.LOG_LEVEL]),
  };
}

// Re-export AppConfig type for convenience
export type { AppConfig } from "./types";
