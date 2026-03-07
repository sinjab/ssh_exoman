# Technology Stack

**Analysis Date:** 2026-03-07

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code

**Secondary:**
- None

## Runtime

**Environment:**
- Bun (latest) - Primary runtime per project conventions (see `.claude/CLAUDE.md`)
- Node.js 20+ - Alternative runtime (PRD references Node.js compatibility)

**Package Manager:**
- Bun - `bun install`, `bun run`
- Lockfile: `bun.lock` (present, lockfileVersion 1)

## Frameworks

**Core:**
- `@modelcontextprotocol/sdk` (not yet installed) - MCP server framework for tool/resource/prompt registration. PRD specifies SDK v2 patterns.

**Validation:**
- Zod v4 (not yet installed) - Schema validation for request/response types. Required peer dependency of MCP SDK v2.

**SSH:**
- `ssh2` or `node-ssh` (not yet installed) - SSH client library for remote command execution and file transfer.

**Logging:**
- Pino (not yet installed) - Structured logging. PRD specifies Pino over Winston.

**Testing:**
- `bun test` - Built-in Bun test runner (per project conventions). PRD mentions Vitest/Jest but project conventions mandate `bun test`.

**Build/Dev:**
- Bun bundler - Built-in bundling/transpilation. No separate build tool needed.
- `bun --hot` - Hot reload for development.

## Key Dependencies

**Currently Installed:**
- `@types/bun@1.3.10` (devDependency) - Bun type definitions
- `typescript@5.9.3` (peerDependency) - TypeScript compiler for type checking

**Planned (from PRD, not yet installed):**
- `@modelcontextprotocol/sdk` - Core MCP protocol implementation
- `zod` (v4) - Runtime schema validation
- `ssh2` - SSH2 protocol client
- `pino` - Structured JSON logging
- `uuid` - Process ID generation for background commands

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: ESNext
- Module: Preserve (bundler mode)
- JSX: react-jsx
- Strict mode: enabled
- `noEmit: true` - Bun handles execution directly, no compile step
- `verbatimModuleSyntax: true` - Explicit import/export type annotations
- `noUncheckedIndexedAccess: true` - Stricter index access
- `allowImportingTsExtensions: true` - Import `.ts` files directly

**Environment:**
- Bun auto-loads `.env` files (no dotenv needed per project conventions)
- Environment variables control security mode, SSH defaults, logging level (see PRD section on config/env.ts)

**Build:**
- No separate build configuration needed - Bun runs TypeScript directly
- Module type: ESM (`"type": "module"` in `package.json`)

## Platform Requirements

**Development:**
- Bun runtime (latest)
- TypeScript 5.x for IDE support and type checking
- SSH client/keys for testing against remote hosts

**Production:**
- Bun or Node.js 20+
- Access to `~/.ssh/config` and SSH keys on the host machine
- MCP-compatible client (e.g., Claude Desktop) for stdio transport
- HTTP server for remote access via HTTP transport

## Current State

This project is at the **initial scaffold stage**. Only `index.ts` exists with a hello-world placeholder. The PRD (`PRD.md`) defines the full target architecture and dependency requirements. No application dependencies have been installed yet beyond type definitions.

---

*Stack analysis: 2026-03-07*
