/**
 * Structured Logger for MCP stdio compatibility
 *
 * CRITICAL: All logs go to stderr (console.error), never stdout.
 * MCP stdio transport reserves stdout for protocol messages.
 */

/** Log levels supported by the logger */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Internal log entry structure */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: Record<string, unknown>;
  traceId?: string;
}

/** Service name for all log entries */
const SERVICE_NAME = "ssh-exoman";

/**
 * Core logging function that outputs structured JSON to stderr.
 *
 * @param level - Log level (debug, info, warn, error)
 * @param message - Log message
 * @param context - Optional context object with additional data
 * @param traceId - Optional trace ID for request tracing
 */
export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  traceId?: string
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    ...(context && { context }),
    ...(traceId && { traceId }),
  };

  // CRITICAL: Use console.error (stderr), NOT console.log (stdout)
  // MCP stdio transport reserves stdout for protocol messages
  console.error(JSON.stringify(entry));
}

/**
 * Convenience logger object with methods for each log level.
 * Does not support traceId - use log() directly if traceId is needed.
 */
export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log("error", message, context),
};
