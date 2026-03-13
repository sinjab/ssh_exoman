/**
 * MCP Tool: get_security_info
 *
 * Returns information about the current security configuration.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync } from "fs";
import { GetSecurityInfoSchema } from "../schemas/get-security-info";
import { resultToMcpResponse } from "../test-utils";
import { getSecurityInfo, loadPatterns } from "../security-validator";
import type { AppConfig } from "../types";

// ============================================================================
// Tool Dependencies
// ============================================================================

export interface SecurityInfoToolDeps {
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
 * Register the get_security_info tool with the MCP server.
 *
 * This tool returns information about the current security configuration,
 * including the mode (blacklist/whitelist/disabled), pattern count, and
 * sample patterns.
 */
export function registerSecurityInfo(
  server: McpServer,
  deps: SecurityInfoToolDeps
): void {
  server.registerTool(
    "get_security_info",
    {
      title: "Get Security Info",
      description:
        "Get information about the current security configuration (mode, patterns).",
      // Pass the raw shape from the schema for Zod 4 compatibility
      inputSchema: GetSecurityInfoSchema._zod.def.shape,
    },
    async (_params) => {
      try {
        deps.logger.info("Getting security info");

        const patterns = loadPatterns();
        const info = getSecurityInfo({
          mode: deps.config.securityMode,
          patterns,
        });

        // Check SSH agent availability for agent forwarding
        const agentSocket = process.env.SSH_AUTH_SOCK || null;
        const agentAvailable = agentSocket ? existsSync(agentSocket) : false;

        return resultToMcpResponse({
          success: true,
          data: {
            mode: info.mode,
            patternCount: info.patternCount,
            samplePatterns: info.samplePatterns,
            agentAvailable,
            agentSocket,
          },
        });
      } catch (error) {
        deps.logger.error("get_security_info failed", {
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
