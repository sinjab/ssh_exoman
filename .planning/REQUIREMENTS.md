# Requirements: ssh-exoman

**Defined:** 2026-03-07
**Core Value:** AI assistants can securely execute and manage SSH commands on remote hosts through MCP

## v1 Requirements

### Command Execution

- [ ] **EXEC-01**: User can execute SSH commands in background with UUID-based process tracking
- [ ] **EXEC-02**: User can retrieve command output with chunked byte-offset reading
- [ ] **EXEC-03**: User can check command status without fetching full output
- [ ] **EXEC-04**: User can kill running processes with SIGTERM → SIGKILL escalation

### SSH Infrastructure

- [x] **SSH-01**: Server parses ~/.ssh/config for host resolution (Host, HostName, User, Port, IdentityFile)
- [ ] **SSH-02**: Server manages SSH connections with configurable connect timeout
- [x] **SSH-03**: Server detects simple vs complex commands and routes execution accordingly

### Security

- [x] **SEC-01**: Server validates commands against configurable security policy (blacklist/whitelist/disabled)
- [x] **SEC-02**: Server ships with ~30 default blacklist patterns for dangerous commands
- [x] **SEC-03**: User can inspect current security configuration via tool

### MCP Integration

- [ ] **MCP-01**: Server connects via stdio transport for Claude Desktop integration
- [ ] **MCP-02**: Server exposes ssh://hosts resource listing configured SSH hosts
- [ ] **MCP-03**: Server provides ssh_help prompt with usage guidance
- [x] **MCP-04**: All tools return structured error responses with success/error_message shape
- [x] **MCP-05**: All settings configurable via environment variables (Bun auto-loads .env)
- [x] **MCP-06**: All tool inputs validated with Zod schemas

### Infrastructure

- [x] **INFRA-01**: Structured logging to stderr (never stdout in stdio mode)
- [x] **INFRA-02**: Configurable timeouts for SSH connect and command execution

## v2 Requirements

### File Transfer

- **XFER-01**: User can upload files to remote host via SFTP
- **XFER-02**: User can download files from remote host via SFTP

### Performance

- **PERF-01**: Connection pooling with configurable TTL and health checks
- **PERF-02**: Per-operation configurable timeouts (connect/command/transfer/read)

### Transport

- **TRANS-01**: Server supports HTTP/Streamable transport for remote MCP access

### Security Extensions

- **SECX-01**: Custom blacklist/whitelist patterns configurable via environment variables

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive/PTY sessions | MCP is request/response, not streaming. Background execution covers 95% of use cases |
| SSH agent forwarding | Security risk when AI controls the agent. Use ProxyJump in ~/.ssh/config instead |
| Multi-tenant authentication | Headless single-user server, not a SaaS platform |
| Database persistence | Background processes are ephemeral. Server restart = tracking lost |
| Web UI dashboard | AI assistant IS the UI. Process status via get_command_status |
| Automatic command retry | Dangerous for non-idempotent commands. AI should decide retry strategy |
| SSH key generation | Security-sensitive operation, should be manual |
| Command queueing/scheduling | Use cron on remote host instead |
| Sudo/privilege escalation | Blocked in default blacklist for safety. Users can set disabled mode at own risk |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXEC-01 | Phase 2 | Pending |
| EXEC-02 | Phase 2 | Pending |
| EXEC-03 | Phase 2 | Pending |
| EXEC-04 | Phase 2 | Pending |
| SSH-01 | Phase 2 | Complete |
| SSH-02 | Phase 2 | Pending |
| SSH-03 | Phase 2 | Complete |
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| MCP-01 | Phase 3 | Pending |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Pending |
| MCP-04 | Phase 1 | Complete |
| MCP-05 | Phase 1 | Complete |
| MCP-06 | Phase 1 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after 02-01 completion*
