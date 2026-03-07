# ssh-exoman

## What This Is

A TypeScript MCP server that gives AI assistants (like Claude Desktop) secure SSH capabilities — executing remote commands, transferring files, and managing background processes on remote hosts. This is a ground-up rebuild of an existing Python MCP SSH server, rethinking the architecture while maintaining feature parity.

## Core Value

AI assistants can securely execute and manage SSH commands on remote hosts through MCP, with proper security validation and background process tracking.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Execute SSH commands in background with process tracking (UUID-based)
- [ ] Retrieve command output with chunked reading support
- [ ] Check command status without retrieving full output
- [ ] Kill running background processes (SIGTERM → SIGKILL escalation)
- [ ] Transfer files via SFTP (upload and download)
- [ ] Inspect current security configuration
- [ ] List configured SSH hosts from ~/.ssh/config
- [ ] Provide interactive SSH help prompt
- [ ] Parse ~/.ssh/config for host resolution
- [ ] Connection pooling with configurable reuse and TTL
- [ ] Command security validation (blacklist/whitelist/disabled modes)
- [ ] Support stdio transport (Claude Desktop integration)
- [ ] Support HTTP transport (remote MCP access)
- [ ] Configurable timeouts per operation type
- [ ] Structured error responses for all failure modes
- [ ] Structured logging

### Out of Scope

- Mobile or web UI — this is a headless MCP server
- Database persistence — all state is ephemeral per session
- Multi-tenant auth — single-user server model
- SSH agent forwarding — not in Python version scope
- Interactive/PTY sessions — background execution only

## Context

- Rebuilding from a Python MCP SSH server (`mcp_ssh`) that has 107 tests, 87% coverage, 6 tools, 1 resource, 1 prompt
- The Python version has a monolithic `server.py` (~1020 lines) — this rebuild aims for better separation of concerns
- Using Bun as runtime instead of Node.js (per project conventions)
- PRD.md exists as a detailed reference but architecture decisions should be rethought from scratch
- Should study the official MCP TypeScript SDK (https://github.com/modelcontextprotocol/typescript-sdk) for best practices and idiomatic patterns
- Bun's built-in test runner replaces Vitest/Jest
- Bun auto-loads .env, no dotenv needed

## Constraints

- **Runtime**: Bun — per project conventions in CLAUDE.md
- **Protocol**: MCP TypeScript SDK v2 (`@modelcontextprotocol/sdk`)
- **Validation**: Zod schemas for all MCP tool inputs/outputs
- **SSH Library**: `ssh2` (mature, low-level control) + `ssh2-sftp-client` for file transfers
- **Security**: Default blacklist of ~30 dangerous command patterns must ship out of the box
- **Compatibility**: Must work with Claude Desktop via stdio transport

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun over Node.js | Project conventions, built-in TS support, faster runtime | — Pending |
| PRD as reference, not spec | Want to rethink architecture using MCP SDK best practices | — Pending |
| Fresh architecture | Python version's monolithic server.py needs better separation | — Pending |
| Both stdio + HTTP transports | Need Claude Desktop integration and remote access | — Pending |

---
*Last updated: 2026-03-07 after initialization*
