/**
 * MCP Tool: execute_command
 *
 * Executes a command on a remote host via SSH.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ExecuteCommandSchema } from "../schemas/execute-command";
import { resultToMcpResponse } from "../test-utils";
import { executeSSHCommand } from "../ssh/executor";
import type { ProcessManager } from "../ssh/process-manager";
import type { AppConfig } from "../types";

// ============================================================================
// Tool Dependencies
// ============================================================================

export interface ExecuteToolDeps {
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
 * Register the execute_command tool with the MCP server.
 *
 * This tool executes a command on a remote host via SSH and returns
 * a process ID for tracking the command's status and output.
 */
export function registerExecuteCommand(
  server: McpServer,
  deps: ExecuteToolDeps
): void {
  server.tool(
    "execute_command",
    {
      title: "Execute SSH Command",
      description:
        "Execute a command on a remote host via SSH. Returns a process ID for tracking.",
      inputSchema: ExecuteCommandSchema,
    },
    async (params) => {
      try {
        deps.logger.info("Executing command", {
          host: params.host,
          command: params.command.substring(0, 100),
        });

        const result = await executeSSHCommand(
          params.host,
          params.command,
          deps.config,
          deps.processManager
        );

        return resultToMcpResponse(result);
      } catch (error) {
        deps.logger.error("execute_command failed", {
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
