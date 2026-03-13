# Stack Research: SSH Agent Forwarding

**Project:** ssh-exoman v2.0
**Feature:** SSH Agent Forwarding
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

**No new dependencies required.** SSH agent forwarding is fully supported by the existing `ssh2@1.17.0` library via the `agentForward: boolean` configuration option. The implementation requires only code changes to leverage existing library capabilities.

## Recommended Changes

### Core Configuration (ssh2)

| Option | Type | Purpose | Why |
|--------|------|---------|-----|
| `agentForward` | `boolean` | Enable OpenSSH agent forwarding (`auth-agent@openssh.com`) | When set to `true` at connection time, ssh2 requests agent forwarding for the entire connection lifetime. Remote commands can then use the local SSH agent for authentication. |
| `agent` | `string \| BaseAgent` | Specify SSH agent socket path or custom agent | Required when `agentForward: true` to provide access to the local agent. Use `process.env.SSH_AUTH_SOCK` on Unix/Linux/macOS or `"pageant"` on Windows. |

### Integration Points

| File | Change Required | Rationale |
|------|-----------------|-----------|
| `src/ssh/client.ts` | Add `agentForward?: boolean` to `ConnectOptions` | Pass forwarding flag through connection layer |
| `src/ssh/client.ts` | Add `agent?: string` to connection config build | Forward agent socket path to ssh2 |
| `src/ssh/executor.ts` | Add `forwardAgent` parameter to `executeSSHCommand` | Allow tool-level control of forwarding |
| `src/schemas/execute-command.ts` | Add `forwardAgent: z.boolean().optional()` | Expose parameter via MCP tool |
| `src/tools/execute.ts` | Wire `forwardAgent` through to executor | Connect MCP layer to SSH layer |

### No New Dependencies

```bash
# No new packages needed
# Existing stack fully supports agent forwarding:
# - ssh2@1.17.0: Has agentForward support (verified in @types/ssh2)
# - @types/ssh2@1.15.5: Provides TypeScript types for agentForward
```

## SSH2 Agent Forwarding API

### Connection Configuration

The ssh2 `ConnectConfig` interface already includes:

```typescript
export interface ConnectConfig {
  // ... other options ...

  /** Path to ssh-agent's UNIX socket for ssh-agent-based user authentication (or 'pageant' when using Pagent on Windows). */
  agent?: BaseAgent | string;

  /** Set to `true` to use OpenSSH agent forwarding (`auth-agent@openssh.com`) for the life of the connection. */
  agentForward?: boolean;
}
```

### Usage Pattern

```typescript
import { Client } from "ssh2";

const client = new Client();

client.on("ready", () => {
  // Connection established with agent forwarding enabled
  // Remote commands can now use the forwarded agent
  client.exec("ssh user@another-server 'git clone repo'", (err, stream) => {
    // The remote ssh command uses the forwarded agent for authentication
    // Private keys never leave the local machine
  });
});

client.connect({
  host: "bastion.example.com",
  username: "user",
  privateKey: fs.readFileSync("/path/to/key"),
  agentForward: true,           // Enable forwarding for connection
  agent: process.env.SSH_AUTH_SOCK,  // Use local agent
});
```

### Agent Detection

The `createAgent()` helper from ssh2 automatically selects the appropriate agent:

```typescript
import { createAgent } from "ssh2";

// Auto-detects:
// - Windows + "pageant" -> PageantAgent
// - Windows + path -> CygwinAgent
// - Unix + path -> OpenSSHAgent
const agent = createAgent(process.env.SSH_AUTH_SOCK || "pageant");
```

### BaseAgent Interface (for reference)

The ssh2 library provides agent abstraction via `BaseAgent` class:

```typescript
export abstract class BaseAgent {
  // Get identities from agent
  abstract getIdentities(cb: IdentityCallback): void;

  // Sign data with a key
  abstract sign(pubKey, data, options?, cb?): void;

  // Optional: Get stream for agent forwarding
  // This is what enables forwarding to work
  getStream?(cb: GetStreamCallback): void;
}
```

## Current Codebase Integration

### Existing `connect()` Function (src/ssh/client.ts)

```typescript
// Current signature
export async function connect(
  options: ConnectOptions
): Promise<Result<SSHConnection>> {

// Current ConnectOptions extends HostConfig
export interface ConnectOptions extends HostConfig {
  passphrase?: string;
  timeout?: number;
}

// Current connectConfig build (lines 121-133)
const connectConfig: {
  host: string;
  port: number;
  username: string;
  readyTimeout: number;
  privateKey?: Buffer;
  passphrase?: string;
} = {
  host: hostConfig.hostname || hostConfig.host,
  port: hostConfig.port,
  username: hostConfig.user,
  readyTimeout: timeout,
};
```

### Required Changes to client.ts

```typescript
// Updated ConnectOptions
export interface ConnectOptions extends HostConfig {
  passphrase?: string;
  timeout?: number;
  forwardAgent?: boolean;  // NEW: Enable agent forwarding
}

// Updated connectConfig type
const connectConfig: {
  host: string;
  port: number;
  username: string;
  readyTimeout: number;
  privateKey?: Buffer;
  passphrase?: string;
  agentForward?: boolean;  // NEW
  agent?: string;          // NEW
} = {
  host: hostConfig.hostname || hostConfig.host,
  port: hostConfig.port,
  username: hostConfig.user,
  readyTimeout: timeout,
};

// Add after privateKey handling
if (options.forwardAgent) {
  connectConfig.agentForward = true;
  connectConfig.agent = process.env.SSH_AUTH_SOCK;
}
```

## Platform Considerations

| Platform | Agent Socket | Notes |
|----------|-------------|-------|
| macOS/Linux | `$SSH_AUTH_SOCK` | Typically `/tmp/ssh-XXXXXXXX/agent.XXXXX` |
| Windows (Pageant) | `"pageant"` | Literal string triggers Pageant integration |
| Windows (WSL) | `$SSH_AUTH_SOCK` | Uses WSL's ssh-agent |
| Windows (Cygwin) | Path to socket | Auto-detected by ssh2 |

## Security Implications

### What Agent Forwarding Does

1. Forwards the **agent protocol**, not the private keys
2. Remote server can request signatures from local agent
3. Private keys **never leave the local machine**
4. User must approve each use (if agent requires confirmation)

### Security Concerns

| Concern | Severity | Mitigation |
|---------|----------|------------|
| Trusted host requirement | HIGH | Document that agent forwarding should only be used with trusted hosts. The remote host's root user can access the forwarded agent. |
| AI-controlled forwarding | MEDIUM | Require explicit `forwardAgent: true` parameter - never default to enabled. Log when forwarding is used. |
| Session hijacking | MEDIUM | Agent forwarding is per-connection. When connection closes, forwarding ends. |

### Recommended Security Patterns

```typescript
// Log when agent forwarding is requested
if (options.forwardAgent) {
  logger.info("Agent forwarding requested", {
    host: hostConfig.host,
    securityNote: "Only use with trusted hosts"
  });
}

// Require explicit opt-in (never default to true)
const forwardAgent = options.forwardAgent === true; // Explicit check
```

## What NOT to Add

| Avoid | Why | Instead |
|-------|-----|---------|
| `ssh2-sftp-client` | Not needed for agent forwarding | Use existing ssh2 connection |
| Custom agent implementation | ssh2 handles this | Use `process.env.SSH_AUTH_SOCK` |
| SSH config `ForwardAgent` parsing | Out of scope per PROJECT.md | Require explicit parameter |
| Agent caching | Security risk | Create fresh agent reference per connection |
| `node-ssh` wrapper | Loses low-level control | Continue using ssh2 directly |

## Testing Strategy

### Unit Tests

```typescript
// Test: agentForward is passed to ssh2
it("should set agentForward when forwardAgent is true", async () => {
  const mockConnect = vi.fn();
  // ... verify connectConfig.agentForward === true
});

// Test: agent is set to SSH_AUTH_SOCK
it("should use SSH_AUTH_SOCK for agent", async () => {
  process.env.SSH_AUTH_SOCK = "/tmp/test-agent";
  // ... verify connectConfig.agent === "/tmp/test-agent"
});
```

### Integration Tests

```typescript
// Test: Commands can use forwarded agent
it("should allow git clone via forwarded agent", async () => {
  // Requires running ssh-agent with loaded key
  // Connects to host with agent forwarding
  // Runs: ssh git@github.com repo-info
  // Verifies authentication succeeds via agent
});
```

## Sources

- `@types/ssh2@1.15.5` (installed) - TypeScript definitions for `ConnectConfig.agentForward` and `ConnectConfig.agent` - HIGH confidence
- `@types/ssh2@1.15.5` - `BaseAgent` class with `getStream()` method for forwarding - HIGH confidence
- ssh2 GitHub: https://github.com/mscdex/ssh2 - Official documentation - HIGH confidence (via type definitions verified)
- PROJECT.md - Confirmed agent forwarding is explicit parameter only, no SSH config parsing - HIGH confidence

---
*Stack research for: SSH Agent Forwarding feature*
*Researched: 2026-03-13*
