# Phase 1: Foundation Services - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Core service modules with zero external dependencies — security validation, process lifecycle tracking, structured logging, configuration, error handling, and input schemas. These are the building blocks that Phase 2 (SSH execution) will consume. No SSH, no MCP protocol — pure foundational services.

</domain>

<decisions>
## Implementation Decisions

### Module organization
- Flat `src/` directory structure with all modules at root level
- Barrel exports via `src/index.ts` that re-exports all public APIs
- Central `src/types.ts` for shared TypeScript types (ProcessStatus, SecurityMode, etc.)
- Descriptive filenames with dashes: `security-validator.ts`, `process-tracker.ts`, `structured-logger.ts`, `config.ts`

### Security validator API
- Single function interface: `validateCommand(command: string, config: SecurityConfig): ValidationResult`
- Result object shape: `{ allowed: boolean, reason?: string, matchedPattern?: string }`
- Plain regex for pattern matching (no external scanner library)
- Default blacklist patterns loaded from external JSON file (`security-patterns.json`)
- Three modes supported: `blacklist`, `whitelist`, `disabled`

### Logging format
- JSON output format for machine parseability
- Full observability fields on every log: `{ timestamp, level, message, context, traceId, service }`
- Four log levels: `debug`, `info`, `warn`, `error`
- Logs written to stderr only (never stdout — stdio mode constraint)
- Logger function interface: `log(level, message, context?)`

### Error handling
- Result type pattern: all service functions return `{ success: boolean, data?: T, error?: { code, message } }`
- Error code enum for machine-readable errors: `SECURITY_BLOCKED`, `PROCESS_NOT_FOUND`, `INVALID_INPUT`, `CONFIG_ERROR`, etc.
- Simple result object shape — no Result class with methods, no discriminated unions
- Errors include context for debugging but no stack traces in responses

### Claude's Discretion
- Exact regex patterns for default blacklist (~30 patterns)
- Specific field names in JSON log output (timestamp vs @timestamp, etc.)
- Exact error codes in the enum beyond the core ones identified
- Zod schema structure for each tool input
- Environment variable naming conventions

</decisions>

<specifics>
## Specific Ideas

- No specific product references — this is foundational infrastructure
- Should feel idiomatic TypeScript, not ported from Python patterns

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is a greenfield project
- `@modelcontextprotocol/sdk` and `zod` already installed in package.json

### Established Patterns
- Bun runtime (per CLAUDE.md) — use `bun test`, `bun run`, auto-loaded .env
- TypeScript strict mode implied by tsconfig.json

### Integration Points
- Phase 2 will import security validator, process tracker, logger, config, error types
- Phase 3 will use Zod schemas for MCP tool input validation
- All modules will use the Result type for consistent error handling

</code_context>

<deferred>
## Deferred Ideas

- SFTP file transfer utilities — v2 requirement, Phase 2 or later
- Connection pooling — v2 requirement
- HTTP transport support — v2 requirement
- Custom security patterns via environment — v2 requirement

</deferred>

---

*Phase: 01-foundation-services*
*Context gathered: 2026-03-07*
