# Feature Research

**Domain:** MCP SSH Server (AI-accessible remote command execution via Model Context Protocol)
**Researched:** 2026-03-07
**Confidence:** HIGH (based on existing Python implementation with 107 tests, PRD reference, and MCP protocol knowledge)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Remote command execution | Core purpose of an SSH MCP server -- without this there is no product | HIGH | Background execution with UUID tracking, not blocking. Must handle both simple commands and complex shell expressions (pipes, redirects, variables). |
| Command output retrieval | Commands are useless if you cannot read their output | MEDIUM | Must support chunked reading for large outputs (start_byte + chunk_size). AI context windows are limited, so chunking is essential. |
| Command status checking | AI needs to poll for completion without fetching full output | LOW | Lightweight check via `kill -0 PID` and exit code file. Keeps token usage efficient. |
| Process termination | Running processes must be killable -- safety requirement | MEDIUM | SIGTERM then SIGKILL escalation after timeout. Must also clean up remote temp files. |
| File transfer (SFTP) | Uploading configs, downloading logs is a core SSH workflow | MEDIUM | Upload and download via SFTP. Must validate file existence before transfer. |
| SSH config integration | Users already have `~/.ssh/config` -- not using it is a dealbreaker | MEDIUM | Parse standard SSH config format. Support Host, HostName, User, Port, IdentityFile. Skip wildcard entries. |
| Command security validation | AI assistants must not run `rm -rf /` -- safety is non-negotiable | MEDIUM | Default blacklist of ~30 dangerous patterns. Blacklist/whitelist/disabled modes. Ship secure by default. |
| Security info introspection | Users need to see what security rules are active | LOW | Expose current mode, pattern counts, and pattern list. Helps debug blocked commands. |
| Stdio transport | Claude Desktop uses stdio -- this is the primary integration path | LOW | Standard MCP StdioServerTransport. Without this, the server cannot connect to Claude Desktop. |
| Structured error responses | AI assistants need parseable errors to recover gracefully | LOW | Consistent `{ success, error_message }` shape across all tools. No raw stack traces. |
| Environment-based configuration | Ops standard for configuring servers without code changes | LOW | All timeouts, security modes, chunk sizes via env vars. Bun auto-loads .env. |
| SSH help prompt | MCP prompts guide the AI on how to use available tools | LOW | Single prompt explaining all tools, their parameters, and typical workflows. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Connection pooling with TTL | Avoids SSH handshake overhead on repeated commands to same host -- dramatically faster for multi-step workflows | MEDIUM | Cache connections with configurable TTL (default 5 min). Health-check cached connections before reuse. Most competing MCP SSH servers create a new connection per command. |
| HTTP/Streamable transport | Enables remote MCP access beyond local stdio -- run the server on a bastion host, connect from anywhere | MEDIUM | StreamableHTTPServerTransport from MCP SDK. Not all MCP SSH servers offer this. Opens use cases like shared team SSH gateways. |
| Configurable timeouts per operation | Different operations need different timeouts -- a file transfer needs 5 min, a status check needs 5 sec | LOW | connect/command/transfer/read timeouts all independently configurable. Prevents both premature timeouts and hung connections. |
| Simple vs complex command detection | Automatically routes simple commands to direct exec and complex commands through `bash -c` -- reduces shell escaping errors | LOW | Detect pipes, redirects, variables, subshells. Direct exec is faster and avoids shell interpretation issues. Transparent to the user. |
| SSH hosts as MCP resource | Exposes available hosts via MCP resource protocol -- AI can discover hosts without user listing them | LOW | `ssh://hosts` resource returns structured JSON. AI assistants can proactively list available targets. Most competitors only support tools, not resources. |
| Custom blacklist/whitelist via env | Users can add their own security patterns beyond defaults without code changes | LOW | Comma-separated patterns in `MCP_SSH_COMMAND_BLACKLIST` / `MCP_SSH_COMMAND_WHITELIST` env vars. Enables org-specific policies. |
| Output size awareness | Report output_size and has_more_output so AI knows when to chunk | LOW | Prevents AI from requesting full output of a 100MB log file. AI can make informed decisions about how much to read. |
| Bun runtime | Faster startup, lower memory, built-in TS support, simpler toolchain | LOW | ~2x faster cold start than Node.js. No separate build step needed. Single binary-like deployment. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Interactive/PTY sessions | "I want a real SSH terminal" | MCP is request/response, not streaming. PTY sessions require persistent bidirectional streams that don't map to MCP's tool call model. Adds massive complexity for marginal benefit. | Background execution covers 95% of use cases. For the remaining 5%, tell the user to SSH directly. |
| SSH agent forwarding | "I need to hop between servers" | Security nightmare when AI controls the agent. Adds authentication complexity. Most users have direct SSH access to target hosts. | Configure jump hosts in `~/.ssh/config` using ProxyJump -- SSH handles this natively without MCP involvement. |
| Multi-tenant authentication | "Multiple users sharing one server" | Adds auth layer, session isolation, permission management. This is a headless single-user MCP server, not a SaaS platform. | Deploy separate instances per user. MCP clients already handle auth at the client level. |
| Database persistence | "Remember my processes across restarts" | Adds dependency, migration complexity, and state synchronization problems. Background processes are ephemeral by nature -- if the server restarts, remote processes are orphaned anyway. | Ephemeral in-memory tracking. Document that server restart means process tracking is lost (remote processes continue independently). |
| Web UI dashboard | "Show me a dashboard of running processes" | This is a headless protocol server. A UI adds frontend stack, serves a different user, and duplicates what the AI client already shows. | The AI assistant IS the UI. Process status is available via `get_command_status`. |
| Automatic command retry | "Retry failed commands automatically" | Dangerous for non-idempotent commands. The AI assistant should decide whether to retry based on the error, not the server. | Return clear error information. Let the AI decide retry strategy. |
| SSH key generation | "Generate keys for me" | Security-sensitive operation that should be done deliberately by the user, not automated by an AI tool. Key management is out of scope. | Document that users must have SSH keys configured. Point to ssh-keygen docs. |
| Command queueing/scheduling | "Queue commands for later execution" | Adds job scheduler complexity. Cron on the remote host already does this better. MCP is for interactive AI workflows, not batch processing. | Use `execute_command` to set up cron jobs on the remote host if scheduling is needed. |
| Sudo/privilege escalation support | "I need to run commands as root" | Explicitly blocked in the default security blacklist for good reason. An AI running privileged commands is a security incident waiting to happen. | If users truly need it, they can set security_mode to disabled (at their own risk) or configure a whitelist for specific safe privileged commands. |

## Feature Dependencies

```
[SSH Config Parser]
    └──requires──> [SSH Client/Connection Management]
                       └──requires──> [Command Execution]
                       └──requires──> [File Transfer (SFTP)]
                       └──requires──> [Background Process Execution]

[Background Process Execution]
    └──requires──> [Process Manager (UUID tracking)]
                       └──enables──> [Get Command Output (chunked)]
                       └──enables──> [Get Command Status]
                       └──enables──> [Kill Command]

[Security Validator]
    └──required-by──> [Command Execution]
    └──independent-of──> [SSH Client Layer]

[Stdio Transport]
    └──requires──> [MCP Server Setup (tool/resource/prompt registration)]

[HTTP Transport]
    └──requires──> [MCP Server Setup (tool/resource/prompt registration)]

[Connection Pooling]
    └──enhances──> [SSH Client/Connection Management]

[MCP Server Setup]
    └──requires──> [All Tool Implementations]
    └──requires──> [SSH Hosts Resource]
    └──requires──> [SSH Help Prompt]
```

### Dependency Notes

- **Command Execution requires SSH Client:** Cannot run commands without a connection. SSH config parsing feeds connection parameters.
- **All process tools require Background Process Execution:** Output retrieval, status checking, and kill all depend on UUID-tracked background processes existing.
- **Security Validator is independent of SSH layer:** Validates command strings before they reach SSH. Can be built and tested in isolation.
- **Connection Pooling enhances SSH Client:** Optional optimization layer. SSH client works without it; pooling makes repeated operations faster.
- **MCP Server Setup requires all tools:** Tools must be implemented before they can be registered. But tool implementations only need the SSH and process layers, not the MCP layer.
- **HTTP transport is independent of Stdio transport:** Both require MCP server setup but can be built and deployed independently. Stdio is the priority (Claude Desktop).

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept works with Claude Desktop.

- [ ] SSH config parser -- read `~/.ssh/config` for host resolution
- [ ] SSH client with basic connection management -- connect, execute, disconnect
- [ ] Command security validator with default blacklist -- ship secure
- [ ] Background command execution with UUID tracking -- core differentiator vs blocking execution
- [ ] `execute_command` tool -- run commands on remote hosts
- [ ] `get_command_output` tool with chunking -- read command results
- [ ] `get_command_status` tool -- lightweight completion check
- [ ] `kill_command` tool -- terminate runaway processes
- [ ] `get_security_info` tool -- inspect active security rules
- [ ] `ssh://hosts` resource -- list available SSH targets
- [ ] `ssh_help` prompt -- guide the AI on usage
- [ ] Stdio transport -- Claude Desktop integration
- [ ] Zod schemas for all inputs -- type-safe validation
- [ ] Structured error responses -- parseable failures
- [ ] Environment-based configuration -- all settings via env vars

### Add After Validation (v1.x)

Features to add once core is working and tested with Claude Desktop.

- [ ] `transfer_file` tool (SFTP upload/download) -- add once command execution is solid
- [ ] Connection pooling with TTL -- add when users report latency on multi-step workflows
- [ ] HTTP/Streamable transport -- add when remote access use case is validated
- [ ] Custom blacklist/whitelist patterns via env -- add when users need org-specific security policies
- [ ] Configurable timeouts per operation type -- add when default timeouts prove insufficient

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] SSH key passphrase support -- complex auth flow, most users use ssh-agent
- [ ] Multiple identity file resolution -- edge case, defer until requested
- [ ] Jump host / ProxyJump awareness -- SSH handles this natively via config
- [ ] Structured logging with log levels -- nice for production monitoring
- [ ] Health check endpoint (HTTP transport) -- needed for production deployments

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| execute_command | HIGH | HIGH | P1 |
| get_command_output (chunked) | HIGH | MEDIUM | P1 |
| get_command_status | HIGH | LOW | P1 |
| kill_command | HIGH | MEDIUM | P1 |
| SSH config parser | HIGH | MEDIUM | P1 |
| Security validator (blacklist) | HIGH | MEDIUM | P1 |
| Stdio transport | HIGH | LOW | P1 |
| ssh://hosts resource | MEDIUM | LOW | P1 |
| ssh_help prompt | MEDIUM | LOW | P1 |
| get_security_info | MEDIUM | LOW | P1 |
| Env-based configuration | MEDIUM | LOW | P1 |
| transfer_file (SFTP) | MEDIUM | MEDIUM | P2 |
| Connection pooling | MEDIUM | MEDIUM | P2 |
| HTTP transport | MEDIUM | MEDIUM | P2 |
| Custom security patterns | LOW | LOW | P2 |
| Per-operation timeouts | LOW | LOW | P2 |
| SSH key passphrase support | LOW | MEDIUM | P3 |
| Structured logging | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch -- core SSH execution loop and Claude Desktop integration
- P2: Should have, add when possible -- file transfer, performance, remote access
- P3: Nice to have, future consideration -- edge cases and operational polish

## Competitor Feature Analysis

| Feature | Python mcp_ssh (source) | pathintegral mcp-server-ssh | Generic SSH tools | Our Approach (ssh-exoman) |
|---------|------------------------|----------------------------|-------------------|--------------------------|
| Background execution | Yes, UUID-tracked | Unknown | Typically blocking | Yes, UUID-tracked (port from Python) |
| Output chunking | Yes, byte-offset | Unknown | No | Yes, byte-offset with has_more_output flag |
| Security validation | Yes, 3 modes | Unknown | Rarely | Yes, blacklist/whitelist/disabled |
| Connection pooling | Yes, optional | Unknown | Varies | Yes, with TTL and health checking |
| File transfer | Yes, SFTP | Unknown | Some | Yes, SFTP (P2 priority) |
| SSH config parsing | Yes | Unknown | Some | Yes, standard ~/.ssh/config |
| MCP resources | Yes (hosts) | Unknown | No | Yes, ssh://hosts |
| MCP prompts | Yes (help) | Unknown | No | Yes, ssh_help |
| Multiple transports | Stdio only | Unknown | Varies | Stdio + HTTP (HTTP is P2) |
| Runtime | Python 3.11+ | Unknown | Varies | Bun (faster startup, built-in TS) |

**Note:** Web search was unavailable during this research, so competitor analysis for third-party MCP SSH servers is limited. The primary reference is the Python mcp_ssh source project (107 tests, 87% coverage) which this project rebuilds. The feature set is well-understood from the PRD. Confidence in the feature landscape is HIGH because we are rebuilding a proven product with known requirements.

## Sources

- PRD.md in project root -- comprehensive specification from Python source analysis
- PROJECT.md -- project context, requirements, constraints, and out-of-scope decisions
- Python mcp_ssh source project -- 6 tools, 1 resource, 1 prompt, 107 tests
- MCP TypeScript SDK patterns -- tool/resource/prompt registration APIs
- MCP protocol specification -- tools, resources, prompts, transports

---
*Feature research for: MCP SSH Server*
*Researched: 2026-03-07*
