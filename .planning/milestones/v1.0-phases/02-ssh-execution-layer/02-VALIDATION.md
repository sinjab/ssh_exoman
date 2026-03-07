---
phase: 02
slug: ssh-execution-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test |
| **Config file** | bunfig.toml (if exists) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SSH-01 | unit | `bun test src/ssh/config-parser.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SSH-02 | integration | `bun test src/ssh/client.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SSH-03 | unit | `bun test src/ssh/command-detection.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | EXEC-01 | unit | `bun test src/ssh/process-manager.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | EXEC-02 | unit | `bun test src/ssh/process-manager.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | EXEC-03 | unit | `bun test src/ssh/process-manager.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-05 | 02 | 2 | EXEC-04 | unit | `bun test src/ssh/process-manager.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ssh/config-parser.test.ts` — stubs for SSH-01
- [ ] `src/ssh/client.test.ts` — stubs for SSH-02
- [ ] `src/ssh/command-detection.test.ts` — stubs for SSH-03
- [ ] `src/ssh/process-manager.test.ts` — stubs for EXEC-01..04
- [ ] `src/ssh/index.ts` — barrel exports

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real SSH connection to remote host | SSH-02 | Requires live SSH server | Connect to a known host and verify connection succeeds |
| Background process execution | EXEC-01 | Requires live SSH server | Execute command and verify UUID returned immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
