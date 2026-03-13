# Pitfalls Research: SSH Agent Forwarding

**Domain:** SSH Agent Forwarding for ssh-exoman MCP Server
**Researched:** 2026-03-13
**Confidence:** HIGH (OpenSSH official documentation, ssh2 library docs, established security practices)

## Critical Pitfalls

### Pitfall 1: Socket Hijacking by Root Users

**What goes wrong:**
When agent forwarding is enabled, a Unix domain socket is created on the remote server (typically `/tmp/ssh-XXXXXXXXXX/agent.XXXXX`). Any user with root access on the remote host can:
1. Access the socket file
2. Use your forwarded agent to authenticate to any other server you have access to
3. Pivot through your infrastructure without your knowledge

**Why it happens:**
The SSH agent protocol allows anyone who can access the socket to request signatures. Root users can access any file on the system, including the forwarded agent socket. The private keys never leave your local machine, but the *ability to use them* is exposed.

**How to avoid:**
- Document prominently: "Only use agent forwarding on hosts where you trust the root user"
- Add a `forwardAgentTrustedHosts` allowlist configuration option
- Log a warning every time agent forwarding is used: "Agent forwarding enabled - ensure host is trusted"
- Consider requiring explicit acknowledgment per-session for agent forwarding

**Warning signs:**
- Agent forwarding enabled on public/shared/CI servers
- No documentation about trusted host requirement
- Users unaware that root can hijack their keys

**Phase to address:**
Phase 1 (Agent Forwarding Implementation) - Security documentation and trust model must be defined before any code is written.

---

### Pitfall 2: Agent Forwarding Enabled by Default

**What goes wrong:**
If `forwardAgent` defaults to `true` or is enabled globally, every SSH connection will expose the agent socket. This violates the principle of least privilege and expands the attack surface unnecessarily.

**Why it happens:**
Developers often prioritize convenience over security. The ssh2 library's `agentForward: false` default is correct, but it is easy to flip when things "don't work."

**How to avoid:**
- `forwardAgent` parameter MUST default to `false` on `execute_command`
- Never read `ForwardAgent yes` from `~/.ssh/config` (explicitly out of scope per PROJECT.md)
- Require explicit opt-in per command: `execute_command(host, command, { forwardAgent: true })`
- Log every use of agent forwarding for audit purposes

**Warning signs:**
- Parameter defaults to `true`
- Config file `ForwardAgent` settings are respected automatically
- No audit log when agent forwarding is used

**Phase to address:**
Phase 1 (Agent Forwarding Implementation) - Default behavior is the foundation of the feature.

---

### Pitfall 3: Agent Socket Left After Connection Close

**What goes wrong:**
If the SSH connection is terminated abnormally (crash, timeout, kill), the forwarded agent socket on the remote server may not be cleaned up. This leaves the authentication capability exposed even after you intended to stop forwarding.

**Why it happens:**
The ssh2 library's connection cleanup may not always execute if the process crashes. The remote sshd will eventually clean up the socket, but there is a window of vulnerability.

**How to avoid:**
- Always call `client.end()` in a `finally` block or cleanup handler
- Set a short `ChannelTimeout` for agent connections (OpenSSH supports this)
- Document that users should verify socket cleanup after abnormal termination
- Consider implementing a "socket cleanup" command users can run

**Warning signs:**
- Abandoned sockets in `/tmp/ssh-*` directories on remote hosts
- Long-lived connections with agent forwarding enabled
- No cleanup handling for abnormal termination scenarios

**Phase to address:**
Phase 1 (Agent Forwarding Implementation) - Connection lifecycle management is critical.

---

### Pitfall 4: Missing Agent on Local Machine

**What goes wrong:**
If `forwardAgent: true` is requested but no SSH agent is running locally (or `SSH_AUTH_SOCK` is not set), the connection will fail with a cryptic error. Users will not understand why "it works from my terminal but not from the MCP server."

**Why it happens:**
The MCP server runs as a subprocess of Claude Desktop, which may not have the SSH agent environment variables propagated. This is especially common on macOS where the agent is started by the keychain integration.

**How to avoid:**
- Before attempting agent forwarding, verify `process.env.SSH_AUTH_SOCK` exists
- If missing, return a clear error: "Agent forwarding requested but no SSH agent detected. Ensure SSH_AUTH_SOCK environment variable is set and ssh-agent is running."
- Document how to verify agent availability: `ssh-add -l`
- Support explicit agent socket path via configuration as a fallback

**Warning signs:**
- "No such file or directory" errors when enabling agent forwarding
- Agent forwarding works interactively but fails from MCP
- No pre-flight check for agent availability

**Phase to address:**
Phase 1 (Agent Forwarding Implementation) - User experience depends on clear error messages.

---

### Pitfall 5: Forwarding to Unreachable Second Hop

**What goes wrong:**
Agent forwarding is typically used for multi-hop SSH connections. If the second-hop host is unreachable, the error message comes from the first-hop server and can be confusing. Users blame the MCP server rather than network/host issues.

**Why it happens:**
The MCP server only controls the first connection. Errors from commands executed on the first host (like `ssh second-hop`) are just command output, not structured SSH errors.

**How to avoid:**
- Document common error patterns and their meanings:
  - "ssh: connect to host X port 22: Connection refused" = second host unreachable
  - "Permission denied (publickey)" = key not authorized on second host
  - "Could not resolve hostname" = DNS issue
- Do not attempt to parse command output to infer SSH errors
- Encourage users to test multi-hop manually before using via MCP

**Warning signs:**
- Bug reports about "SSH failing" that are actually second-hop issues
- Attempts to handle nested SSH errors in MCP code
- No documentation about multi-hop troubleshooting

**Phase to address:**
Phase 2 (Documentation) - User guidance is the solution, not code changes.

---

### Pitfall 6: Agent Forwarding with Connection Pooling

**What goes wrong:**
The existing ssh-exoman architecture may eventually add connection pooling. If agent forwarding is enabled on a pooled connection, all subsequent commands on that connection will have agent access, even if they did not request it.

**Why it happens:**
Agent forwarding is a connection-level setting in ssh2 (`agentForward: true` in connect config). Once enabled, it persists for the life of the connection.

**How to avoid:**
- If connection pooling is implemented, connections with agent forwarding MUST be pooled separately from non-forwarding connections
- Tag pooled connections: `{ agentForwarding: boolean }`
- When `execute_command` requests agent forwarding, only use a connection from the "forwarding" pool (or create a new one)
- Document that agent-forwarding connections have different pooling behavior

**Warning signs:**
- Connection pooling implementation ignores agent forwarding state
- Agent forwarding "leaks" to commands that did not request it
- No distinction in pool between forwarded and non-forwarded connections

**Phase to address:**
Phase 2 or later (Connection Pooling) - This is a future consideration, but architecture should anticipate it.

---

### Pitfall 7: Confusing `agent` vs `agentForward` in ssh2

**What goes wrong:**
The ssh2 library has two related but different options:
- `agent`: Path to the local SSH agent socket (for authentication TO the first host)
- `agentForward`: Boolean to forward the agent TO the remote host (for authentication FROM the remote host)

Mixing these up causes either authentication failures or unintended agent exposure.

**Why it happens:**
The naming is similar and the concepts are related. Developers see "agent" and assume it handles forwarding.

**How to avoid:**
- Use clear variable names in code: `localAgentSocket` vs `enableAgentForwarding`
- Add code comments explaining the difference
- In the Zod schema for `execute_command`, use `forwardAgent` (matching OpenSSH terminology) not `agentForward`
- Document the difference in code comments and user documentation

**Warning signs:**
- `agent` option used when `agentForward` was intended
- Authentication works but forwarding does not
- Code reviews flagging "agent" usage as potentially wrong

**Phase to address:**
Phase 1 (Agent Forwarding Implementation) - Correct API design prevents confusion.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Default `forwardAgent: true` | Users don't have to think about it | Every connection exposes agent, major security risk | Never |
| Respect SSH config `ForwardAgent` | Matches user's existing config | Implicit security exposure, hard to audit | Never (explicitly out of scope) |
| Skip agent availability check | Simpler code path | Cryptic runtime errors | Never |
| Single pool for all connections | Simpler pooling implementation | Agent forwarding leaks to non-forwarding commands | Never if pooling is implemented |
| No audit logging of agent forwarding | Less log noise | No forensic trail of who used forwarding when | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ssh2 `connect()` | Setting `agentForward: true` without `agent` option | Both must be set: `agent: process.env.SSH_AUTH_SOCK, agentForward: true` |
| ssh2 `exec()` | Expecting different auth behavior for forwarded commands | The exec command is just a shell command; if it uses SSH, it uses the forwarded agent transparently |
| Claude Desktop env | Assuming `SSH_AUTH_SOCK` is inherited from user shell | Verify in startup log; may need to configure Claude Desktop to pass through env vars |
| macOS Keychain | Assuming ssh-agent is always available | On macOS, the agent may be Keychain-integrated; test that `ssh-add -l` works before assuming forwarding will work |
| Windows Pageant | Using `agentForward` without `agent: 'pageant'` | On Windows, must explicitly set `agent: 'pageant'` for agent access |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Agent confirmation prompts blocking | Commands hang indefinitely if `ssh-add -c` was used | Warn users not to use confirmation-required keys with automated systems; timeout agent operations | Immediately if confirmation keys are used |
| Agent socket under load | Multiple concurrent forwarded commands slow down | The agent socket is single-threaded; limit concurrent agent-using commands | At ~10+ concurrent forwarded commands |
| Agent timeout mid-operation | Long-running commands lose auth mid-execution | Use keys with no timeout, or set long `ssh-add -t` duration; document that agent timeout breaks long commands | Commands running longer than agent timeout |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Enabling on shared/bastion hosts | Other users (or compromised accounts) can access socket | Document trusted host requirement; consider host allowlist |
| No audit trail | Cannot determine post-incident which commands used agent forwarding | Log every `forwardAgent: true` invocation with timestamp, host, user |
| Ignoring socket permissions | Socket may be world-readable on misconfigured systems | Document that socket permissions are managed by sshd; warn if detection is possible |
| Forwarding to compromised host | Attacker gains ability to pivot through infrastructure | This is inherent to agent forwarding; document as accepted risk for trusted hosts only |
| Long-lived forwarded connections | Extended window for socket hijacking | Prefer short-lived connections when agent forwarding; document risk of long sessions |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "No agent found" with no guidance | User doesn't know how to start agent | Error message: "SSH agent not detected. Run `eval $(ssh-agent)` and `ssh-add` or verify SSH_AUTH_SOCK environment variable." |
| Silent failure when agent times out | Command fails mysteriously mid-execution | If possible, detect agent timeout and report; otherwise document this failure mode |
| Confusing second-hop errors | User blames MCP server for network issues | Document: "Errors from nested SSH commands appear as command output, not MCP errors. Test multi-hop SSH manually first." |
| No indication when forwarding is active | User forgets agent is exposed | Log "Agent forwarding enabled for this connection" prominently; include in command status if possible |

## "Looks Done But Isn't" Checklist

- [ ] **Agent availability check:** Often missing -- verify code checks `SSH_AUTH_SOCK` before attempting forwarding
- [ ] **Default value:** Often wrong -- verify `forwardAgent` defaults to `false` with explicit test
- [ ] **Audit logging:** Often missing -- verify every `forwardAgent: true` is logged with context
- [ ] **Error messages:** Often cryptic -- verify "no agent" error is actionable and clear
- [ ] **Documentation:** Often incomplete -- verify trusted host requirement is prominently documented
- [ ] **Connection cleanup:** Often missing -- verify agent socket cleanup on connection close/abort
- [ ] **Config file respect:** Often accidentally implemented -- verify `~/.ssh/config` ForwardAgent is NOT read

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agent used on compromised host | HIGH | Immediately remove compromised host from trust; rotate all keys that were in agent; audit access logs for unauthorized use |
| Socket left after crash | LOW | SSH to host and remove `/tmp/ssh-*` directory; or wait for sshd cleanup (typically 10-60 seconds) |
| Agent forwarding enabled by default | MEDIUM | Change default, release new version; communicate security advisory for previous behavior |
| Pooling leaks agent access | HIGH | Flush all connection pools; implement separate pooling; audit for unauthorized access |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Socket hijacking awareness | Phase 1: Implementation + Documentation | Security documentation reviewed; warning logged on every use |
| Default to false | Phase 1: Implementation | Explicit test that `execute_command` without `forwardAgent` does not forward |
| Agent availability check | Phase 1: Implementation | Test with unset `SSH_AUTH_SOCK` returns clear error |
| Connection lifecycle | Phase 1: Implementation | Test abnormal termination; verify cleanup |
| Agent vs agentForward confusion | Phase 1: Implementation | Code review; clear variable naming |
| Connection pooling interaction | Future: Connection Pooling Phase | When pooling is implemented, verify separate pools for forwarded/non-forwarded |

## Sources

- OpenBSD ssh_config(5) manual page - Official documentation for ForwardAgent with security warning
  - https://man.openbsd.org/ssh_config.5 (HIGH confidence)
  - Excerpt: "Agent forwarding should be enabled with caution. Users with the ability to bypass file permissions on the remote host (for the agent's Unix-domain socket) can access the local agent through the forwarded connection."
- ssh2 npm package documentation - Implementation details for `agent` and `agentForward` options
  - https://github.com/mscdex/ssh2 (HIGH confidence)
  - `agentForward: true` requires `agent` to also be set
- PROJECT.md - Project context (explicitly out of scope: SSH config ForwardAgent parsing)
- Existing PITFALLS.md - Base project pitfalls to extend, not replace
- Domain expertise in SSH agent protocol and security implications

---
*Pitfalls research for: SSH Agent Forwarding (ssh-exoman v2.0)*
*Researched: 2026-03-13*
