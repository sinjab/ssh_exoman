# Architecture

**Analysis Date:** 2026-03-07

## Pattern Overview

**Overall:** MCP Server with layered module architecture (greenfield project, PRD-defined)

**Key Characteristics:**
- Model Context Protocol (MCP) server providing SSH capabilities to AI clients (Claude Desktop)
- Layered design: MCP transport -> Server/tool registration -> Domain modules (SSH, security, process)
- Background execution model: commands run asynchronously on remote hosts, tracked by UUID
- All communication via MCP protocol over stdio or HTTP transports
- Bun runtime (not Node.js) per project conventions

**Current State:**
This is a greenfield project. Only a scaffold `index.ts` with `console.log("Hello via Bun!")` exists. The architecture below is prescribed by `PRD.md` and should be followed during implementation.

## Layers

**Transport Layer (Entry Points):**
- Purpose: Accept MCP protocol connections from clients
- Location: `src/index.ts` (stdio), `src/index-http.ts` (HTTP)
- Contains: Transport initialization, server bootstrap
- Depends on: Server layer
- Used by: MCP clients (Claude Desktop, remote HTTP clients)

**Server Layer:**
- Purpose: MCP server setup, tool/resource/prompt registration, request routing
- Location: `src/server.ts`
- Contains: MCP server instantiation, tool handler registration, lifecycle management
- Depends on: Tools, Resources, Prompts modules
- Used by: Transport layer

**Tools Layer:**
- Purpose: Implement MCP tool handlers (the core API surface)
- Location: `src/tools/`
- Contains: 6 tool handlers (`execute.ts`, `output.ts`, `status.ts`, `kill.ts`, `transfer.ts`, `security-info.ts`)
- Depends on: SSH module, Process module, Security module
- Used by: Server layer

**Resources Layer:**
- Purpose: Implement MCP resource providers
- Location: `src/resources/`
- Contains: `hosts.ts` (ssh://hosts resource listing configured SSH hosts)
- Depends on: SSH config parser
- Used by: Server layer

**Prompts Layer:**
- Purpose: Implement MCP prompt templates
- Location: `src/prompts/`
- Contains: `help.ts` (ssh_help prompt with usage guidance)
- Depends on: None
- Used by: Server layer

**SSH Client Layer:**
- Purpose: All SSH operations -- connections, command execution, file transfer, config parsing
- Location: `src/ssh/`
- Contains: `client.ts` (connection pooling), `config.ts` (SSH config parser), `execute.ts` (command execution), `transfer.ts` (SFTP/SCP), `background.ts` (background execution)
- Depends on: `ssh2` or `node-ssh` library, Config module
- Used by: Tools layer

**Process Manager Layer:**
- Purpose: Track background processes by UUID, manage lifecycle
- Location: `src/process/`
- Contains: `manager.ts` (process lifecycle tracking), `types.ts` (BackgroundProcess interface)
- Depends on: SSH client layer (for remote status checks)
- Used by: Tools layer

**Security Module:**
- Purpose: Validate commands against configurable blacklist/whitelist policies
- Location: `src/security/`
- Contains: `validator.ts` (validation logic), `patterns.ts` (default patterns)
- Depends on: Config module
- Used by: Tools layer (specifically `execute.ts`)

**Config Module:**
- Purpose: Parse environment variables into typed configuration
- Location: `src/config/`
- Contains: `env.ts` (environment variable parsing with defaults)
- Depends on: Environment variables (Bun auto-loads `.env`)
- Used by: All other modules

**Types Module:**
- Purpose: Shared Zod schemas and TypeScript types for requests/responses
- Location: `src/types/`
- Contains: `requests.ts` (Zod schemas for tool inputs), `responses.ts` (Zod schemas for tool outputs)
- Depends on: Zod
- Used by: Tools layer, Server layer

**Utils Module:**
- Purpose: Cross-cutting utilities
- Location: `src/utils/`
- Contains: `logger.ts` (structured logging via Pino)
- Depends on: Logging library
- Used by: All modules

## Data Flow

**Command Execution (Primary Flow):**

1. MCP client sends `execute_command` tool call via stdio/HTTP transport
2. `src/server.ts` routes to `src/tools/execute.ts` handler
3. Handler validates input via Zod schema (`CommandRequestSchema`)
4. `src/security/validator.ts` checks command against security policy (blacklist/whitelist)
5. `src/ssh/client.ts` retrieves or creates SSH connection (with pooling)
6. `src/ssh/background.ts` executes command in background on remote host (nohup with output redirection)
7. `src/process/manager.ts` creates tracking entry with UUID
8. Handler waits briefly (configurable, default 5s) for quick commands
9. Returns `CommandResult` with process_id, initial status, and any partial output

**Output Retrieval (Polling Flow):**

1. MCP client sends `get_command_output` with process_id and optional start_byte
2. `src/process/manager.ts` looks up process by UUID
3. `src/ssh/execute.ts` reads output chunk from remote temp file (`tail -c +N | head -c M`)
4. Returns chunk with `has_more_output` flag for pagination

**Process Termination Flow:**

1. MCP client sends `kill_command` with process_id
2. Process manager looks up the tracked process
3. Sends SIGTERM via SSH, waits 2 seconds
4. If still running, sends SIGKILL
5. Optionally cleans up remote temp files

**File Transfer Flow:**

1. MCP client sends `transfer_file` with host, paths, direction
2. SSH client opens SFTP channel
3. File streamed with timeout protection
4. Returns bytes transferred

**State Management:**
- In-memory `Map<string, BackgroundProcess>` in process manager (not persisted)
- SSH connection pool managed in `src/ssh/client.ts` (in-memory)
- No database; all state is ephemeral per server session
- Remote state: temp output/error files in configurable temp directory (`/tmp` by default)

## Key Abstractions

**BackgroundProcess:**
- Purpose: Represents a tracked remote command execution
- Definition: `src/process/types.ts`
- Pattern: UUID-keyed entries with status state machine (running -> completed | failed | killed)

**SSHHostConfig:**
- Purpose: Parsed SSH host configuration from `~/.ssh/config`
- Definition: `src/ssh/config.ts`
- Pattern: Interface with known SSH config fields plus dynamic key-value pairs

**Zod Request/Response Schemas:**
- Purpose: Validate all MCP tool inputs and structure outputs
- Definition: `src/types/requests.ts`, `src/types/responses.ts`
- Pattern: Zod schemas with `.infer<>` for TypeScript types; schemas used at validation boundary

**Security Validator:**
- Purpose: Gate command execution based on configurable regex patterns
- Definition: `src/security/validator.ts`
- Pattern: Three modes (blacklist, whitelist, disabled); compiled regex patterns for efficient matching

## Entry Points

**Stdio Transport (`src/index.ts`):**
- Location: `src/index.ts`
- Triggers: Spawned by Claude Desktop or MCP client via stdio
- Responsibilities: Initialize MCP server, connect stdio transport, start listening

**HTTP Transport (`src/index-http.ts`):**
- Location: `src/index-http.ts`
- Triggers: Started as a long-running HTTP server for remote MCP access
- Responsibilities: Initialize MCP server, bind HTTP/SSE transport, handle auth

**Current scaffold (`index.ts` at root):**
- Location: `index.ts` (project root)
- This is a placeholder from `bun init`. Will be replaced by the `src/` entry points.

## Error Handling

**Strategy:** Structured error responses within MCP tool results

**Patterns:**
- All tool handlers return structured result objects with `success: boolean` and `error_message: string`
- SSH connection errors caught and returned as failed results (not thrown)
- Security validation failures return descriptive error messages
- Timeouts handled via configurable timeout values per operation type
- Process kill uses escalating signals (SIGTERM -> SIGKILL) with grace period

## Cross-Cutting Concerns

**Logging:** Structured logging via Pino (or similar), configured in `src/utils/logger.ts`
**Validation:** Zod schemas at the MCP tool input boundary (`src/types/requests.ts`)
**Authentication:** SSH key-based auth via `~/.ssh/config`; MCP transport auth is transport-dependent
**Configuration:** Environment variables parsed in `src/config/env.ts`, auto-loaded by Bun from `.env`

---

*Architecture analysis: 2026-03-07*
