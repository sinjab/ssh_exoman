# Feature Research: SSH Agent Forwarding

**Domain:** MCP SSH Server - Agent Forwarding (v2.0 Milestone)
**Researched:** 2026-03-13
**Confidence:** HIGH (ssh2 library documentation, SSH.com academy, established SSH protocol patterns)

## Executive Summary

SSH agent forwarding enables remote commands to authenticate with other SSH servers using the user's local SSH agent. The user's private keys never leave the local machine - only signing requests are forwarded. For ssh-exoman, this means adding an optional `forwardAgent` parameter to `execute_command` that, when enabled, forwards the local agent socket to the remote SSH session.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when SSH agent forwarding is mentioned.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `forwardAgent` parameter | Standard SSH option (`ssh -A`), users expect parity | LOW | Boolean parameter on `execute_command`. Default `false` for security. |
| Agent socket detection | Must find the agent socket automatically | LOW | Read `SSH_AUTH_SOCK` environment variable. Fail clearly if not set when forwarding is requested. |
| Private keys stay local | This is the entire point of agent forwarding | N/A (inherent) | Keys never transmitted. Only signing requests forwarded over encrypted channel. |
| Clear error when agent unavailable | Users need to know why forwarding failed | LOW | Return structured error if `forwardAgent: true` but no agent socket detected. |
| Security documentation | Users must understand trust implications | LOW | Document: only forward to trusted hosts, root on remote can use your agent. |

### Differentiators (Competitive Advantage)

Features that would enhance the agent forwarding experience beyond basic functionality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-command forwarding | Each command decides independently whether to forward | LOW | Already the design - `forwardAgent` is per-invocation, not global. |
| Agent status in `get_security_info` | Users can verify agent is available before attempting forwarding | LOW | Add `agentAvailable: boolean` and `agentSocket: string \| null` to security info response. |
| Forwarded session tracking | Process info shows which commands have agent forwarding enabled | LOW | Include `forwardAgent: boolean` in process metadata returned by `get_command_status`. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this MCP server context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Global `agentForward` default | "Always forward my agent" | Security risk - should be explicit per-command. AI assistants might forward to untrusted hosts without user awareness. | Require explicit `forwardAgent: true` on each command. Opt-in, not opt-out. |
| SSH config `ForwardAgent` parsing | "My config already has ForwardAgent yes" | Adds implicit behavior that's invisible to the user. MCP tool parameters should be explicit. Also explicitly out of scope per PROJECT.md. | Document that users must pass `forwardAgent` parameter explicitly. Config is ignored. |
| Session-level forwarding (persist across commands) | "Set forwarding once for multiple commands" | State management complexity. Which commands inherit? How to disable mid-session? What if agent socket changes? | Per-command forwarding is simpler, safer, and follows SSH's per-connection model. |
| Agent forwarding via environment variable | "Set SSH_EXOMAN_FORWARD_AGENT=true" | Same problem as global default - implicit behavior, security risk. | Only via tool parameter - explicit and visible in the AI's tool call. |

## Feature Dependencies

```
[Agent Socket Detection]
    └──requires──> [SSH_AUTH_SOCK env var present]
                       └──enables──> [forwardAgent parameter]

[forwardAgent Parameter]
    └──requires──> [Agent Socket Detection]
    └──requires──> [ssh2 agent + agentForward config]
    └──enhances──> [execute_command tool]

[Agent Status in get_security_info]
    └──requires──> [Agent Socket Detection]
    └──independent-of──> [forwardAgent Parameter]

[Forwarded Session Tracking]
    └──requires──> [Process Manager stores forwardAgent flag]
    └──enables──> [get_command_status shows forwarding state]
```

### Dependency Notes

- **forwardAgent requires Agent Socket Detection:** Cannot forward if no agent socket exists. Must detect before attempting connection.
- **ssh2 requires both `agent` and `agentForward`:** The ssh2 library requires setting `agent: process.env.SSH_AUTH_SOCK` AND `agentForward: true` in the connection config. Setting only one does not work.
- **Agent Status is independent of Forwarding:** Knowing if an agent is available is useful info even when not forwarding.
- **Process tracking should store forwardAgent:** When listing processes, showing which have agent forwarding helps users audit security posture.

## MCP Tool Interface Considerations

### Proposed `execute_command` Schema Extension

```typescript
export const ExecuteCommandSchema = z.object({
  host: z.string().min(1, "Host is required").max(253, "Host name too long"),
  command: z.string().min(1, "Command is required").max(10000, "Command too long"),
  timeout: z.number().int().positive().optional(),
  forwardAgent: z.boolean().optional(), // NEW: Enable SSH agent forwarding
});
```

### Proposed `get_security_info` Schema Extension

```typescript
// Response extension
{
  mode: string;
  patternCount: number;
  patterns: string[];
  // NEW fields:
  agentAvailable: boolean;      // Is SSH_AUTH_SOCK set and socket exists?
  agentSocket: string | null;   // Path to agent socket (or null if unavailable)
}
```

### Proposed Process Metadata Extension

```typescript
// In ProcessInfo (process-manager.ts)
interface ProcessInfo {
  // ... existing fields ...
  forwardAgent: boolean;  // NEW: Was agent forwarding enabled for this process?
}
```

## ssh2 Library Integration

### Connection Config Pattern

From ssh2 library documentation (HIGH confidence):

```typescript
const connectionConfig = {
  host: hostConfig.hostname || hostConfig.host,
  port: hostConfig.port,
  username: hostConfig.user,
  readyTimeout: timeout,
  privateKey: fs.readFileSync(keyPath),
  passphrase: passphrase,
  // Agent forwarding requires BOTH of these:
  agent: process.env.SSH_AUTH_SOCK,  // Socket path to local agent
  agentForward: true,                 // Enable forwarding to remote
};
```

**Critical Implementation Note:** Both `agent` and `agentForward: true` must be set. Setting only `agentForward` without `agent` will not work.

### Error Handling Scenarios

| Scenario | Detection | Error Response |
|----------|-----------|----------------|
| `forwardAgent: true` but `SSH_AUTH_SOCK` not set | Check before connection | `AGENT_UNAVAILABLE: SSH agent socket not found. Set SSH_AUTH_SOCK or start ssh-agent.` |
| `forwardAgent: true` but socket file doesn't exist | `fs.existsSync(socketPath)` | `AGENT_UNAVAILABLE: SSH agent socket at {path} does not exist. Is ssh-agent running?` |
| Agent forwarding fails during connection | ssh2 `error` event | `SSH_AGENT_FORWARD_FAILED: {ssh2 error message}` |

### Code Changes Required

1. **src/ssh/client.ts** - Extend `connect()` to accept `forwardAgent` option
2. **src/schemas/execute-command.ts** - Add `forwardAgent` field
3. **src/tools/execute.ts** - Pass `forwardAgent` through to executor
4. **src/ssh/executor.ts** - Forward `forwardAgent` to `connect()`
5. **src/tools/security-info.ts** - Add agent availability info
6. **src/ssh/process-manager.ts** - Store `forwardAgent` in process metadata

## Security Considerations

### User Must Understand

1. **Only forward to trusted hosts** - The remote host's root user can use your forwarded agent to authenticate with other servers.
2. **Agent is not the keys** - Your private keys stay on your local machine. Only signing operations are forwarded.
3. **Explicit per-command** - No global defaults, no config file parsing. Every forwarded command is intentional.

### Documentation Requirements

- Document `forwardAgent` parameter in tool descriptions
- Add security warning to `execute_command` tool description
- Include agent forwarding section in `ssh_help` prompt
- Document `SSH_AUTH_SOCK` requirement

## MVP Definition for v2.0

### Must Have

- [ ] `forwardAgent` boolean parameter on `execute_command` (default: `false`)
- [ ] Agent socket detection via `SSH_AUTH_SOCK`
- [ ] Clear error when `forwardAgent: true` but no agent available
- [ ] ssh2 config with `agent` and `agentForward: true` when forwarding
- [ ] Update `ssh_help` prompt with agent forwarding documentation
- [ ] Security documentation in README

### Should Have (v2.0 or v2.1)

- [ ] `agentAvailable` and `agentSocket` in `get_security_info` response
- [ ] `forwardAgent` flag in process metadata (visible via `get_command_status`)

### Will Not Have

- Global default via environment variable
- SSH config `ForwardAgent` parsing (explicitly out of scope per PROJECT.md)
- Session-level forwarding state

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| forwardAgent parameter | HIGH | LOW | P1 |
| Agent socket detection | HIGH | LOW | P1 |
| Error when agent unavailable | HIGH | LOW | P1 |
| ssh2 agent+agentForward config | HIGH | LOW | P1 |
| Security documentation | HIGH | LOW | P1 |
| Agent status in get_security_info | MEDIUM | LOW | P2 |
| forwardAgent in process metadata | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for v2.0 launch - core agent forwarding functionality
- P2: Should have - observability and auditing enhancements

## Sources

- **ssh2 npm library README** - https://github.com/mscdex/ssh2 (HIGH confidence - official documentation)
  - Documents `agent` and `agentForward` connection options
  - Confirms both must be set for forwarding to work
- **SSH.com Academy: ssh-agent** - https://www.ssh.com/academy/ssh/agent (HIGH confidence - authoritative source)
  - Explains agent forwarding security model
  - Documents that private keys never leave local machine
  - Warns about root user on remote host having access to agent
- **PROJECT.md** - Current milestone requirements and out-of-scope decisions (HIGH confidence - project source of truth)
- **src/ssh/client.ts** - Current connection implementation (HIGH confidence - existing codebase)
- **src/schemas/execute-command.ts** - Current schema structure (HIGH confidence - existing codebase)

---
*Feature research for: SSH Agent Forwarding (v2.0)*
*Researched: 2026-03-13*
