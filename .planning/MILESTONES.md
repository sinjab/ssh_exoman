# Milestones

## v2.0 SSH Agent Forwarding (Shipped: 2026-03-13)

**Phases completed:** 2 phases, 5 plans, 3 tasks

**Key accomplishments:**
- Added `forwardAgent` parameter to `execute_command` tool for SSH agent forwarding (opt-in by default)
- Implemented `validateAgent()` for SSH agent availability validation with helpful error messages
- Wired forwardAgent through SSH client to ssh2 library with both `agent` and `agentForward` config
- Added `agentAvailable` and `agentSocket` fields to `get_security_info` response
- Added security documentation to README with trusted hosts warning and usage examples
- Updated `ssh_help` MCP prompt with forwardAgent parameter guidance

**Stats:**
- Files modified: ~12
- Lines of code: ~6,511 TypeScript
- Tests: 289 passing (+28 from v1.0)
- Timeline: March 13, 2026

---

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
