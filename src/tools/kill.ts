/**
 * MCP Tool: kill_command
 *
 * Terminates a running command.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KillCommandSchema } from "../schemas/kill-command";
import { resultToMcpResponse } from "../test-utils";
import type { ProcessManager } from "../ssh/process-manager";
import type { AppConfig } from "../types";

// ============================================================================
// Tool Dependencies
// ============================================================================

export interface KillToolDeps {
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
 * Register the kill_command tool with the MCP server.
 *
 * This tool terminates a running command. Use force=true for immediate
 * SIGKILL, or force=false (default) for graceful SIGTERM with SIGKILL
 * escalation after 5 seconds.
 */
export function registerKillCommand(
  server: McpServer,
  deps: KillToolDeps
): void {
  server.tool(
    "kill_command",
    {
      title: "Kill Command",
      description:
        "Terminate a running command. Use force=true for immediate termination.",
      inputSchema: KillCommandSchema,
    },
    async (params) => {
      try {
        deps.logger.info("Killing command", {
          processId: params.process_id,
          force: params.force ?? false,
        });

        const result = await deps.processManager.killProcess(
          params.process_id,
          params.force ?? false
        );

        return resultToMcpResponse(result);
      } catch (error) {
        deps.logger.error("kill_command failed", {
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
