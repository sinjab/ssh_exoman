/**
 * MCP Tool: get_command_status
 *
 * Checks the status of a running or completed command.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetCommandStatusSchema } from "../schemas/get-command-status";
import { resultToMcpResponse } from "../test-utils";
import type { ProcessManager } from "../ssh/process-manager";
import type { AppConfig } from "../types";

// ============================================================================
// Tool Dependencies
// ============================================================================

export interface StatusToolDeps {
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
 * Register the get_command_status tool with the MCP server.
 *
 * This tool checks the status of a running or completed command,
 * including exit code, signal, and output sizes.
 */
export function registerGetStatus(
  server: McpServer,
  deps: StatusToolDeps
): void {
  server.tool(
    "get_command_status",
    {
      title: "Get Command Status",
      description:
        "Check the status of a command (running, completed, failed, killed).",
      inputSchema: GetCommandStatusSchema,
    },
    async (params) => {
      try {
        deps.logger.info("Getting command status", {
          processId: params.process_id,
        });

        const result = deps.processManager.getStatus(params.process_id);

        return resultToMcpResponse(result);
      } catch (error) {
        deps.logger.error("get_command_status failed", {
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
