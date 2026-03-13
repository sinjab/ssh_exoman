# Phase 4: Core Agent Forwarding - Research

**Researched:** 2026-03-13
**Domain:** SSH Agent Forwarding via ssh2 library
**Confidence:** HIGH

## Summary

SSH agent forwarding enables remote commands to authenticate with other SSH servers using the user's local SSH keys without the private keys ever leaving the local machine. The `ssh2` library (already a project dependency at v1.17.0) fully supports this via two configuration options: `agent` (path to SSH agent socket) and `agentForward` (boolean to enable forwarding).

**Primary recommendation:** Extend the existing `connect()` function in `src/ssh/client.ts` to accept a `forwardAgent` option. When true, validate the SSH agent is available (SSH_AUTH_SOCK env var exists and socket file exists), then pass both `agent: process.env.SSH_AUTH_SOCK` and `agentForward: true` to the ssh2 client config. Fail fast with a descriptive error if agent is unavailable when forwarding is requested.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New error code `SSH_AGENT_UNAVAILABLE` in src/errors.ts
- Error message includes fix suggestion: "SSH agent socket not found. Set SSH_AUTH_SOCK or start ssh-agent."
- Include Claude Desktop hint: "If using Claude Desktop, ensure SSH_AUTH_SOCK is exported in launch environment."
- Validate both SSH_AUTH_SOCK env var exists AND socket file exists (fs.existsSync)
- Check at execute_command call time (fail fast) - before SSH connection attempt

### Observability (P2 features promoted to P1)
- Include `agentAvailable: boolean` and `agentSocket: string | null` in `get_security_info` response
- Include `forwardAgent: boolean` in ProcessInfo and `get_command_status` response
- These are included in Phase 4 for completeness and debugging value

### Detection Behavior
- Only check agent when `forwardAgent: true`
- Skip agent validation when `forwardAgent: false` or omitted (no overhead)
- Agent check is: env var present AND socket file exists

### ssh2 Configuration
- Both `agent: process.env.SSH_AUTH_SOCK` AND `agentForward: true` must be set in connection config
- Setting only one does not work (confirmed by research)

### Claude's Discretion
- Exact phrasing of Claude Desktop hint (within the guideline above)
- Logging verbosity for agent detection
- Test coverage approach

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-01 | User can enable SSH agent forwarding via `forwardAgent: true` parameter on `execute_command` | ssh2 library supports via `agent` + `agentForward` config options; extend ExecuteCommandSchema with optional boolean |
| AGNT-02 | `forwardAgent` parameter defaults to `false` (explicit opt-in required) | Zod schema `.optional().default(false)` pattern; no changes needed when omitted |
| AGNT-03 | When `forwardAgent: true`, the local SSH agent socket is forwarded to the remote host | ssh2 README confirms: set `agent: socketPath` and `agentForward: true` in connect config |
| AGNT-04 | Remote commands can authenticate with other SSH servers using the forwarded agent | ssh2 agent forwarding protocol forwards signing requests; keys never leave local machine |
| ERRO-01 | User receives structured error when agent forwarding is requested but SSH agent is not available | New ErrorCode.SSH_AGENT_UNAVAILABLE; validate before connection attempt |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | ^1.17.0 | SSH client with agent forwarding support | Already in project; native agent forwarding via `agent` and `agentForward` options |
| Zod | ^4.3.6 | Schema validation | Already in project; extend ExecuteCommandSchema with `forwardAgent` field |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| fs.existsSync | Node built-in | Check if agent socket file exists | Agent validation before connection |
| process.env.SSH_AUTH_SOCK | Node built-in | Path to SSH agent socket | Required for agent forwarding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ssh2 native agent | ssh-agent npm module | Unnecessary dependency; ssh2 handles agent protocol internally |
| Custom agent protocol | ssh2 AgentProtocol class | Overkill; ssh2 OpenSSHAgent class handles standard UNIX sockets |

**Installation:**
No new dependencies required - all functionality available via existing `ssh2` library.

## Architecture Patterns

### Recommended Project Structure (Changes)
```
src/
├── errors.ts                 # Add SSH_AGENT_UNAVAILABLE to ErrorCode enum
├── schemas/
│   └── execute-command.ts    # Add forwardAgent?: boolean field
├── ssh/
│   ├── client.ts             # Add forwardAgent option to ConnectOptions, validate agent
│   ├── executor.ts           # Pass forwardAgent through to connect()
│   └── process-manager.ts    # Add forwardAgent to ProcessInfo (optional)
├── tools/
│   ├── execute.ts            # Pass forwardAgent param to executor
│   ├── status.ts             # Include forwardAgent in response (optional)
│   └── security-info.ts      # Add agentAvailable, agentSocket to response
└── types.ts                  # Add forwardAgent to ProcessInfo interface (optional)
```

### Pattern 1: Agent Validation (Fail Fast)
**What:** Check agent availability before attempting SSH connection when `forwardAgent: true`
**When to use:** Every `execute_command` call with `forwardAgent: true`
**Example:**
```typescript
// Source: CONTEXT.md decision + ssh2 README
function validateAgent(): Result<{ socketPath: string }> {
  const socketPath = process.env.SSH_AUTH_SOCK;

  if (!socketPath) {
    return errorResult(
      ErrorCode.SSH_AGENT_UNAVAILABLE,
      "SSH agent socket not found. Set SSH_AUTH_SOCK or start ssh-agent. " +
      "If using Claude Desktop, ensure SSH_AUTH_SOCK is exported in launch environment."
    );
  }

  if (!fs.existsSync(socketPath)) {
    return errorResult(
      ErrorCode.SSH_AGENT_UNAVAILABLE,
      `SSH agent socket not found at ${socketPath}. Ensure ssh-agent is running.`
    );
  }

  return { success: true, data: { socketPath } };
}
```

### Pattern 2: ssh2 Agent Forwarding Configuration
**What:** Configure ssh2 client for agent forwarding when requested
**When to use:** Inside `connect()` function when `forwardAgent: true`
**Example:**
```typescript
// Source: ssh2 README - Client.connect() config
const connectConfig = {
  host: hostConfig.hostname || hostConfig.host,
  port: hostConfig.port,
  username: hostConfig.user,
  readyTimeout: timeout,
  privateKey: connectConfig.privateKey,
  passphrase: connectConfig.passphrase,
  // Agent forwarding requires BOTH options
  agent: forwardAgent ? process.env.SSH_AUTH_SOCK : undefined,
  agentForward: forwardAgent,
};
```

### Pattern 3: get_security_info Extension
**What:** Report agent availability in security info tool
**When to use:** Every call to `get_security_info`
**Example:**
```typescript
// Source: CONTEXT.md observability decision
const agentSocket = process.env.SSH_AUTH_SOCK || null;
const agentAvailable = agentSocket ? fs.existsSync(agentSocket) : false;

return {
  success: true,
  data: {
    mode: info.mode,
    patternCount: info.patternCount,
    samplePatterns: info.samplePatterns,
    agentAvailable,
    agentSocket,
  },
};
```

### Anti-Patterns to Avoid
- **Setting only `agent` or only `agentForward`:** Both must be set together for forwarding to work
- **Validating agent when `forwardAgent: false`:** Adds unnecessary overhead; skip validation entirely
- **Caching agent availability:** Agent may become unavailable between check and use; validate at call time
- **Reading agent socket for auth + forwarding:** ssh2 handles both; just set `agent` for local auth and `agentForward` for remote forwarding

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent socket communication | Custom socket reader | ssh2 OpenSSHAgent class | Protocol complexity, edge cases |
| Agent protocol parsing | Custom protocol handler | ssh2 AgentProtocol class | Binary protocol with many message types |
| Agent availability detection | Complex health checks | `fs.existsSync(process.env.SSH_AUTH_SOCK)` | Simple and reliable |
| Per-connection agent state | Custom agent tracking | ssh2 built-in agent management | Library handles lifecycle |

**Key insight:** ssh2 has built-in support for OpenSSH agent protocol via `agent` config option. The library handles all socket communication, key enumeration, and signing operations internally.

## Common Pitfalls

### Pitfall 1: Missing Both Required Options
**What goes wrong:** Agent forwarding silently fails because only one of `agent` or `agentForward` is set
**Why it happens:** Documentation examples sometimes show only one option
**How to avoid:** Always set BOTH `agent: process.env.SSH_AUTH_SOCK` AND `agentForward: true`
**Warning signs:** Remote SSH commands fail with "permission denied" despite agent being available locally

### Pitfall 2: Claude Desktop Environment Variables
**What goes wrong:** `SSH_AUTH_SOCK` not set in Claude Desktop's environment even when agent is running
**Why it happens:** GUI applications don't inherit shell environment; launchd/systemd contexts differ
**How to avoid:** Error message explicitly mentions Claude Desktop; user must configure launch environment
**Warning signs:** Agent works in terminal but fails from MCP server

### Pitfall 3: Race Condition with Agent Socket
**What goes wrong:** Agent socket file exists at validation time but disappears before connection
**Why it happens:** ssh-agent may terminate, or socket may be cleaned up
**How to avoid:** This is acceptable; connection will fail with appropriate error. Don't over-engineer.
**Warning signs:** Intermittent failures that self-resolve on retry

### Pitfall 4: Security Misunderstanding
**What goes wrong:** Users enable forwarding on untrusted hosts, exposing their agent to root socket hijacking
**Why it happens:** Agent forwarding is convenient but has security implications
**How to avoid:** Default to `false`, require explicit opt-in, document security considerations (Phase 5)
**Warning signs:** Forwarding used indiscriminately across all hosts

## Code Examples

Verified patterns from official ssh2 documentation:

### Execute Command with Agent Forwarding
```typescript
// Source: ssh2 README - Client connect config with agentForward
import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
  // Now remote commands can use forwarded agent
  conn.exec("ssh user@another-host ls", (err, stream) => {
    // This SSH command uses the local agent for authentication
  });
}).connect({
  host: "jump-host.example.com",
  username: "user",
  // Both required for agent forwarding
  agent: process.env.SSH_AUTH_SOCK,
  agentForward: true,
});
```

### Schema Extension for forwardAgent
```typescript
// Source: Existing pattern in src/schemas/execute-command.ts
import { z } from "zod";

export const ExecuteCommandSchema = z.object({
  host: z.string().min(1, "Host is required").max(253, "Host name too long"),
  command: z.string().min(1, "Command is required").max(10000, "Command too long"),
  timeout: z.number().int().positive().optional(),
  forwardAgent: z.boolean().optional().default(false), // NEW
});
```

### Error Code Addition
```typescript
// Source: Existing pattern in src/errors.ts
export enum ErrorCode {
  // Security errors
  SECURITY_BLOCKED = "SECURITY_BLOCKED",

  // Process errors
  PROCESS_NOT_FOUND = "PROCESS_NOT_FOUND",
  PROCESS_TIMEOUT = "PROCESS_TIMEOUT",

  // Input validation errors
  INVALID_INPUT = "INVALID_INPUT",

  // Configuration errors
  CONFIG_ERROR = "CONFIG_ERROR",

  // SSH errors
  SSH_CONNECTION_FAILED = "SSH_CONNECTION_FAILED",
  SSH_AUTH_FAILED = "SSH_AUTH_FAILED",
  SSH_AGENT_UNAVAILABLE = "SSH_AGENT_UNAVAILABLE", // NEW

  // Internal errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual agent socket communication | ssh2 native agent support | ssh2 v0.5+ | No custom protocol handling needed |
| Environment-only agent detection | Env var + file existence check | This project | More reliable detection |

**Deprecated/outdated:**
- Using external `ssh-agent` npm module: ssh2 now includes built-in agent classes (OpenSSHAgent, PageantAgent, CygwinAgent)

## Open Questions

1. **ProcessInfo forwardAgent storage**
   - What we know: CONTEXT.md says to include `forwardAgent: boolean` in ProcessInfo
   - What's unclear: Whether to store it as optional field or always-present with default
   - Recommendation: Store as `forwardAgent: boolean` (always present, defaults to false) for consistency with other fields

2. **get_command_status forwardAgent in response**
   - What we know: CONTEXT.md says to include `forwardAgent` in status response
   - What's unclear: Whether this should be in ProcessStatusInfo (public) or just ProcessInfo (internal)
   - Recommendation: Add to ProcessStatusInfo since it's useful metadata for debugging

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in) |
| Config file | None - Bun auto-discovers *.test.ts files |
| Quick run command | `bun test` |
| Full suite command | `bun test && bun run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGNT-01 | forwardAgent parameter accepted | unit | `bun test src/schemas.test.ts` | Yes |
| AGNT-02 | forwardAgent defaults to false | unit | `bun test src/schemas.test.ts` | Yes |
| AGNT-03 | Agent socket forwarded to remote | unit/integration | `bun test src/ssh/client.test.ts` | Yes |
| AGNT-04 | Remote commands can use forwarded agent | integration | Manual testing required | N/A |
| ERRO-01 | Error when agent unavailable | unit | `bun test src/ssh/client.test.ts` | Yes |

### Sampling Rate
- **Per task commit:** `bun test`
- **Per wave merge:** `bun test && bun run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/ssh/client.test.ts` - Add tests for agent validation (forwardAgent parameter, SSH_AGENT_UNAVAILABLE error)
- [ ] `src/schemas.test.ts` - Add tests for forwardAgent field validation
- [ ] `src/tools/security-info.test.ts` - Add tests for agentAvailable and agentSocket fields
- [ ] `src/ssh/process-manager.test.ts` - Add test for forwardAgent in ProcessInfo (if stored)
- [ ] `src/tools/status.test.ts` - Add test for forwardAgent in status response (if included)

## Sources

### Primary (HIGH confidence)
- [ssh2 README (raw)](https://raw.githubusercontent.com/mscdex/ssh2/master/README.md) - Agent forwarding configuration (`agent` + `agentForward` options)
- [ssh2 GitHub Repository](https://github.com/mscdex/ssh2) - Official documentation and examples

### Secondary (MEDIUM confidence)
- Project source files: `src/errors.ts`, `src/schemas/execute-command.ts`, `src/ssh/client.ts`, `src/ssh/executor.ts`, `src/ssh/process-manager.ts`, `src/tools/security-info.ts`, `src/tools/execute.ts`, `src/tools/status.ts`, `src/types.ts`
- Project test files: `src/ssh/client.test.ts`, `src/ssh/executor.test.ts`, `src/ssh/process-manager.test.ts`, `src/tools/security-info.test.ts`
- CONTEXT.md decisions locked by user

### Tertiary (LOW confidence)
- None - all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ssh2 library already in project with full agent forwarding support
- Architecture: HIGH - existing code patterns well-established (Result<T>, ErrorCode enum, Zod schemas)
- Pitfalls: HIGH - ssh2 documentation clearly states both options required; Claude Desktop environment issue documented in STATE.md

**Research date:** 2026-03-13
**Valid until:** 30 days (stable library, established patterns)
