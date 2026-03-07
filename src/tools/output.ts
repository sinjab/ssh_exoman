/**
 * MCP Tool: get_command_output
 *
 * Retrieves output from a running or completed command.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetCommandOutputSchema } from "../schemas/get-command-output";
import { resultToMcpResponse } from "../test-utils";
import type { ProcessManager } from "../ssh/process-manager";
import type { AppConfig } from "../types";

// ============================================================================
// Tool Dependencies
// ============================================================================

export interface OutputToolDeps {
  processManager: ProcessManager;
  config: AppConfig;
  logger: {
    info: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register the get_command_output tool with the MCP server.
 *
 * This tool retrieves output from a running or completed command,
 * supporting byte-offset pagination for large outputs.
 */
export function registerGetOutput(
  server: McpServer,
  deps: OutputToolDeps
): void {
  server.tool(
    "get_command_output",
    {
      title: "Get Command Output",
      description:
        "Retrieve output from a command. Supports pagination via byte_offset and max_bytes.",
      inputSchema: GetCommandOutputSchema,
    },
    async (params) => {
      try {
        deps.logger.info("Getting command output", {
          processId: params.process_id,
          byteOffset: params.byte_offset ?? 0,
          maxBytes: params.max_bytes ?? 65536,
        });

        const result = await deps.processManager.getOutput(
          params.process_id,
          params.byte_offset ?? 0,
          params.max_bytes ?? 65536
        );

        return resultToMcpResponse(result);
      } catch (error) {
        deps.logger.error("get_command_output failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return resultToMcpResponse({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message:
              error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }
  );
}
