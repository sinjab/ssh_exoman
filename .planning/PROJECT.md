# ssh-exoman

## What This Is

A TypeScript MCP server that gives AI assistants (like Claude Desktop) secure SSH capabilities — executing remote commands and managing background processes on remote hosts. The v1.0 MVP delivers a working stdio-connected server with security validation, process tracking, and full Claude Desktop integration.

## Core Value

AI assistants can securely execute and manage SSH commands on remote hosts through MCP, with proper security validation and background process tracking.

## Requirements

### Validated

- ✓ Execute SSH commands in background with process tracking (UUID-based) — v1.0
- ✓ Retrieve command output with chunked reading support — v1.0
- ✓ Check command status without retrieving full output — v1.0
- ✓ Kill running background processes (SIGTERM → SIGKILL escalation) — v1.0
- ✓ Inspect current security configuration — v1.0
- ✓ List configured SSH hosts from ~/.ssh/config — v1.0
- ✓ Provide interactive SSH help prompt — v1.0
- ✓ Parse ~/.ssh/config for host resolution — v1.0
- ✓ Command security validation (blacklist/whitelist/disabled modes) — v1.0
- ✓ Support stdio transport (Claude Desktop integration) — v1.0
- ✓ Structured error responses for all failure modes — v1.0
- ✓ Structured logging — v1.0

### Active

- [ ] Transfer files via SFTP (upload and download)
- [ ] Connection pooling with configurable reuse and TTL
- [ ] Support HTTP transport (remote MCP access)
- [ ] Configurable timeouts per operation type
- [ ] Custom blacklist/whitelist patterns via environment variables

### Out of Scope

- Mobile or web UI — this is a headless MCP server, AI assistant IS the UI
- Database persistence — all state is ephemeral per session
- Multi-tenant auth — single-user server model
- SSH agent forwarding — security risk when AI controls the agent; use ProxyJump in ~/.ssh/config instead
- Interactive/PTY sessions — MCP is request/response, background execution covers 95% of use cases

## Context

**Shipped v1.0 MVP:**
- 3 phases, 10 plans executed in single day (March 7, 2026)
- ~5,821 TypeScript LOC across 26 source files
- 261 tests passing
- Tech stack: Bun runtime, MCP TypeScript SDK v2, Zod 4, ssh2

**Architecture highlights:**
- Clean separation: foundation services → SSH layer → MCP integration
- Result<T> pattern throughout for structured error handling
- TDD approach with 4:1 test-to-code ratio

## Constraints

- **Runtime**: Bun — per project conventions in CLAUDE.md
- **Protocol**: MCP TypeScript SDK v2 (`@modelcontextprotocol/sdk`)
- **Validation**: Zod schemas for all MCP tool inputs/outputs
- **SSH Library**: `ssh2` (mature, low-level control) + `ssh2-sftp-client` for file transfers (v2)
- **Security**: 36 default blacklist patterns for dangerous commands
- **Compatibility**: Must work with Claude Desktop via stdio transport

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun over Node.js | Project conventions, built-in TS support, faster runtime | ✓ Good |
| Three-phase architecture | Foundation → SSH → MCP ensures dependency order | ✓ Good |
| Result<T> pattern | Structured error handling without exceptions | ✓ Good |
| 36 security patterns | Exceeded planned 30 for better coverage | ✓ Good |
| Hybrid output handling | Stream + temp file for post-completion retrieval | ✓ Good |
| Per-host passphrase env vars | SSH_PASSPHRASE_{HOST} for flexibility | ✓ Good |
| schema._zod.def.shape | Zod 4 compatibility with MCP SDK | ✓ Good |
| registerTool() API | Current MCP SDK method (deprecated tool()) | ✓ Good |

---
*Last updated: 2026-03-07 after v1.0 MVP milestone*
