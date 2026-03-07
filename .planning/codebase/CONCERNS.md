# Codebase Concerns

**Analysis Date:** 2026-03-07

## Tech Debt

**No Implementation Exists:**
- Issue: The project is at `bun init` scaffold stage. `index.ts` contains only `console.log("Hello via Bun!")`. Zero application code has been written against the PRD specification.
- Files: `index.ts`
- Impact: The entire PRD (`PRD.md`, ~900 lines) describes a complex MCP SSH server with 6 tools, process management, SSH config parsing, security validation, and file transfer -- none of which exists yet.
- Fix approach: This is expected for a greenfield project. Implementation should follow the phased approach outlined in the PRD.

**No MCP SDK Dependency Installed:**
- Issue: The PRD targets MCP TypeScript SDK v2, but `package.json` has zero runtime dependencies -- only `@types/bun` as a devDependency. Key packages like `@anthropic/mcp-sdk`, `ssh2`, or any SSH library are missing.
- Files: `package.json`, `bun.lock`
- Impact: Cannot begin any feature implementation until core dependencies are added.
- Fix approach: Install MCP SDK and SSH client library as first step of implementation. PRD Section 2.3 lists expected dependencies.

**Missing Scripts in package.json:**
- Issue: No `scripts` block in `package.json`. No `start`, `dev`, `test`, `build`, or `lint` commands defined.
- Files: `package.json`
- Impact: No standardized way to run, test, or build the project.
- Fix approach: Add scripts block. Per CLAUDE.md, use `bun` commands (e.g., `bun run index.ts`, `bun test`).

## Known Bugs

No bugs to report -- no application code exists yet.

## Security Considerations

**SSH Key and Credential Handling (Design Phase):**
- Risk: The PRD describes SSH operations using `~/.ssh/config` and key-based auth. Implementation must never log, cache, or expose SSH credentials, passphrases, or private key contents.
- Files: Not yet created; will be in SSH connection management modules.
- Current mitigation: `.gitignore` excludes `.env` and `.env.*` variants.
- Recommendations: When implementing, ensure SSH credentials are never serialized to logs or MCP tool responses. Use `ssh-agent` forwarding rather than reading key files directly where possible.

**Command Execution Security (Design Phase):**
- Risk: The PRD specifies command blacklist/whitelist validation for SSH command execution. This is a critical security boundary -- an AI assistant will be executing arbitrary commands on remote systems.
- Files: Not yet created; PRD Section 5 describes `CommandValidator`.
- Current mitigation: None yet.
- Recommendations: Implement command validation before any execution capability. Default to deny-all with explicit allowlisting. Consider rate limiting and audit logging from day one.

**MCP Transport Security:**
- Risk: The PRD describes stdio transport for MCP communication. If HTTP/SSE transport is added later, authentication and TLS become critical.
- Files: Not yet created.
- Current mitigation: Stdio transport is inherently local-only.
- Recommendations: If adding network transports, require authentication and encryption. Never expose MCP server on public interfaces without auth.

**.gitignore Completeness:**
- Risk: `.gitignore` covers common patterns but does not explicitly exclude SSH-related files (`*.pem`, `*.key`, `id_rsa*`) that might end up in the project during development/testing.
- Files: `.gitignore`
- Current mitigation: Standard patterns for `.env` files are present.
- Recommendations: Add SSH key patterns (`*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `known_hosts`) to `.gitignore` before SSH functionality is implemented.

## Performance Bottlenecks

**No Performance Concerns Yet:**
- The PRD describes background process execution with tracking, which is architecturally sound for non-blocking SSH operations.
- Potential future concern: The PRD describes maintaining an in-memory process registry (`ProcessManager`). For long-running sessions with many commands, memory could grow unbounded if completed processes are not cleaned up.
- Files: Not yet created; PRD Section 4.2 describes `ProcessManager`.
- Improvement path: Implement TTL-based cleanup for completed process records. PRD mentions configurable `max_processes` which addresses this partially.

## Fragile Areas

No fragile code areas -- no application code exists yet.

**Anticipated Fragile Areas (from PRD):**
- SSH connection lifecycle management (connect, reconnect, timeout, cleanup) will be inherently fragile. Test thoroughly.
- Process tracking across SSH sessions -- if an SSH connection drops, orphaned remote processes need handling.
- SSH config parsing (`~/.ssh/config`) -- edge cases with `Match` blocks, `ProxyJump`, and `Include` directives.

## Scaling Limits

Not applicable at current stage.

## Dependencies at Risk

**MCP TypeScript SDK v2 (Not Yet Installed):**
- Risk: PRD explicitly notes SDK v2 is "pre-alpha" with "stable release expected in Q1 2026." API surface may change.
- Impact: Breaking changes in the SDK could require significant refactoring of the MCP server integration layer.
- Migration plan: PRD recommends v1.x for production. Consider starting with v1.x and migrating to v2 when stable, or pin to a specific v2 pre-release tag.

**@types/bun@latest (Installed):**
- Risk: Using `latest` tag for `@types/bun` in `package.json` means types can change unexpectedly between installs.
- Files: `package.json`
- Impact: Type definitions could break compilation after a `bun install` on a different machine or date.
- Migration plan: Pin to a specific version (currently resolves to `1.3.10` per lockfile).

## Missing Critical Features

**Everything in the PRD:**
- Problem: The entire application described in `PRD.md` is unimplemented. Key missing capabilities:
  - MCP server setup and tool registration
  - SSH connection management (`SSHManager`)
  - Command execution with background process tracking (`ProcessManager`)
  - File transfer (upload/download via SCP/SFTP)
  - Command validation (security layer)
  - SSH config parsing
  - Logging infrastructure
- Blocks: The project cannot serve its stated purpose (MCP SSH server for AI assistants) until core features are built.

## Test Coverage Gaps

**No Tests Exist:**
- What's not tested: Everything -- no test files exist in the project.
- Files: No `*.test.ts` or `*.spec.ts` files found anywhere.
- Risk: As implementation begins, untested code could ship with bugs in critical security and SSH execution paths.
- Priority: High. Per CLAUDE.md, use `bun test` with `bun:test` imports. The PRD source project had 107 tests with 87% coverage -- the rebuild should target similar coverage.

---

*Concerns audit: 2026-03-07*
