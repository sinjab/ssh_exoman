/**
 * Security Validator for SSH command filtering
 *
 * Provides command validation against configurable security patterns.
 * Supports three modes: blacklist (block matches), whitelist (allow matches only), disabled.
 */

import type { SecurityConfig, ValidationResult, Result } from "./types";
import { ErrorCode, errorResult } from "./errors";
import patterns from "./security-patterns.json";

// ============================================================================
// Pattern Loading
// ============================================================================

/**
 * Load default security patterns from JSON file.
 *
 * @returns Array of regex pattern strings
 */
export function loadPatterns(): string[] {
  return patterns as string[];
}

// ============================================================================
// Command Validation
// ============================================================================

/**
 * Validate a command against the security configuration.
 *
 * @param command - The command string to validate
 * @param config - Security configuration with mode and patterns
 * @returns ValidationResult indicating if command is allowed
 */
export function validateCommand(
  command: string,
  config: SecurityConfig
): ValidationResult {
  // Disabled mode: allow everything
  if (config.mode === "disabled") {
    return { allowed: true };
  }

  // Test command against each pattern
  for (const pattern of config.patterns) {
    try {
      const regex = new RegExp(pattern, "i");
      const matches = regex.test(command);

      if (config.mode === "blacklist") {
        // Blacklist: block if matches
        if (matches) {
          return {
            allowed: false,
            reason: `Command matches blocked pattern`,
            matchedPattern: pattern,
          };
        }
      } else if (config.mode === "whitelist") {
        // Whitelist: allow if matches
        if (matches) {
          return { allowed: true };
        }
      }
    } catch {
      // Invalid regex pattern - skip it (log to stderr for MCP compatibility)
      console.error(`Invalid regex pattern in security config: ${pattern}`);
    }
  }

  // Blacklist: no matches = allowed
  // Whitelist: no matches = blocked
  if (config.mode === "blacklist") {
    return { allowed: true };
  } else {
    return {
      allowed: false,
      reason: "Command does not match any allowed pattern",
    };
  }
}

// ============================================================================
// Security Info
// ============================================================================

/**
 * Information about the security configuration
 */
export interface SecurityInfo {
  /** Current security mode */
  mode: SecurityConfig["mode"];
  /** Number of patterns in configuration */
  patternCount: number;
  /** First few patterns for inspection */
  samplePatterns: string[];
}

/**
 * Get information about the current security configuration.
 *
 * @param config - Security configuration
 * @returns SecurityInfo object with mode, pattern count, and samples
 */
export function getSecurityInfo(config: SecurityConfig): SecurityInfo {
  return {
    mode: config.mode,
    patternCount: config.patterns.length,
    samplePatterns: config.patterns.slice(0, 5),
  };
}

// ============================================================================
// Result-Returning Wrapper
// ============================================================================

/**
 * Validate a command and return a Result type.
 *
 * This is the preferred function for use in MCP tools as it returns
 * a consistent Result type that can be easily converted to tool responses.
 *
 * @param command - The command string to validate
 * @param config - Security configuration with mode and patterns
 * @returns Result with ValidationResult data or SECURITY_BLOCKED error
 */
export function validateCommandWithResult(
  command: string,
  config: SecurityConfig
): Result<ValidationResult> {
  const result = validateCommand(command, config);
  if (!result.allowed) {
    return errorResult(
      ErrorCode.SECURITY_BLOCKED,
      result.reason ?? "Command blocked by security policy"
    );
  }
  return { success: true, data: result };
}
