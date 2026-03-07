# Milestones

## v1.0 MVP (Shipped: 2026-03-07)

**Phases completed:** 3 phases, 10 plans

**Key accomplishments:**
- Security validator with 36-command blacklist filtering and Zod schemas for all 5 MCP tool inputs
- SSH config parsing for host resolution from ~/.ssh/config (Host, HostName, User, Port, IdentityFile)
- Background process tracking with UUID, temp file persistence, chunked output retrieval, and SIGTERM/SIGKILL escalation
- MCP server with 5 tools, ssh://hosts resource, and ssh_help prompt for Claude Desktop integration
- Per-host SSH passphrase support via SSH_PASSPHRASE_{HOST} environment variables with global fallback

**Stats:**
- Files modified: 105
- Lines of code: ~5,821 TypeScript
- Tests: 261 passing
- Timeline: March 7, 2026

---
