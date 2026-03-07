# Project Research Summary

**Project:** ssh-exoman (MCP SSH Server)
**Domain:** AI-native remote command execution via Model Context Protocol
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

ssh-exoman is a TypeScript/Bun rebuild of a proven Python MCP SSH server that enables AI assistants (primarily Claude Desktop) to execute commands on remote hosts via SSH. The product domain is well-understood: the reference Python implementation has 107 tests at 87% coverage, a comprehensive PRD, and a clear feature set of 6 tools, 1 resource, and 1 prompt. The recommended approach is a minimal-dependency stack (MCP SDK, ssh2, ssh-config, Zod) running on Bun, with a modular architecture that avoids the Python version's monolithic server file. Build bottom-up: foundation modules first (config, security, process tracking), then SSH layer, then MCP integration, then transports.

The key technical risk is not the domain complexity but the integration seams: ssh2's event-driven connection lifecycle under Bun, background process race conditions with remote temp files, and stdio transport corruption from accidental stdout writes. All three are well-documented pitfalls with known prevention strategies. The security validator's regex-based blacklist is a defense-in-depth measure, not a security boundary -- this must be clearly communicated. The MCP SDK v1.27 is stable and has explicit Bun support via `WebStandardStreamableHTTPServerTransport`, so there is no need to use the pre-alpha v2.

The stack is deliberately lean: 3 runtime dependencies plus Zod as a peer dep, 2 dev dependencies. No Express, no logging library, no UUID package. Bun provides the runtime, test runner, .env loading, and HTTP server. This simplicity is a strength -- fewer dependencies means fewer integration surprises and faster startup (important for stdio MCP servers launched per-session by Claude Desktop).

## Key Findings

### Recommended Stack

The stack centers on Bun (^1.3) as the runtime with native TypeScript execution, the official MCP SDK (^1.27.1) for protocol handling, ssh2 (^1.17.0) as the only mature pure-JS SSH2 implementation, and ssh-config (^5.1.0) for parsing `~/.ssh/config`. Zod 4 handles schema validation as an MCP SDK peer dependency. All libraries are confirmed Bun-compatible with no native bindings required.

**Core technologies:**
- **Bun ^1.3**: Runtime, package manager, test runner, HTTP server -- project constraint, also gives faster cold start than Node.js
- **@modelcontextprotocol/sdk ^1.27.1**: Official MCP protocol implementation with StdioServerTransport and WebStandardStreamableHTTPServerTransport (Bun-native)
- **ssh2 ^1.17.0**: Pure-JS SSH2 client supporting exec, shell, SFTP -- no native bindings needed
- **ssh-config ^5.1.0**: Zero-dependency SSH config parser handling Host blocks, wildcards, Include directives
- **Zod ^4.0**: Tool input schema validation, MCP SDK peer dependency

### Expected Features

**Must have (table stakes):**
- Background command execution with UUID tracking (core value proposition)
- Chunked output retrieval (AI context windows are limited)
- Command status polling (lightweight, token-efficient)
- Process termination with SIGTERM/SIGKILL escalation
- SSH config integration (users already have `~/.ssh/config`)
- Command security validation (blacklist mode, ship secure by default)
- Security info introspection
- Stdio transport (Claude Desktop integration path)
- `ssh://hosts` MCP resource and `ssh_help` MCP prompt
- Structured error responses and env-based configuration

**Should have (add after core validation):**
- SFTP file transfer (upload/download)
- Connection pooling with TTL (performance for multi-step workflows)
- HTTP/Streamable transport (remote MCP access beyond local stdio)
- Custom blacklist/whitelist patterns via env vars
- Per-operation configurable timeouts

**Defer (v2+):**
- SSH key passphrase support
- Multiple identity file resolution
- Jump host / ProxyJump awareness
- Structured logging with log levels
- Health check endpoint for HTTP transport

**Anti-features (do not build):**
- Interactive/PTY sessions (MCP is request/response, not streaming)
- SSH agent forwarding (security risk when AI controls the agent)
- Multi-tenant auth, web UI, command retry, key generation, sudo support

### Architecture Approach

The architecture follows a layered pattern: thin MCP tool handlers at the top call into a service layer (security validator, process manager, SSH connection manager, command executor), which sits atop the ssh2 protocol layer. Two entry points (stdio and HTTP) share the same McpServer instance. The project structure splits into `tools/`, `ssh/`, `process/`, `security/`, `config/`, `resources/`, `prompts/`, and `utils/` directories -- one file per tool handler, one module per concern.

**Major components:**
1. **MCP Server Core** -- Protocol handling, tool/resource/prompt registration via SDK
2. **Tool Handlers** (6 tools) -- Thin orchestrators: validate input, call services, format MCP responses
3. **Security Validator** -- Stateless regex-based command validation with blacklist/whitelist/disabled modes
4. **Process Manager** -- In-memory UUID-keyed Map tracking background process lifecycle
5. **Connection Manager** -- SSH connection pooling with TTL, health checks, config resolution
6. **Command Executor** -- Simple/complex/background command execution via ssh2, temp file output redirection
7. **SSH Config Parser** -- Wraps ssh-config library for host resolution from `~/.ssh/config`

### Critical Pitfalls

1. **ssh2 connection lifecycle mismanagement** -- Always attach error/close/end listeners on every Client instance. Use keepaliveInterval for proactive dead connection detection. Destroy stale connections with both `client.end()` AND `client.destroy()`.
2. **Background process race conditions** -- PID capture, exit code detection, and output chunking all have race windows. Use PID file approach, check both `kill -0` and exit code file, add brief delay after process start, use atomic rename for exit code writes.
3. **Security validator bypass via shell metacharacters** -- Regex blacklist is bypassable via command substitution, eval, base64 encoding, variable expansion. Add normalization layer, block metacharacter patterns by default, document blacklist as "accident reduction, not security boundary."
4. **stdio transport logging corruption** -- Any stdout output that is not JSON-RPC corrupts the Claude Desktop connection. Route ALL logging to stderr from day one. Ban `console.log`. Catch unhandled exceptions globally.
5. **Temp file cleanup failures** -- Background processes create files in `/tmp` on remote hosts. Server crashes leave orphans. Implement periodic cleanup sweep, use subdirectory, clean on startup.

## Implications for Roadmap

Based on research, the project naturally divides into 5 phases following the bottom-up dependency ordering identified in architecture research.

### Phase 1: Foundation and Core Services
**Rationale:** All higher layers depend on config, security, process tracking, and logging. These are independently testable with zero external dependencies. Security must be correct from the start.
**Delivers:** Environment config module, structured stderr logger, custom error types, Zod schemas for all tool inputs, security validator with blacklist/whitelist/disabled modes and bypass-resistant patterns, process manager with in-memory UUID tracking.
**Addresses:** env-based configuration, security validation, security info introspection, structured error responses
**Avoids:** Pitfall 3 (security bypass), Pitfall 5 (stdio logging corruption)

### Phase 2: SSH Layer
**Rationale:** Depends on config and logger from Phase 1. The SSH layer is the infrastructure all tools need. Connection management must handle lifecycle events correctly before any tools are built on top.
**Delivers:** SSH config parser (wrapping ssh-config library), connection manager with basic connect/disconnect (pooling deferred), command executor supporting simple/complex/background execution via remote temp files, SFTP transfer operations.
**Addresses:** SSH config integration, background command execution, file transfer capability
**Avoids:** Pitfall 1 (connection lifecycle), Pitfall 2 (process race conditions), Pitfall 6 (config parser edge cases), Pitfall 7 (temp file cleanup)

### Phase 3: MCP Tools and Integration
**Rationale:** Depends on both Phase 1 and Phase 2. Each tool handler is thin glue wiring validated input to service-layer calls and formatting MCP responses. All 6 tools plus the resource and prompt can be implemented once the service layer exists.
**Delivers:** All MCP tool handlers (execute_command, get_command_output, get_command_status, kill_command, get_security_info, transfer_file), ssh://hosts resource, ssh_help prompt, McpServer registration.
**Addresses:** All table-stakes features, MCP resource/prompt discovery
**Avoids:** Anti-pattern of monolithic server file

### Phase 4: Stdio Transport and Claude Desktop Integration
**Rationale:** The primary integration path. Stdio transport is a thin wrapper connecting McpServer to StdioServerTransport. This phase includes end-to-end testing with actual Claude Desktop.
**Delivers:** Working stdio entry point (`index.ts`), Claude Desktop configuration, end-to-end validation.
**Addresses:** Stdio transport (table stakes), Claude Desktop integration
**Avoids:** Pitfall 5 (stdout corruption -- verified by E2E testing)

### Phase 5: Connection Pooling, HTTP Transport, and Polish
**Rationale:** Performance optimizations and remote access are "should have" features that build on the working core. Connection pooling enhances Phase 2's connection manager. HTTP transport is an independent entry point.
**Delivers:** Connection pooling with TTL and health checks, HTTP entry point (`index-http.ts`) via Bun.serve() + WebStandardStreamableHTTPServerTransport, custom security pattern support, per-operation timeouts.
**Addresses:** All differentiator features (connection pooling, HTTP transport, custom security, configurable timeouts)
**Avoids:** Building optimization before correctness is proven

### Phase Ordering Rationale

- **Bottom-up by dependency**: Config and security have zero dependencies. SSH layer depends on config. Tools depend on SSH and security. Transports depend on tools being registered. This ordering means each phase can be fully tested before the next begins.
- **Security-first**: The security validator is built and tested in Phase 1, before any SSH connection code exists. Every subsequent phase inherits the security constraint.
- **Stdio before HTTP**: Claude Desktop is the primary use case. HTTP transport is a differentiator, not table stakes. Shipping a working stdio server validates the product before investing in remote access.
- **Pooling last**: Connection pooling is an optimization. The SSH layer works without it. Adding pooling to a correct, tested connection manager is low-risk. Adding pooling during initial development is a complexity trap.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (SSH Layer):** Background execution via remote temp files has subtle race conditions. The exact shell commands for nohup/PID capture/exit code writing need careful testing against different remote OS flavors (Ubuntu, macOS, Alpine).
- **Phase 5 (HTTP Transport):** WebStandardStreamableHTTPServerTransport + Bun.serve() integration needs API verification. The architecture research flags this as MEDIUM confidence.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Pure logic modules -- config parsing, regex validation, Map-based tracking. Well-documented patterns.
- **Phase 3 (MCP Tools):** Tool registration follows the SDK's documented `registerTool` API. The Python reference implementation provides exact tool signatures and response shapes.
- **Phase 4 (Stdio Transport):** StdioServerTransport is a single line of SDK code. The integration is trivial.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via npm registry, Bun compatibility confirmed, versions pinned. MCP SDK explicitly documents Bun support. |
| Features | HIGH | Rebuilding a proven Python implementation with 107 tests. Feature set is known and validated. PRD provides exact tool signatures. |
| Architecture | HIGH | Layered architecture follows standard MCP server patterns. Python reference validates component boundaries. Build order is dependency-driven. |
| Pitfalls | HIGH | Pitfalls are well-understood SSH and MCP domain issues. Prevention strategies are concrete and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **MCP SDK registerTool vs tool API**: The SDK may use `.tool()` (older) or `.registerTool()` (newer). Verify the exact method name on the installed v1.27.1 during Phase 3 implementation.
- **Bun + ssh2 crypto performance**: ssh2 falls back to pure-JS crypto when native bindings are unavailable (expected under Bun). Performance impact is likely negligible but should be measured with a simple benchmark during Phase 2.
- **WebStandardStreamableHTTPServerTransport session management**: The HTTP transport supports sessions via `sessionIdGenerator`. How session cleanup works (memory leaks for abandoned sessions) needs verification during Phase 5.
- **Remote OS compatibility**: Background execution shell commands (nohup, temp file paths, process detection via kill -0) may behave differently on macOS vs Linux remotes. Test matrix needed during Phase 2.
- **ssh-config library coverage**: Verify the ssh-config library handles Include directives and ProxyJump. If gaps exist, document workarounds.

## Sources

### Primary (HIGH confidence)
- MCP TypeScript SDK v1.27.1 -- installed and inspected type definitions directly
- ssh2 v1.17.0 npm package -- pure-JS SSH2 implementation, verified Bun compatibility
- ssh-config v5.1.0 npm package -- zero-dependency config parser
- Project PRD.md -- comprehensive specification from Python source analysis (107 tests, 87% coverage)
- PROJECT.md -- project constraints, requirements, out-of-scope decisions

### Secondary (MEDIUM confidence)
- MCP SDK WebStandardStreamableHTTPServerTransport docs comment re: Bun support
- Python mcp_ssh reference implementation -- feature set and architecture patterns
- OpenSSH config specification (`man ssh_config`) -- parser edge cases

### Tertiary (LOW confidence)
- MCP SDK v2 pre-alpha patterns referenced in PRD -- not used, but noted as future migration path
- Competitor MCP SSH server analysis -- limited due to unavailable web search during research

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
