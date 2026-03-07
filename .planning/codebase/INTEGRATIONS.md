# External Integrations

**Analysis Date:** 2026-03-07

## Current State

This project is at the initial scaffold stage. No integrations are implemented yet. All integrations below are specified in the PRD (`PRD.md`) and represent the target design.

## APIs & External Services

**MCP Protocol (Model Context Protocol):**
- Purpose: Primary communication protocol with AI clients (Claude Desktop)
- SDK: `@modelcontextprotocol/sdk` (not yet installed)
- Transports:
  - **stdio** - Default transport for Claude Desktop integration (entry: `src/index.ts`)
  - **HTTP/SSE** - Remote access transport (entry: `src/index-http.ts`)
- Auth: None for stdio; HTTP transport may require configuration

**SSH Protocol:**
- Purpose: Execute commands, transfer files on remote hosts
- Library: `ssh2` (planned, not yet installed)
- Auth: SSH keys from `~/.ssh/` directory, passphrase support
- Config: Reads `~/.ssh/config` for host definitions
- Features: Connection pooling/caching, direct and shell execution modes

## Data Storage

**Databases:**
- None - This is a stateless MCP server

**File Storage:**
- Local filesystem: Reads `~/.ssh/config`, SSH keys
- Remote filesystem: File transfer via SFTP/SCP to remote hosts
- Temporary files: Background process output/error stored on remote hosts at `/tmp/mcp_bg_*`

**Caching:**
- In-memory SSH connection pool (planned in `src/ssh/client.ts`)
- In-memory process tracking Map (planned in `src/process/manager.ts`)

## Authentication & Identity

**SSH Authentication:**
- Key-based auth: Reads private keys from `~/.ssh/`
- Passphrase support: For encrypted private keys
- SSH agent forwarding: Supported via ssh2 library
- Config parsing: Hostname, port, user, identity file from `~/.ssh/config`

**MCP Client Auth:**
- stdio transport: No auth needed (local process)
- HTTP transport: Not yet specified in detail

## Monitoring & Observability

**Error Tracking:**
- None (no external service)

**Logging:**
- Pino (planned) - Structured JSON logging
- Location: `src/utils/logger.ts` (planned)
- Log levels configurable via environment variable

## CI/CD & Deployment

**Hosting:**
- Local process (stdio mode for Claude Desktop)
- Self-hosted server (HTTP mode for remote access)

**CI Pipeline:**
- None configured

## Environment Configuration

**Required env vars (from PRD):**
- `SSH_SECURITY_MODE` - Security validation mode: `blacklist` (default), `whitelist`, `disabled`
- `SSH_BLACKLIST_PATTERNS` - Comma-separated dangerous command patterns
- `SSH_WHITELIST_PATTERNS` - Comma-separated allowed command patterns
- `SSH_DEFAULT_TIMEOUT` - Default command timeout in seconds
- `SSH_MAX_CONNECTIONS` - Maximum concurrent SSH connections
- `LOG_LEVEL` - Logging verbosity (debug, info, warn, error)

**Secrets:**
- SSH private keys at `~/.ssh/` (read by the application, never stored or transmitted)
- No API keys or external service credentials required

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## MCP Tools (Planned Interface)

The server exposes these MCP tools to AI clients:

| Tool | Purpose | Source Module |
|------|---------|--------------|
| `execute_command` | Run SSH command on remote host | `src/tools/execute.ts` |
| `get_command_output` | Retrieve output from background command | `src/tools/output.ts` |
| `get_command_status` | Check background command status | `src/tools/status.ts` |
| `kill_command` | Terminate a background command | `src/tools/kill.ts` |
| `transfer_file` | Upload/download files via SFTP/SCP | `src/tools/transfer.ts` |
| `get_security_info` | Show current security configuration | `src/tools/security-info.ts` |

## MCP Resources (Planned)

| Resource | URI | Purpose |
|----------|-----|---------|
| SSH Hosts | `ssh://hosts` | List available SSH hosts from config |

## MCP Prompts (Planned)

| Prompt | Purpose |
|--------|---------|
| `ssh_help` | Provide usage guidance to AI clients |

---

*Integration audit: 2026-03-07*
