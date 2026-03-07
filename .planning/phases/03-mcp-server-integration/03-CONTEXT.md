# Phase 3: MCP Server Integration - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A complete, working MCP server that Claude Desktop can connect to via stdio, exposing all SSH tools (execute_command, get_command_output, get_command_status, kill_command, get_security_info), the ssh://hosts resource, and the ssh_help prompt. This phase wires existing service modules into the MCP protocol — no new business logic, just protocol integration.

</domain>

<decisions>
## Implementation Decisions

### Server Structure
- Two-file entry: `index.ts` (thin, connects transport) + `server.ts` (holds McpServer setup, registers all tools/resources/prompts)
- Direct imports in server.ts — import each tool's register function directly, no domain-level aggregator functions
- Stdio transport only for v1 (Claude Desktop); HTTP transport deferred to v2
- No explicit shutdown handling — let process exit naturally when stdin closes

### Tool Handler Organization
- One file per tool: `tools/execute.ts`, `tools/output.ts`, `tools/status.ts`, `tools/kill.ts`, `tools/security-info.ts`
- Each exports `register(server, deps)` function where deps = { processManager, config, logger }
- Handlers are thin: validate input (Zod), call service layer, convert Result<T> to MCP response
- Service layer already has Zod schemas — reuse them for MCP registration

### Response Shape
- All tools return `{ success: boolean, error_code?: string, error_message?: string, ...data }`
- Matches existing Result<T> pattern from service layer
- On failure: set MCP `isError: true` flag so Claude knows the call failed
- Each handler converts service Result<T> to MCP content envelope

### Resource & Prompt Design
- **ssh://hosts resource**: Returns simple JSON array of host aliases from ~/.ssh/config
  - Example: `["prod", "staging", "dev", "db-primary"]`
  - Host details (hostname, port, user) can be discovered via tool calls if needed
- **ssh_help prompt**: Provides tool list with descriptions + example workflows
  - Lists all 5 tools with one-line descriptions
  - Shows common pattern: execute → check status → retrieve output
  - Includes tips for error handling

### Error Handling
- Catch all exceptions in handlers — never throw from tool handlers
- Convert service Result<T> errors to structured response with `error_code` and `error_message`
- Use ErrorCode enum from errors.ts for consistent error codes
- MCP `isError: true` on application-level failures (not just protocol errors)

### Claude's Discretion
- Exact wording of ssh_help prompt content
- Log message format and level choices
- Minor code style details (null checks, type assertions)
- Import grouping/order in server.ts

</decisions>

<specifics>
## Specific Ideas

- "Keep handlers thin — they should validate and delegate, not implement business logic"
- "Error messages should be actionable — tell Claude what went wrong and what to try"
- "The hosts resource is for discovery; detailed config stays in service layer"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/index.ts`: Barrel exports all public APIs — tools will import from here
- `src/schemas/*.ts`: Zod schemas for all 5 tools already defined — reuse for MCP registration
- `src/ssh/index.ts`: SSH module with connect, executeSSHCommand, ProcessManager, listHosts
- `src/types.ts`: Result<T> type, ProcessStatus, SecurityMode, etc.
- `src/errors.ts`: ErrorCode enum with codes like INVALID_INPUT, SSH_CONNECTION_FAILED, etc.
- `src/structured-logger.ts`: Logger that writes to stderr (never stdout)
- `src/config.ts`: AppConfig with timeouts, security mode, log level

### Established Patterns
- Result<T> discriminated union for all service responses
- validateInput(schema, input) helper returns Result<T>
- Logging to stderr only — critical for stdio transport
- Barrel exports from index.ts for clean imports
- ProcessManager class for background process tracking

### Integration Points
- Tool handlers will import ProcessManager, executeSSHCommand, listHosts from src/ssh
- Resource handler will call listHosts() from ssh/config-parser
- All handlers use logger from src/structured-logger.ts
- Security validation via validateCommand from src/security-validator.ts
- MCP SDK: `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- Transport: `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`

</code_context>

<deferred>
## Deferred Ideas

- HTTP transport support — v2 requirement (WebStandardStreamableHTTPServerTransport)
- Graceful shutdown with connection cleanup — not needed for stdio-only v1
- Connection pooling with TTL — v2 requirement
- Tool-specific timeout overrides — could be future enhancement

</deferred>

---

*Phase: 03-mcp-server-integration*
*Context gathered: 2026-03-07*
