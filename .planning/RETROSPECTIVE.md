# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-07
**Phases:** 3 | **Plans:** 10 | **Sessions:** 1

### What Was Built
- Security validator with 36-command blacklist filtering and Zod schemas for all 5 MCP tool inputs
- SSH config parsing for host resolution from ~/.ssh/config
- Background process tracking with UUID, temp file persistence, chunked output retrieval
- MCP server with 5 tools, ssh://hosts resource, and ssh_help prompt
- Per-host SSH passphrase support via environment variables

### What Worked
- Three-phase architecture (Foundation → SSH → MCP) ensured clean dependency order
- TDD approach with 4:1 test-to-code ratio caught issues early
- Result<T> pattern provided consistent error handling without exceptions
- Wave-based parallelization in executor kept phases moving efficiently

### What Was Inefficient
- Gap closure (03-03) required extra plan after UAT discovered missing passphrase support
- ROADMAP.md plan checkboxes were stale (showed unchecked despite completion)

### Patterns Established
- `schema._zod.def.shape` for Zod 4 compatibility with MCP SDK
- `registerTool()` instead of deprecated `tool()` method
- Two-file entry pattern: index.ts (transport) + server.ts (McpServer setup)
- Per-host env var pattern: `{PREFIX}_{NORMALIZED_HOST}` for host-specific config

### Key Lessons
1. Run UAT early in final phase to discover gaps before declaring phase complete
2. Zod 4 requires extracting raw shape via `_zod.def.shape` for MCP SDK compatibility
3. Hybrid output handling (stream + temp file) enables post-completion retrieval

### Cost Observations
- Model mix: 100% balanced profile (Sonnet/Opus mix)
- Sessions: 1
- Notable: 10 plans in single day (~0.77 hours execution time, 4.7 min avg/plan)

---

## Milestone: v2.0 — SSH Agent Forwarding

**Shipped:** 2026-03-13
**Phases:** 2 | **Plans:** 5 | **Sessions:** 1

### What Was Built
- `forwardAgent` parameter on `execute_command` tool for SSH agent forwarding
- `validateAgent()` function to check SSH_AUTH_SOCK availability
- Agent forwarding through ssh2 library with `agent` and `agentForward` config
- `agentAvailable` and `agentSocket` fields in `get_security_info` response
- Security documentation in README with trusted hosts warning
- `forwardAgent` guidance in `ssh_help` MCP prompt

### What Worked
- Feature flag pattern (`z.boolean().optional().default(false)`) for opt-in security
- Early validation (validateAgent before connect) with helpful error messages
- Documentation phase separated from implementation for clean focus
- Audit-driven completion verification caught minor integration gap

### What Was Inefficient
- ROADMAP.md was stale (showed incomplete despite 100% completion)
- Minor integration gap: agentAvailable not documented in ssh_help prompt (non-blocking)

### Patterns Established
- Feature flags with `z.boolean().optional().default(false)` pattern
- Error messages include environment-specific hints (e.g., "Claude Desktop")
- Both `agent` and `agentForward` required in ssh2 config for forwarding

### Key Lessons
1. Agent forwarding requires BOTH `agent` socket path AND `agentForward: true` in ssh2
2. validateAgent() should check env var AND socket file existence
3. Security features should default to off with explicit opt-in

### Cost Observations
- Model mix: 100% balanced profile (Sonnet/Opus mix)
- Sessions: 1
- Notable: 5 plans in single day (~35 min total execution)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 3 | Initial MVP with TDD and wave-based execution |
| v2.0 | 1 | 2 | Agent forwarding with opt-in feature flag pattern |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 261 | N/A | 0 |
| v2.0 | 289 | N/A | 0 |

### Top Lessons (Verified Across Milestones)

1. TDD approach produces high-quality code with minimal bugs
2. Clear phase dependencies prevent blocking issues
3. Result<T> pattern simplifies error handling in async code
4. Feature flags with explicit opt-in default improve security posture
5. Early validation with helpful error messages improves user experience
