# Requirements: ssh-exoman v2.0

**Defined:** 2026-03-13
**Core Value:** AI assistants can securely execute and manage SSH commands on remote hosts through MCP

## v1 Requirements (Milestone v2.0)

Requirements for SSH Agent Forwarding feature. Each maps to roadmap phases.

### Agent Forwarding

- [x] **AGNT-01**: User can enable SSH agent forwarding via `forwardAgent: true` parameter on `execute_command`
- [x] **AGNT-02**: `forwardAgent` parameter defaults to `false` (explicit opt-in required)
- [x] **AGNT-03**: When `forwardAgent: true`, the local SSH agent socket is forwarded to the remote host
- [x] **AGNT-04**: Remote commands can authenticate with other SSH servers using the forwarded agent

### Error Handling

- [x] **ERRO-01**: User receives structured error when agent forwarding is requested but SSH agent is not available

### Documentation

- [ ] **DOCS-01**: README includes security warning about agent forwarding on untrusted hosts (root socket hijacking risk)
- [x] **DOCS-02**: `ssh_help` MCP prompt includes guidance on when and how to use `forwardAgent`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Security Enhancements

- **SECU-01**: Audit logging of all `forwardAgent: true` invocations with timestamp and host
- **SECU-02**: Host allowlist for trusted agent forwarding (`forwardAgentTrustedHosts` config)
- **SECU-03**: Agent forwarding status included in `get_security_info` output

### Extended Capabilities

- **EXTD-01**: Parse `ForwardAgent` directive from `~/.ssh/config` for per-host defaults
- **EXTD-02**: Windows Pageant agent support via `agent: "pageant"` configuration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Always-on agent forwarding | Security risk — must remain opt-in per command |
| Agent caching | Security risk — fresh agent reference per connection |
| Interactive/PTY sessions | MCP is request/response, background execution covers 95% of use cases |
| SSH config ForwardAgent parsing | Explicit parameter-only control for clarity (user decision) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGNT-01 | Phase 4 | Complete (04-01) |
| AGNT-02 | Phase 4 | Complete (04-01) |
| AGNT-03 | Phase 4 | Complete (04-02) |
| AGNT-04 | Phase 4 | Complete (04-02) |
| ERRO-01 | Phase 4 | Complete (04-01) |
| DOCS-01 | Phase 5 | Pending |
| DOCS-02 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after 04-02 completion*
