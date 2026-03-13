# Project Research Summary

**Project:** ssh-exoman v2.0 (SSH Agent Forwarding Feature)
**Domain:** MCP SSH Server - AI-accessible remote command execution
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

SSH Agent Forwarding is a well-documented, targeted enhancement to the existing ssh-exoman MCP server (v1.0). The ssh2 library already has full native support via `agent` and `agentForward` configuration options, requiring **no new dependencies** - only code changes to existing modules. This is a moderate-complexity feature with significant security implications that must be carefully addressed.

The recommended approach is an explicit opt-in model: add a `forwardAgent` parameter to `execute_command` that defaults to `false`, validate SSH agent availability before connection, and log every use for audit purposes. The implementation is straightforward (5 file modifications) but requires thorough security documentation warning users that agent forwarding should only be enabled on trusted hosts.

Key risks include socket hijacking by root users on remote hosts and environment variable propagation issues (Claude Desktop may not inherit `SSH_AUTH_SOCK`). Mitigation strategies include clear error messages when agent is unavailable, audit logging, and prominent documentation of the trusted host requirement.

## Key Findings

### Recommended Stack

**No new dependencies required.** The existing `ssh2@1.17.0` library fully supports SSH agent forwarding via its `agent` and `agentForward` configuration options. TypeScript types are already available in `@types/ssh2@1.15.5`.

**Core technologies (existing):**
- **ssh2**: SSH client library - provides `agentForward` boolean and `agent` string options for forwarding
- **SSH_AUTH_SOCK**: Environment variable - standard Unix socket path for local SSH agent access
- **Zod**: Schema validation - extend ExecuteCommandSchema with `forwardAgent` boolean

### Expected Features

This is a feature addition to an existing v1.0 MCP server, not a new product. The feature enables remote commands to authenticate with other SSH servers using the user's local SSH keys.

**Must have (table stakes for this feature):**
- `forwardAgent` parameter on `execute_command` tool - defaults to `false`, explicit opt-in
- SSH agent availability check - validate `SSH_AUTH_SOCK` exists before attempting forwarding
- Clear error messages - actionable guidance when agent is not available
- Audit logging - log every `forwardAgent: true` invocation with timestamp and host

**Should have (security hardening):**
- Security documentation - prominent warning about trusted host requirement
- Error code for agent unavailable - structured error for programmatic handling

**Defer (v2.x or later):**
- SSH config `ForwardAgent` parsing - explicitly out of scope per PROJECT.md
- Trusted host allowlist - could be added later if users request it

**Anti-features (do not build):**
- Always-on agent forwarding - security risk, must remain opt-in
- SSH config ForwardAgent parsing - explicitly out of scope
- Agent caching - security risk, create fresh agent reference per connection

### Architecture Approach

The feature follows the existing data flow with minimal modification. Agent forwarding is a connection-level setting in ssh2, applied at connection time and persisting for the connection lifetime.

**Major components to modify:**
1. **schemas/execute-command.ts** - Add `forwardAgent: z.boolean().optional().default(false)`
2. **ssh/client.ts** - Add `forwardAgent` to `ConnectOptions`, configure `agent` + `agentForward` in connection config
3. **ssh/executor.ts** - Pass `forwardAgent` through execution pipeline
4. **tools/execute.ts** - Wire `forwardAgent` from MCP params to executor
5. **errors.ts** - Add `AGENT_NOT_AVAILABLE` error code

**Data flow changes:**
```
execute_command { forwardAgent: true }
    -> Zod validation (new param)
    -> Security check (unchanged)
    -> Host resolution (unchanged)
    -> SSH connection (NEW: agent + agentForward config)
    -> Process tracking (unchanged)
    -> Command exec (remote can now use SSH_AUTH_SOCK)
```

### Critical Pitfalls

1. **Socket Hijacking by Root Users** - Document that agent forwarding should only be used on trusted hosts. Root users on the remote host can access the forwarded socket and pivot through the user's infrastructure.

2. **Agent Forwarding Enabled by Default** - `forwardAgent` MUST default to `false` with an explicit test verifying this. Never read `ForwardAgent` from `~/.ssh/config`.

3. **Missing Agent on Local Machine** - Pre-flight check for `SSH_AUTH_SOCK` before attempting forwarding. Return clear error: "SSH agent forwarding requested but SSH_AUTH_SOCK is not set."

4. **Confusing `agent` vs `agentForward` in ssh2** - Use clear variable naming (`localAgentSocket` vs `enableAgentForwarding`). Both options must be set together: `agent: process.env.SSH_AUTH_SOCK, agentForward: true`.

5. **Agent Forwarding with Connection Pooling** - If connection pooling is implemented later, connections with agent forwarding MUST be pooled separately to prevent "leaking" agent access to commands that did not request it.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Implementation
**Rationale:** All code changes are tightly coupled and must be implemented together. The feature is a vertical slice through the existing stack.
**Delivers:** Working `forwardAgent` parameter on `execute_command` with proper validation and error handling
**Addresses:** Table stakes features (parameter, validation, error messages, logging)
**Avoids:** Pitfalls 2, 3, 4 (default false, agent check, clear naming)
**Files to modify:** errors.ts, schemas/execute-command.ts, ssh/client.ts, ssh/executor.ts, tools/execute.ts

### Phase 2: Security Documentation
**Rationale:** Documentation is separate from code and can be developed in parallel or after implementation
**Delivers:** Prominent security warnings, usage examples, troubleshooting guide
**Addresses:** Pitfalls 1, 5 (trusted host requirement, pooling considerations for future)
**Avoids:** Users enabling agent forwarding on untrusted hosts

### Phase 3: Testing and Verification
**Rationale:** Requires working implementation to test; integration tests need live SSH agent
**Delivers:** Unit tests for all code paths, integration tests for actual agent forwarding
**Addresses:** All pitfalls through verification
**Test scenarios:**
- `forwardAgent` defaults to false
- Agent unavailable returns clear error
- Successful forwarding with live agent
- Commands can use forwarded agent for git/ssh

### Phase Ordering Rationale

- **Phase 1 first:** Core implementation is a minimal change set (5 files, ~50 lines of code) that must be complete before testing
- **Phase 2 can parallel:** Documentation can start during Phase 1 but should be finalized after implementation details are confirmed
- **Phase 3 last:** Testing requires completed implementation; integration tests need environment setup

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (minimal):** ssh2 API is well-documented, implementation is straightforward. Only verify exact TypeScript types for `agent` and `agentForward` options.
- **Phase 3 (moderate):** Integration testing strategy needs planning - requires SSH agent setup, test hosts, and possibly containerization for isolated testing.

Phases with standard patterns (skip research-phase):
- **Phase 1 code changes:** Follows existing patterns in codebase (Zod schemas, error codes, parameter threading)
- **Phase 2 documentation:** Standard documentation task, no technical research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | ssh2 library support verified via @types/ssh2, no new dependencies needed |
| Features | HIGH | Clear scope from PROJECT.md, well-defined table stakes and anti-features |
| Architecture | HIGH | Minimal changes to existing architecture, ssh2 integration is well-understood |
| Pitfalls | HIGH | OpenSSH official documentation and ssh2 docs provide clear security guidance |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude Desktop environment propagation:** May not inherit `SSH_AUTH_SOCK` from user shell. Needs verification during testing. Document workaround if needed (configure Claude Desktop to pass env vars).
- **Integration test infrastructure:** Need to set up test environment with SSH agent and test hosts. Consider using containers or CI secrets for automated testing.
- **Windows Pageant support:** Research focused on Unix `SSH_AUTH_SOCK`. Windows uses Pageant agent with `agent: "pageant"` string. Should verify Windows compatibility during testing or defer to follow-up.

## Sources

### Primary (HIGH confidence)
- `@types/ssh2@1.15.5` (installed) - TypeScript definitions for `ConnectConfig.agentForward` and `ConnectConfig.agent`
- ssh2 GitHub: https://github.com/mscdex/ssh2 - Official documentation, mature library with agent forwarding support
- OpenBSD ssh_config(5) manual - https://man.openbsd.org/ssh_config.5 - Official security warning about agent forwarding
- PROJECT.md - Explicit scope constraints (no SSH config ForwardAgent parsing)

### Secondary (MEDIUM confidence)
- Existing codebase (src/ssh/client.ts, src/ssh/executor.ts, etc.) - Current patterns and architecture to extend
- MCP TypeScript SDK - Tool registration patterns already in use

### Tertiary (LOW confidence)
- Claude Desktop environment handling - Needs runtime verification, may vary by configuration

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
