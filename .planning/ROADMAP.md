# Roadmap: ssh-exoman

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-03-07)
- 🚧 **v2.0 SSH Agent Forwarding** — Phases 4-5 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-03-07</summary>

- [x] Phase 1: Foundation Services (4/4 plans) — config, security, logging, schemas
- [x] Phase 2: SSH Execution Layer (3/3 plans) — config parsing, process manager, executor
- [x] Phase 3: MCP Server Integration (3/3 plans) — tools, resource, prompt, stdio

</details>

### 🚧 v2.0 SSH Agent Forwarding (In Progress)

**Milestone Goal:** Add SSH agent forwarding capability so remote commands can authenticate with other servers using the user's local SSH keys, without private keys ever leaving the local machine.

- [ ] **Phase 4: Core Agent Forwarding** - Implement forwardAgent parameter with proper validation and error handling
- [ ] **Phase 5: Documentation** - Security warnings and usage guidance

## Phase Details

### Phase 4: Core Agent Forwarding
**Goal**: Users can opt-in to SSH agent forwarding for remote command execution
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, ERRO-01
**Success Criteria** (what must be TRUE):
  1. User can enable agent forwarding by setting `forwardAgent: true` on `execute_command`
  2. Agent forwarding is disabled by default (user must explicitly enable it)
  3. Remote commands can authenticate with other SSH servers using the forwarded agent
  4. User receives clear error message when agent forwarding is requested but SSH agent is unavailable
**Plans**: TBD

Plans:
- [ ] 04-01: Schema and type extensions for forwardAgent parameter
- [ ] 04-02: SSH client agent forwarding implementation
- [ ] 04-03: Error handling for missing SSH agent

### Phase 5: Documentation
**Goal**: Users understand the security implications and proper usage of agent forwarding
**Depends on**: Phase 4
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. User sees security warning in README about agent forwarding risks on untrusted hosts
  2. User gets guidance from `ssh_help` prompt on when and how to use `forwardAgent`
**Plans**: TBD

Plans:
- [ ] 05-01: README security documentation
- [ ] 05-02: ssh_help prompt update

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Core Agent Forwarding | 0/3 | Not started | - |
| 5. Documentation | 0/2 | Not started | - |

---
*Last updated: 2026-03-13*
