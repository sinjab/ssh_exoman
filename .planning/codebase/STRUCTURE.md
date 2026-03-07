# Codebase Structure

**Analysis Date:** 2026-03-07

## Current State

This is a greenfield project initialized with `bun init`. Only the root scaffold exists. The structure below describes both the current state and the prescribed target structure from `PRD.md`.

## Directory Layout (Current)

```
ssh_exoman/
├── .claude/             # Claude Code configuration and GSD framework
├── .planning/           # GSD planning documents
├── node_modules/        # Dependencies (bun install)
├── index.ts             # Scaffold entry point (placeholder)
├── package.json         # Package manifest
├── tsconfig.json        # TypeScript configuration
├── bun.lock             # Bun lockfile
├── PRD.md               # Product requirements document
├── README.md            # Project readme
└── .gitignore           # Git ignore rules
```

## Directory Layout (Target per PRD)

```
ssh_exoman/
├── src/
│   ├── index.ts              # Stdio entry point (Claude Desktop)
│   ├── index-http.ts         # HTTP entry point (remote access)
│   ├── server.ts             # MCP server setup, tool registration
│   ├── tools/
│   │   ├── index.ts          # Tool barrel exports
│   │   ├── execute.ts        # execute_command tool handler
│   │   ├── output.ts         # get_command_output tool handler
│   │   ├── status.ts         # get_command_status tool handler
│   │   ├── kill.ts           # kill_command tool handler
│   │   ├── transfer.ts       # transfer_file tool handler
│   │   └── security-info.ts  # get_security_info tool handler
│   ├── resources/
│   │   ├── index.ts          # Resource barrel exports
│   │   └── hosts.ts          # ssh://hosts resource
│   ├── prompts/
│   │   ├── index.ts          # Prompt barrel exports
│   │   └── help.ts           # ssh_help prompt
│   ├── ssh/
│   │   ├── index.ts          # SSH module barrel exports
│   │   ├── client.ts         # Connection management, pooling
│   │   ├── config.ts         # SSH config file parser
│   │   ├── execute.ts        # Command execution (direct/shell)
│   │   ├── transfer.ts       # SCP/SFTP file transfer
│   │   └── background.ts     # Background command execution
│   ├── process/
│   │   ├── index.ts          # Process module barrel exports
│   │   ├── manager.ts        # Process lifecycle tracking
│   │   └── types.ts          # BackgroundProcess interface
│   ├── security/
│   │   ├── index.ts          # Security module barrel exports
│   │   ├── validator.ts      # Command validation logic
│   │   └── patterns.ts       # Default blacklist/whitelist patterns
│   ├── config/
│   │   ├── index.ts          # Config module barrel exports
│   │   └── env.ts            # Environment variable parsing
│   ├── types/
│   │   ├── index.ts          # Shared type barrel exports
│   │   ├── requests.ts       # Zod schemas for MCP request inputs
│   │   └── responses.ts      # Zod schemas for MCP response outputs
│   └── utils/
│       ├── index.ts          # Utility barrel exports
│       └── logger.ts         # Structured logging setup (Pino)
├── tests/                    # Test files (mirrors src/ structure)
│   ├── tools/
│   ├── ssh/
│   ├── process/
│   ├── security/
│   └── config/
├── package.json
├── tsconfig.json
├── bun.lock
├── PRD.md
├── README.md
└── .gitignore
```

## Directory Purposes

**`src/`:**
- Purpose: All application source code
- Contains: TypeScript modules organized by domain
- Key files: `server.ts` (central MCP server), `index.ts` (stdio entry), `index-http.ts` (HTTP entry)

**`src/tools/`:**
- Purpose: MCP tool handler implementations (the primary API surface)
- Contains: One file per MCP tool, plus barrel export
- Key files: `execute.ts` (most complex tool), `transfer.ts` (file operations)

**`src/ssh/`:**
- Purpose: All SSH protocol operations
- Contains: Connection management, config parsing, command execution, file transfer
- Key files: `client.ts` (connection pooling), `config.ts` (SSH config parser)

**`src/process/`:**
- Purpose: Background process lifecycle management
- Contains: Process tracker with UUID-keyed Map, type definitions
- Key files: `manager.ts` (core tracking logic)

**`src/security/`:**
- Purpose: Command validation and security policies
- Contains: Validator with blacklist/whitelist/disabled modes
- Key files: `validator.ts` (validation engine), `patterns.ts` (default regex patterns)

**`src/config/`:**
- Purpose: Environment-based configuration
- Contains: Typed config object from env vars
- Key files: `env.ts` (all configuration with defaults)

**`src/types/`:**
- Purpose: Shared Zod schemas and inferred TypeScript types
- Contains: Request schemas, response schemas
- Key files: `requests.ts`, `responses.ts`

**`src/utils/`:**
- Purpose: Cross-cutting utilities
- Contains: Logger setup
- Key files: `logger.ts`

**`tests/`:**
- Purpose: Test files (separate from source, mirroring src/ structure)
- Contains: Unit and integration tests per module

## Key File Locations

**Entry Points:**
- `src/index.ts`: Stdio transport entry point (Claude Desktop integration)
- `src/index-http.ts`: HTTP transport entry point (remote access)
- `index.ts` (root): Current scaffold placeholder -- will be replaced

**Configuration:**
- `tsconfig.json`: TypeScript compiler options (strict mode, ESNext target, bundler resolution)
- `package.json`: Dependencies and scripts
- `src/config/env.ts`: Runtime configuration from environment variables
- `.env`: Environment variables (auto-loaded by Bun, never committed)

**Core Logic:**
- `src/server.ts`: MCP server initialization and tool registration
- `src/ssh/client.ts`: SSH connection management with pooling
- `src/ssh/background.ts`: Background command execution on remote hosts
- `src/process/manager.ts`: Process lifecycle tracking
- `src/security/validator.ts`: Command security validation

**Testing:**
- `tests/`: All test files using `bun test`

## Naming Conventions

**Files:**
- kebab-case for multi-word files: `security-info.ts`, `index-http.ts`
- Singular nouns for modules: `validator.ts`, `manager.ts`, `client.ts`
- `index.ts` as barrel export in every module directory

**Directories:**
- Lowercase, singular: `tools/`, `ssh/`, `process/`, `security/`, `config/`, `types/`, `utils/`
- Domain-oriented grouping (not layer-oriented)

## Where to Add New Code

**New MCP Tool:**
- Create handler: `src/tools/{tool-name}.ts`
- Export from barrel: `src/tools/index.ts`
- Register in: `src/server.ts`
- Add Zod schema: `src/types/requests.ts` (input), `src/types/responses.ts` (output)
- Add tests: `tests/tools/{tool-name}.test.ts`

**New MCP Resource:**
- Create resource: `src/resources/{resource-name}.ts`
- Export from barrel: `src/resources/index.ts`
- Register in: `src/server.ts`

**New MCP Prompt:**
- Create prompt: `src/prompts/{prompt-name}.ts`
- Export from barrel: `src/prompts/index.ts`
- Register in: `src/server.ts`

**New SSH Operation:**
- Add to: `src/ssh/{operation}.ts`
- Export from barrel: `src/ssh/index.ts`

**New Shared Type:**
- Zod schemas: `src/types/requests.ts` or `src/types/responses.ts`
- Internal interfaces: relevant module's `types.ts` (e.g., `src/process/types.ts`)

**New Utility:**
- Add to: `src/utils/{utility-name}.ts`
- Export from barrel: `src/utils/index.ts`

## Special Directories

**`node_modules/`:**
- Purpose: Bun-managed dependencies
- Generated: Yes (via `bun install`)
- Committed: No

**`.planning/`:**
- Purpose: GSD framework planning documents and codebase analysis
- Generated: By GSD mapping and planning commands
- Committed: Yes

**`.claude/`:**
- Purpose: Claude Code configuration, commands, and GSD framework
- Generated: Partially (settings are local)
- Committed: Yes (except `settings.local.json`)

---

*Structure analysis: 2026-03-07*
