---
phase: 4
slug: core-agent-forwarding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (built-in) |
| **Config file** | none — Bun auto-discovers *.test.ts files |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test && bun run build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test && bun run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | AGNT-01 | unit | `bun test src/schemas.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | AGNT-02 | unit | `bun test src/schemas.test.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | AGNT-03 | unit | `bun test src/ssh/client.test.ts` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | ERRO-01 | unit | `bun test src/ssh/client.test.ts` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | AGNT-04 | integration | Manual testing required | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/schemas.test.ts` — add forwardAgent field validation tests
- [ ] `src/ssh/client.test.ts` — add agent validation and forwarding tests
- [ ] `src/tools/security-info.test.ts` — add agentAvailable and agentSocket tests
- [ ] `src/ssh/process-manager.test.ts` — add forwardAgent in ProcessInfo tests
- [ ] `src/tools/status.test.ts` — add forwardAgent in status response tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Remote commands authenticate with other SSH servers | AGNT-04 | Requires live SSH infrastructure with jump host | 1. Enable agent forwarding on jump host 2. Run `ssh user@internal-host` from jump host 3. Verify authentication succeeds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
