/**
 * Zod schemas for MCP tool input validation
 *
 * All schemas use safeParse (not parse) to never throw exceptions.
 * Use validateInput helper to get Result<T> type.
 */

// Re-export all schemas and types
export { ExecuteCommandSchema, type ExecuteCommandInput } from "./execute-command";
export { GetCommandOutputSchema, type GetCommandOutputInput } from "./get-command-output";
export { GetCommandStatusSchema, type GetCommandStatusInput } from "./get-command-status";
export { KillCommandSchema, type KillCommandInput } from "./kill-command";
export { GetSecurityInfoSchema, type GetSecurityInfoInput } from "./get-security-info";

// Validation helper
import { z } from "zod";
import type { Result } from "../types";
import { ErrorCode, errorResult } from "../errors";

/**
 * Validate input against a Zod schema.
 *
 * Uses safeParse so it never throws - returns Result type instead.
 *
 * @param schema - Zod schema to validate against
 * @param input - Unknown input to validate
 * @returns Result with parsed data or INVALID_INPUT error
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): Result<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    return errorResult(ErrorCode.INVALID_INPUT, messages);
  }
  return { success: true, data: result.data };
}
