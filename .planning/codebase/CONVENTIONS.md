# Coding Conventions

**Analysis Date:** 2026-03-07

> **Note:** This project is in early initialization (single `index.ts` with hello world). Conventions are derived from the project's configuration files (`tsconfig.json`, `.claude/CLAUDE.md`) and the PRD (`PRD.md`). Follow these prescriptively when writing new code.

## Naming Patterns

**Files:**
- Use `kebab-case.ts` for all source files (e.g., `security-info.ts`, `index-http.ts`)
- Use `index.ts` barrel files for module exports
- Test files use `.test.ts` suffix (e.g., `config.test.ts`, `validator.test.ts`)

**Functions:**
- Use `camelCase` for all functions and methods (e.g., `executeSSHCommand`, `isSimpleCommand`, `getClient`)
- Prefix boolean-returning functions with `is` (e.g., `isSimpleCommand`)
- Prefix getter functions with `get` (e.g., `getClient`, `getSecurityInfo`)

**Variables:**
- Use `camelCase` for variables and parameters (e.g., `connectTimeout`, `chunkSize`)
- Use `UPPER_SNAKE_CASE` for constants and default pattern arrays (e.g., `DEFAULT_BLACKLIST_PATTERNS`, `CONNECTION_CACHE_TTL`)
- Environment variables use `UPPER_SNAKE_CASE` with `MCP_SSH_` prefix

**Types:**
- Use `PascalCase` for interfaces, types, and classes (e.g., `CommandResult`, `BackgroundProcess`, `CommandValidator`)
- Zod schemas use `PascalCase` with `Schema` suffix (e.g., `CommandRequestSchema`, `HostInfoSchema`)
- Inferred types from Zod use matching name without suffix: `type CommandRequest = z.infer<typeof CommandRequestSchema>`

## Code Style

**Formatting:**
- No explicit formatter configured (Prettier, Biome, etc.)
- Use 2-space indentation (consistent with `tsconfig.json` style)
- Use single quotes for strings

**Linting:**
- No explicit linter configured (ESLint, Biome, etc.)
- Rely on TypeScript strict mode for correctness

**TypeScript Strictness:**
- `strict: true` is enabled in `tsconfig.json`
- `noUncheckedIndexedAccess: true` -- always handle `undefined` from index access
- `noFallthroughCasesInSwitch: true` -- always break/return in switch cases
- `noImplicitOverride: true` -- use `override` keyword when overriding methods
- `verbatimModuleSyntax: true` -- use `import type` for type-only imports

## Import Organization

**Order:**
1. External packages (`@modelcontextprotocol/sdk`, `zod`, `ssh2`, `pino`)
2. Internal modules by layer (`./ssh/`, `./security/`, `./process/`)
3. Local files (relative imports within same module)

**Path Aliases:**
- None configured. Use relative imports.
- Use `.ts` extensions in imports (allowed by `allowImportingTsExtensions: true`)

**Module System:**
- ESM only (`"type": "module"` in `package.json`, `"module": "Preserve"` in tsconfig)
- Use `import`/`export`, never `require`
- Use `import type { Foo }` for type-only imports (enforced by `verbatimModuleSyntax`)
- Use barrel `index.ts` files for each module directory

## Error Handling

**Patterns:**
- Return result objects with `success: boolean` and `error_message: string` fields
- Never throw exceptions from tool handlers -- catch and return error responses
- All response types include an `error_message` field (empty string on success)
- Use Zod for input validation; parse at the boundary

**Example pattern from PRD:**
```typescript
// Tool handler pattern -- catch all errors, return structured response
async function handleTool(input: CommandRequest): Promise<ToolResponse> {
  try {
    const result = await executeSSHCommand(input.host, input.command);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
      }) }],
    };
  }
}
```

## Logging

**Framework:** Pino (prescribed in PRD)

**Patterns:**
- Log command requests with tool name, host, command preview
- Log command responses with success, status, execution time
- Log process lifecycle events (created, pid_assigned, completed, killed)
- Log security events (validation passed/blocked)
- Log errors with exception type, message, and context
- Place logger setup in `src/utils/logger.ts`

## Comments

**When to Comment:**
- Document security-sensitive logic (validation, blacklist patterns)
- Explain non-obvious shell command constructions (background execution wrappers)
- Add JSDoc to public API functions and class methods

**JSDoc/TSDoc:**
- Use JSDoc on exported functions and classes
- Include `@param` and `@returns` annotations

## Function Design

**Size:** Keep functions focused on single responsibility. Split complex SSH operations into helpers.

**Parameters:** Use typed objects (Zod-inferred types) for multi-parameter functions rather than positional args.

**Return Values:**
- Return typed result objects, never raw primitives for tool handlers
- Use `Promise<T>` for all async operations
- Use `| null` for functions that may not find a result (e.g., `getClient` returns `SSHClient | null`)

## Module Design

**Exports:**
- Use barrel `index.ts` files in each module directory
- Export types alongside implementations
- Each module directory (`ssh/`, `security/`, `process/`, etc.) has its own `index.ts`

**Barrel Files:**
- Every subdirectory under `src/` uses an `index.ts` barrel file
- Re-export public API from the barrel

## Bun-Specific Conventions

Per `.claude/CLAUDE.md`:
- Use `Bun.file()` over `node:fs` readFile/writeFile
- Use `Bun.$\`command\`` over `execa` for shell commands
- Bun auto-loads `.env` -- do not use `dotenv`
- Use `bun:test` for testing, not Jest or Vitest
- Use `bun install` / `bun run` / `bunx` for package management

## Validation Pattern

**Use Zod v4 for all input validation:**
```typescript
// Define schema
export const CommandRequestSchema = z.object({
  host: z.string().min(1).max(253),
  command: z.string().min(1).max(2000),
});

// Infer type
export type CommandRequest = z.infer<typeof CommandRequestSchema>;
```

## Class vs Function Style

- Use classes for stateful components (`CommandValidator`, process manager)
- Use standalone functions for stateless utilities (`isSimpleCommand`, `parseSSHConfig`)
- Use interfaces for data structures (`BackgroundProcess`, `SSHHostConfig`)

---

*Convention analysis: 2026-03-07*
