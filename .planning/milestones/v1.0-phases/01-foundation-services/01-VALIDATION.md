---
phase: 01
slug: foundation-services
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun test (Bun built-in) |
| **Config file** | bunfig.toml (optional) |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~2 seconds |

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
| 01-01-01 | 01 | 1 | SEC-01, SEC-02 | unit | `bun test src/security-validator.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SEC-03 | unit | `bun test src/security-validator.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | INFRA-01 | unit | `bun test src/structured-logger.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | INFRA-02 | unit | `bun test src/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | MCP-04 | unit | `bun test src/types.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | MCP-06 | unit | `bun test src/schemas.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | MCP-05 | unit | `bun test src/config.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/security-validator.test.ts` — stubs for SEC-01, SEC-02, SEC-03
- [ ] `src/structured-logger.test.ts` — stubs for INFRA-01
- [ ] `src/config.test.ts` — stubs for INFRA-02, MCP-05
- [ ] `src/types.test.ts` — stubs for MCP-04 (Result type)
- [ ] `src/schemas.test.ts` — stubs for MCP-06 (Zod schemas)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | - | - | All phase behaviors have automated verification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
