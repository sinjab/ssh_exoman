/**
 * MCP Tool: resolve_host
 *
 * Resolves an SSH config alias to its actual connection details.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResolveHostSchema } from "../schemas/resolve-host";
import { resultToMcpResponse } from "../test-utils";
import { parseSSHConfig, resolveHost } from "../ssh/config-parser";
import { ErrorCode, errorResult } from "../errors";
import type { Result } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface ResolveHostResult {
  alias: string;
  hostname: string;
  port: number;
  user: string;
}

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Resolve an SSH config alias to actual connection details.
 *
 * @param params - Object containing host alias to resolve
 * @returns Result with resolved connection details or error
 */
export async function resolveHostTool(
  params: { host: string }
): Promise<Result<ResolveHostResult>> {
  const config = parseSSHConfig();
  const resolved = resolveHost(params.host, config);

  if (!resolved) {
    return errorResult(
      ErrorCode.CONFIG_ERROR,
      `Host "${params.host}" not found in SSH config`
    );
  }

  return {
    success: true,
    data: {
      alias: resolved.host,
      hostname: resolved.hostname || resolved.host,
      port: resolved.port,
      user: resolved.user,
    },
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register the resolve_host tool with the MCP server.
 *
 * This tool resolves an SSH config alias to its actual connection details,
 * which is essential for multi-hop SSH/SCP operations where the remote
 * server doesn't have access to the local SSH config.
 */
export function registerResolveHost(server: McpServer): void {
  server.registerTool(
    "resolve_host",
    {
      title: "Resolve SSH Host Alias",
      description:
        "Resolve an SSH config alias to its actual hostname/IP, port, and user. Use this before multi-hop SSH/SCP commands to get the real address that remote servers can connect to.",
      inputSchema: ResolveHostSchema._zod.def.shape,
    },
    async (params) => {
      const result = await resolveHostTool(params);
      return resultToMcpResponse(result);
    }
  );
}
