/**
 * ssh-exoman: SSH command execution via MCP
 *
 * This barrel file exports all public APIs for the ssh-exoman package.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  Result,
  SecurityMode,
  ProcessStatus,
  SecurityConfig,
  ValidationResult,
  LogLevel,
} from "./types";

// ============================================================================
// Errors
// ============================================================================

export { ErrorCode, createError, errorResult } from "./errors";
export type { ServiceError } from "./errors";

// ============================================================================
// Config
// ============================================================================

export { loadConfig } from "./config";
export type { AppConfig } from "./config";

// ============================================================================
// Logger
// ============================================================================

export { log, logger } from "./structured-logger";

// ============================================================================
// Security
// ============================================================================

export {
  validateCommand,
  validateCommandWithResult,
  getSecurityInfo,
  loadPatterns,
} from "./security-validator";
export type { SecurityInfo } from "./security-validator";

// ============================================================================
// Schemas
// ============================================================================

export {
  ExecuteCommandSchema,
  GetCommandOutputSchema,
  GetCommandStatusSchema,
  KillCommandSchema,
  GetSecurityInfoSchema,
  validateInput,
} from "./schemas";
export type {
  ExecuteCommandInput,
  GetCommandOutputInput,
  GetCommandStatusInput,
  KillCommandInput,
  GetSecurityInfoInput,
} from "./schemas";
