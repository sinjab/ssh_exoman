# Phase 3: MCP Server Integration - Research

**Researched:** 2026-03-07
**Domain:** MCP Protocol Integration with TypeScript SDK
**Confidence:** HIGH

## Summary

Phase 3 wires the existing SSH execution layer into the Model Context Protocol (MCP) using `@modelcontextprotocol/sdk` v1.27.1. The SDK's `McpServer` class provides a high-level API for registering tools, resources, and prompts with automatic Zod schema validation. The primary work is creating thin handler wrappers that convert the existing `Result<T>` service responses into MCP content envelopes.

**Primary recommendation:** Use `McpServer.registerTool()` with Zod input schemas for all five tools, `registerResource()` for ssh://hosts, and `registerPrompt()` for ssh_help. Each handler should be a thin adapter: validate input via existing schemas, call service layer, convert Result<T> to MCP response with `isError: true` for failures.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Server Structure**
- Two-file entry: `index.ts` (thin, connects transport) + `server.ts` (holds McpServer setup, registers all tools/resources/prompts)
- Direct imports in server.ts — import each tool's register function directly, no domain-level aggregator functions
- Stdio transport only for v1 (Claude Desktop); HTTP transport deferred to v2
- No explicit shutdown handling — let process exit naturally when stdin closes

**Tool Handler Organization**
- One file per tool: `tools/execute.ts`, `tools/output.ts`, `tools/status.ts`, `tools/kill.ts`, `tools/security-info.ts`
- Each exports `register(server, deps)` function where deps = { processManager, config, logger }
- Handlers are thin: validate input (Zod), call service layer, convert Result<T> to MCP response
- Service layer already has Zod schemas — reuse them for MCP registration

**Response Shape**
- All tools return `{ success: boolean, error_code?: string, error_message?: string, ...data }`
- Matches existing Result<T> pattern from service layer
- On failure: set MCP `isError: true` flag so Claude knows the call failed
- Each handler converts service Result<T> to MCP content envelope

**Resource & Prompt Design**
- **ssh://hosts resource**: Returns simple JSON array of host aliases from ~/.ssh/config
  - Example: `["prod", "staging", "dev", "db-primary"]`
  - Host details (hostname, port, user) can be discovered via tool calls if needed
- **ssh_help prompt**: Provides tool list with descriptions + example workflows
  - Lists all 5 tools with one-line descriptions
  - Shows common pattern: execute -> check status -> retrieve output
  - Includes tips for error handling

**Error Handling**
- Catch all exceptions in handlers — never throw from tool handlers
- Convert service Result<T> errors to structured response with `error_code` and `error_message`
- Use ErrorCode enum from errors.ts for consistent error codes
- MCP `isError: true` on application-level failures (not just protocol errors)

### Claude's Discretion

- Exact wording of ssh_help prompt content
- Log message format and level choices
- Minor code style details (null checks, type assertions)
- Import grouping/order in server.ts

### Deferred Ideas (OUT OF SCOPE)

- HTTP transport support — v2 requirement (WebStandardStreamableHTTPServerTransport)
- Graceful shutdown with connection cleanup — not needed for stdio-only v1
- Connection pooling with TTL — v2 requirement
- Tool-specific timeout overrides — could be future enhancement

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | Server connects via stdio transport for Claude Desktop integration | McpServer + StdioServerTransport pattern documented in Standard Stack |
| MCP-02 | Server exposes ssh://hosts resource listing configured SSH hosts | registerResource() pattern documented; listHosts() from config-parser.ts |
| MCP-03 | Server provides ssh_help prompt with usage guidance | registerPrompt() pattern documented in Architecture Patterns |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.27.1 | MCP protocol implementation | Official TypeScript SDK, only choice for MCP |
| zod | ^4.3.6 | Schema validation | Peer dependency of MCP SDK, already in use |

### Supporting (Existing Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ssh2 | ^1.17.0 | SSH connections | Already wrapped in service layer |
| ssh-config | ^5.1.0 | Parse ~/.ssh/config | Used by config-parser.ts |

### MCP SDK API Methods
| Method | Import Path | Purpose |
|--------|-------------|---------|
| `McpServer` | `@modelcontextprotocol/sdk/server/mcp.js` | High-level server class |
| `StdioServerTransport` | `@modelcontextprotocol/sdk/server/stdio.js` | Transport for Claude Desktop |
| `server.registerTool()` | (instance method) | Register MCP tool with Zod schema |
| `server.registerResource()` | (instance method) | Register MCP resource (e.g., hosts list) |
| `server.registerPrompt()` | (instance method) | Register MCP prompt template |
| `server.connect(transport)` | (instance method) | Start listening on transport |

**Installation:**
Already installed. No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts              # Barrel exports (existing)
├── server.ts             # NEW: McpServer setup + registration
├── tools/                # NEW: MCP tool handlers
│   ├── execute.ts        # execute_command handler
│   ├── output.ts         # get_command_output handler
│   ├── status.ts         # get_command_status handler
│   ├── kill.ts           # kill_command handler
│   └── security-info.ts  # get_security_info handler
├── resources/            # NEW: MCP resource handlers
│   └── hosts.ts          # ssh://hosts resource
├── prompts/              # NEW: MCP prompt templates
│   └── help.ts           # ssh_help prompt
├── schemas/              # Zod schemas (existing)
├── ssh/                  # SSH layer (existing)
├── config.ts             # AppConfig loader (existing)
├── errors.ts             # ErrorCode enum (existing)
├── types.ts              # Result<T> type (existing)
└── structured-logger.ts  # Logger (existing)
```

### Pattern 1: Server Entry Point
**What:** Two-file entry separating transport connection from server setup
**When to use:** All MCP servers
**Example:**
```typescript
// src/index.ts (thin entry)
#!/usr/bin/env bun
import { createServer } from "./server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

```typescript
// src/server.ts (server setup)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExecuteCommand } from "./tools/execute";
import { registerGetOutput } from "./tools/output";
// ... other imports

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ssh-exoman",
    version: "1.0.0",
  });

  const deps = {
    processManager: new ProcessManager(),
    config: loadConfig(),
    logger,
  };

  // Register all tools
  registerExecuteCommand(server, deps);
  registerGetOutput(server, deps);
  // ... other tool registrations

  return server;
}
```

### Pattern 2: Tool Handler with Result<T> Conversion
**What:** Thin handler that validates, delegates, and converts response
**When to use:** All MCP tool handlers
**Example:**
```typescript
// src/tools/execute.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ExecuteCommandSchema } from "../schemas/execute-command";
import { executeSSHCommand } from "../ssh/executor";
import type { Result } from "../types";

interface ToolDeps {
  processManager: ProcessManager;
  config: AppConfig;
  logger: Logger;
}

export function registerExecuteCommand(server: McpServer, deps: ToolDeps) {
  server.registerTool(
    "execute_command",
    {
      title: "Execute SSH Command",
      description: "Execute a command on a remote host via SSH",
      inputSchema: ExecuteCommandSchema,
    },
    async (params) => {
      try {
        const result = await executeSSHCommand(
          params.host,
          params.command,
          deps.config,
          deps.processManager
        );

        return resultToMcpResponse(result);
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error_code: "INTERNAL_ERROR",
              error_message: error instanceof Error ? error.message : "Unknown error",
            }),
          }],
          isError: true,
        };
      }
    }
  );
}

// Helper: Convert Result<T> to MCP response
function resultToMcpResponse<T>(result: Result<T>) {
  if (result.success) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, ...result.data }),
      }],
    };
  } else {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error_code: result.error.code,
          error_message: result.error.message,
        }),
      }],
      isError: true,
    };
  }
}
```

### Pattern 3: Resource Registration
**What:** Register a static or dynamic resource with URI
**When to use:** ssh://hosts resource
**Example:**
```typescript
// src/resources/hosts.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseSSHConfig, listHosts } from "../ssh/config-parser";

export function registerHostsResource(server: McpServer) {
  server.registerResource(
    "hosts",
    "ssh://hosts",
    {
      title: "SSH Hosts",
      description: "List of configured SSH host aliases",
      mimeType: "application/json",
    },
    async (uri) => {
      const config = parseSSHConfig();
      const hosts = listHosts(config);

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(hosts),
          mimeType: "application/json",
        }],
      };
    }
  );
}
```

### Pattern 4: Prompt Registration
**What:** Register a reusable prompt template
**When to use:** ssh_help prompt
**Example:**
```typescript
// src/prompts/help.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerHelpPrompt(server: McpServer) {
  server.registerPrompt(
    "ssh_help",
    {
      title: "SSH Help",
      description: "Guidance for using SSH tools",
    },
    () => ({
      messages: [{
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: `# SSH Tools Available

## Tools
1. **execute_command** - Run a command on a remote host
2. **get_command_status** - Check if a command is still running
3. **get_command_output** - Retrieve command output (stdout)
4. **kill_command** - Terminate a running command
5. **get_security_info** - View current security settings

## Typical Workflow
1. Execute command: \`execute_command(host="prod", command="ls -la")\`
2. Check status: \`get_command_status(process_id="...")\`
3. Get output: \`get_command_output(process_id="...", byte_offset=0)\`

## Error Handling
All tools return \`{ success: boolean, error_code?, error_message? }\`.
Check \`success\` before using other response fields.`,
        },
      }],
    })
  );
}
```

### Anti-Patterns to Avoid

- **Throwing from handlers:** MCP handlers must never throw; always return error response with `isError: true`
- **Logging to stdout:** MCP stdio transport reserves stdout for protocol; use stderr only (existing logger already does this)
- **Ignoring isError flag:** Application-level failures must set `isError: true` so Claude knows the tool call failed
- **Re-implementing validation:** Reuse existing Zod schemas; don't duplicate validation logic

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool input validation | Custom validator | `inputSchema` in registerTool() | MCP SDK handles Zod validation automatically |
| Error response formatting | Custom error shape | Result<T> pattern + isError flag | Consistent with existing patterns |
| Transport management | Manual stdio handling | StdioServerTransport | SDK handles framing, buffering |
| Process lifecycle | Shutdown handlers | None (let process exit naturally) | Stdio mode: stdin close = graceful exit |

**Key insight:** MCP SDK v1's `McpServer` class is high-level and opinionated. Work with it, not around it. The existing Result<T> pattern maps cleanly to MCP's content + isError model.

## Common Pitfalls

### Pitfall 1: Logging to stdout in stdio mode
**What goes wrong:** Log messages corrupt MCP protocol stream, causing Claude Desktop to fail
**Why it happens:** stdout is reserved for JSON-RPC messages in stdio transport
**How to avoid:** Use existing `structured-logger.ts` which writes to stderr via `console.error`
**Warning signs:** Claude Desktop shows "server disconnected" or protocol errors

### Pitfall 2: Forgetting isError flag on failure
**What goes wrong:** Claude thinks tool call succeeded even when `success: false` in response
**Why it happens:** MCP uses `isError` flag, not response body content, to determine failure
**How to avoid:** Always set `isError: true` when `result.success === false`
**Warning signs:** Claude doesn't suggest corrective actions after failed tool calls

### Pitfall 3: Not catching exceptions in handlers
**What goes wrong:** Unhandled exception crashes the MCP server, disconnecting Claude
**Why it happens:** Async exceptions in handler callbacks propagate to transport
**How to avoid:** Wrap handler body in try/catch, return error response with isError: true
**Warning signs:** Server exits unexpectedly, Claude shows connection error

### Pitfall 4: Wrong SDK import paths
**What goes wrong:** Module not found or wrong API version
**Why it happens:** SDK has multiple export paths for different use cases
**How to avoid:** Use exact paths: `@modelcontextprotocol/sdk/server/mcp.js` and `@modelcontextprotocol/sdk/server/stdio.js`
**Warning signs:** TypeScript errors, runtime module resolution failures

### Pitfall 5: Zod schema shape mismatch
**What goes wrong:** MCP SDK rejects schema or validation behaves unexpectedly
**Why it happens:** `inputSchema` expects Zod object, not raw shape
**How to avoid:** Pass existing Zod schemas directly (e.g., `ExecuteCommandSchema`), not Zod.shape objects
**Warning signs:** "Invalid schema" errors, missing validation

## Code Examples

### Server Bootstrap
```typescript
// Source: MCP SDK v1 documentation
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "ssh-exoman",
  version: "1.0.0",
});

// Register tools, resources, prompts...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Tool Registration with Zod
```typescript
// Source: MCP SDK v1 documentation
server.registerTool(
  "tool-name",
  {
    title: "Tool Title",
    description: "What this tool does",
    inputSchema: z.object({
      param: z.string().describe("Parameter description"),
    }),
  },
  async (params) => {
    // params is typed and validated
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);
```

### Error Response Pattern
```typescript
// Consistent error response for all tools
function errorResponse(code: string, message: string) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        success: false,
        error_code: code,
        error_message: message,
      }),
    }],
    isError: true,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Low-level Server class | McpServer high-level class | SDK v1 | Simpler registration, automatic Zod integration |
| Manual JSON-RPC framing | StdioServerTransport handles framing | SDK v1 | No protocol-level code needed |
| Custom error handling | isError flag + content envelope | SDK v1 | Claude can distinguish protocol vs app errors |

**Deprecated/outdated:**
- `server.tool()` method: Use `server.registerTool()` instead (v1 API)
- `Server` class from `/server/index.js`: Use `McpServer` from `/server/mcp.js`

## Open Questions

1. **ProcessManager instance lifecycle**
   - What we know: ProcessManager tracks running processes in memory
   - What's unclear: Should it be a singleton or passed through deps?
   - Recommendation: Create in createServer(), pass through deps object

2. **Claude Desktop config file location**
   - What we know: Claude Desktop config is at `~/Library/Application Support/Claude/claude_desktop_config.json`
   - What's unclear: Documentation needs exact path for user setup
   - Recommendation: Document setup in README with exact path

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None - Bun auto-discovers *.test.ts |
| Quick run command | `bun test` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | Server connects via stdio | unit | `bun test src/server.test.ts` | Wave 0 |
| MCP-02 | ssh://hosts resource returns host list | unit | `bun test src/resources/hosts.test.ts` | Wave 0 |
| MCP-03 | ssh_help prompt returns guidance | unit | `bun test src/prompts/help.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test` (all tests)
- **Per wave merge:** `bun test` (all tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/server.test.ts` - tests server creation and registration
- [ ] `src/tools/*.test.ts` - tests for each tool handler (5 files)
- [ ] `src/resources/hosts.test.ts` - tests hosts resource
- [ ] `src/prompts/help.test.ts` - tests help prompt
- [ ] `src/test-utils.ts` - shared test helpers (mock ProcessManager, etc.)

**Note:** Existing test files cover service layer (config, schemas, SSH modules). Wave 0 needs MCP-specific tests for handlers and server setup.

## Sources

### Primary (HIGH confidence)
- MCP SDK v1 source code: `node_modules/@modelcontextprotocol/sdk/dist/server/mcp.d.ts`
- Existing schemas: `src/schemas/*.ts`
- Existing SSH layer: `src/ssh/executor.ts`, `src/ssh/process-manager.ts`
- User decisions: `03-CONTEXT.md`

### Secondary (MEDIUM confidence)
- MCP TypeScript SDK documentation patterns (extrapolated from types)

### Tertiary (LOW confidence)
- None - all core patterns verified from codebase or SDK types

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SDK already installed, API verified from types
- Architecture: HIGH - Patterns match SDK design, existing codebase well-structured
- Pitfalls: HIGH - Common MCP stdio issues are well-documented

**Research date:** 2026-03-07
**Valid until:** 30 days (MCP SDK v1 is stable)
