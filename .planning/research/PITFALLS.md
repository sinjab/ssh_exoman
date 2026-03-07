# Pitfalls Research

**Domain:** MCP SSH Server (TypeScript/Bun rebuild of Python `mcp_ssh`)
**Researched:** 2026-03-07
**Confidence:** HIGH (domain expertise + PRD analysis; LOW on MCP SDK v2 specifics due to pre-alpha status)

## Critical Pitfalls

### Pitfall 1: ssh2 Connection Lifecycle Mismanagement

**What goes wrong:**
The `ssh2` library's `Client` object emits events (`ready`, `error`, `close`, `end`) asynchronously. Developers wrap `connect()` in a Promise but only handle `ready` and `error`, missing `close` and `end` events. This leads to:
- Connections sitting in the pool that are actually dead (half-open TCP sockets)
- Unhandled error events crashing the process (Node.js/Bun treats unhandled `error` events as fatal)
- Connection pool returning stale clients that fail on first command

**Why it happens:**
The ssh2 API is event-driven, not Promise-based. Most examples online show the happy path only. The PRD's connection cache tests health with `echo test`, but the ssh2 client can be in a state where it appears connected but the underlying TCP socket is dead (e.g., remote host rebooted, network partition resolved).

**How to avoid:**
- Always attach `error`, `close`, and `end` listeners on every `Client` instance, even cached ones
- When a cached connection fails health check, destroy it explicitly with `client.end()` AND `client.destroy()` -- `end()` alone does not release the socket immediately
- Implement a connection wrapper class that tracks state (`connecting`, `ready`, `closed`, `error`) and refuses to return clients in non-`ready` state
- Set `keepaliveInterval` and `keepaliveCountMax` in ssh2 connect options to detect dead connections proactively

**Warning signs:**
- Tests pass locally but timeout in CI (different network conditions)
- "ECONNRESET" or "Channel open failure" errors appearing sporadically
- Memory growth over time (leaked socket handles)

**Phase to address:**
Phase 1 (SSH Client Layer) -- connection management must be correct from the start. Retrofitting connection lifecycle handling into a pool is extremely painful.

---

### Pitfall 2: Background Process Tracking Race Conditions

**What goes wrong:**
The background execution model writes PID to stdout via `echo $!`, then later checks process status via `kill -0 PID` and reads output from temp files. Multiple race conditions exist:
1. The `echo $!` command returns before the background process has actually started, giving a PID that may not exist yet
2. Between checking `kill -0` and reading the exit code file, the process can complete and the file can be partially written
3. The `sync` in the wrapper script is not atomic with the exit code write -- a read between `echo $rc > file` and `sync` gets stale data on some filesystems (especially NFS)
4. Two rapid `get_command_output` calls for the same process can read overlapping chunks

**Why it happens:**
Shell background process management is inherently racy. The Python version likely handles this through careful sequencing and retry logic that is easy to miss during a rewrite.

**How to avoid:**
- Use a PID file approach: write PID to a separate file and wait for it to exist before returning from `execute_command`
- For exit code detection, check both `kill -0` failure AND exit code file existence -- do not rely on either alone
- Add a brief delay (100-200ms) after `echo $!` returns before considering the process "started"
- For output chunking, use file size checks (`wc -c`) before reading to avoid partial reads
- Consider using `flock` or atomic rename for exit code file writes: `echo $rc > file.tmp && mv file.tmp file`

**Warning signs:**
- Intermittent "process not found" errors right after `execute_command` returns
- Exit codes reading as empty strings or partial numbers
- Output chunks containing duplicate data

**Phase to address:**
Phase 2 (Background Process Manager) -- this is the most complex component. Get it right before building tools on top of it.

---

### Pitfall 3: Security Validator Bypass via Shell Metacharacters

**What goes wrong:**
The blacklist regex patterns in the PRD match literal command strings, but attackers (or overeager AI assistants) can bypass them trivially:
- `r\m -rf /` (backslash escaping)
- `$(rm -rf /)` (command substitution)
- `echo "" | sudo bash` (pipe to elevated shell)
- `eval "rm -rf /"` (eval execution)
- `base64 -d <<< "cm0gLXJmIC8=" | bash` (encoded commands)
- Variable expansion: `cmd="rm"; $cmd -rf /`
- Newline injection in command strings: `ls\nrm -rf /`

The PRD's blacklist catches direct invocations but misses these evasion techniques.

**Why it happens:**
Regex-based command validation is fundamentally a losing game against shell metacharacter escaping. The Python version likely has the same weakness but it is especially dangerous in a rebuild where the security model might be considered "done" after porting the patterns.

**How to avoid:**
- Layer 1: Normalize commands before validation -- strip backslashes, decode common encodings, expand simple variables
- Layer 2: Block ALL commands containing `eval`, backticks, `$()` substitution, and `base64 ... | bash` patterns in the blacklist by default
- Layer 3: In `whitelist` mode, ONLY allow commands matching the whitelist -- this is already correct in the PRD
- Layer 4: Document clearly that `blacklist` mode is "defense in depth, not a security boundary" -- the real security is SSH key permissions and remote user privileges
- Never claim the blacklist is "secure" -- it reduces accident surface, not attack surface

**Warning signs:**
- Security tests only test the exact patterns from the blacklist, not evasion variants
- No tests for metacharacter bypass attempts
- Users reporting that certain dangerous commands get through

**Phase to address:**
Phase 1 (Security Module) -- the validator must be built with evasion awareness from the start. Add a dedicated test suite of bypass attempts.

---

### Pitfall 4: MCP SDK v2 API Instability

**What goes wrong:**
The PRD references MCP TypeScript SDK v2 which is in pre-alpha as of March 2026. Building against a pre-alpha API means:
- Breaking changes between releases with no migration guide
- APIs that exist in docs but are not yet implemented
- Transport implementations (stdio, HTTP) that change interface
- Zod v4 requirement that may conflict with other ecosystem libraries still on v3

**Why it happens:**
The PRD explicitly notes v2 is pre-alpha and recommends v1.x for production. But developers want to build on the "latest" to avoid future migration.

**How to avoid:**
- Start with MCP SDK v1.x (`@modelcontextprotocol/sdk` on the `v1.x` branch) for the initial build
- Abstract the MCP SDK behind a thin adapter layer so the server logic does not directly depend on SDK internals
- Pin exact SDK versions in `package.json` (no `^` or `~` ranges)
- Only migrate to v2 once it reaches beta/RC status
- If using Zod v4, verify compatibility with the SDK version chosen -- some SDK versions may require Zod v3

**Warning signs:**
- `bun install` pulls a different SDK version than expected
- Tool registration code stops compiling after `bun update`
- Type errors in transport setup code

**Phase to address:**
Phase 1 (Project Setup + MCP Server Skeleton) -- the SDK version decision affects every subsequent phase. Lock it down immediately.

---

### Pitfall 5: stdio Transport Logging Corruption

**What goes wrong:**
When running as a stdio MCP server (Claude Desktop integration), the server communicates over stdin/stdout using JSON-RPC. ANY output to stdout that is not valid JSON-RPC will corrupt the protocol stream and crash the connection. This includes:
- `console.log()` debug output
- Unhandled exception stack traces printed to stdout
- Library warning messages (ssh2 prints warnings to stdout in some error conditions)
- Bun's built-in error formatting going to stdout

**Why it happens:**
Developers test with HTTP transport where stdout logging is fine, then deploy to Claude Desktop via stdio and everything breaks. Or they add a debug `console.log` during development and forget to remove it.

**How to avoid:**
- Route ALL logging to stderr, never stdout -- configure the logger (Pino/custom) with `destination: 2` (fd 2 = stderr)
- Catch ALL unhandled exceptions and rejections globally, log to stderr, and respond with a proper JSON-RPC error
- Replace `console.log` with the structured logger everywhere -- consider banning `console.log` via ESLint rule
- In the stdio entry point, redirect any accidental stdout writes by monkey-patching `process.stdout.write` to throw in development
- Test the stdio transport by piping actual JSON-RPC messages and verifying output is clean JSON-RPC

**Warning signs:**
- Claude Desktop shows "MCP server disconnected" or "invalid JSON" errors
- Server works fine via HTTP but fails via stdio
- Intermittent connection drops that correlate with specific commands (the ones that trigger log output)

**Phase to address:**
Phase 1 (MCP Server Setup) -- the logging architecture must be stderr-only from day one. Every subsequent phase inherits this constraint.

---

### Pitfall 6: SSH Config Parser Edge Cases

**What goes wrong:**
The `~/.ssh/config` parser seems simple but has numerous edge cases that cause silent failures:
- `Match` blocks (conditional config) are complex and rarely handled correctly
- `Include` directives reference other config files that must be resolved
- `ProxyJump` and `ProxyCommand` entries require multi-hop connection logic
- Wildcard host patterns (`Host *.example.com`) match differently than exact names
- `IdentityFile` paths with `~` need expansion, and multiple identity files per host are common
- Config values can be quoted: `User "my user"` or `HostName "weird host.com"`
- The first matching Host block wins for each directive (SSH's override model)

**Why it happens:**
Most SSH config parsers handle the 80% case (simple Host blocks with Hostname/User/Port/IdentityFile). The remaining 20% causes the parser to silently skip hosts or resolve wrong values, leading to connection failures users cannot diagnose.

**How to avoid:**
- Use an existing SSH config parser library if one exists for TypeScript/JS, rather than writing from scratch
- If writing custom: support at minimum `Host`, `HostName`, `User`, `Port`, `IdentityFile`, `Include`, and `ProxyJump`
- Skip `Match` blocks explicitly and log a warning -- do not try to evaluate them
- Test against real-world SSH configs with multiple Host blocks, wildcards, and Include directives
- For unrecognized directives, store them as raw key-value pairs for potential future use

**Warning signs:**
- Users report "host not found" for hosts that exist in their SSH config
- Connections use wrong port or username
- Tests only use simple configs with one Host block

**Phase to address:**
Phase 1 (SSH Client Layer) -- the config parser feeds into every connection. If it silently drops hosts, all downstream features break.

---

### Pitfall 7: Temp File Cleanup Failures Leading to Disk Exhaustion

**What goes wrong:**
Background processes create output/error/exit files in `/tmp`. If the MCP server crashes, is killed, or loses connection to the remote host, these files are never cleaned up. Over time:
- Remote hosts accumulate thousands of `mcp_ssh_*` files in `/tmp`
- `/tmp` fills up, breaking other system services
- Stale process tracking entries reference files that no longer exist (cleaned by system tmpwatch/tmpreaper)

**Why it happens:**
Cleanup is tied to the `kill_command` tool or explicit cleanup. But many processes complete without the AI assistant ever calling `kill_command`. Server crashes leave no cleanup path.

**How to avoid:**
- Implement a periodic cleanup sweep that runs every N minutes, removing files older than a configurable TTL (default: 1 hour)
- Use the remote system's `/tmp` with a subdirectory (`/tmp/mcp_ssh/`) that can be cleaned atomically
- On server startup, scan for and clean orphaned files from previous sessions
- When `get_command_output` detects a completed process, automatically clean up after delivering the final output
- Add a `cleanup_ttl` configuration option so users can tune retention
- Log cleanup events so users can audit temp file management

**Warning signs:**
- `ls /tmp/mcp_ssh_*` on remote hosts shows hundreds of old files
- Disk space alerts on remote hosts
- "No space left on device" errors when starting new background processes

**Phase to address:**
Phase 2 (Background Process Manager) -- cleanup must be part of the process lifecycle, not an afterthought.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline ssh2 calls in tool handlers | Faster initial development | Connection management scattered everywhere, impossible to swap SSH library | Never -- always go through a client abstraction layer |
| Synchronous SSH config parsing at request time | No caching complexity | Re-parses config file on every connection, slow with large configs | MVP only, add caching before release |
| Hardcoded `/tmp` for remote temp files | Works on most Linux hosts | Fails on macOS remotes (`/tmp` is per-user), Windows via WSL, custom tmpdir configs | Never -- make it configurable per-host |
| Single connection per host (no pooling) | Simpler connection management | Serial command execution, slow for rapid sequential commands | MVP only, pool before any real usage |
| `console.log` for logging | Zero setup | Breaks stdio transport, no log levels, no structured output | Never -- use structured logger from day one |
| Skipping Zod validation on responses | Slightly faster responses | Silently returns malformed data that confuses AI clients | Never -- validate both inputs and outputs |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ssh2 `exec()` | Not handling the `stderr` stream separately from `stdout` -- data events mix | Always attach separate `data` handlers to both `stdout` and `stderr` streams from the `Channel` object |
| ssh2 SFTP | Using `fastGet`/`fastPut` which use parallel reads/writes and can overwhelm slow connections | Use `createReadStream`/`createWriteStream` for large files with configurable highWaterMark; `fastGet`/`fastPut` for small files |
| Claude Desktop stdio | Sending `Content-Type` headers or HTTP-style responses on stdout | stdio transport is raw JSON-RPC over newline-delimited JSON, not HTTP |
| MCP SDK tool registration | Returning plain strings instead of `CallToolResult` with `content` array | Always return `{ content: [{ type: "text", text: JSON.stringify(result) }] }` |
| ssh2 key loading | Using `fs.readFileSync` for key files | Use `Bun.file().text()` per project conventions; also handle encrypted keys by catching the "encrypted" error and prompting for passphrase |
| Bun + ssh2 native modules | Assuming ssh2 works identically under Bun as Node.js | ssh2 has optional native crypto bindings (`cpu-features`, `nan`). Test early that ssh2 works under Bun. If native bindings fail, ssh2 falls back to pure JS crypto (slower but functional) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-parsing SSH config on every tool call | Noticeable latency (50-200ms) per command | Parse once at startup, cache in memory, watch file for changes with `fs.watch` | Immediately noticeable with fast-firing AI assistants |
| Creating new SSH connections per command | 1-3 second connection overhead per tool call, AI assistant appears slow | Connection pooling with health checks and TTL-based expiry | At any scale -- SSH handshake is inherently slow |
| Reading entire command output into memory | Server OOM on large outputs (e.g., `find /` or log tailing) | Stream-based output with chunking, enforce `maxOutputSize` limit server-side | When output exceeds ~50MB |
| Health-checking cached connections with `echo test` | Adds 100-500ms latency on every cached connection use | Use ssh2's keepalive mechanism instead of active health checks; only health-check on error | When connection pool is heavily used |
| Regex-compiling blacklist patterns on every validation call | CPU spike on rapid command submissions | Compile patterns once at startup, store as `RegExp` instances | At ~100+ commands/minute |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full commands including passwords or secrets | Credentials in log files: `mysql -p'secret123'` appears in logs | Truncate or redact command strings in logs; never log full commands at INFO level |
| Storing SSH key passphrases in environment variables as plaintext | Passphrase visible in process listing (`/proc/PID/environ`), Bun's `.env` files | Document that passphrases should use SSH agent instead; warn if `SSH_KEY_PHRASE` is set |
| Not validating `host` parameter against SSH config | Attackers can specify arbitrary hostnames like `evil.com` not in SSH config | Only allow connections to hosts present in `~/.ssh/config`; reject arbitrary hostnames |
| Allowing path traversal in `transfer_file` local paths | AI assistant can read/write arbitrary local files: `../../etc/shadow` | Validate and resolve local paths; consider a configurable allowed directory for transfers |
| Exposing raw SSH error messages to AI clients | Error messages may contain internal hostnames, usernames, key paths | Sanitize error messages before returning; log full errors to stderr only |
| Not rate-limiting tool calls | AI assistant in a loop can execute thousands of commands | Add configurable rate limits per host and globally |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cryptic error messages like "SSH2 Error: Channel open failure" | Users cannot diagnose whether it is a config, auth, or network problem | Map ssh2 error codes to human-readable messages: "Could not connect to host 'X' -- check that the host is reachable and your SSH key is valid" |
| No indication of which SSH config file was loaded | Users with multiple SSH configs do not know why hosts are missing | Log the config file path at startup; include it in `get_security_info` response |
| `execute_command` returns partial output with `has_more_output: true` but no guidance | AI assistant does not know to call `get_command_output` to get the rest | Include a hint in the response: "Use get_command_output with process_id 'X' and start_byte Y to retrieve remaining output" |
| Silent failure when SSH key has wrong permissions | ssh2 connects but auth fails with unhelpful "All configured authentication methods failed" | Check key file permissions (should be 600) before attempting connection; include specific fix in error message |

## "Looks Done But Isn't" Checklist

- [ ] **Connection pooling:** Often missing TTL-based expiry -- verify connections are evicted after configurable timeout, not just on error
- [ ] **Background processes:** Often missing orphan cleanup -- verify server handles restart/crash recovery for temp files
- [ ] **Security validator:** Often missing metacharacter bypass tests -- verify `$(rm -rf /)`, backtick variants, and base64 pipe bypass are all blocked
- [ ] **SSH config parser:** Often missing `Include` directive support -- verify configs with `Include ~/.ssh/config.d/*` are resolved
- [ ] **stdio transport:** Often missing stdout purity -- verify NO non-JSON-RPC output appears on stdout under any error condition
- [ ] **File transfer:** Often missing large file handling -- verify transfers of 100MB+ files do not OOM the server
- [ ] **Error handling:** Often missing timeout cleanup -- verify that timed-out commands still get their temp files cleaned up
- [ ] **Kill command:** Often missing SIGKILL fallback verification -- verify that `kill -9` is actually sent after SIGTERM grace period
- [ ] **Zod schemas:** Often missing output validation -- verify responses are validated, not just inputs
- [ ] **Logging:** Often missing correlation IDs -- verify that log entries for a single tool call can be traced together

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Connection pool corruption | LOW | Restart server; connections are ephemeral. Add pool reset endpoint for runtime recovery |
| Temp file disk exhaustion | MEDIUM | SSH into affected hosts and `rm /tmp/mcp_ssh_*`; add automated cleanup to prevent recurrence |
| Security bypass discovered | HIGH | Immediately switch to `whitelist` mode; audit command logs for malicious activity; patch validator and re-deploy |
| stdio transport corruption | LOW | Restart Claude Desktop; fix the offending `console.log`; add stdout purity test to CI |
| SSH config parser bug | MEDIUM | Identify affected hosts; add them as explicit environment variable overrides until parser is fixed |
| MCP SDK breaking change | MEDIUM | Pin to last working version; read changelog; adapt adapter layer. This is why the abstraction layer matters |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ssh2 connection lifecycle | Phase 1: SSH Client Layer | Unit tests for error/close/end events; integration test with dropped connection |
| Background process race conditions | Phase 2: Process Manager | Tests with rapid sequential execute/status/output calls; test with slow-starting commands |
| Security validator bypass | Phase 1: Security Module | Dedicated bypass test suite with 20+ evasion patterns |
| MCP SDK instability | Phase 1: Project Setup | Pin exact version; verify tools register and respond correctly; add SDK version to startup log |
| stdio transport logging | Phase 1: MCP Server Setup | CI test that pipes JSON-RPC to server and verifies stdout is clean JSON-RPC only |
| SSH config parser edge cases | Phase 1: SSH Client Layer | Test suite with real-world SSH configs (Include, wildcards, multiple IdentityFiles) |
| Temp file cleanup | Phase 2: Process Manager | Test that simulates server crash and verifies cleanup on restart |
| Bun + ssh2 compatibility | Phase 1: Project Setup | Smoke test that ssh2 connects under Bun runtime; document any workarounds needed |

## Sources

- ssh2 library documentation and known issues (npm package `ssh2`, maintained by mscdex)
- MCP TypeScript SDK repository: https://github.com/modelcontextprotocol/typescript-sdk
- Project PRD.md analysis (detailed review of proposed architecture, security patterns, and background execution strategy)
- OpenSSH config specification (`man ssh_config`) for parser edge cases
- Domain expertise in SSH connection management, shell escaping, and process lifecycle patterns

---
*Pitfalls research for: MCP SSH Server (TypeScript/Bun)*
*Researched: 2026-03-07*
