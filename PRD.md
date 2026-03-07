# Technical PRD: ssh-exoman MCP Server - TypeScript Rebuild

## Document Info
- **Source Project**: Python MCP SSH Server (`mcp_ssh`)
- **Target**: TypeScript/Node.js Rebuild
- **Purpose**: Complete specification for rebuilding from scratch
- **SDK Version**: MCP TypeScript SDK v2 (pre-alpha, v1.x recommended for production)
- **Last Updated**: 2026-03-07

> **Important**: This PRD uses the latest MCP TypeScript SDK v2 patterns from the official repository. As of March 2026, v2 is in pre-alpha with a stable release expected in Q1 2026. For production use, v1.x on the `v1.x` branch is recommended.

---

## 1. Executive Summary

### 1.1 Product Overview
MCP SSH is a **production-ready Model Context Protocol (MCP) server** that provides secure SSH capabilities for AI systems (like Claude Desktop). It enables AI assistants to execute SSH commands, transfer files, and manage remote systems through a structured, secure interface.

### 1.2 Key Value Propositions
- **AI-Native Integration**: Designed for MCP protocol compatibility
- **Background Execution**: All commands run non-blocking with process tracking
- **Security-First**: Configurable command validation (blacklist/whitelist)
- **Production-Ready**: Comprehensive error handling, logging, timeout protection
- **SSH Config Integration**: Uses standard `~/.ssh/config` for host management

### 1.3 Core Statistics (Source Project)
- 107 tests across 5 modules
- 87% code coverage
- 6 MCP Tools, 1 Resource, 1 Prompt
- Support for Python 3.11, 3.12, 3.13

---

## 2. Technical Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude Desktop)                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ MCP Protocol (stdio/sse/http)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP SSH Server                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Server     │  │   Security   │  │   Background Process │  │
│  │   Layer      │──│   Module     │  │   Manager            │  │
│  │  (MCP Tools) │  │ (Validator)  │  │  (ProcessTracker)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                                      │                │
│         ▼                                      ▼                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   SSH Client Layer                        │  │
│  │  - Connection Management (pooling, caching)              │  │
│  │  - SSH Config Parser                                      │  │
│  │  - Command Execution (direct & shell)                    │  │
│  │  - File Transfer (SCP/SFTP)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ SSH Protocol
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Remote SSH Hosts                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack (TypeScript Target)

| Layer | Python Source | TypeScript Target |
|-------|---------------|-------------------|
| Runtime | Python 3.11+ | Node.js 20+ / Bun |
| MCP Framework | `mcp[cli]>=1.7.0` | `@modelcontextprotocol/sdk` |
| SSH Library | `paramiko>=3.5.1` | `ssh2` / `node-ssh` |
| Validation | Pydantic | Zod v4 (required peer dependency) |
| Logging | Python logging | Winston / Pino |
| Testing | pytest, pytest-asyncio | Vitest / Jest |
| Build | hatch / uv | tsup / tsx |

> **Note**: The MCP TypeScript SDK v2 is organized as a monorepo with separate packages:
> - `@modelcontextprotocol/sdk` - Core SDK with server and client
> - For transports, use the built-in transport classes

---

## 3. Core Components

### 3.1 Module Structure

```
src/
├── index.ts                 # Stdio entry point (for Claude Desktop)
├── index-http.ts            # HTTP entry point (for remote access)
├── server.ts                # MCP server setup, tool registration
├── tools/
│   ├── index.ts             # Tool exports
│   ├── execute.ts           # execute_command tool
│   ├── output.ts            # get_command_output tool
│   ├── status.ts            # get_command_status tool
│   ├── kill.ts              # kill_command tool
│   ├── transfer.ts          # transfer_file tool
│   └── security-info.ts     # get_security_info tool
├── resources/
│   ├── index.ts             # Resource exports
│   └── hosts.ts             # ssh://hosts resource
├── prompts/
│   ├── index.ts             # Prompt exports
│   └── help.ts              # ssh_help prompt
├── ssh/
│   ├── index.ts             # SSH module exports
│   ├── client.ts            # Connection management, pooling
│   ├── config.ts            # SSH config file parser
│   ├── execute.ts           # Command execution (direct/shell)
│   ├── transfer.ts          # SCP file transfer operations
│   └── background.ts        # Background command execution
├── process/
│   ├── index.ts             # Process module exports
│   ├── manager.ts           # Process lifecycle tracking
│   └── types.ts             # Process-related types
├── security/
│   ├── index.ts             # Security module exports
│   ├── validator.ts         # Command validation logic
│   └── patterns.ts          # Default blacklist/whitelist patterns
├── config/
│   ├── index.ts             # Config module exports
│   └── env.ts               # Environment variable parsing
├── types/
│   ├── index.ts             # Shared type exports
│   ├── requests.ts          # MCP request types (Zod schemas)
│   └── responses.ts         # MCP response types
└── utils/
    ├── index.ts             # Utility exports
    └── logger.ts            # Structured logging setup (Pino)
```

**Entry Points**:
- `index.ts` - Stdio transport for Claude Desktop integration
- `index-http.ts` - HTTP transport with Express for remote access

### 3.2 Component Responsibilities

#### Server Layer (`server.ts`)
- Initialize MCP server with `@modelcontextprotocol/sdk`
- Register all MCP tools, resources, and prompts
- Handle incoming tool calls and route to appropriate handlers
- Manage server lifecycle (start, stop)

#### SSH Client Layer (`ssh/`)
- Parse `~/.ssh/config` for host configurations
- Manage SSH connections with optional pooling/caching
- Execute commands (simple direct, complex shell)
- Handle file transfers via SFTP/SCP
- Support encrypted keys with passphrase

#### Background Process Manager (`process/`)
- Track running background processes with UUIDs
- Manage process output/error files on remote hosts
- Provide status checking and output chunking
- Handle process termination with escalating signals

#### Security Module (`security/`)
- Validate commands against security policies
- Support blacklist, whitelist, and disabled modes
- Compile regex patterns for efficient matching
- Log security events

---

## 4. Data Models (Zod Schemas)

### 4.1 Request Models

```typescript
// types/requests.ts
import { z } from 'zod';

export const CommandRequestSchema = z.object({
  host: z.string().min(1).max(253),
  command: z.string().min(1).max(2000),
});

export const GetOutputRequestSchema = z.object({
  process_id: z.string().min(1).max(50),
  start_byte: z.number().int().nonnegative().default(0),
  chunk_size: z.number().int().positive().max(100000).optional(),
});

export const KillProcessRequestSchema = z.object({
  process_id: z.string().min(1).max(50),
  cleanup_files: z.boolean().default(true),
});

export const FileTransferRequestSchema = z.object({
  host: z.string().min(1),
  local_path: z.string().min(1),
  remote_path: z.string().min(1),
  direction: z.enum(['upload', 'download']),
});

export type CommandRequest = z.infer<typeof CommandRequestSchema>;
export type GetOutputRequest = z.infer<typeof GetOutputRequestSchema>;
export type KillProcessRequest = z.infer<typeof KillProcessRequestSchema>;
export type FileTransferRequest = z.infer<typeof FileTransferRequestSchema>;
```

### 4.2 Response Models

```typescript
// types/responses.ts
import { z } from 'zod';

export const CommandResultSchema = z.object({
  success: z.boolean(),
  process_id: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'timeout']),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  exit_code: z.number().int().nullable(),
  execution_time: z.number().default(0),
  output_size: z.number().int().default(0),
  has_more_output: z.boolean().default(false),
  chunk_start: z.number().int().default(0),
  error_message: z.string().default(''),
});

export const KillProcessResultSchema = z.object({
  success: z.boolean(),
  process_id: z.string(),
  message: z.string().default(''),
  error_message: z.string().default(''),
});

export const FileTransferResultSchema = z.object({
  success: z.boolean(),
  bytes_transferred: z.number().int().default(0),
  local_path: z.string(),
  remote_path: z.string(),
  host: z.string(),
  error_message: z.string().default(''),
});

export const HostInfoSchema = z.object({
  name: z.string(),
  hostname: z.string(),
  user: z.string().nullable(),
  port: z.number().int().default(22),
});

export const SecurityInfoSchema = z.object({
  security_mode: z.enum(['blacklist', 'whitelist', 'disabled']),
  case_sensitive: z.boolean(),
  blacklist_patterns_count: z.number().int(),
  whitelist_patterns_count: z.number().int(),
  blacklist_patterns: z.array(z.string()),
  whitelist_patterns: z.array(z.string()),
});

export type CommandResult = z.infer<typeof CommandResultSchema>;
export type KillProcessResult = z.infer<typeof KillProcessResultSchema>;
export type FileTransferResult = z.infer<typeof FileTransferResultSchema>;
export type HostInfo = z.infer<typeof HostInfoSchema>;
export type SecurityInfo = z.infer<typeof SecurityInfoSchema>;
```

### 4.3 Internal Models

```typescript
// process/types.ts
export interface BackgroundProcess {
  process_id: string;
  host: string;
  command: string;
  pid: number | null;
  start_time: Date;
  status: 'running' | 'completed' | 'failed' | 'killed';
  output_file: string;
  error_file: string;
  exit_code: number | null;
}

// ssh/config.ts
export interface SSHHostConfig {
  hostname: string;
  port?: number;
  user?: string;
  identityfile?: string;
  [key: string]: string | number | undefined;
}
```

---

## 5. MCP Tools Specification

### 5.1 Tool: `execute_command`

**Purpose**: Execute SSH command in background, return immediately with process_id.

**Request Schema**:
```json
{
  "host": "server-name",
  "command": "ls -la /var/log"
}
```

**Response Schema**:
```json
{
  "success": true,
  "process_id": "a1b2c3d4",
  "status": "running",
  "stdout": "partial output...",
  "stderr": "",
  "exit_code": null,
  "execution_time": 5.23,
  "output_size": 1024,
  "has_more_output": false,
  "chunk_start": 0,
  "error_message": ""
}
```

**Flow**:
1. Validate request (host, command)
2. Security validation (blacklist/whitelist check)
3. Get SSH client from config (with connection pooling)
4. Create process tracking entry (generate UUID)
5. Execute command in background on remote host
6. Wait briefly (configurable, default 5s) for quick commands
7. Check initial status and return

### 5.2 Tool: `get_command_output`

**Purpose**: Retrieve output from background command with chunking support.

**Request Schema**:
```json
{
  "process_id": "a1b2c3d4",
  "start_byte": 0,
  "chunk_size": 10000
}
```

**Flow**:
1. Look up process by ID
2. Get SSH connection
3. Read output chunk from remote file using `tail -c +N | head -c M`
4. Check if more data exists
5. Update process status
6. Return chunk with has_more flag

### 5.3 Tool: `get_command_status`

**Purpose**: Lightweight status check without retrieving output.

**Request Schema**:
```json
{
  "process_id": "a1b2c3d4",
  "start_byte": 0
}
```

**Flow**:
1. Look up process by ID
2. Get SSH connection
3. Check if process is running using `kill -0 PID`
4. Read exit code file if completed
5. Return status and exit_code

### 5.4 Tool: `kill_command`

**Purpose**: Terminate running background process.

**Request Schema**:
```json
{
  "process_id": "a1b2c3d4",
  "cleanup_files": true
}
```

**Flow**:
1. Look up process by ID
2. Check if process is still running
3. Send SIGTERM (graceful termination)
4. Wait 2 seconds
5. If still running, send SIGKILL (force)
6. Optionally clean up temp files
7. Return result

### 5.5 Tool: `transfer_file`

**Purpose**: Upload or download files via SCP/SFTP.

**Request Schema**:
```json
{
  "host": "server-name",
  "local_path": "/local/file.txt",
  "remote_path": "/remote/file.txt",
  "direction": "upload"
}
```

**Flow**:
1. Validate source file exists (local for upload, remote for download)
2. Get SSH connection
3. Open SFTP channel
4. Transfer file with timeout protection
5. Return bytes transferred

### 5.6 Tool: `get_security_info`

**Purpose**: Get current security configuration.

**Response Schema**:
```json
{
  "security_mode": "blacklist",
  "case_sensitive": false,
  "blacklist_patterns_count": 30,
  "whitelist_patterns_count": 0,
  "blacklist_patterns": ["rm\\s+.*-r.*", "sudo\\s+.*", ...],
  "whitelist_patterns": []
}
```

### 5.7 Resource: `ssh://hosts`

**Purpose**: List all configured SSH hosts from `~/.ssh/config`.

**Response Schema**:
```json
[
  {
    "name": "production",
    "hostname": "prod.example.com",
    "user": "deploy",
    "port": 22
  }
]
```

### 5.8 Prompt: `ssh_help`

**Purpose**: Interactive guidance for SSH operations.

Returns a help string explaining all available tools and their usage.

---

## 6. Configuration Specification

### 6.1 Environment Variables

```typescript
// config/env.ts
export const config = {
  // Background Execution
  maxOutputSize: parseInt(process.env.MCP_SSH_MAX_OUTPUT_SIZE || '50000', 10),
  quickWaitTime: parseInt(process.env.MCP_SSH_QUICK_WAIT_TIME || '5', 10),
  chunkSize: parseInt(process.env.MCP_SSH_CHUNK_SIZE || '10000', 10),

  // Timeouts
  connectTimeout: parseInt(process.env.MCP_SSH_CONNECT_TIMEOUT || '30', 10),
  commandTimeout: parseInt(process.env.MCP_SSH_COMMAND_TIMEOUT || '60', 10),
  transferTimeout: parseInt(process.env.MCP_SSH_TRANSFER_TIMEOUT || '300', 10),
  readTimeout: parseInt(process.env.MCP_SSH_READ_TIMEOUT || '30', 10),

  // Connection Optimization
  connectionReuse: process.env.MCP_SSH_CONNECTION_REUSE === 'true',
  connectionPoolSize: parseInt(process.env.MCP_SSH_CONNECTION_POOL_SIZE || '5', 10),

  // Security
  securityMode: (process.env.MCP_SSH_SECURITY_MODE || 'blacklist') as 'blacklist' | 'whitelist' | 'disabled',
  commandBlacklist: process.env.MCP_SSH_COMMAND_BLACKLIST || '',
  commandWhitelist: process.env.MCP_SSH_COMMAND_WHITELIST || '',
  caseSensitive: process.env.MCP_SSH_CASE_SENSITIVE === 'true',

  // SSH
  tempDir: process.env.MCP_SSH_TEMP_DIR || '/tmp',
  keyFile: process.env.SSH_KEY_FILE || '~/.ssh/id_rsa',
  keyPassphrase: process.env.SSH_KEY_PHRASE || '',
};
```

### 6.2 Default Values

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_SSH_MAX_OUTPUT_SIZE` | 50000 | Max output bytes before chunking |
| `MCP_SSH_QUICK_WAIT_TIME` | 5 | Seconds to wait for quick commands |
| `MCP_SSH_CHUNK_SIZE` | 10000 | Default chunk size for output |
| `MCP_SSH_CONNECT_TIMEOUT` | 30 | SSH connection timeout (seconds) |
| `MCP_SSH_COMMAND_TIMEOUT` | 60 | Command execution timeout (seconds) |
| `MCP_SSH_TRANSFER_TIMEOUT` | 300 | File transfer timeout (seconds) |
| `MCP_SSH_READ_TIMEOUT` | 30 | Output reading timeout (seconds) |
| `MCP_SSH_CONNECTION_REUSE` | false | Enable connection caching |
| `MCP_SSH_SECURITY_MODE` | blacklist | Security validation mode |

---

## 7. Security Implementation

### 7.1 Default Blacklist Patterns

```typescript
// security/patterns.ts
export const DEFAULT_BLACKLIST_PATTERNS = [
  // Recursive/force deletions
  /rm\s+.*-r.*/i,
  /rm\s+.*-f.*/i,

  // Disk operations
  /dd\s+.*/i,
  /mkfs[.\s].*/i,
  /fdisk\s+.*/i,
  /parted\s+.*/i,

  // Privilege escalation
  /sudo\s+.*/i,
  /su\s+.*/i,
  /passwd\s+.*/i,

  // Network/Firewall
  /iptables\s+.*/i,
  /ufw\s+.*/i,

  // System control
  /systemctl\s+(stop|disable|mask).*/i,
  /service\s+(stop|disable).*/i,
  /killall\s+.*/i,
  /pkill\s+.*/i,
  /shutdown\s+.*/i,
  /reboot\s+.*/i,
  /halt\s+.*/i,
  /init\s+[06]/i,

  // Filesystem
  /mount\s+.*/i,
  /umount\s+.*/i,
  /chmod\s+.*777.*/i,
  /chown\s+.*root.*/i,

  // Dangerous redirects
  /.*>\s*\/dev\/sd[a-z].*/i,
  /.*>\s*\/dev\/nvme.*/i,

  // Crontab/History
  /crontab\s+-r/i,
  /history\s+-c/i,

  // Remote execution
  /.*\|\s*sh\s*$/i,
  /.*\|\s*bash\s*$/i,
  /curl\s+.*\|\s*(sh|bash)/i,
  /wget\s+.*\|\s*(sh|bash)/i,
];
```

### 7.2 Validator Logic

```typescript
// security/validator.ts
export class CommandValidator {
  private mode: 'blacklist' | 'whitelist' | 'disabled';
  private caseSensitive: boolean;
  private blacklistPatterns: RegExp[];
  private whitelistPatterns: RegExp[];

  validate(command: string, host: string = '', user: string = ''): { allowed: boolean; reason: string } {
    if (this.mode === 'disabled') {
      return { allowed: true, reason: 'Security validation disabled' };
    }

    if (!command.trim()) {
      return { allowed: false, reason: 'Empty command not allowed' };
    }

    if (this.mode === 'whitelist') {
      return this.validateWhitelist(command);
    } else {
      return this.validateBlacklist(command);
    }
  }

  private validateBlacklist(command: string): { allowed: boolean; reason: string } {
    for (const pattern of this.blacklistPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Command blocked by security policy: ${pattern.source}`
        };
      }
    }
    return { allowed: true, reason: 'Command passed security validation' };
  }

  private validateWhitelist(command: string): { allowed: boolean; reason: string } {
    if (this.whitelistPatterns.length === 0) {
      return { allowed: false, reason: 'No whitelist patterns configured - all commands blocked' };
    }

    for (const pattern of this.whitelistPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: true,
          reason: `Command matches whitelist pattern: ${pattern.source}`
        };
      }
    }
    return { allowed: false, reason: 'Command not found in whitelist patterns' };
  }
}
```

---

## 8. SSH Implementation Details

### 8.1 SSH Config Parser

Parse `~/.ssh/config` format:

```
Host production
    HostName prod.example.com
    User deploy
    Port 22
    IdentityFile ~/.ssh/prod_key
```

**Implementation Notes**:
- Skip wildcard patterns (containing `*` or `?`)
- Support both `Key Value` and `Key=Value` formats
- Handle multiple IdentityFile entries

### 8.2 Connection Management

```typescript
interface ConnectionCache {
  [host: string]: {
    client: SSHClient;
    timestamp: number;
  };
}

// Connection reuse with 5-minute expiry
const CONNECTION_CACHE_TTL = 5 * 60 * 1000;

async function getClient(host: string): Promise<SSHClient | null> {
  // Check cache
  if (config.connectionReuse && cache[host]) {
    const { client, timestamp } = cache[host];
    if (Date.now() - timestamp < CONNECTION_CACHE_TTL) {
      // Test connection health
      try {
        await client.exec('echo test', { timeout: 5000 });
        return client;
      } catch {
        delete cache[host];
      }
    }
  }

  // Create new connection
  const hostConfig = parseSSHConfig()[host];
  if (!hostConfig) return null;

  const client = new SSHClient();
  await client.connect({
    host: hostConfig.hostname,
    port: hostConfig.port || 22,
    username: hostConfig.user,
    privateKey: await loadKey(hostConfig.identityfile),
    readyTimeout: config.connectTimeout,
  });

  if (config.connectionReuse) {
    cache[host] = { client, timestamp: Date.now() };
  }

  return client;
}
```

### 8.3 Command Execution Types

**Simple Command** (direct execution):
- No pipes (`|`), redirects (`>`, `<`), variables (`$`), subshells
- Execute directly via SSH exec

**Complex Command** (shell execution):
- Contains shell features
- Wrap with `bash -c` using proper quoting
- For complex quoting, use heredoc approach

```typescript
function isSimpleCommand(command: string): boolean {
  const shellFeatures = ['|', '>', '<', '>>', '<<', '&&', '||', ';', '$', '`', '$(', '${'];
  const complexQuoting = ["'\"'", "\"'", "\\'", '\\"'];

  for (const feature of shellFeatures) {
    if (command.includes(feature)) return false;
  }
  for (const pattern of complexQuoting) {
    if (command.includes(pattern)) return false;
  }
  return true;
}
```

### 8.4 Background Execution Strategy

**Remote Temporary Files**:
```
/tmp/mcp_ssh_{process_id}_{timestamp}.out   # stdout
/tmp/mcp_ssh_{process_id}_{timestamp}.err   # stderr
/tmp/mcp_ssh_{process_id}_{timestamp}.out.exit  # exit code
```

**Background Wrapper Command**:
```bash
bash -c '
    set -e
    cd "$PWD"
    {escaped_command} > "{output_file}" 2> "{error_file}"
    rc=$?
    echo $rc > "{output_file}.exit"
    sync
    exit $rc
' &
echo $!
```

**Output Chunking**:
```bash
# Get chunk from byte position
tail -c +{start_byte + 1} {output_file} | head -c {chunk_size}

# Check if more data exists
tail -c +{start_byte + chunk_size + 1} {output_file} | head -c 1
```

---

## 9. Error Handling Strategy

### 9.1 Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Connection | Host unreachable, auth failed | Return error response, log details |
| Timeout | Command execution timeout | Return status="timeout", partial output |
| Security | Command blocked by policy | Return error with reason |
| Process | Process not found | Return error response |
| Transfer | File not found, permission denied | Return error with details |

### 9.2 Response Pattern

All tools return consistent response format:
```typescript
{
  success: boolean;
  // ... result fields on success
  error_message: string; // present on failure
}
```

### 9.3 Logging Requirements

Log the following events:
- Command requests (tool name, host, command preview)
- Command responses (success, status, execution time)
- Process lifecycle (created, pid_assigned, completed, killed)
- Security events (validation passed/blocked)
- Errors (exception type, message, context)

---

## 10. Testing Strategy

### 10.1 Test Categories

| Category | Focus | Tools |
|----------|-------|-------|
| Unit | Individual functions, validators | Vitest/Jest |
| Integration | SSH client, command execution | Mock SSH |
| E2E | Full MCP tool workflows | Real SSH (optional) |
| Security | Command validation patterns | Pattern tests |

### 10.2 Test Structure

```
tests/
├── setup.ts              # Test fixtures, mocks
├── ssh/
│   ├── config.test.ts    # SSH config parsing
│   ├── client.test.ts    # Connection management
│   └── execute.test.ts   # Command execution
├── process/
│   └── manager.test.ts   # Process tracking
├── security/
│   └── validator.test.ts # Command validation
├── server/
│   └── tools.test.ts     # MCP tool handlers
└── e2e/
    └── workflow.test.ts  # Full workflows
```

### 10.3 Key Test Scenarios

- Simple command execution
- Complex shell command with pipes/redirects
- Background process tracking
- Output chunking
- Process termination (graceful and force)
- File upload/download
- Security validation (blacklist/whitelist)
- Connection reuse
- Timeout handling
- Error scenarios

---

## 11. TypeScript Implementation Notes

### 11.1 MCP SDK v2 Integration

The MCP TypeScript SDK v2 provides a clean API with `McpServer` class and `registerTool()`, `registerResource()`, `registerPrompt()` methods.

#### Package Installation

```bash
# Core SDK (includes server, client, and transports)
npm install @modelcontextprotocol/sdk

# Zod v4 is a required peer dependency for schema validation
npm install zod

# SSH libraries
npm install ssh2 ssh2-sftp-client

# Logging
npm install pino pino-pretty

# HTTP server (optional, for HTTP transport)
npm install express
npm install @types/express -D
```

#### Stdio Transport (for Claude Desktop)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'MCP SSH Server',
  version: '1.0.0',
});

// Register tool with Zod schema
server.tool(
  'execute_command',
  {
    host: z.string().min(1).max(253),
    command: z.string().min(1).max(2000),
  },
  async (input) => {
    // Implementation
    const result = await executeSSHCommand(input.host, input.command);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// Register resource
server.resource(
  'ssh-hosts',
  'ssh://hosts',
  {
    description: 'List all configured SSH hosts from ~/.ssh/config',
    mimeType: 'application/json',
  },
  async (uri) => {
    const hosts = await listSSHHosts();
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(hosts),
        },
      ],
    };
  }
);

// Register prompt
server.prompt(
  'ssh_help',
  {},
  async () => {
    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: getSSSHelpText(),
          },
        },
      ],
    };
  }
);

// Start server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### HTTP Transport (for remote access)

```typescript
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());

const server = new McpServer({
  name: 'MCP SSH Server',
  version: '1.0.0',
});

// Register tools, resources, prompts...

// Handle MCP requests
app.all('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    // Configure as needed
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.MCP_SSH_PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP SSH Server listening on port ${PORT}`);
});
```

### 11.2 SSH Library Options

| Library | Pros | Cons |
|---------|------|------|
| `ssh2` | Low-level control, mature | More verbose API |
| `node-ssh` | Higher-level API | Less control |
| `ssh2-sftp-client` | Good SFTP support | Separate package |

**Recommended**: `ssh2` for core functionality + `ssh2-sftp-client` for file transfers

### 11.3 Async/Await Patterns

All SSH operations should be async:
```typescript
async function executeCommand(client: Client, command: string): Promise<CommandResult> {
  // Use Promise wrappers for callback-based SSH2 API
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);
      // Handle stream events
    });
  });
}
```

### 11.4 Package.json Scripts

```json
{
  "name": "mcp-ssh-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:http": "tsx watch src/index-http.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "start": "node dist/index.js",
    "start:http": "node dist/index-http.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ssh2": "^1.15.0",
    "ssh2-sftp-client": "^11.0.0",
    "zod": "^3.24.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "express": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ssh2": "^1.15.0",
    "@types/express": "^5.0.0",
    "typescript": "^5.7.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 11.5 TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 12. Implementation Roadmap

### Phase 1: Core Infrastructure
- [ ] Project setup (package.json, tsconfig.json, .gitignore)
- [ ] Install dependencies (`@modelcontextprotocol/sdk`, `ssh2`, `zod`)
- [ ] Type definitions (Zod schemas for requests/responses)
- [ ] Configuration module (environment variables parsing)
- [ ] Logger setup (Pino with pretty printing for dev)

### Phase 2: SSH Layer
- [ ] SSH config parser (`~/.ssh/config`)
- [ ] SSH client with connection management and pooling
- [ ] Command execution (simple direct vs complex shell)
- [ ] File transfer (SFTP with ssh2-sftp-client)

### Phase 3: Process Management
- [ ] Background process tracking with UUIDs
- [ ] Output file management on remote hosts
- [ ] Status checking (kill -0 PID, exit code files)
- [ ] Process termination (SIGTERM → SIGKILL escalation)

### Phase 4: Security
- [ ] Command validator with blacklist/whitelist modes
- [ ] Default blacklist patterns (destructive commands)
- [ ] Configuration loading from environment variables
- [ ] Security info tool for configuration introspection

### Phase 5: MCP Server Setup
- [ ] Create McpServer instance with metadata
- [ ] Register all 6 tools with Zod schemas
- [ ] Register ssh://hosts resource
- [ ] Register ssh_help prompt
- [ ] Create stdio entry point (index.ts) for Claude Desktop
- [ ] Create HTTP entry point (index-http.ts) with Express

### Phase 6: Testing & QA
- [ ] Unit tests for each module (Vitest)
- [ ] Integration tests for SSH operations (mock SSH server)
- [ ] E2E testing with real SSH (optional)
- [ ] Test Claude Desktop integration via stdio
- [ ] Test HTTP transport
- [ ] Documentation and README

---

## 13. Verification Checklist

After implementation, verify:

### MCP Tools & Resources
- [ ] All 6 tools working correctly (`server.tool` with Zod schemas)
- [ ] Resource `ssh://hosts` returns configured hosts (`server.resource`)
- [ ] Prompt `ssh_help` returns help text (`server.prompt`)

### Transports
- [ ] Stdio transport works (Claude Desktop integration)
- [ ] HTTP transport works with `StreamableHTTPServerTransport`

### SSH Operations
- [ ] Background execution works with process tracking
- [ ] Output chunking works correctly
- [ ] Process termination (SIGTERM -> SIGKILL)
- [ ] File transfers (upload/download via SFTP)

### Security & Performance
- [ ] Security validation (blacklist/whitelist)
- [ ] Connection reuse and caching
- [ ] All timeouts respected
- [ ] Comprehensive error handling

### Integration
- [ ] Claude Desktop integration via stdio
- [ ] HTTP server starts and handles requests
- [ ] Zod schemas validate correctly

---

## 14. Critical Files Reference

### Python Source (Reference)

| File | Purpose | Lines (approx) |
|------|---------|----------------|
| `server.py` | MCP server, tool definitions | ~1020 |
| `ssh.py` | SSH client, execution, transfer | ~710 |
| `background.py` | Process tracking | ~90 |
| `security.py` | Command validation | ~200 |
| `pyproject.toml` | Project config, dependencies | ~207 |

**Python Total**: ~2220 lines

### TypeScript Target (Planned)

| File | Purpose | Lines (est) |
|------|---------|-------------|
| `src/index.ts` | Stdio entry point | ~30 |
| `src/index-http.ts` | HTTP entry point | ~40 |
| `src/server.ts` | McpServer setup, tool registration | ~150 |
| `src/tools/*.ts` | 6 tool implementations (each ~100-200) | ~800 |
| `src/resources/hosts.ts` | ssh://hosts resource | ~50 |
| `src/prompts/help.ts` | ssh_help prompt | ~40 |
| `src/ssh/client.ts` | Connection management | ~200 |
| `src/ssh/config.ts` | SSH config parser | ~100 |
| `src/ssh/execute.ts` | Command execution | ~150 |
| `src/ssh/transfer.ts` | File transfer | ~100 |
| `src/ssh/background.ts` | Background execution | ~100 |
| `src/process/manager.ts` | Process tracking | ~100 |
| `src/security/validator.ts` | Command validation | ~80 |
| `src/security/patterns.ts` | Default patterns | ~60 |
| `src/config/env.ts` | Environment config | ~50 |
| `src/types/*.ts` | Zod schemas and types | ~150 |
| `src/utils/logger.ts` | Pino logger setup | ~30 |

**TypeScript Total (estimated)**: ~2200 lines

---

## 15. Migration Notes: Python → TypeScript

### Key API Differences

| Aspect | Python (mcp package) | TypeScript (@modelcontextprotocol/sdk) |
|--------|---------------------|---------------------------------------|
| Server Class | `Server` or `FastMCP` | `McpServer` |
| Tool Registration | `@mcp.tool()` decorator | `server.tool(name, schema, handler)` |
| Schema Definition | Pydantic models | Zod schemas |
| Transport | `StdioServerTransport` | `StdioServerTransport` or `StreamableHTTPServerTransport` |
| Context Access | Function parameters | Handler parameters |
| Response Format | Dict/object | `{ content: [{ type: 'text', text: '...' }] }` |

### Pattern Mapping

```python
# Python (FastMCP)
@mcp.tool()
async def execute_command(host: str, command: str) -> dict:
    return {"success": True, "process_id": "abc123"}
```

```typescript
// TypeScript (MCP SDK)
server.tool(
  'execute_command',
  {
    host: z.string().min(1),
    command: z.string().min(1),
  },
  async (input) => {
    const result = { success: true, process_id: 'abc123' };
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  }
);
```

---

## 16. Appendix: Detailed API Reference

### 16.1 MCP Server Class Methods

```typescript
// Tool registration
server.tool(
  name: string,
  inputSchema: ZodRawShape,
  handler: (input: z.infer<z.ZodObject<ZodRawShape>>) => Promise<{
    content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
    isError?: boolean;
  }>
): void;

// Resource registration
server.resource(
  name: string,
  uri: string | URL,
  metadata: {
    description?: string;
    mimeType?: string;
  },
  handler: (uri: URL) => Promise<{
    contents: Array<{
      uri: string;
      mimeType?: string;
      text?: string;
      blob?: string;
    }>;
  }>
): void;

// Prompt registration
server.prompt(
  name: string,
  argsSchema: ZodRawShape,
  handler: (args: z.infer<z.ZodObject<ZodRawShape>>) => Promise<{
    messages: Array<{
      role: 'user' | 'assistant';
      content: { type: 'text'; text: string };
    }>;
  }>
): void;
```

### 16.2 SSH2 Client API

```typescript
import { Client } from 'ssh2';

const client = new Client();

// Connect
client.connect({
  host: string,
  port?: number,
  username?: string,
  privateKey?: Buffer | string,
  passphrase?: string,
  readyTimeout?: number,
});

// Execute command
client.exec(command: string, (err: Error | undefined, stream: Channel) => {
  stream.on('close', (code: number, signal: string) => {});
  stream.on('data', (data: Buffer) => {}); // stdout
  stream.stderr.on('data', (data: Buffer) => {}); // stderr
});

// SFTP
client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
  sftp.fastGet(remotePath, localPath, (err) => {});
  sftp.fastPut(localPath, remotePath, (err) => {});
  sftp.readFile(remotePath, (err, data) => {});
  sftp.writeFile(remotePath, data, (err) => {});
});
```

### 16.3 Error Response Format

```typescript
// Standard error response
{
  success: false,
  error_message: "Connection refused to host example.com:22",
  // Other fields default to empty/null
}

// Tool error response (MCP format)
{
  content: [{
    type: 'text',
    text: JSON.stringify({
      success: false,
      error_message: "..."
    })
  }],
  isError: true
}
```

---

## 17. Appendix: Environment Variables Complete List

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MCP_SSH_MAX_OUTPUT_SIZE` | number | 50000 | Max output bytes before chunking |
| `MCP_SSH_QUICK_WAIT_TIME` | number | 5 | Seconds to wait for quick commands |
| `MCP_SSH_CHUNK_SIZE` | number | 10000 | Default chunk size for output |
| `MCP_SSH_CONNECT_TIMEOUT` | number | 30 | SSH connection timeout (seconds) |
| `MCP_SSH_COMMAND_TIMEOUT` | number | 60 | Command execution timeout (seconds) |
| `MCP_SSH_TRANSFER_TIMEOUT` | number | 300 | File transfer timeout (seconds) |
| `MCP_SSH_READ_TIMEOUT` | number | 30 | Output reading timeout (seconds) |
| `MCP_SSH_CONNECTION_REUSE` | boolean | false | Enable connection caching |
| `MCP_SSH_CONNECTION_POOL_SIZE` | number | 5 | Max connections per host |
| `MCP_SSH_SECURITY_MODE` | string | blacklist | Security validation mode (blacklist/whitelist/disabled) |
| `MCP_SSH_COMMAND_BLACKLIST` | string | '' | Comma-separated blacklist patterns |
| `MCP_SSH_COMMAND_WHITELIST` | string | '' | Comma-separated whitelist patterns |
| `MCP_SSH_CASE_SENSITIVE` | boolean | false | Case-sensitive pattern matching |
| `MCP_SSH_TEMP_DIR` | string | /tmp | Remote temp directory |
| `MCP_SSH_PORT` | number | 3000 | HTTP server port (for HTTP mode) |
| `SSH_KEY_FILE` | string | ~/.ssh/id_rsa | Default SSH private key path |
| `SSH_KEY_PHRASE` | string | '' | SSH key passphrase |

---

## 18. Appendix: SSH Config File Format

The parser should handle standard OpenSSH config format:

```
# Comment
Host alias-name
    HostName actual-hostname.com
    User username
    Port 22
    IdentityFile ~/.ssh/custom_key
    ServerAliveInterval 60
    ServerAliveCountMax 3
    Compression yes
    ForwardAgent no

Host another-host
    HostName 192.168.1.100
    User admin
    Port 2222
```

**Parsing Rules**:
1. Lines starting with `#` are comments
2. `Host` starts a new host entry
3. Indented lines are properties of the previous `Host`
4. Both `Key Value` and `Key=Value` formats are valid
5. Properties are case-insensitive
6. Skip entries with wildcards (`*`, `?`) in the host name
7. Default values: `Port 22`, `User` from current user

---

## 19. Appendix: Claude Desktop Configuration

After building the TypeScript server, configure Claude Desktop:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/path/to/mcp-ssh-server/dist/index.js"],
      "env": {
        "MCP_SSH_SECURITY_MODE": "blacklist",
        "MCP_SSH_CASE_SENSITIVE": "false"
      }
    }
  }
}
```

---

## 20. Appendix: Development Workflow

### 20.1 Initial Setup

```bash
# Create project directory
mkdir mcp-ssh-server && cd mcp-ssh-server

# Initialize npm project
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk ssh2 ssh2-sftp-client zod pino

# Install dev dependencies
npm install -D typescript tsup tsx vitest @vitest/coverage-v8 \
  @types/node @types/ssh2 eslint typescript-eslint

# Create directory structure
mkdir -p src/{tools,resources,prompts,ssh,process,security,config,types,utils}
mkdir -p tests/{ssh,process,security,server,e2e}
```

### 20.2 Development Commands

```bash
# Development with hot reload
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Build for production
npm run build

# Run linter
npm run lint
```

### 20.3 Debugging

For debugging MCP server with Claude Desktop:

```bash
# View MCP logs (macOS)
tail -f ~/Library/Logs/Claude/mcp*.log

# Run server standalone for testing
node --inspect dist/index.js
```
