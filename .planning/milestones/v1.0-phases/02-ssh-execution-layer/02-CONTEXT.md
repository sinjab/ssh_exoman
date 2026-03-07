# Phase 2: SSH Execution Layer - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Commands can be executed on remote SSH hosts with background process tracking, output retrieval, status checking, and process termination — all using ~/.ssh/config for host resolution. Security validation (from Phase 1) applies to all commands.

</domain>

<decisions>
## Implementation Decisions

### SSH Config Parsing
- Expand wildcard host patterns (e.g., `Host *.example.com`) into matched host aliases
- Parse standard SSH config fields: Host, HostName, User, Port, IdentityFile
- Return partial config with defaults for missing required fields (User=$USER, Port=22)
- Skip any `Match` entries with wildcards, only return exact matches

### Command Execution Mode
- Always wrap commands in shell (`/bin/sh -c "{command}"`)
- Direct `exec` for simple commands, shell wrapper for complex commands
- Shell wrapper ensures consistent behavior with pipes, semicolons, globbing, redirection

### Output Buffering Strategy
- Hybrid approach: stream output during command execution AND persist to temp file after completion
- Default chunk size: 4KB for pagination
- Stream during execution enables real-time monitoring
- Temp files enable retrieval after process completes
- Handles large outputs (multi-GB) by reading in chunks

### Process Kill Escalation
- Send SIGTERM, wait 5 seconds
- If still running, send SIGKILL
- Standard escalation pattern (2s + 5s)

</decisions>

<specifics>
## Specific Ideas

- Commands should feel "ssh-like" — familiar to infrastructure teams
- Shell wrapper keeps output behavior predictable (pipes work, same way)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Result<T>` type (src/types.ts): Use for structured responses from all SSH operations
- `AppConfig` (src/config.ts): Provides timeouts (sshConnectTimeout: 30s, commandTimeout: 60s)
- `validateCommand` (src/security-validator.ts): Validates commands before execution
- `StructuredLogger` (src/structured-logger.ts): JSON logging to stderr
- Zod schemas (src/schemas/): Already define input shapes for all tools

### Established Patterns
- Result<T> discriminated union for success/error
- Config via env vars with defaults, never throws
- Structured logging to stderr (never stdout)
- safeParse always for Zod validation

- Barrel exports from `src/index.ts` for clean module access

### Integration Points
- SSH module will use `AppConfig` for security validation
- Background executor will call `executeCommand` before running commands
- Output retrieval will use SSH client connection
- Process manager will track background processes by UUID

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-ssh-execution-layer*
*Context gathered: 2026-03-07*
