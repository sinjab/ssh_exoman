/**
 * MCP Resource: ssh://hosts
 *
 * Returns a list of configured SSH host aliases from ~/.ssh/config.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseSSHConfig, listHosts } from "../ssh/config-parser";

// ============================================================================
// Resource Registration
// ============================================================================

/**
 * Register the ssh://hosts resource with the MCP server.
 *
 * This resource provides a list of configured SSH host aliases
 * from the user's ~/.ssh/config file.
 *
 * @param server - The McpServer instance to register the resource with
 */
export function registerHostsResource(server: McpServer): void {
  server.registerResource(
    "hosts",
    "ssh://hosts",
    {
      title: "SSH Hosts",
      description: "List of configured SSH host aliases from ~/.ssh/config",
      mimeType: "application/json",
    },
    async (uri) => {
      const config = parseSSHConfig();
      const hosts = listHosts(config);

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(hosts),
            mimeType: "application/json",
          },
        ],
      };
    }
  );
}
