# SSH Exoman - GSD Project

An MCP server that enables secure SSH command execution on remote hosts via Claude Desktop.

## GSD Workflow

This project uses the GSD (Get Shit Done) development system. Use GSD commands as the primary workflow:

- `/gsd:progress` - Check current progress and route to next action
- `/gsd:plan-phase` - Create detailed phase implementation plans
- `/gsd:execute-phase` - Execute plans with atomic commits
- `/gsd:verify-work` - Validate built features through UAT
- `/gsd:debug` - Systematic debugging with persistent state

**Development Tasks**: Use `/gsd:progress` to check status and route appropriately.

**New Features**: Start with `/gsd:plan-phase` to create structured plans before implementation.

**Bug Fixes**: Use `/gsd:debug` for systematic investigation and resolution.

## Project Context

### Structure

```
src/
├── index.ts              # MCP server entry point (stdio transport)
├── server.ts             # MCP server setup and tool registration
├── lib.ts                # Library exports
├── config.ts             # Environment variable loading
├── types.ts              # TypeScript type definitions
├── errors.ts             # Error classes
├── structured-logger.ts  # Logging utility
├── security-validator.ts # Command blacklist/whitelist filtering
├── test-utils.ts         # Testing utilities
├── schemas/              # Zod schemas for tool inputs
│   ├── index.ts
│   ├── execute-command.ts
│   ├── get-command-output.ts
│   ├── get-command-status.ts
│   ├── kill-command.ts
│   └── get-security-info.ts
├── tools/                # MCP tool implementations
│   ├── execute.ts
│   ├── output.ts
│   ├── status.ts
│   ├── kill.ts
│   ├── resolve-host.ts
│   └── security-info.ts
├── resources/            # MCP resource implementations
│   └── hosts.ts
├── prompts/              # MCP prompt implementations
│   └── help.ts
└── ssh/                  # SSH handling
    ├── index.ts
    ├── client.ts         # SSH connection, passphrase resolution
    ├── executor.ts       # Command execution with output streaming
    ├── config-parser.ts  # SSH config parser (~/.ssh/config)
    ├── agent-discovery.ts # SSH agent socket auto-discovery (macOS launchd, standard Unix)
    ├── command-detection.ts
    └── process-manager.ts
```

### Development Commands

```bash
bun install          # Install dependencies
bun test             # Run all tests
bun test --watch     # Run tests in watch mode
bun run build        # Build to dist/index.js
bun run src/index.ts # Run the MCP server directly
```

**IMPORTANT**: After any code changes, always run `bun test && bun run build` before testing with MCP.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_SECURITYMODE` | `blacklist` | Security mode: blacklist/whitelist/disabled |
| `SSH_EXOMAN_CONNECT_TIMEOUT` | `30000` | SSH connection timeout (ms) |
| `SSH_EXOMAN_COMMAND_TIMEOUT` | `60000` | Command execution timeout (ms) |
| `SSH_EXOMAN_LOG_LEVEL` | `info` | Log level: debug/info/warn/error |
| `SSH_PASSPHRASE` | - | Global passphrase for encrypted keys |
| `SSH_PASSPHRASE_{HOST}` | - | Per-host passphrase (uppercase, hyphens→underscores) |

### Architecture

#### MCP Tools
- **execute_command**: Runs SSH commands in background, returns UUID for tracking
- **get_command_output**: Chunked output retrieval for large results
- **get_command_status**: Check if command is running/completed
- **kill_command**: SIGTERM → SIGKILL escalation for process termination
- **get_security_info**: Inspect current security configuration
- **resolve_host**: Resolve SSH config alias to actual IP/port/user for multi-hop operations

#### Command Execution Flow
1. `execute_command` validates against security filter (blacklist/whitelist)
2. SSH connection established via `ssh2` library
3. Command runs with output streaming to in-memory buffer
4. Client can poll output/status via UUID tracking
5. Long-running commands can be killed

#### Passphrase Resolution
Per-host passphrases checked first (`SSH_PASSPHRASE_MYHOST`), then global fallback (`SSH_PASSPHRASE`).

#### SSH Agent Discovery (Zero Config on macOS)
Automatic discovery of SSH agent socket when `SSH_AUTH_SOCK` is not set:

1. **SSH_AUTH_SOCK** - Environment variable (if set)
2. **Env file** - `~/.config/ssh-exoman/agent-sock`
3. **macOS launchd** - `/private/tmp/com.apple.launchd.XXX/Listeners`
4. **Standard Unix** - `/tmp/ssh-XXX/agent.NNN`

On macOS, agent forwarding works out-of-the-box when Claude is launched from Finder.

#### Security
- 36 default blacklist patterns (rm -rf, sudo, shutdown, etc.)
- Three modes: blacklist (default), whitelist, disabled
- See `src/security-validator.ts` for pattern list

### Bun Notes

- Use `bun test` instead of jest/vitest
- Bun auto-loads `.env` files, no dotenv needed
- Use `bun:sqlite` instead of better-sqlite3 if needed
- Prefer `Bun.file()` over `node:fs` readFile/writeFile
