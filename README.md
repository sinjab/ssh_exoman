# SSH Exoman

[![Version](https://img.shields.io/badge/version-2.0-blue.svg)](https://github.com/user/ssh_exoman)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Bun-orange.svg)](https://bun.sh)
[![MCP](https://img.shields.io/badge/MCP-SDK-1.0-purple.svg)](https://modelcontextprotocol.io)

An MCP (Model Context Protocol) server for Claude Desktop that enables secure SSH command execution on remote hosts. Uses stdio transport for seamless integration.

## Quick Start

Get up and running in 30 seconds:

```bash
# 1. Clone and install
git clone <repo> && cd ssh_exoman
bun install

# 2. Add to Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json)
```

```json
{
  "mcpServers": {
    "ssh-exoman": {
      "command": "bun",
      "args": ["run", "/path/to/ssh_exoman/src/index.ts"]
    }
  }
}
```

```bash
# 3. Restart Claude Desktop

# 4. Try it: "List my SSH hosts" or "Run 'uname -a' on myserver"
```

## Features Overview

### Tools (6)

| Tool | Description |
|------|-------------|
| `execute_command` | Run SSH commands in background with UUID tracking |
| `get_command_output` | Retrieve command output with chunked reading |
| `get_command_status` | Check if a command is running, completed, or failed |
| `kill_command` | Terminate running processes (SIGTERM → SIGKILL) |
| `get_security_info` | Inspect current security configuration |
| `resolve_host` | Resolve SSH config alias to actual connection details |

### Resources (1)

| Resource | Description |
|----------|-------------|
| `ssh://hosts` | List configured SSH hosts from `~/.ssh/config` |

### Prompts (1)

| Prompt | Description |
|--------|-------------|
| `ssh_help` | Usage guidance for all available tools |

## Installation

```bash
bun install
```

### Requirements

- [Bun](https://bun.sh) v1.3.10 or later
- SSH access configured in `~/.ssh/config`
- Private keys in `~/.ssh/` (optionally passphrase-protected)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_SECURITYMODE` | `blacklist` | Security mode: `blacklist`, `whitelist`, or `disabled` |
| `SSH_EXOMAN_CONNECT_TIMEOUT` | `30000` | SSH connection timeout in milliseconds |
| `SSH_EXOMAN_COMMAND_TIMEOUT` | `60000` | Command execution timeout in milliseconds |
| `SSH_EXOMAN_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `SSH_PASSPHRASE` | - | Global passphrase for encrypted private keys |
| `SSH_PASSPHRASE_{HOST}` | - | Per-host passphrase (host uppercased, hyphens to underscores) |

### Per-Host Passphrases

For hosts with passphrase-protected private keys, set per-host environment variables:

| Host | Environment Variable |
|------|---------------------|
| `myhost` | `SSH_PASSPHRASE_MYHOST` |
| `my-server` | `SSH_PASSPHRASE_MY_SERVER` |
| `prod_db` | `SSH_PASSPHRASE_PROD_DB` |

If no per-host passphrase is set, falls back to `SSH_PASSPHRASE`.

### Security Modes

| Mode | Behavior |
|------|----------|
| `blacklist` (default) | Block known dangerous commands, allow everything else |
| `whitelist` | Only allow explicitly permitted commands |
| `disabled` | No filtering (use with caution) |

Set mode via `SSH_SECURITYMODE=blacklist|whitelist|disabled`.

## Claude Desktop Integration

### Development Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ssh-exoman": {
      "command": "bun",
      "args": ["run", "/path/to/ssh_exoman/src/index.ts"]
    }
  }
}
```

### Production Setup (Compiled Binary)

```bash
bun build ./src/index.ts --compile --outfile ssh-exoman
```

Then reference the compiled binary:

```json
{
  "mcpServers": {
    "ssh-exoman": {
      "command": "/path/to/ssh_exoman/ssh-exoman"
    }
  }
}
```

### macOS launchd Considerations

When Claude Desktop is launched via Finder/Spotlight (default on macOS), environment variables like `SSH_AUTH_SOCK` may not be available. **However, SSH Exoman now includes automatic agent discovery** that finds the SSH agent socket without requiring `SSH_AUTH_SOCK`.

**Automatic Discovery (No Configuration Required)**

SSH Exoman automatically discovers your SSH agent using multiple strategies:

1. **SSH_AUTH_SOCK** environment variable (if set)
2. **Environment file** at `~/.config/ssh-exoman/agent-sock` (optional)
3. **macOS launchd socket** at `/private/tmp/com.apple.launchd.XXX/Listeners`
4. **Standard Unix sockets** at `/tmp/ssh-XXX/agent.NNN`

On macOS, the launchd-managed agent is automatically discovered when Claude Desktop is launched from Finder. No manual configuration required.

**For Linux/Other Platforms**

If `SSH_AUTH_SOCK` isn't set, ensure ssh-agent is running:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

## Tool Reference

### execute_command

Run a command on a remote host via SSH. Commands run in background and return a UUID for tracking.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `host` | string | Yes | - | SSH config alias (1-253 chars) |
| `command` | string | Yes | - | Command to execute (1-10000 chars) |
| `timeout` | number | No | 60000 | Command timeout in milliseconds |
| `forwardAgent` | boolean | No | false | Forward local SSH agent to remote host |

**Example:**

```json
{
  "host": "myserver",
  "command": "ls -la /var/log",
  "timeout": 30000
}
```

**Response:**

```json
{
  "success": true,
  "process_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**With Agent Forwarding:**

```json
{
  "host": "jump-host",
  "command": "scp file.txt user@target:/dest/",
  "forwardAgent": true
}
```

> ⚠️ **Security Note**: Only use `forwardAgent: true` on fully trusted hosts. Root users on remote systems can access your forwarded agent socket.

---

### get_command_status

Check if a command is still running, completed, or failed.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `process_id` | string (UUID) | Yes | - | Process ID from execute_command |

**Example:**

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Running):**

```json
{
  "success": true,
  "status": "running",
  "pid": 12345
}
```

**Response (Completed):**

```json
{
  "success": true,
  "status": "completed",
  "exit_code": 0
}
```

**Response (Failed):**

```json
{
  "success": true,
  "status": "failed",
  "exit_code": 1,
  "error": "Command failed with exit code 1"
}
```

---

### get_command_output

Retrieve command output with chunked reading for large results.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `process_id` | string (UUID) | Yes | - | Process ID from execute_command |
| `byte_offset` | number | No | 0 | Starting byte offset |
| `max_bytes` | number | No | 65536 | Maximum bytes to return (max: 1MB) |

**Example:**

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "byte_offset": 0,
  "max_bytes": 65536
}
```

**Response:**

```json
{
  "success": true,
  "data": "total 48\ndrwxr-xr-x  2 root root 4096 Jan 1 00:00 .\n...",
  "total_size": 1024,
  "has_more": false
}
```

**For Large Outputs (Pagination):**

```json
// First chunk
{ "success": true, "data": "...", "total_size": 100000, "has_more": true }

// Next chunk
{ "process_id": "...", "byte_offset": 65536, "max_bytes": 65536 }
```

---

### kill_command

Terminate a running command with graceful shutdown.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `process_id` | string (UUID) | Yes | - | Process ID from execute_command |
| `force` | boolean | No | false | Skip SIGTERM, send SIGKILL immediately |

**Example:**

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Process terminated"
}
```

**Force Kill:**

```json
{
  "process_id": "550e8400-e29b-41d4-a716-446655440000",
  "force": true
}
```

> **Note:** By default, sends SIGTERM first, then SIGKILL after 5 seconds if process doesn't exit.

---

### get_security_info

Inspect current security configuration and pattern count.

**Parameters:** None

**Example:**

```json
{}
```

**Response:**

```json
{
  "success": true,
  "mode": "blacklist",
  "pattern_count": 36,
  "sample_patterns": [
    "\\brm\\s+(-[rf]+|-[a-z]*r[a-z]*f[a-z]*)",
    "\\bdd\\s+if=.*of=/dev/",
    "\\bmkfs\\.",
    "\\bsudo\\b",
    "\\bsu\\s+(-|--)"
  ]
}
```

---

### resolve_host

Resolve an SSH config alias to actual connection details (IP, port, user). Essential for multi-hop SSH operations where remote servers need the real address, not local aliases.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `host` | string | Yes | - | SSH config alias to resolve |

**Example:**

```json
{
  "host": "art.cp1.afrhkom"
}
```

**Response:**

```json
{
  "success": true,
  "alias": "art.cp1.afrhkom",
  "hostname": "5.39.70.214",
  "port": 2274,
  "user": "afrhkom"
}
```

**Use Case:** Before multi-hop SCP/SSH with `forwardAgent`, resolve the target host to get the real IP that remote servers can connect to.

## Agent Forwarding Guide

### What It Does

Agent forwarding (`forwardAgent: true`) allows a remote host to authenticate to other SSH servers using your **local** SSH keys. Your private keys never leave your machine.

### When to Use

- **SCP/rsync hops**: Transfer files between remote servers without copying private keys
- **Git clone on remote**: Clone private repositories on a jump host using your local credentials
- **Multi-hop SSH**: SSH from one remote to another using your local identity

### Security Considerations

> ⚠️ **Only use `forwardAgent` on fully trusted hosts.**

Root users on remote systems can access your forwarded agent socket and authenticate to other servers using your credentials. This is a fundamental SSH security consideration.

### Multi-Hop Workflow Example

When copying files between remote servers:

```
┌─────────┐      SSH Agent       ┌─────────┐      SCP       ┌─────────┐
│  Local  │ ──────────────────► │ Jump    │ ──────────────► │ Target  │
│  Machine│   forwardAgent      │ Host    │   Uses agent    │ Server  │
└─────────┘                     └─────────┘                 └─────────┘
```

**Step 1: Resolve the target host**

```json
// Use resolve_host to get the REAL IP address
{ "host": "target-server" }
// Returns: { "hostname": "192.168.1.100", "port": 22, "user": "admin" }
```

**Step 2: Execute with resolved address**

```json
// Use the RESOLVED IP, not the alias!
{
  "host": "jump-host",
  "command": "scp -P 22 /data/file admin@192.168.1.100:/backup/",
  "forwardAgent": true
}
```

### Common Pitfall: Using Aliases Instead of IPs

❌ **Wrong:** SSH aliases like `my-server` only exist in your local `~/.ssh/config`. Remote servers cannot resolve them.

```json
{
  "host": "jump-host",
  "command": "scp file.txt user@target-alias:/dest/",  // ❌ Won't work!
  "forwardAgent": true
}
```

✅ **Correct:** Use `resolve_host` first, then use the real IP:

```json
// First: resolve_host("target-alias") → { "hostname": "10.0.0.5", ... }
{
  "host": "jump-host",
  "command": "scp file.txt user@10.0.0.5:/dest/",  // ✅ Works!
  "forwardAgent": true
}
```

## Security

SSH Exoman includes built-in command filtering to prevent accidental destructive operations.

### Default Blacklist Patterns (36)

| Category | Blocked Patterns |
|----------|-----------------|
| **File Deletion** | `rm -rf` variants |
| **Disk Operations** | `dd if=... of=/dev/`, `mkfs.*`, `shred`, `wipefs`, `fdisk`, `parted` |
| **Privilege Escalation** | `sudo`, `su -`, `su --`, `doas`, `pkexec` |
| **System Power** | `shutdown`, `reboot`, `halt`, `poweroff`, `init 0`, `init 6` |
| **User Management** | `useradd`, `userdel`, `usermod`, `passwd` |
| **Firewall** | `iptables -F`, `firewall-cmd` |
| **Network (Reverse Shells)** | `nc -[el]`, `ncat -[el]` |
| **Package Removal** | `apt remove`, `apt purge`, `yum remove`, `pacman -R`, `pip uninstall` |
| **Process Killing** | `kill -9 -1`, `pkill -9`, `killall` |
| **Escape Vectors** | `vi/vim ... shell`, `less ... !` |
| **Kernel Modules** | `modprobe`, `rmmod`, `insmod` |

### Custom Patterns

Override with environment variables:

```bash
# Use whitelist mode for restricted access
SSH_SECURITYMODE=whitelist

# Patterns are regex (case-insensitive)
# Whitelist allows ONLY matching commands
```

### When to Use Which Mode

| Mode | Use Case |
|------|----------|
| `blacklist` | General use - blocks dangerous operations while allowing flexibility |
| `whitelist` | Highly restricted environments - only explicitly allowed commands |
| `disabled` | Trusted environments only - no filtering |

## Troubleshooting

### SSH_AGENT_UNAVAILABLE

**Error:** `SSH agent socket not found. On macOS, ensure ssh-agent is running. On Linux, run: eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519`

**Cause:** ssh-agent is not running or its socket cannot be found.

**Automatic Discovery**

SSH Exoman automatically discovers your SSH agent using multiple strategies:

| Priority | Source | Platform |
|----------|--------|----------|
| 1 | `SSH_AUTH_SOCK` env var | All |
| 2 | `~/.config/ssh-exoman/agent-sock` file | All |
| 3 | `/private/tmp/com.apple.launchd.XXX/Listeners` | macOS only |
| 4 | `/tmp/ssh-XXX/agent.NNN` | Linux/Unix |

**On macOS:** The launchd-managed agent socket is automatically discovered. No configuration required when launching Claude from Finder.

**On Linux:** If you still see this error, ensure ssh-agent is running:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

**Manual Socket Path (Optional)**

If automatic discovery doesn't work, you can create an environment file:

```bash
# Find your agent socket
ls /tmp/ssh-*/agent.*

# Or on macOS
ls /private/tmp/com.apple.launchd.*/Listeners

# Create the config file
mkdir -p ~/.config/ssh-exoman
echo "/path/to/your/agent.sock" > ~/.config/ssh-exoman/agent-sock
```

---

### Agent Forwarding: Remote Auth Failed (Exit 255)

**Error:** SCP/SSH command exits with code 255 when using `forwardAgent: true`

**Cause:** Your local agent is forwarded, but the remote command is still failing auth. Common causes:

1. **Using SSH config alias instead of real IP** - Remote servers can't resolve your local aliases
2. **Key not authorized on destination** - Your forwarded key isn't in `authorized_keys` on the target

**Solution 1: Use resolve_host Before Multi-hop**

```json
// First resolve the target
{ "host": "target-server" }
// Returns: { "hostname": "10.0.0.5", "port": 22, "user": "admin" }

// Then use the REAL IP in your remote command
{ "host": "jump-host", "command": "scp -P 22 file.txt admin@10.0.0.5:/dest/", "forwardAgent": true }
```

**Solution 2: Authorize Your Key on Destination**

```bash
# On jump-host, check which key would be used:
ssh -v target-server 2>&1 | grep " Offering "

# On target-server, add the public key:
echo "ssh-ed25519 AAAA... your@local.machine" >> ~/.ssh/authorized_keys
```

**Solution 3: Debug the Connection**

```bash
# Run with verbose SSH on the remote:
ssh jump-host "ssh -vvv user@target ls"

# Check agent forwarding is working:
ssh -A jump-host "ssh-add -l"
# Should list your local keys
```

---

### SSH_AUTH_FAILED with Encrypted Key

**Error:** `SSH_AUTH_FAILED` with message about encrypted private key

**Cause:** Private key is passphrase-protected and no passphrase was provided.

**Solutions:**

```bash
# Option 1: Set global passphrase
export SSH_PASSPHRASE="your-passphrase"

# Option 2: Set per-host passphrase
export SSH_PASSPHRASE_MY_SERVER="your-passphrase"

# Option 3: Use ssh-agent (recommended)
ssh-add ~/.ssh/id_ed25519
```

---

### CONFIG_ERROR Host Not Found

**Error:** `CONFIG_ERROR: Host 'alias' not found`

**Cause:** Host alias not in `~/.ssh/config` file.

**Solutions:**

```bash
# Check your SSH config
cat ~/.ssh/config

# Verify host entry exists
ssh -G myserver | head -5

# Add missing host entry
echo "Host myserver
  HostName 192.168.1.100
  User myuser
  Port 22" >> ~/.ssh/config
```

---

### SECURITY_BLOCKED

**Error:** `SECURITY_BLOCKED: Command matches blocked pattern`

**Cause:** Command matched a blacklist pattern (e.g., `sudo`, `rm -rf`).

**Solutions:**

1. Review if the command is truly needed
2. Use a safer alternative if available
3. Temporarily disable security (not recommended): `SSH_SECURITYMODE=disabled`

---

### Connection Timeout

**Error:** `SSH_CONNECTION_FAILED` with timeout message

**Possible Causes:**

- Firewall blocking connection
- Wrong port in SSH config
- Host is down or unreachable
- Network connectivity issues

**Debugging:**

```bash
# Test connectivity
ping myserver

# Test SSH directly with verbose output
ssh -vvv myserver

# Check if port is open
nc -zv myserver 22
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Desktop                           │
│                           │                                  │
│                     MCP Protocol                             │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               SSH Exoman Server                        │  │
│  │                                                        │  │
│  │   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │   │    Tools    │  │  Resources  │  │    Prompts   │  │  │
│  │   │  (6 tools)  │  │ ssh://hosts │  │   ssh_help   │  │  │
│  │   └──────┬──────┘  └─────────────┘  └──────────────┘  │  │
│  │          │                                            │  │
│  │          ▼                                            │  │
│  │   ┌─────────────┐  ┌─────────────────────────────┐   │  │
│  │   │  Security   │  │      SSH Executor           │   │  │
│  │   │  Validator  │  │  (connections, streaming)   │   │  │
│  │   └─────────────┘  └──────────────┬──────────────┘   │  │
│  │                                     │                  │  │
│  └─────────────────────────────────────┼──────────────────┘  │
│                                        │                     │
│                                  SSH Protocol                │
│                                        ▼                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Remote Host                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | Purpose |
|--------|---------|
| `index.ts` | Entry point, stdio transport |
| `server.ts` | MCP server setup, tool registration |
| `security-validator.ts` | Command filtering (blacklist/whitelist) |
| `ssh/client.ts` | SSH connection, passphrase resolution |
| `ssh/executor.ts` | Command execution, output streaming |
| `ssh/config-parser.ts` | `~/.ssh/config` parsing |
| `ssh/process-manager.ts` | Process tracking, kill handling |
| `schemas/` | Zod input validation |
| `tools/` | MCP tool implementations |
| `resources/` | MCP resource implementations |
| `prompts/` | MCP prompt implementations |

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3.10+
- SSH configured in `~/.ssh/config`

### Commands

```bash
bun install          # Install dependencies
bun test             # Run all tests
bun test --watch     # Run tests in watch mode
bun run build        # Build to dist/index.js
bun run src/index.ts # Run the MCP server directly
```

> **IMPORTANT:** After code changes, always run `bun test && bun run build` before testing with MCP.

### Project Structure

```
src/
├── index.ts              # MCP server entry point (stdio transport)
├── server.ts             # MCP server setup and tool registration
├── lib.ts                # Library exports
├── config.ts             # Environment variable loading
├── types.ts              # TypeScript type definitions
├── errors.ts             # Error classes and codes
├── structured-logger.ts  # Logging utility
├── security-validator.ts # Command blacklist/whitelist filtering
├── security-patterns.json # 36 security patterns
├── test-utils.ts         # Testing utilities
├── schemas/              # Zod schemas for tool inputs
│   ├── index.ts
│   ├── execute-command.ts
│   ├── get-command-output.ts
│   ├── get-command-status.ts
│   ├── kill-command.ts
│   ├── resolve-host.ts
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
    ├── agent-discovery.ts # SSH agent socket discovery (auto-discovery)
    ├── command-detection.ts
    └── process-manager.ts
```

### Bun Notes

- Use `bun test` instead of jest/vitest
- Bun auto-loads `.env` files, no dotenv needed
- Use `bun:sqlite` instead of better-sqlite3 if needed
- Prefer `Bun.file()` over `node:fs` readFile/writeFile

## License

MIT
