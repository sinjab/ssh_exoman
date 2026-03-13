/**
 * MCP Prompt: ssh_help
 *
 * Provides guidance for using SSH tools and typical workflows.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ============================================================================
// Prompt Registration
// ============================================================================

/**
 * Register the ssh_help prompt with the MCP server.
 *
 * This prompt provides Claude with guidance on:
 * - Available SSH tools and their parameters
 * - Typical workflow for executing commands
 * - Error handling patterns
 * - Reference to the hosts resource
 *
 * @param server - The McpServer instance to register the prompt with
 */
export function registerHelpPrompt(server: McpServer): void {
  server.registerPrompt(
    "ssh_help",
    {
      title: "SSH Help",
      description: "Guidance for using SSH tools and typical workflows",
    },
    () => ({
      messages: [
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: `# SSH Tools Reference

## Available Tools

1. **execute_command** - Run a command on a remote host via SSH
   - Parameters: host (string), command (string), timeout (number, optional), forwardAgent (boolean, optional, default: false)
   - forwardAgent: Forward local SSH agent to remote host. Allows remote commands to authenticate with other SSH servers using your local keys. Only enable on fully trusted hosts.

   **IMPORTANT for forwardAgent**: When using agent forwarding for multi-hop SSH/SCP commands, use the actual IP address or resolved hostname - NOT SSH config aliases. Aliases like "my-server" only exist in your local ~/.ssh/config and won't resolve on the remote server. Use \`resolve_host\` tool to get the actual hostname/IP for a given alias.

2. **get_command_status** - Check if a command is still running
   - Parameters: process_id (UUID string)

3. **get_command_output** - Retrieve command output with chunked reading
   - Parameters: process_id (UUID string), byte_offset (number), max_bytes (number)

4. **kill_command** - Terminate a running command
   - Parameters: process_id (UUID string), force (boolean, optional)

5. **get_security_info** - View current security settings
   - Parameters: none

6. **resolve_host** - Resolve SSH config alias to actual connection details
   - Parameters: host (string) - SSH config alias
   - Returns: { alias, hostname, port, user }
   - Use this before multi-hop SSH/SCP to get the real address remote servers can connect to.

## Typical Workflow

1. Execute a command:
   \`execute_command(host="myserver", command="ls -la")\`
   Returns: \`{ success: true, processId: "uuid..." }\`

2. Check status:
   \`get_command_status(process_id="uuid...")\`
   Returns: \`{ success: true, status: "running"|"completed"|"failed", exitCode, ... }\`

3. Retrieve output (chunked):
   \`get_command_output(process_id="uuid...", byte_offset=0, max_bytes=65536)\`
   Returns: \`{ success: true, data: "...", totalSize: N, hasMore: true|false }\`

4. If needed, kill the process:
   \`kill_command(process_id="uuid...", force=false)\`

## Multi-hop SSH/SCP Example

When copying files between remote servers with \`forwardAgent: true\`:

\`\`\`
# First, resolve the target host alias to get the real IP
resolve_host(host="art.cp1.afrhkom") → { hostname: "5.39.70.214", port: 2274, user: "afrhkom" }

# Then use the resolved IP in the remote SCP command (NOT the alias!)
execute_command(
  host="art.afrhkom.afrhkom",
  command="scp -P 2274 /path/to/file afrhkom@5.39.70.214:/destination/",
  forwardAgent=true
)
\`\`\`

## Error Handling

All tools return:
\`\`\`json
{ "success": boolean, "error_code"?: string, "error_message"?: string, ...data }
\`\`\`

Always check \`success\` before using other response fields.

## Available Hosts

Use the \`ssh://hosts\` resource to see configured SSH host aliases from ~/.ssh/config.
`,
          },
        },
      ],
    })
  );
}
