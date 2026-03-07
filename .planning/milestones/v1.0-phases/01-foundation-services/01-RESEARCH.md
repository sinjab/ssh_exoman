# Phase 1: Foundation Services - Research

**Researched:** 2026-03-07
**Domain:** TypeScript foundation services (config, logging, validation, error handling, schemas)
**Confidence:** HIGH

## Summary

Phase 1 establishes core service modules with zero external dependencies beyond Zod (already installed). The key patterns are: Result type for error handling, structured JSON logging to stderr, security validator with three modes, and environment-based configuration. All modules are pure TypeScript with flat `src/` organization and barrel exports.

**Primary recommendation:** Use simple object-based Result types (no class hierarchy), Bun's built-in `console.error` for JSON logging to stderr, Zod v4 schemas for input validation with `safeParse()`, and `process.env` for configuration (Bun auto-loads `.env`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Module organization
- Flat `src/` directory structure with all modules at root level
- Barrel exports via `src/index.ts` that re-exports all public APIs
- Central `src/types.ts` for shared TypeScript types (ProcessStatus, SecurityMode, etc.)
- Descriptive filenames with dashes: `security-validator.ts`, `process-tracker.ts`, `structured-logger.ts`, `config.ts`

#### Security validator API
- Single function interface: `validateCommand(command: string, config: SecurityConfig): ValidationResult`
- Result object shape: `{ allowed: boolean, reason?: string, matchedPattern?: string }`
- Plain regex for pattern matching (no external scanner library)
- Default blacklist patterns loaded from external JSON file (`security-patterns.json`)
- Three modes supported: `blacklist`, `whitelist`, `disabled`

#### Logging format
- JSON output format for machine parseability
- Full observability fields on every log: `{ timestamp, level, message, context, traceId, service }`
- Four log levels: `debug`, `info`, `warn`, `error`
- Logs written to stderr only (never stdout -- stdio mode constraint)
- Logger function interface: `log(level, message, context?)`

#### Error handling
- Result type pattern: all service functions return `{ success: boolean, data?: T, error?: { code, message } }`
- Error code enum for machine-readable errors: `SECURITY_BLOCKED`, `PROCESS_NOT_FOUND`, `INVALID_INPUT`, `CONFIG_ERROR`, etc.
- Simple result object shape -- no Result class with methods, no discriminated unions
- Errors include context for debugging but no stack traces in responses

### Claude's Discretion
- Exact regex patterns for default blacklist (~30 patterns)
- Specific field names in JSON log output (timestamp vs @timestamp, etc.)
- Exact error codes in the enum beyond the core ones identified
- Zod schema structure for each tool input
- Environment variable naming conventions

### Deferred Ideas (OUT OF SCOPE)
- SFTP file transfer utilities -- v2 requirement, Phase 2 or later
- Connection pooling -- v2 requirement
- HTTP transport support -- v2 requirement
- Custom security patterns via environment -- v2 requirement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Server validates commands against configurable security policy (blacklist/whitelist/disabled) | Security validator module with `validateCommand()` function and three modes |
| SEC-02 | Server ships with ~30 default blacklist patterns for dangerous commands | `security-patterns.json` file with regex patterns for dangerous commands |
| SEC-03 | User can inspect current security configuration via tool | `getSecurityConfig()` function returning mode, pattern count, samples |
| MCP-04 | All tools return structured error responses with success/error_message shape | Result type pattern `{ success, data?, error? }` |
| MCP-05 | All settings configurable via environment variables (Bun auto-loads .env) | Config module using `process.env` with defaults |
| MCP-06 | All tool inputs validated with Zod schemas | Zod v4 schemas with `safeParse()` for each tool input |
| INFRA-01 | Structured logging to stderr (never stdout in stdio mode) | Structured logger using `console.error()` with JSON output |
| INFRA-02 | Configurable timeouts for SSH connect and command execution | Config module with timeout settings from env vars |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 | Schema validation and type inference | Already installed, zero deps, TypeScript-first, MCP SDK uses it |
| bun:test | built-in | Unit testing | Native Bun test runner, Jest-compatible API, fast |
| process.env | built-in | Configuration | Bun auto-loads .env files, no dotenv needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | ^1.27.1 | Phase 3 only | Not used in Phase 1 (deferred to Phase 3) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | Yup, Joi, Valibot | Zod has best TypeScript inference, already installed, MCP SDK standard |
| bun:test | Vitest, Jest | Bun test is faster, built-in, no config needed |
| Simple Result objects | neverthrow, fp-ts/Either | Simple objects match API shape requirement, no library dependency |

**Installation:**
No new packages needed. Zod and MCP SDK already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts              # Barrel exports - re-exports all public APIs
├── types.ts              # Shared types: SecurityMode, ProcessStatus, ErrorCode, Result<T>
├── config.ts             # Environment-based configuration loader
├── structured-logger.ts  # JSON logging to stderr
├── security-validator.ts # Command validation with blacklist/whitelist modes
├── process-tracker.ts    # Process lifecycle tracking (for Phase 2)
├── errors.ts             # Error codes enum and error factory functions
├── schemas/              # Zod schemas for tool inputs
│   ├── index.ts          # Re-exports all schemas
│   └── *.ts              # Individual schema files
└── security-patterns.json # Default blacklist patterns (~30 entries)
```

### Pattern 1: Result Type Pattern
**What:** Simple object shape for function returns with success/error state
**When to use:** All service functions that can fail
**Example:**
```typescript
// src/types.ts
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

// src/errors.ts
export enum ErrorCode {
  SECURITY_BLOCKED = "SECURITY_BLOCKED",
  PROCESS_NOT_FOUND = "PROCESS_NOT_FOUND",
  INVALID_INPUT = "INVALID_INPUT",
  CONFIG_ERROR = "CONFIG_ERROR",
}

// Usage in service function
export function validateCommand(
  command: string,
  config: SecurityConfig
): Result<ValidationData> {
  if (config.mode === "disabled") {
    return { success: true, data: { allowed: true } };
  }
  // ... validation logic
  if (blocked) {
    return {
      success: false,
      error: {
        code: ErrorCode.SECURITY_BLOCKED,
        message: `Command blocked by ${config.mode} policy`
      }
    };
  }
  return { success: true, data: { allowed: true } };
}
```

### Pattern 2: Structured JSON Logging
**What:** JSON-formatted logs to stderr with consistent fields
**When to use:** All logging throughout the application
**Example:**
```typescript
// src/structured-logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  traceId?: string;
  service: string;
}

const SERVICE_NAME = "ssh-exoman";

export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  traceId?: string
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    ...(context && { context }),
    ...(traceId && { traceId }),
  };
  // Write to stderr only - critical for stdio MCP transport
  console.error(JSON.stringify(entry));
}

// Convenience functions
export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
```

### Pattern 3: Environment-Based Configuration
**What:** Load all settings from environment variables with defaults
**When to use:** All configurable settings in the application
**Example:**
```typescript
// src/config.ts
export type SecurityMode = "blacklist" | "whitelist" | "disabled";

export interface AppConfig {
  securityMode: SecurityMode;
  sshConnectTimeout: number;
  commandTimeout: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

function parseSecurityMode(value: string | undefined): SecurityMode {
  if (value === "blacklist" || value === "whitelist" || value === "disabled") {
    return value;
  }
  return "blacklist"; // Safe default
}

export function loadConfig(): AppConfig {
  return {
    securityMode: parseSecurityMode(process.env.SSH_SECURITYMODE),
    sshConnectTimeout: parseInt(process.env.SSH_EXOMAN_CONNECT_TIMEOUT ?? "30000", 10),
    commandTimeout: parseInt(process.env.SSH_EXOMAN_COMMAND_TIMEOUT ?? "60000", 10),
    logLevel: (process.env.SSH_EXOMAN_LOG_LEVEL as AppConfig["logLevel"]) ?? "info",
  };
}
```

### Pattern 4: Zod Schema Definition
**What:** Define input schemas with type inference for MCP tools
**When to use:** All tool input validation
**Example:**
```typescript
// src/schemas/execute-command.ts
import { z } from "zod";

export const ExecuteCommandSchema = z.object({
  host: z.string().min(1, "Host is required"),
  command: z.string().min(1, "Command is required"),
  timeout: z.number().int().positive().optional(),
});

export type ExecuteCommandInput = z.infer<typeof ExecuteCommandSchema>;

// Validation helper
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): Result<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      error: {
        code: ErrorCode.INVALID_INPUT,
        message: result.error.issues.map(i => i.message).join("; "),
      },
    };
  }
  return { success: true, data: result.data };
}
```

### Pattern 5: Security Validator
**What:** Command validation against regex patterns
**When to use:** Before executing any SSH command
**Example:**
```typescript
// src/security-validator.ts
import patterns from "./security-patterns.json";

export interface SecurityConfig {
  mode: SecurityMode;
  patterns: string[];
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  matchedPattern?: string;
}

export function validateCommand(
  command: string,
  config: SecurityConfig
): ValidationResult {
  if (config.mode === "disabled") {
    return { allowed: true };
  }

  for (const pattern of config.patterns) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(command)) {
      if (config.mode === "blacklist") {
        return {
          allowed: false,
          reason: "Command matches blocked pattern",
          matchedPattern: pattern,
        };
      }
    } else if (config.mode === "whitelist") {
      // In whitelist mode, command must match at least one pattern
      // This is a simplified example - real implementation more complex
    }
  }

  return { allowed: config.mode === "blacklist" };
}
```

### Anti-Patterns to Avoid
- **Logging to stdout:** MCP uses stdio transport, stdout is reserved for protocol messages
- **Throwing exceptions for expected errors:** Use Result type instead
- **Using `any` types:** Defeats TypeScript safety, use `unknown` with validation
- **Global mutable state:** Makes testing hard, prefer dependency injection
- **Async config loading:** Bun loads .env synchronously at startup, keep config sync

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validators | Zod schemas | Type inference, error messages, MCP SDK compatibility |
| Environment parsing | Manual string parsing | `process.env` with parseInt/defaults | Bun handles .env automatically |
| Test runner | Custom test harness | `bun:test` | Built-in, Jest-compatible, fast |
| Date formatting | Custom ISO formatter | `new Date().toISOString()` | Built-in, correct, fast |
| JSON serialization | Custom serializer | `JSON.stringify()` | Built-in, handles edge cases |

**Key insight:** Keep it simple. This phase has zero external dependencies beyond Zod (already installed). Use Bun/TypeScript built-ins for everything else.

## Common Pitfalls

### Pitfall 1: Writing Logs to stdout
**What goes wrong:** MCP stdio transport breaks when logs appear on stdout
**Why it happens:** console.log defaults to stdout, easy mistake
**How to avoid:** Always use `console.error()` or write to `process.stderr`
**Warning signs:** MCP client reports JSON parse errors, protocol desync

### Pitfall 2: Regex Injection in Security Patterns
**What goes wrong:** Malicious patterns could cause ReDoS or escape regex context
**Why it happens:** Loading patterns from JSON without validation
**How to avoid:** Validate patterns are valid regex at load time, use timeout on matching
**Warning signs:** High CPU during validation, slow command processing

### Pitfall 3: Missing Type Narrowing on Result
**What goes wrong:** TypeScript doesn't narrow Result types correctly
**Why it happens:** Using union without discriminating field check
**How to avoid:** Always check `result.success` before accessing `data` or `error`
```typescript
// Correct
const result = validateCommand(cmd, config);
if (!result.success) {
  // TypeScript knows result.error exists here
  return result.error;
}
// TypeScript knows result.data exists here
```

### Pitfall 4: Environment Variable Type Coercion
**What goes wrong:** `process.env.SOME_VAR` is `string | undefined`, not `number`
**Why it happens:** Forgetting to parse/validate env vars
**How to avoid:** Always parse with defaults: `parseInt(process.env.TIMEOUT ?? "30000", 10)`
**Warning signs:** NaN values, undefined config, type errors

### Pitfall 5: Zod safeParse vs parse
**What goes wrong:** Using `parse()` throws exceptions, breaking Result pattern
**Why it happens:** `parse()` is shorter and throws on invalid input
**How to avoid:** Always use `safeParse()` to get `{ success, data, error }` shape
**Warning signs:** Uncaught exceptions in validation code

## Code Examples

Verified patterns from official sources:

### Bun Test Structure
```typescript
// Source: https://bun.sh/docs/test/writing
import { expect, test, describe } from "bun:test";

describe("security validator", () => {
  test("blocks rm -rf /", () => {
    const result = validateCommand("rm -rf /", { mode: "blacklist", patterns: ["rm\\s+-rf"] });
    expect(result.allowed).toBe(false);
  });

  test("allows safe commands", () => {
    const result = validateCommand("ls -la", { mode: "blacklist", patterns: ["rm\\s+-rf"] });
    expect(result.allowed).toBe(true);
  });
});
```

### Zod v4 Schema with Type Inference
```typescript
// Source: https://zod.dev/ - Zod v4.3.6 installed
import { z } from "zod";

const HostSchema = z.string().min(1).max(253);
const CommandSchema = z.string().min(1).max(10000);
const TimeoutSchema = z.number().int().positive().optional();

const ExecuteCommandInputSchema = z.object({
  host: HostSchema,
  command: CommandSchema,
  timeout: TimeoutSchema,
});

type ExecuteCommandInput = z.infer<typeof ExecuteCommandInputSchema>;

// Safe parsing for Result pattern
function validateInput(input: unknown) {
  const result = ExecuteCommandInputSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false as const,
      error: {
        code: "INVALID_INPUT" as const,
        message: result.error.issues[0]?.message ?? "Invalid input"
      }
    };
  }
  return { success: true as const, data: result.data };
}
```

### Bun Environment Variables
```typescript
// Source: https://bun.sh/docs/runtime/environment-variables
// Bun automatically loads .env files

// All env vars are string | undefined
const timeout = parseInt(process.env.SSH_EXOMAN_TIMEOUT ?? "30000", 10);

// TypeScript declaration for typed env vars
declare module "bun" {
  interface Env {
    SSH_SECURITYMODE?: string;
    SSH_EXOMAN_TIMEOUT?: string;
    SSH_EXOMAN_LOG_LEVEL?: string;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dotenv library | Bun auto-loads .env | Bun 1.0+ | No dependency needed |
| Jest/Vitest | bun:test | Bun 1.0+ | Faster, no config |
| Result class libraries | Simple object shapes | 2024+ | Less abstraction, matches API |
| Console.log debugging | Structured JSON logging | Always | Machine parseable, grepable |

**Deprecated/outdated:**
- `dotenv` package: Bun handles .env automatically, no dependency needed
- `neverthrow`/`fp-ts`: Simple object Result type is sufficient for this project

## Open Questions

1. **Exact blacklist patterns for security-patterns.json**
   - What we know: Need ~30 patterns for dangerous commands (rm, sudo, dd, mkfs, etc.)
   - What's unclear: Exact regex patterns, escape handling, case sensitivity
   - Recommendation: Start with common dangerous patterns, expand based on testing

2. **Trace ID generation and propagation**
   - What we know: Logs should include traceId field
   - What's unclear: Where trace ID comes from (MCP request ID? Generated?)
   - Recommendation: Generate UUID per request in Phase 3, pass through context

3. **Pattern validation at startup**
   - What we know: Patterns loaded from JSON
   - What's unclear: Should invalid patterns fail startup or log warning?
   - Recommendation: Fail fast - throw on invalid pattern to catch config errors early

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in) |
| Config file | None needed - use bunfig.toml for optional config |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Validates commands in blacklist/whitelist/disabled modes | unit | `bun test src/security-validator.test.ts` | Wave 0 |
| SEC-02 | Loads ~30 default patterns from JSON | unit | `bun test src/security-validator.test.ts` | Wave 0 |
| SEC-03 | Returns security config info | unit | `bun test src/security-validator.test.ts` | Wave 0 |
| MCP-04 | All functions return Result shape | unit | `bun test src/types.test.ts` | Wave 0 |
| MCP-05 | Config loads from env vars | unit | `bun test src/config.test.ts` | Wave 0 |
| MCP-06 | Zod schemas validate inputs | unit | `bun test src/schemas/*.test.ts` | Wave 0 |
| INFRA-01 | Logs to stderr in JSON format | unit | `bun test src/structured-logger.test.ts` | Wave 0 |
| INFRA-02 | Timeouts configurable via env | unit | `bun test src/config.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test`
- **Per wave merge:** `bun test --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/security-validator.test.ts` - covers SEC-01, SEC-02, SEC-03
- [ ] `src/config.test.ts` - covers MCP-05, INFRA-02
- [ ] `src/structured-logger.test.ts` - covers INFRA-01
- [ ] `src/types.test.ts` - covers MCP-04 (Result type shape)
- [ ] `src/schemas/*.test.ts` - covers MCP-06

## Sources

### Primary (HIGH confidence)
- https://bun.sh/docs/test/writing - Bun test API and patterns
- https://zod.dev/ - Zod v4 schema validation API
- https://bun.sh/docs/runtime/environment-variables - Bun .env handling
- https://github.com/colinhacks/zod - Zod GitHub (API reference)

### Secondary (MEDIUM confidence)
- Project package.json (installed versions: zod ^4.3.6, @modelcontextprotocol/sdk ^1.27.1)
- Project tsconfig.json (strict mode enabled, ESNext target)

### Tertiary (LOW confidence)
- None - all core patterns verified with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Bun and Zod are well-documented, already installed
- Architecture: HIGH - User decisions in CONTEXT.md are clear and specific
- Pitfalls: HIGH - stdio constraint is well-understood for MCP servers

**Research date:** 2026-03-07
**Valid until:** 30 days - stable TypeScript/Bun patterns, Zod v4 API stable
