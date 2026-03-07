# Phase 2: SSH Execution Layer - Research

**Researched:** 2026-03-07
**Domain:** SSH2 client, ssh-config parsing, background process management
**Confidence:** HIGH

## Summary

This phase implements SSH command execution with background process tracking, output retrieval, status checking, and process termination. The implementation uses the `ssh2` library for SSH connections, `ssh-config` for config parsing, and an in-memory process manager with temp file persistence for output.

**Primary recommendation:** Use `ssh2` v1.17+ for connections, `ssh-config` v5.1+ for config parsing, wrap all commands in `/bin/sh -c` for predictable output behavior, and implement hybrid streaming + temp file persistence for output handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SSH Config Parsing:**
- Expand wildcard host patterns (e.g., `Host *.example.com`) into matched host aliases
- Parse standard SSH config fields: Host, HostName, User, Port, IdentityFile
- Return partial config with defaults for missing required fields (User=$USER, Port=22)
- Skip any `Match` entries with wildcards, only return exact matches

**Command Execution Mode:**
- Always wrap commands in shell (`/bin/sh -c "{command}"`)
- Direct `exec` for simple commands, shell wrapper for complex commands
- Shell wrapper ensures consistent behavior with pipes, semicolons, globbing, redirection

**Output Buffering Strategy:**
- Hybrid approach: stream output during command execution AND persist to temp file after completion
- Default chunk size: 4KB for pagination
- Stream during execution enables real-time monitoring
- Temp files enable retrieval after process completes
- Handles large outputs (multi-GB) by reading in chunks

**Process Kill Escalation:**
- Send SIGTERM, wait 5 seconds
- If still running, send SIGKILL
- Standard escalation pattern (2s + 5s)

### Claude's Discretion

- Implementation details for process tracking data structures
- Exact regex patterns for simple vs complex command detection
- Temp file naming conventions and cleanup strategies

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SSH-01 | Server parses ~/.ssh/config for host resolution (Host, HostName, User, Port, IdentityFile) | `ssh-config` library with `.compute()` method for wildcard expansion |
| SSH-02 | Server manages SSH connections with configurable connect timeout | `ssh2` library `Client.connect()` with `readyTimeout` config option |
| SSH-03 | Server detects simple vs complex commands and routes execution accordingly | Regex-based detection, shell wrapper `/bin/sh -c` for complex commands |
| EXEC-01 | User can execute SSH commands in background with UUID-based process tracking | `ssh2` Client.exec() with streaming output, in-process `Map<UUID, ProcessInfo>` |
| EXEC-02 | User can retrieve command output with chunked byte-offset reading | ProcessManager.getOutput() with Bun.file() for async chunked reading |
| EXEC-03 | User can check command status without fetching full output | ProcessManager.getStatus() returning cached status info |
| EXEC-04 | User can kill running processes with SIGTERM -> SIGKILL escalation | ssh2 Channel.signal() with configurable delay (5s default) |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ssh2 | ^1.17.0 | SSH connections and command execution | Only mature pure-JS SSH2 client. Works with Bun. 5.8k stars, actively maintained. |
| ssh-config | ^5.1.0 | Parse ~/.ssh/config files | Handles wildcards, `.compute()` for merged config, TypeScript types included |
| @types/ssh2 | ^1.15.5 | TypeScript types for ssh2 | Essential for type safety |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 (existing) | Input validation | Already used for MCP tool schemas |
| uuid | ^11.0 (or Bun built-in) | UUID generation | `crypto.randomUUID()` built into Bun |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ssh-config | Custom parser | Hand-rolled parsers are error-prone, miss edge cases like wildcard expansion |
| ssh2 | node-ssh | node-ssh wraps ssh2, adds unnecessary abstraction layer |
| temp files | Memory-only | Memory-only fails for multi-GB outputs, server restarts |

**Installation:**
```bash
bun add ssh2 ssh-config
bun add -d @types/ssh2
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── ssh/
│   ├── config-parser.ts     # SSH config file parsing
│   ├── client.ts            # SSH client wrapper
│   └── process-manager.ts   # Background process tracking
├── schemas/
│   └── index.ts             # Zod schemas (existing, extend for SSH)
├── types.ts                 # Shared types (existing, extend)
├── config.ts                # App config (existing)
├── errors.ts                # Error codes (existing)
├── security-validator.ts    # Security (existing)
└── structured-logger.ts     # Logging (existing)
```

### Pattern 1: SSH Config Parsing

**What:** Parse ~/.ssh/config using `ssh-config` library with `.compute()` for host resolution

**When to use:** When resolving host alias to connection parameters

**Example:**
```typescript
import SSHConfig from 'ssh-config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface HostConfig {
  host: string;        // Alias name
  hostname?: string;   // Actual hostname/IP
  user: string;        // Username (default: $USER)
  port: number;        // Port (default: 22)
  identityFile?: string; // Path to private key
}

export function parseSSHConfig(): SSHConfig {
  const configPath = path.join(os.homedir(), '.ssh', 'config');
  if (!fs.existsSync(configPath)) {
    return new SSHConfig();
  }
  const content = fs.readFileSync(configPath, 'utf8');
  return SSHConfig.parse(content);
}

export function resolveHost(alias: string, config: SSHConfig): HostConfig | null {
  // .compute() merges wildcard patterns (Host *) with specific host config
  const computed = config.compute(alias);
  if (!computed) return null;

  return {
    host: alias,
    hostname: computed.HostName || alias,
    user: computed.User || process.env.USER || 'root',
    port: parseInt(computed.Port, 10) || 22,
    identityFile: computed.IdentityFile?.[0], // Array of identity files
  };
}

export function listHosts(config: SSHConfig): string[] {
  const hosts: string[] = [];
  for (const section of config) {
    if (section.param === 'Host' && typeof section.value === 'string') {
      // Skip wildcard patterns like * or *.example.com
      if (!section.value.includes('*')) {
        hosts.push(section.value);
      }
    }
  }
  return hosts;
}
```

### Pattern 2: SSH Client Connection

**What:** Create and manage SSH connections with configurable timeout

**When to use:** Before executing any command

**Example:**
```typescript
import { Client } from 'ssh2';
import * as fs from 'fs';
import type { HostConfig } from './config-parser';
import { ErrorCode, errorResult } from '../errors';
import type { Result } from '../types';

export interface SSHConnection {
  client: Client;
  hostConfig: HostConfig;
}

export async function connect(
  hostConfig: HostConfig,
  timeoutMs: number
): Promise<Result<SSHConnection>> {
  return new Promise((resolve) => {
    const client = new Client();

    client.on('ready', () => {
      resolve({
        success: true,
        data: { client, hostConfig }
      });
    });

    client.on('error', (err) => {
      resolve(errorResult(
        ErrorCode.SSH_CONNECTION_FAILED,
        `SSH connection failed: ${err.message}`
      ));
    });

    const connectConfig: any = {
      host: hostConfig.hostname || hostConfig.host,
      port: hostConfig.port,
      username: hostConfig.user,
      readyTimeout: timeoutMs,
    };

    // Load private key if specified
    if (hostConfig.identityFile) {
      const keyPath = hostConfig.identityFile.replace('~', os.homedir());
      if (fs.existsSync(keyPath)) {
        connectConfig.privateKey = fs.readFileSync(keyPath);
      }
    }

    client.connect(connectConfig);
  });
}
```

### Pattern 3: Command Detection and Execution

**What:** Detect simple vs complex commands, wrap in shell for complex ones

**When to use:** Before executing any command

**Simple command detection logic:**
```typescript
// Characters that indicate shell complexity
const SHELL_META_CHARS = /[|;&<>\$`\\"'*?[\]{}()]/;

export function isComplexCommand(command: string): boolean {
  // Commands with pipes, redirects, semicolons, globs, variables
  if (SHELL_META_CHARS.test(command)) return true;

  // Multiple commands separated by && or ||
  if (/\s(&&|\|\|)\s/.test(command)) return true;

  // Subshells or command substitution
  if (command.includes('$(') || command.includes('`')) return true;

  return false;
}

export function wrapCommand(command: string): string {
  // Always wrap in shell for predictable behavior
  // Escape double quotes in the command
  const escaped = command.replace(/"/g, '\\"');
  return `/bin/sh -c "${escaped}"`;
}
```

**Execution pattern:**
```typescript
interface ExecResult {
  processId: string;
  exitCode: number | null;
  signal: string | null;
  stdout: Buffer;
  stderr: Buffer;
}

export async function executeCommand(
  connection: SSHConnection,
  command: string,
  processId: string,
  onOutput: (data: Buffer, isStderr: boolean) => void
): Promise<ExecResult> {
  const wrappedCommand = wrapCommand(command);

  return new Promise((resolve, reject) => {
    connection.client.exec(wrappedCommand, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let exitCode: number | null = null;
      let signal: string | null = null;

      stream.on('data', (data: Buffer) => {
        stdoutChunks.push(data);
        onOutput(data, false);
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderrChunks.push(data);
        onOutput(data, true);
      });

      stream.on('exit', (code: number | null, sig: string | null) => {
        exitCode = code;
        signal = sig;
      });

      stream.on('close', () => {
        resolve({
          processId,
          exitCode,
          signal,
          stdout: Buffer.concat(stdoutChunks),
          stderr: Buffer.concat(stderrChunks),
        });
      });
    });
  });
}
```

### Pattern 4: Process Manager

**What:** Track background processes with UUID, status, and output

**When to use:** For all background command execution

**Example:**
```typescript
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ProcessStatus, Result } from '../types';
import { ErrorCode, errorResult } from '../errors';

export interface ProcessInfo {
  processId: string;
  host: string;
  command: string;
  status: ProcessStatus;
  exitCode: number | null;
  signal: string | null;
  startTime: Date;
  endTime: Date | null;
  outputSize: number;
  errorSize: number;
  tempOutputPath: string;
  tempErrorPath: string;
  channel: any; // ssh2 Channel
  connection: any; // ssh2 Client
}

const TEMP_DIR = os.tmpdir();
const TEMP_PREFIX = 'ssh-exoman';

export class ProcessManager {
  private processes = new Map<string, ProcessInfo>();

  startProcess(
    host: string,
    command: string,
    channel: any,
    connection: any
  ): string {
    const processId = randomUUID();
    const tempOutputPath = path.join(TEMP_DIR, `${TEMP_PREFIX}-${processId}.out`);
    const tempErrorPath = path.join(TEMP_DIR, `${TEMP_PREFIX}-${processId}.err`);

    this.processes.set(processId, {
      processId,
      host,
      command,
      status: 'running',
      exitCode: null,
      signal: null,
      startTime: new Date(),
      endTime: null,
      outputSize: 0,
      errorSize: 0,
      tempOutputPath,
      tempErrorPath,
      channel,
      connection,
    });

    return processId;
  }

  appendOutput(processId: string, data: Buffer, isStderr: boolean): void {
    const process = this.processes.get(processId);
    if (!process) return;

    const filePath = isStderr ? process.tempErrorPath : process.tempOutputPath;
    fs.appendFileSync(filePath, data);

    if (isStderr) {
      process.errorSize += data.length;
    } else {
      process.outputSize += data.length;
    }
  }

  completeProcess(
    processId: string,
    exitCode: number | null,
    signal: string | null
  ): void {
    const process = this.processes.get(processId);
    if (!process) return;

    process.status = exitCode === 0 ? 'completed' : 'failed';
    process.exitCode = exitCode;
    process.signal = signal;
    process.endTime = new Date();

    // Close connection
    if (process.connection) {
      process.connection.end();
    }
  }

  getProcess(processId: string): ProcessInfo | undefined {
    return this.processes.get(processId);
  }

  getStatus(processId: string): Result<{
    status: ProcessStatus;
    exitCode: number | null;
    signal: string | null;
    outputSize: number;
    errorSize: number;
    startTime: Date;
    endTime: Date | null;
  }> {
    const process = this.processes.get(processId);
    if (!process) {
      return errorResult(ErrorCode.PROCESS_NOT_FOUND, `Process ${processId} not found`);
    }

    return {
      success: true,
      data: {
        status: process.status,
        exitCode: process.exitCode,
        signal: process.signal,
        outputSize: process.outputSize,
        errorSize: process.errorSize,
        startTime: process.startTime,
        endTime: process.endTime,
      }
    };
  }

  async getOutput(
    processId: string,
    byteOffset: number,
    maxBytes: number
  ): Promise<Result<{ data: string; totalSize: number; hasMore: boolean }>> {
    const process = this.processes.get(processId);
    if (!process) {
      return errorResult(ErrorCode.PROCESS_NOT_FOUND, `Process ${processId} not found`);
    }

    if (!fs.existsSync(process.tempOutputPath)) {
      return {
        success: true,
        data: { data: '', totalSize: 0, hasMore: false }
      };
    }

    const stat = fs.statSync(process.tempOutputPath);
    const totalSize = stat.size;

    if (byteOffset >= totalSize) {
      return {
        success: true,
        data: { data: '', totalSize, hasMore: false }
      };
    }

    const endOffset = Math.min(byteOffset + maxBytes, totalSize);
    const file = Bun.file(process.tempOutputPath);
    const buffer = await file.slice(byteOffset, endOffset).arrayBuffer();
    const data = Buffer.from(buffer).toString('utf8');

    return {
      success: true,
      data: {
        data,
        totalSize,
        hasMore: endOffset < totalSize
      }
    };
  }

  async killProcess(processId: string, force: boolean = false): Promise<Result<{ status: ProcessStatus }>> {
    const process = this.processes.get(processId);
    if (!process) {
      return errorResult(ErrorCode.PROCESS_NOT_FOUND, `Process ${processId} not found`);
    }

    if (process.status !== 'running') {
      return { success: true, data: { status: process.status } };
    }

    try {
      if (force) {
        // Immediate SIGKILL
        process.channel.signal('KILL');
      } else {
        // Graceful SIGTERM, then SIGKILL after 5s
        process.channel.signal('TERM');

        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (process.status === 'running') {
              process.channel.signal('KILL');
            }
            resolve();
          }, 5000);

          // Resolve early if process exits
          const checkInterval = setInterval(() => {
            if (process.status !== 'running') {
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      process.status = 'killed';
      process.endTime = new Date();

      return { success: true, data: { status: 'killed' } };
    } catch (err) {
      return errorResult(ErrorCode.INTERNAL_ERROR, `Failed to kill process: ${err}`);
    }
  }

  cleanupProcess(processId: string): void {
    const process = this.processes.get(processId);
    if (!process) return;

    // Delete temp files
    try {
      if (fs.existsSync(process.tempOutputPath)) {
        fs.unlinkSync(process.tempOutputPath);
      }
      if (fs.existsSync(process.tempErrorPath)) {
        fs.unlinkSync(process.tempErrorPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Remove from tracking
    this.processes.delete(processId);
  }
}
```

### Anti-Patterns to Avoid

- **Interactive PTY allocation:** MCP is request/response, not interactive. Use non-interactive `exec()` instead.
- **Memory-only output storage:** Multi-GB outputs cause OOM. Always use temp files.
- **Custom SSH config parser:** Edge cases abound. Use `ssh-config` library.
- **Synchronous file operations on hot path:** Use `Bun.file()` for async reads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH config parsing | Custom regex parser | `ssh-config` library | Wildcards, Match blocks, includes are complex |
| SSH protocol | Raw socket implementation | `ssh2` library | Encryption, key exchange, channel multiplexing |
| Process ID generation | Incremental counter | `crypto.randomUUID()` | Collision safety, uniqueness guarantee |
| Temp file management | Custom naming scheme | `os.tmpdir()` + UUID | OS-appropriate location, unique names |

## Common Pitfalls

### Pitfall 1: Connection Leak

**What goes wrong:** SSH connections not closed after command completion, exhausting file descriptors.

**Why it happens:** Missing `client.end()` in error paths or forgetting to close on stream close.

**How to avoid:** Always call `client.end()` in stream `close` handler, use try/finally pattern.

**Warning signs:** "Too many open files" errors, slow command execution.

### Pitfall 2: Output Buffer Overflow

**What goes wrong:** Accumulating all output in memory causes OOM for multi-GB outputs.

**Why it happens:** Naive approach of collecting all chunks before returning.

**How to avoid:** Stream to temp file during execution, read chunks on demand.

**Warning signs:** Memory usage grows linearly with output size.

### Pitfall 3: Zombie Processes

**What goes wrong:** Kill signal sent but process tracking not updated.

**Why it happens:** Signal sent without waiting for confirmation.

**How to avoid:** Update status immediately after signal, verify with status check.

**Warning signs:** Processes show "running" but are actually terminated.

### Pitfall 4: Wildcard Host Expansion

**What goes wrong:** Returning wildcard patterns as valid hosts.

**Why it happens:** Not filtering `Host *.example.com` entries.

**How to avoid:** Filter hosts containing `*` from list, use `.compute()` for resolution.

**Warning signs:** User tries to connect to `*.example.com` literally.

## Code Examples

### Complete Execute Flow

```typescript
// src/ssh/executor.ts
import { ProcessManager, connect, resolveHost, parseSSHConfig, executeCommand } from './index';
import { validateCommandWithResult } from '../security-validator';
import type { Result, AppConfig } from '../types';

export async function executeSSHCommand(
  hostAlias: string,
  command: string,
  config: AppConfig,
  processManager: ProcessManager
): Promise<Result<{ processId: string }>> {
  // 1. Security validation
  const securityCheck = validateCommandWithResult(command, {
    mode: config.securityMode,
    patterns: [] // loaded from security-patterns.json
  });
  if (!securityCheck.success) return securityCheck as any;

  // 2. Resolve host config
  const sshConfig = parseSSHConfig();
  const hostConfig = resolveHost(hostAlias, sshConfig);
  if (!hostConfig) {
    return errorResult(ErrorCode.CONFIG_ERROR, `Host "${hostAlias}" not found in SSH config`);
  }

  // 3. Connect
  const connectionResult = await connect(hostConfig, config.sshConnectTimeout);
  if (!connectionResult.success) return connectionResult as any;

  const connection = connectionResult.data;

  // 4. Start process tracking
  const processId = processManager.startProcess(
    hostAlias,
    command,
    null, // channel set after exec
    connection.client
  );

  // 5. Execute command
  connection.client.exec(wrapCommand(command), (err, stream) => {
    if (err) {
      processManager.completeProcess(processId, 1, null);
      return;
    }

    // Update channel reference
    const process = processManager.getProcess(processId);
    if (process) process.channel = stream;

    stream.on('data', (data: Buffer) => {
      processManager.appendOutput(processId, data, false);
    });

    stream.stderr.on('data', (data: Buffer) => {
      processManager.appendOutput(processId, data, true);
    });

    stream.on('exit', (code, signal) => {
      processManager.completeProcess(processId, code, signal);
    });
  });

  return { success: true, data: { processId } };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom SSH config parsers | `ssh-config` library | 2020+ | Fewer edge case bugs |
| Memory-only output | Stream + temp files | Always | Handles multi-GB outputs |
| PTY allocation for all | Non-interactive exec | Always | Simpler, more reliable |

**Deprecated/outdated:**
- `node-ssh` wrapper: Adds unnecessary abstraction over `ssh2`
- Sync file operations: Block event loop, use `Bun.file()` async API

## Open Questions

1. **Connection pooling for Phase 2?**
   - What we know: v2 requirements mention it
   - What's unclear: Whether to implement basic pooling now
   - Recommendation: Defer to v2, simple connect-per-command for v1

2. **Temp file cleanup strategy?**
   - What we know: Files accumulate in /tmp
   - What's unclear: TTL-based vs process-completion-based cleanup
   - Recommendation: Delete on process completion + status retrieval, or explicit cleanup

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None required (bun test auto-discovers) |
| Quick run command | `bun test src/ssh/` |
| Full suite command | `bun test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| SSH-01 | Parse ~/.ssh/config and resolve host aliases | Unit | `bun test src/ssh/config-parser.test.ts` | Wave 0 |
| SSH-01 | Expand wildcard patterns | Unit | `bun test src/ssh/config-parser.test.ts` | Wave 0 |
| SSH-02 | Connect with configurable timeout | Integration | `bun test src/ssh/client.test.ts` | Wave 0 |
| SSH-02 | Handle connection failures gracefully | Unit | `bun test src/ssh/client.test.ts` | Wave 0 |
| SSH-03 | Detect simple commands | Unit | `bun test src/ssh/command-detection.test.ts` | Wave 0 |
| SSH-03 | Detect complex commands (pipes, redirects) | Unit | `bun test src/ssh/command-detection.test.ts` | Wave 0 |
| SSH-03 | Wrap commands in shell | Unit | `bun test src/ssh/command-detection.test.ts` | Wave 0 |
| EXEC-01 | Execute command and return process ID | Integration | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-01 | Track process status | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-02 | Retrieve output with byte offset | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-02 | Handle chunked reading | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-03 | Check status without full output | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-03 | Return running/completed/failed/killed | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-04 | Send SIGTERM for graceful kill | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |
| EXEC-04 | Escalate to SIGKILL after timeout | Unit | `bun test src/ssh/process-manager.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun test src/ssh/` (quick)
- **Per wave merge:** `bun test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/ssh/config-parser.ts` - SSH config parsing module
- [ ] `src/ssh/config-parser.test.ts` - Config parsing tests
- [ ] `src/ssh/client.ts` - SSH client wrapper module
- [ ] `src/ssh/client.test.ts` - Client connection tests (may need mock)
- [ ] `src/ssh/command-detection.ts` - Simple/complex command detection
- [ ] `src/ssh/command-detection.test.ts` - Command detection tests
- [ ] `src/ssh/process-manager.ts` - Process tracking module
- [ ] `src/ssh/process-manager.test.ts` - Process manager tests
- [ ] `src/ssh/index.ts` - Barrel exports
- [ ] Update `src/types.ts` - Add ProcessInfo interface
- [ ] Update `src/errors.ts` - Add SSH error codes (already present)

## Sources

### Primary (HIGH confidence)

- [ssh2 GitHub](https://github.com/mscdex/ssh2) - Official README with API docs, exec examples
- [ssh-config npm](https://www.npmjs.com/package/ssh-config) - Parse/stringify SSH config, `.compute()` method
- [ssh-config GitHub](https://github.com/cyjake/ssh-config) - Wildcard expansion, config merging

### Secondary (MEDIUM confidence)

- Existing project patterns: `src/types.ts`, `src/config.ts`, `src/errors.ts`, `src/security-validator.ts`

### Tertiary (LOW confidence)

- None - all critical claims verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ssh2 and ssh-config are mature, well-documented libraries
- Architecture: HIGH - patterns established in Phase 1, SSH patterns from official docs
- Pitfalls: HIGH - common issues documented in ssh2 issues and community discussions

**Research date:** 2026-03-07
**Valid until:** 30 days (stable libraries, low churn)
