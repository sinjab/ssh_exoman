---
phase: 03
slug: mcp-server-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (built-in) |
| **Config file** | None - Bun auto-discovers *.test.ts |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | MCP-01 | unit | `bun test src/server.test.ts` | Wave 0 | pending |
| 03-01-02 | 01 | 1 | MCP-01 | unit | `bun test src/tools/execute.test.ts` | Wave 0 | pending |
| 03-01-03 | 01 | 1 | MCP-01 | unit | `bun test src/tools/output.test.ts` | Wave 0 | pending |
| 03-01-04 | 01 | 1 | MCP-01 | unit | `bun test src/tools/status.test.ts` | Wave 0 | pending |
| 03-01-05 | 01 | 1 | MCP-01 | unit | `bun test src/tools/kill.test.ts` | Wave 0 | pending |
| 03-01-06 | 01 | 1 | MCP-01 | unit | `bun test src/tools/security-info.test.ts` | Wave 0 | pending |
| 03-02-01 | 02 | 2 | MCP-02 | unit | `bun test src/resources/hosts.test.ts` | Wave 0 | pending |
| 03-02-02 | 02 | 2 | MCP-03 | unit | `bun test src/prompts/help.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/test-utils.ts` — shared test helpers (mock ProcessManager, mock config, mock logger)
- [ ] `src/server.test.ts` — tests server creation and registration of all tools/resources/prompts
- [ ] `src/tools/execute.test.ts` — tests execute_command handler
- [ ] `src/tools/output.test.ts` — tests get_command_output handler
- [ ] `src/tools/status.test.ts` — tests get_command_status handler
- [ ] `src/tools/kill.test.ts` — tests kill_command handler
- [ ] `src/tools/security-info.test.ts` — tests get_security_info handler
- [ ] `src/resources/hosts.test.ts` — tests ssh://hosts resource
- [ ] `src/prompts/help.test.ts` — tests ssh_help prompt

*Existing test files cover service layer (config, schemas, SSH modules). Wave 0 adds MCP-specific tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude Desktop end-to-end workflow | MCP-01, MCP-02, MCP-03 | Requires running Claude Desktop app with config change | 1. Add server to claude_desktop_config.json 2. Restart Claude Desktop 3. Execute command on remote host via conversation 4. Verify status and output retrieval |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
