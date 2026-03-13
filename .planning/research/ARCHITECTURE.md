# Architecture Research

**Domain:** MCP SSH Server (AI-native remote command execution)
**Researched:** 2026-03-07 (v1.0), 2026-03-13 (v2.0 agent forwarding update)
**Confidence:** HIGH (well-defined protocol, mature SSH libraries, reference Python implementation exists)

## Standard Architecture

### System Overview

```
                     MCP Clients
         (Claude Desktop, other AI tools)
                        |
        ________________|________________
       |                                 |
  stdio transport                  HTTP transport
  (stdin/stdout)              (StreamableHTTP POST)
       |                                 |
       |_____________    ________________|
                     |  |
                     v  v
         +--------------------------+
         |      MCP Server Core     |
         |  (McpServer from SDK)    |
         |  - Tool registration     |
         |  - Resource registration |
         |  - Prompt registration   |
         +-----+-------+------+----+
               |       |      |
      +--------+  +----+---+ +--------+
      |           |         |          |
 +----v----+ +----v----+ +-v-------+ +-v----------+
 | Tool     | | Tool    | | Tool   | | Resource/  |
 | Handlers | | Handlers| | Handler| | Prompt     |
 | (exec,   | | (output,| | (file  | | Handlers   |
 |  kill)   | |  status)| | xfer)  | | (hosts,    |
 +----+-----+ +----+----+ +---+----+ |  help)     |
      |             |          |      +-----+------+
      |             |          |            |
 +----v-------------v----------v------------v---+
 |              Service Layer                    |
 |  +----------------+  +-------------------+   |
 |  | Security       |  | Process Manager   |   |
 |  | Validator      |  | (UUID tracking,   |   |
 |  | (blacklist/    |  |  lifecycle mgmt)  |   |
 |  |  whitelist)    |  +-------------------+   |
 |  +----------------+                          |
 +------------------+---------------------------+
                    |
 +------------------v---------------------------+
 |              SSH Layer                        |
 |  +----------------+  +-------------------+   |
 |  | Connection      |  | SSH Config       |   |
 |  | Manager         |  | Parser           |   |
 |  | (pooling, TTL,  |  | (~/.ssh/config)  |   |
 |  |  health checks) |  +-------------------+  |
 |  +-------+--------+                          |
 |          |          +-------------------+     |
 |          +----------| Command Executor  |     |
 |          |          | (simple/complex,  |     |
 |          |          |  background exec) |     |
 |          |          +-------------------+     |
 |          |          +-------------------+     |
 |          +----------| File Transfer     |     |
 |                     | (SFTP upload/     |     |
 |                     |  download)        |     |
 |                     +-------------------+     |
 +------------------+---------------------------+
                    |  SSH Protocol (ssh2)
                    v
         +---------------------+
         |   Remote SSH Hosts  |
         | (Linux/macOS/etc.)  |
         +---------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| MCP Server Core | Protocol handling, tool/resource/prompt registration, transport management | `McpServer` from `@modelcontextprotocol/sdk` |
| Transport Layer | Wire protocol between client and server (stdio for Claude Desktop, HTTP for remote) | `StdioServerTransport`, `StreamableHTTPServerTransport` from SDK |
| Tool Handlers | Validate inputs, orchestrate service calls, format MCP responses | One file per tool, Zod schemas for input validation |
| Security Validator | Check commands against blacklist/whitelist patterns before execution | Stateless class with compiled RegExp patterns |
| Process Manager | Track background processes by UUID, manage lifecycle (running/completed/killed) | In-memory Map, no persistence needed |
| Connection Manager | SSH connection pooling, TTL-based cache invalidation, health checks | Wraps `ssh2` Client with cache layer |
| SSH Config Parser | Read and parse `~/.ssh/config` for host resolution | Custom parser (skip wildcards, support Key=Value and Key Value) |
| Command Executor | Execute commands on remote hosts (simple direct, complex via bash -c, background with nohup) | Promise wrappers around ssh2 callback API |
| File Transfer | SFTP upload/download with timeout protection | `ssh2` SFTP subsystem (no need for separate sftp-client package) |
| Config | Environment variable parsing, defaults, type coercion | Single module, Bun auto-loads .env |
| Logger | Structured logging to stderr (must not pollute stdio transport on stdout) | `console.error` or lightweight structured logger to stderr |

## Recommended Project Structure

```
src/
+-- index.ts               # Stdio entry point (Claude Desktop)
+-- index-http.ts           # HTTP entry point (remote MCP access)
+-- server.ts               # McpServer setup, registers all tools/resources/prompts
+-- tools/
|   +-- execute.ts          # execute_command tool handler
|   +-- output.ts           # get_command_output tool handler
|   +-- status.ts           # get_command_status tool handler
|   +-- kill.ts             # kill_command tool handler
|   +-- transfer.ts         # transfer_file tool handler
|   +-- security-info.ts    # get_security_info tool handler
+-- resources/
|   +-- hosts.ts            # ssh://hosts resource handler
+-- prompts/
|   +-- help.ts             # ssh_help prompt handler
+-- ssh/
|   +-- connection.ts       # Connection manager with pooling
|   +-- config-parser.ts    # ~/.ssh/config parser
|   +-- executor.ts         # Command execution (simple/complex/background)
|   +-- transfer.ts         # SFTP file transfer operations
+-- process/
|   +-- manager.ts          # Background process tracking (Map-based)
|   +-- types.ts            # BackgroundProcess interface
+-- security/
|   +-- validator.ts        # Command validation logic
|   +-- patterns.ts         # Default blacklist/whitelist patterns
+-- config/
|   +-- index.ts            # Environment config with defaults
+-- types/
|   +-- schemas.ts          # Zod schemas for tool inputs/outputs
+-- utils/
    +-- logger.ts           # Structured logging (to stderr)
    +-- errors.ts           # Custom error types
```

### Structure Rationale

- **tools/**: One file per MCP tool. Each tool handler is thin -- validates input (via Zod schema registered with McpServer), calls service-layer code, formats the MCP response. This avoids the Python version's monolithic server.py problem.
- **ssh/**: All SSH-specific logic isolated here. The rest of the app never touches `ssh2` directly. This makes testing straightforward (mock the SSH layer).
- **process/**: Separated from SSH because process tracking is an in-memory concern independent of SSH protocol details. The process manager tracks UUIDs and metadata; the SSH executor does the actual remote work.
- **security/**: Independent module that can be tested in complete isolation. No SSH or MCP dependencies -- just string pattern matching.
- **config/**: Single source of truth for all configuration. Bun auto-loads .env so no dotenv needed.
- **Two entry points**: `index.ts` for stdio (Claude Desktop), `index-http.ts` for HTTP. Both import the same `server.ts` which holds all tool/resource/prompt registrations.

## Architectural Patterns

### Pattern 1: Thin Tool Handlers with Service Layer

**What:** Tool handlers registered with McpServer do only three things: (1) receive validated input, (2) call service-layer functions, (3) format the MCP response envelope. All business logic lives in the service layer (ssh/, process/, security/).

**When to use:** Always. Every tool handler follows this pattern.

**Trade-offs:** Slightly more files, but each file is small, testable, and single-purpose. The Python version's 1020-line server.py is the anti-pattern this prevents.

**Example:**
```typescript
// tools/execute.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeBackground } from "../ssh/executor.ts";
import { validator } from "../security/validator.ts";
import { processManager } from "../process/manager.ts";

export function registerExecuteTool(server: McpServer) {
  server.tool(
    "execute_command",
    "Execute an SSH command in the background on a remote host",
    {
      host: z.string().min(1).max(253),
      command: z.string().min(1).max(2000),
    },
    async ({ host, command }) => {
      // 1. Security check
      const check = validator.validate(command);
      if (!check.allowed) {
        return {
          content: [{ type: "text", text: JSON.stringify({
            success: false,
            error_message: check.reason,
          })}],
          isError: true,
        };
      }

      // 2. Execute via service layer
      const result = await executeBackground(host, command);

      // 3. Format response
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );
}
```

### Pattern 2: Connection Pooling with TTL

**What:** SSH connections are expensive to establish (TCP + key exchange + authentication). Cache them per host with a configurable TTL (default 5 minutes). Health-check before reuse.

**When to use:** When `MCP_SSH_CONNECTION_REUSE=true`. Default is off for simplicity in initial development.

**Trade-offs:** Faster repeated commands to the same host. Risk of stale connections (mitigated by health checks). Memory usage for idle connections (mitigated by TTL expiry).

**Example:**
```typescript
// ssh/connection.ts
const cache = new Map<string, { client: Client; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function getConnection(host: string): Promise<Client> {
  const cached = cache.get(host);
  if (cached && Date.now() - cached.timestamp < TTL) {
    // Health check: try a no-op command
    try {
      await execOnClient(cached.client, "echo 1");
      return cached.client;
    } catch {
      cache.delete(host);
    }
  }

  const hostConfig = parseSSHConfig(host);
  const client = await connect(hostConfig);

  if (config.connectionReuse) {
    cache.set(host, { client, timestamp: Date.now() });
  }

  return client;
}
```

### Pattern 3: Background Execution via Remote Temp Files

**What:** Commands run in the background on the remote host. stdout/stderr are redirected to temp files. The exit code is written to a `.exit` file. The PID is captured and returned immediately.

**When to use:** All command execution goes through this pattern. Even "quick" commands use background execution but wait briefly (configurable, default 5s) before returning.

**Trade-offs:** More complexity than synchronous execution, but necessary for long-running commands. Creates temp files on the remote host that need cleanup. Enables output chunking for large outputs.

**Key insight:** The AI client (Claude) can poll for status and retrieve output in chunks. This matches how AI assistants work -- they can make multiple tool calls in sequence.

### Pattern 4: Centralized Error Responses

**What:** All tool handlers return a consistent response shape with `success: boolean` and `error_message: string`. Errors never throw from tool handlers -- they return structured error responses.

**When to use:** Every tool handler catches exceptions and converts them to structured responses.

**Trade-offs:** More verbose error handling code, but the AI client gets consistent, parseable error information instead of opaque MCP errors.

## Data Flow

### Command Execution Flow

```
AI Client (Claude)
    |
    | MCP tool_call: execute_command { host: "prod", command: "ls -la" }
    v
MCP Server Core
    |
    | Route to tool handler
    v
Tool Handler (tools/execute.ts)
    |
    | 1. Security validation
    v
Security Validator
    |
    | allowed: true/false
    v
Tool Handler
    |
    | 2. Get SSH connection
    v
Connection Manager (ssh/connection.ts)
    |
    | Resolve host from ~/.ssh/config, connect or reuse cached
    v
Command Executor (ssh/executor.ts)
    |
    | 3. Create background process entry
    v
Process Manager (process/manager.ts)
    |
    | Generate UUID, store metadata
    v
Command Executor
    |
    | 4. Execute on remote:
    |    bash -c 'command > /tmp/mcp_ssh_UUID.out 2> /tmp/mcp_ssh_UUID.err; echo $? > /tmp/mcp_ssh_UUID.out.exit' &
    |    echo $!
    v
Remote SSH Host
    |
    | Returns PID immediately
    v
Command Executor
    |
    | 5. Wait briefly (quick_wait_time) for fast commands
    | 6. Check if process completed, read partial output
    v
Tool Handler
    |
    | 7. Format MCP response
    v
MCP Server Core
    |
    | MCP tool_result: { success: true, process_id: "UUID", status: "running", ... }
    v
AI Client
```

### Output Retrieval Flow

```
AI Client
    |
    | MCP tool_call: get_command_output { process_id: "UUID", start_byte: 0 }
    v
Tool Handler (tools/output.ts)
    |
    | 1. Look up process in Process Manager
    v
Process Manager
    |
    | Returns: host, output_file path, current status
    v
Tool Handler
    |
    | 2. SSH to host, read chunk
    v
Connection Manager --> Remote Host
    |
    | tail -c +1 /tmp/mcp_ssh_UUID.out | head -c 10000
    v
Tool Handler
    |
    | 3. Check for more data, format response
    v
AI Client
    |
    | { stdout: "...", has_more_output: true, chunk_start: 0, output_size: 50000 }
```

### Key Data Flows

1. **Security validation:** Happens synchronously before any SSH connection is attempted. Command string is checked against compiled RegExp patterns. Fast and stateless.

2. **SSH config resolution:** Host name from tool input is resolved against parsed `~/.ssh/config`. The config is parsed once and cached (it rarely changes during a server session). Returns hostname, port, user, identity file.

3. **Process lifecycle:** `created` (UUID assigned) -> `running` (PID captured from remote) -> `completed` (exit code file exists) or `killed` (SIGTERM/SIGKILL sent). Tracked in an in-memory Map. Lost on server restart (acceptable -- this is ephemeral by design).

4. **Logging to stderr:** Critical for stdio transport. All log output MUST go to stderr, never stdout. Stdout is the MCP protocol channel. Using `console.error` or a logger configured to write to stderr.

## Build Order (Suggested Phase Dependencies)

The components have clear dependency ordering. Build bottom-up:

```
Phase 1: Foundation (no dependencies)
  +-- config/index.ts        (env parsing)
  +-- utils/logger.ts        (structured logging to stderr)
  +-- utils/errors.ts        (custom error types)
  +-- types/schemas.ts       (Zod schemas)
  +-- security/patterns.ts   (default blacklist)
  +-- security/validator.ts  (command validation)
  +-- process/types.ts       (interfaces)
  +-- process/manager.ts     (in-memory tracking)

Phase 2: SSH Layer (depends on config, logger)
  +-- ssh/config-parser.ts   (parse ~/.ssh/config)
  +-- ssh/connection.ts      (connect, pool, health-check)
  +-- ssh/executor.ts        (simple, complex, background exec)
  +-- ssh/transfer.ts        (SFTP upload/download)

Phase 3: MCP Integration (depends on everything above)
  +-- tools/*.ts             (all 6 tool handlers)
  +-- resources/hosts.ts     (ssh://hosts resource)
  +-- prompts/help.ts        (ssh_help prompt)
  +-- server.ts              (register everything with McpServer)

Phase 4: Entry Points & Transport (depends on server.ts)
  +-- index.ts               (stdio transport)
  +-- index-http.ts          (HTTP transport)
```

**Why this order:**
- Phase 1 components are independently testable with zero external dependencies. Security validation and process tracking are pure logic.
- Phase 2 requires config and logger but can be tested with mock SSH connections.
- Phase 3 wires everything together through MCP SDK registration. Each tool handler can be written and tested independently once its service-layer dependencies exist.
- Phase 4 is thin glue code connecting the server to a transport.

## Scaling Considerations

This is a single-user, single-instance MCP server. Traditional web-scale concerns do not apply.

| Concern | Relevant Scale | Architecture Adjustment |
|---------|---------------|------------------------|
| Concurrent SSH connections | 5-20 hosts | Connection pool with configurable max size |
| Background processes | 10-50 active | In-memory Map is fine; add periodic cleanup of completed entries |
| Output size | 1-100MB per command | Chunked reading (tail/head on remote); never load full output into memory |
| SSH config size | 10-500 hosts | Parse once, cache; re-parse on SIGHUP if needed |

### Scaling Priorities

1. **First bottleneck: SSH connection establishment.** Each connection requires TCP handshake + key exchange. Connection pooling with TTL solves this. Health-check before reuse prevents stale connections.
2. **Second bottleneck: Large command output.** A command producing gigabytes of output could exhaust memory if loaded fully. The chunked reading pattern (tail -c / head -c on the remote side) prevents this entirely -- only the requested chunk is transferred.

## Anti-Patterns

### Anti-Pattern 1: Monolithic Server File

**What people do:** Put all tool handlers, SSH logic, security validation, and process management in a single `server.ts` (like the Python version's 1020-line `server.py`).
**Why it's wrong:** Untestable in isolation, hard to reason about, merge conflicts when multiple people work on it, difficult to add new tools.
**Do this instead:** One file per tool handler, separate service modules for SSH/security/process management.

### Anti-Pattern 2: Logging to stdout

**What people do:** Use `console.log()` for debug output.
**Why it's wrong:** In stdio transport mode, stdout IS the MCP protocol channel. Any non-MCP data on stdout corrupts the protocol and crashes the client connection.
**Do this instead:** All logging goes to stderr via `console.error()` or a logger configured with `stderr` as its output stream. This is the single most common bug in MCP server development.

### Anti-Pattern 3: Synchronous Command Execution

**What people do:** Execute SSH commands synchronously and block until completion before returning.
**Why it's wrong:** Long-running commands (builds, deployments, data processing) will time out the MCP request. The AI client has no way to check progress.
**Do this instead:** Always use background execution with process tracking. Return a process_id immediately. Let the client poll for status and output.

### Anti-Pattern 4: Holding Full Output in Memory

**What people do:** Read the entire stdout/stderr of a command into a string variable before returning it.
**Why it's wrong:** A `find / -type f` or `cat large_file.log` can produce hundreds of megabytes. Server memory exhaustion.
**Do this instead:** Output stays in temp files on the remote host. Read chunks on demand using `tail -c +N | head -c M` over SSH.

### Anti-Pattern 5: Shared Mutable State Between Tool Calls

**What people do:** Store SSH clients, process state, or config in module-level mutable variables without proper lifecycle management.
**Why it's wrong:** Leads to stale state, connection leaks, and hard-to-reproduce bugs.
**Do this instead:** Use a proper connection manager class with explicit lifecycle (get, release, cleanup). Use the Process Manager as the single source of truth for process state.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Remote SSH Hosts | `ssh2` library over TCP | Supports password, key-based, and agent auth. Key-based is primary for this server. |
| `~/.ssh/config` | File read + custom parser | Standard OpenSSH config format. Must handle Host, HostName, User, Port, IdentityFile directives. |
| Claude Desktop | stdio transport (stdin/stdout) | MCP protocol over JSON-RPC. Claude Desktop spawns the server process. |
| Remote MCP Clients | HTTP transport | StreamableHTTPServerTransport from SDK. Bun.serve() for HTTP handling (not Express -- per project conventions). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Tool Handlers <-> Security | Direct function call | Synchronous validation before any SSH work |
| Tool Handlers <-> Process Manager | Direct function call | Create/lookup/update process entries |
| Tool Handlers <-> SSH Layer | Async function call | Connection manager returns connected client; executor runs commands |
| SSH Layer <-> Remote Hosts | SSH protocol (ssh2) | All remote operations go through connection manager |
| Entry Points <-> Server | McpServer.connect(transport) | Transport is injected; server is transport-agnostic |

### Important: HTTP Transport Without Express

The PRD suggests Express for HTTP transport, but per project conventions (CLAUDE.md), use `Bun.serve()` instead. The MCP SDK's `StreamableHTTPServerTransport` needs a request/response interface. Bun.serve() can provide this by wrapping its Request/Response into the format the transport expects, or by using a compatibility adapter. This is a known integration point that needs verification during implementation.

---

## v2.0 Update: SSH Agent Forwarding Architecture

### Overview

SSH agent forwarding enables remote commands to authenticate with other SSH servers using the user's local SSH keys. This is essential for scenarios like:
- `git clone` from private repositories on a remote host
- SSH hopping (connecting to Server B from Server A)
- CI/CD operations that require SSH authentication

**Key Security Property:** Private keys never leave the local machine. The ssh-agent performs signing operations locally and forwards only the signatures.

### Current Data Flow (v1.0)

```
execute_command MCP call
         |
         v
+------------------+
| Zod validation   | (ExecuteCommandSchema: host, command, timeout)
+------------------+
         |
         v
+------------------+
| Security check   | (validateCommandWithResult)
+------------------+
         |
         v
+------------------+
| Host resolution  | (resolveHost from ssh/config-parser)
+------------------+
         |
         v
+------------------+
| SSH connection   | (connect from ssh/client)
|  - privateKey    |
|  - passphrase    |
+------------------+
         |
         v
+------------------+
| Process tracking | (ProcessManager.startProcess)
+------------------+
         |
         v
+------------------+
| Command exec     | (client.exec with wrapped command)
+------------------+
```

### Updated Data Flow with Agent Forwarding (v2.0)

```
execute_command MCP call { host, command, forwardAgent: true }
         |
         v
+------------------+
| Zod validation   | (ExecuteCommandSchema: host, command, timeout, forwardAgent)
+------------------+
         |
         v
+------------------+
| Security check   | (validateCommandWithResult)
+------------------+
         |
         v
+------------------+
| Host resolution  | (resolveHost from ssh/config-parser)
+------------------+
         |
         v
+------------------+
| SSH connection   | (connect from ssh/client)
|  - privateKey    |
|  - passphrase    |
|  - agent: SSH_AUTH_SOCK      <-- NEW
|  - agentForward: true        <-- NEW
+------------------+
         |
         v
+------------------+
| Process tracking | (ProcessManager.startProcess)
+------------------+
         |
         v
+------------------+
| Command exec     | (client.exec)
|  - Remote command can now use SSH_AUTH_SOCK
|  - git clone, ssh, scp work with local keys
+------------------+
```

### Component Modification Summary

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `schemas/execute-command.ts` | MODIFY | Add `forwardAgent: z.boolean().optional().default(false)` |
| `ssh/client.ts` | MODIFY | Add agent configuration to `ConnectOptions` and `connect()` |
| `ssh/executor.ts` | MODIFY | Pass `forwardAgent` through execution pipeline |
| `tools/execute.ts` | MODIFY | Pass `forwardAgent` from MCP params to executor |
| `errors.ts` | MODIFY | Add `AGENT_NOT_AVAILABLE` error code |

### Detailed Changes

#### 1. `schemas/execute-command.ts` (MODIFY)

```typescript
import { z } from "zod";

export const ExecuteCommandSchema = z.object({
  host: z.string().min(1, "Host is required").max(253, "Host name too long"),
  command: z.string().min(1, "Command is required").max(10000, "Command too long"),
  timeout: z.number().int().positive().optional(),
  forwardAgent: z.boolean().optional().default(false),  // NEW
});

export type ExecuteCommandInput = z.infer<typeof ExecuteCommandSchema>;
```

**Rationale:** Opt-in by default. Users must explicitly enable agent forwarding per command.

#### 2. `ssh/client.ts` (MODIFY)

```typescript
// Extend ConnectOptions interface
export interface ConnectOptions extends HostConfig {
  passphrase?: string;
  timeout?: number;
  forwardAgent?: boolean;  // NEW
}

// In connect() function
export async function connect(
  options: ConnectOptions
): Promise<Result<SSHConnection>> {
  return new Promise((resolve) => {
    const client = new Client();
    const { passphrase, timeout = 30000, forwardAgent = false, ...hostConfig } = options;

    // ... existing error handlers ...

    const connectConfig: {
      host: string;
      port: number;
      username: string;
      readyTimeout: number;
      privateKey?: Buffer;
      passphrase?: string;
      agent?: string;           // NEW
      agentForward?: boolean;   // NEW
    } = {
      host: hostConfig.hostname || hostConfig.host,
      port: hostConfig.port,
      username: hostConfig.user,
      readyTimeout: timeout,
    };

    // ... existing key loading ...

    // NEW: Agent forwarding configuration
    if (forwardAgent) {
      if (!process.env.SSH_AUTH_SOCK) {
        return errorResult(
          ErrorCode.AGENT_NOT_AVAILABLE,
          "SSH agent forwarding requested but SSH_AUTH_SOCK is not set. "
          + "Ensure ssh-agent is running."
        );
      }
      connectConfig.agent = process.env.SSH_AUTH_SOCK;
      connectConfig.agentForward = true;
    }

    client.connect(connectConfig);
  });
}
```

**Rationale:**
- Uses `SSH_AUTH_SOCK` environment variable (standard OpenSSH agent socket)
- Sets `agentForward: true` in connection config to enable forwarding for the connection lifetime
- Validates agent availability before attempting connection

#### 3. `ssh/executor.ts` (MODIFY)

```typescript
export interface ExecutorOptions {
  forwardAgent?: boolean;  // NEW
}

export async function executeSSHCommand(
  hostAlias: string,
  command: string,
  config: AppConfig,
  processManager: ProcessManager,
  options?: ExecutorOptions  // NEW optional parameter
): Promise<Result<ExecuteResult>> {
  // ... existing security validation ...

  // Pass forwardAgent to connect
  const connectionResult = await connect({
    ...hostConfig,
    passphrase: getPassphrase(hostAlias),
    timeout: config.sshConnectTimeout,
    forwardAgent: options?.forwardAgent ?? false,  // NEW
  });

  // ... rest of execution ...
}
```

#### 4. `tools/execute.ts` (MODIFY)

```typescript
async (params) => {
  try {
    deps.logger.info("Executing command", {
      host: params.host,
      command: params.command.substring(0, 100),
      forwardAgent: params.forwardAgent,  // NEW
    });

    const result = await executeSSHCommand(
      params.host,
      params.command,
      deps.config,
      deps.processManager,
      { forwardAgent: params.forwardAgent ?? false }  // NEW
    );

    return resultToMcpResponse(result);
  } catch (error) {
    // ... existing error handling ...
  }
}
```

#### 5. `errors.ts` (MODIFY)

```typescript
export enum ErrorCode {
  // ... existing codes ...

  // Agent-related errors
  AGENT_NOT_AVAILABLE = "AGENT_NOT_AVAILABLE",
}
```

### Architectural Pattern: Environment Variable Resolution

**What:** Resolve agent socket from environment at connection time.
**When:** Agent forwarding is requested via `forwardAgent: true`.
**Trade-offs:** Runtime resolution provides flexibility but requires environment setup.

```typescript
// Pattern: Environment variable resolution with validation
if (forwardAgent) {
  if (!process.env.SSH_AUTH_SOCK) {
    return errorResult(
      ErrorCode.AGENT_NOT_AVAILABLE,
      "SSH agent forwarding requested but SSH_AUTH_SOCK is not set."
    );
  }
  connectConfig.agent = process.env.SSH_AUTH_SOCK;
  connectConfig.agentForward = true;
}
```

### Anti-Patterns for Agent Forwarding

#### Anti-Pattern 1: Hardcoded Agent Socket Path

**What people do:** Hardcode `/var/run/ssh-agent.socket` or similar paths.
**Why it's wrong:** Agent socket paths vary by system and session.
**Do this instead:** Use `process.env.SSH_AUTH_SOCK` which is set by the SSH agent.

#### Anti-Pattern 2: Always-On Agent Forwarding

**What people do:** Enable agent forwarding by default for all connections.
**Why it's wrong:** Security risk - remote host can use your keys for duration of connection.
**Do this instead:** Require explicit opt-in via `forwardAgent: true` parameter.

#### Anti-Pattern 3: Ignoring Agent Availability

**What people do:** Set `agentForward: true` without checking if agent is available.
**Why it's wrong:** Connection fails silently or with confusing errors.
**Do this instead:** Check `process.env.SSH_AUTH_SOCK` exists and provide clear error if not.

### Security Model

1. **Keys Never Leave Local Machine:** The SSH agent holds private keys locally. Only signing operations are forwarded.

2. **Trusted Host Requirement:** Users should only enable agent forwarding to hosts they trust. The remote host can perform signing operations with the user's keys while the connection is active.

3. **Connection-Scoped:** Agent forwarding is enabled for the lifetime of the SSH connection. When the connection closes, the remote host can no longer use the keys.

4. **Opt-In Only:** The `forwardAgent` parameter defaults to `false`. Users must explicitly enable it per command.

### Build Order for Agent Forwarding Feature

Based on dependencies:

1. **errors.ts** - Add `AGENT_NOT_AVAILABLE` error code (no dependencies)
2. **schemas/execute-command.ts** - Add `forwardAgent` parameter (no dependencies)
3. **ssh/client.ts** - Add agent configuration to `connect()` (depends on errors.ts)
4. **ssh/executor.ts** - Pass `forwardAgent` through (depends on client.ts changes)
5. **tools/execute.ts** - Pass `forwardAgent` from params (depends on all above)

### Integration Points

| Dependency | Integration | Notes |
|------------|-------------|-------|
| ssh2 | `agent` and `agentForward` config options | Already in use, no new dependencies |
| OpenSSH Agent | `SSH_AUTH_SOCK` environment variable | Standard agent, user must have it running |

| Boundary | Communication | Notes |
|----------|---------------|-------|
| tools/execute.ts -> ssh/executor.ts | ExecutorOptions object | New optional parameter |
| ssh/executor.ts -> ssh/client.ts | ConnectOptions object | Extended with forwardAgent |
| ssh/client.ts -> ssh2 Client | Connection config | Uses agent + agentForward options |

## Sources

- Project PRD.md (detailed reference specification from Python version analysis)
- PROJECT.md (constraints and decisions)
- CLAUDE.md (Bun runtime conventions)
- MCP TypeScript SDK repository: https://github.com/modelcontextprotocol/typescript-sdk
- MCP Protocol specification (JSON-RPC over stdio/HTTP)
- ssh2 npm package (mature SSH2 client for Node.js/Bun): https://www.npmjs.com/package/ssh2
- ssh2 GitHub repository: https://github.com/mscdex/ssh2

**Confidence notes:**
- HIGH confidence on overall architecture -- this follows standard MCP server patterns with well-understood SSH primitives.
- HIGH confidence on component boundaries -- the Python reference implementation validates the separation of concerns.
- HIGH confidence on agent forwarding integration -- ssh2 library has mature, well-documented support for `agent` and `agentForward` options.
- MEDIUM confidence on MCP SDK v2 API specifics -- the PRD documents v2 patterns but the SDK is pre-alpha and may have changed. Verify `McpServer.tool()`, `McpServer.resource()`, `McpServer.prompt()` signatures against installed SDK version during implementation.
- MEDIUM confidence on Bun + StreamableHTTPServerTransport compatibility -- needs verification that Bun.serve() can integrate with the SDK's HTTP transport without Express.

---
*Architecture research for: MCP SSH Server (ssh-exoman)*
*Researched: 2026-03-07 (v1.0), updated 2026-03-13 (v2.0 agent forwarding)*
