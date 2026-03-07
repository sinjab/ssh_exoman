# SSH Exoman - MCP Server for Claude Desktop

An MCP server that enables secure SSH command execution on remote hosts via Claude Desktop.

## Project Structure

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
    ├── command-detection.ts
    └── process-manager.ts
```

## Development

### Commands

```bash
bun install          # Install dependencies
bun test             # Run all tests
bun test --watch     # Run tests in watch mode
bun run src/index.ts # Run the MCP server directly
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_EXOMAN_SECURITY_MODE` | `blacklist` | Security mode: blacklist/whitelist/disabled |
| `SSH_EXOMAN_CONNECT_TIMEOUT` | `30000` | SSH connection timeout (ms) |
| `SSH_EXOMAN_COMMAND_TIMEOUT` | `60000` | Command execution timeout (ms) |
| `SSH_EXOMAN_LOG_LEVEL` | `info` | Log level: debug/info/warn/error |
| `SSH_PASSPHRASE` | - | Global passphrase for encrypted keys |
| `SSH_PASSPHRASE_{HOST}` | - | Per-host passphrase (uppercase, hyphens→underscores) |

## Architecture Notes

### MCP Tools
- **execute_command**: Runs SSH commands in background, returns UUID for tracking
- **get_command_output**: Chunked output retrieval for large results
- **get_command_status**: Check if command is running/completed
- **kill_command**: SIGTERM → SIGKILL escalation for process termination
- **get_security_info**: Inspect current security configuration

### Command Execution Flow
1. `execute_command` validates against security filter (blacklist/whitelist)
2. SSH connection established via `ssh2` library
3. Command runs with output streaming to in-memory buffer
4. Client can poll output/status via UUID tracking
5. Long-running commands can be killed

### Passphrase Resolution
Per-host passphrases checked first (`SSH_PASSPHRASE_MYHOST`), then global fallback (`SSH_PASSPHRASE`).

### Security
- 36 default blacklist patterns (rm -rf, sudo, shutdown, etc.)
- Three modes: blacklist (default), whitelist, disabled
- See `src/security-validator.ts` for pattern list

## Bun-specific Notes

- Use `bun test` instead of jest/vitest
- Bun auto-loads `.env` files, no dotenv needed
- Use `bun:sqlite` instead of better-sqlite3 if needed
- Prefer `Bun.file()` over `node:fs` readFile/writeFile
