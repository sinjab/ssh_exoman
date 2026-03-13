# SSH Exoman

An MCP (Model Context Protocol) server for Claude Desktop that enables secure SSH command execution on remote hosts. Uses stdio transport for seamless Claude Desktop integration.

## Features

### Tools

- **`execute_command`** - Run SSH commands in background with UUID tracking for long-running operations
- **`get_command_output`** - Retrieve command output with chunked reading for large outputs
- **`get_command_status`** - Check if a command is running, completed, or failed
- **`kill_command`** - Terminate running processes (SIGTERM → SIGKILL escalation)
- **`get_security_info`** - Inspect current security configuration and blocked commands

### Resources

- **`ssh://hosts`** - List configured SSH hosts from `~/.ssh/config`

### Prompts

- **`ssh_help`** - Usage guidance for all available tools

## Installation

```bash
bun install
```

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

#### Per-Host Passphrases

For hosts with passphrase-protected private keys, set per-host environment variables:

- Host `myhost` → `SSH_PASSPHRASE_MYHOST`
- Host `my-server` → `SSH_PASSPHRASE_MY_SERVER`
- Host `prod_db` → `SSH_PASSPHRASE_PROD_DB`

If no per-host passphrase is set, falls back to `SSH_PASSPHRASE`.

## Claude Desktop Integration

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

For production use, build first:

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

## Security

SSH Exoman includes built-in command filtering to prevent accidental destructive operations.

### Agent Forwarding Security

Only use `forwardAgent` on trusted hosts. Root users on remote systems can access your forwarded agent socket and authenticate to other servers using your credentials.

### Agent Forwarding Usage

Use agent forwarding when you need to authenticate from a remote host using your local SSH keys:

- **SCP/rsync hops**: Transfer files between remote servers without copying private keys. Your local key authenticates both connections.
- **Git clone on remote**: Clone private repositories on a jump host using your local credentials.

### Default Blacklist (36 patterns)

Blocks dangerous commands including:

- `rm -rf` variants
- `sudo` and `su`
- `shutdown`, `reboot`, `halt`
- `iptables`, `ufw`
- `dd`, `mkfs`, `fdisk`
- `:(){ :|:& };:` (fork bombs)
- And more...

### Security Modes

| Mode | Behavior |
|------|----------|
| `blacklist` (default) | Block known dangerous commands, allow everything else |
| `whitelist` | Only allow explicitly permitted commands |
| `disabled` | No filtering (use with caution) |

Set mode via `SSH_SECURITYMODE=blacklist|whitelist|disabled`.

## Requirements

- [Bun](https://bun.sh) v1.3.10 or later
- SSH access configured in `~/.ssh/config`
- Private keys in `~/.ssh/` (optionally passphrase-protected)

## License

MIT
