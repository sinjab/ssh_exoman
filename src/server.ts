/**
 * MCP Server setup for ssh-exoman
 *
 * Creates and configures the McpServer with all tools, resources, and prompts registered.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config";
import { logger } from "./structured-logger";
import { ProcessManager } from "./ssh/process-manager";
import { registerExecuteCommand } from "./tools/execute";
import { registerGetOutput } from "./tools/output";
import { registerGetStatus } from "./tools/status";
import { registerKillCommand } from "./tools/kill";
import { registerSecurityInfo } from "./tools/security-info";
import { registerHostsResource } from "./resources/hosts";
import { registerHelpPrompt } from "./prompts/help";

// ============================================================================
// Server Factory
// ============================================================================

/**
 * Create and configure the MCP server with all tools, resources, and prompts registered.
 *
 * This function:
 * 1. Creates a new McpServer instance
 * 2. Loads configuration from environment
 * 3. Creates a ProcessManager for tracking SSH commands
 * 4. Registers all 5 tools with their dependencies
 * 5. Registers the ssh://hosts resource
 * 6. Registers the ssh_help prompt
 *
 * @returns Configured McpServer instance ready for transport connection
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "ssh-exoman",
    version: "1.0.0",
  });

  const config = loadConfig();
  const processManager = new ProcessManager();

  // Common dependencies for most tools
  const commonDeps = {
    processManager,
    config,
    logger,
  };

  // Register all tools
  registerExecuteCommand(server, commonDeps);
  registerGetOutput(server, commonDeps);
  registerGetStatus(server, commonDeps);
  registerKillCommand(server, commonDeps);
  registerSecurityInfo(server, {
    config,
    logger,
  });

  // Register resource and prompt
  registerHostsResource(server);
  registerHelpPrompt(server);

  logger.info("MCP server created with all tools, resources, and prompts registered", {
    tools: [
      "execute_command",
      "get_command_output",
      "get_command_status",
      "kill_command",
      "get_security_info",
    ],
    resources: ["ssh://hosts"],
    prompts: ["ssh_help"],
    securityMode: config.securityMode,
  });

  return server;
}

// Re-export for convenience
export { McpServer };
