# Phase 4: Core Agent Forwarding - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add SSH agent forwarding capability to `execute_command` tool so remote commands can authenticate with other SSH servers using the user's local SSH keys. Private keys never leave the local machine - only signing requests are forwarded over the encrypted SSH channel.

**In scope:**
- `forwardAgent` parameter on execute_command
- Agent socket detection and validation
- Error handling for unavailable agent
- Observability: agent status in get_security_info, forwardAgent flag in process metadata

**Out of scope:**
- SSH config `ForwardAgent` parsing (explicit parameter-only control per PROJECT.md)
- Global forwarding defaults or environment variable toggles
- Session-level forwarding state

</domain>

<decisions>
## Implementation Decisions

### Error Handling
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

</decisions>

<specifics>
## Specific Ideas

- Follow existing Result<T> error handling pattern from v1.0
- Follow existing ErrorCode enum pattern in src/errors.ts
- Follow existing ProcessInfo pattern for metadata storage
- Error message should guide users to fix the issue, not just report failure

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/errors.ts`: ErrorCode enum and errorResult() function - add new error code here
- `src/schemas/execute-command.ts`: ExecuteCommandSchema - add forwardAgent field here
- `src/ssh/client.ts`: connect() function - extend to accept forwardAgent option
- `src/ssh/executor.ts`: executeSSHCommand() - pass forwardAgent through to connect()
- `src/ssh/process-manager.ts`: ProcessInfo interface - add forwardAgent field
- `src/tools/security-info.ts`: getSecurityInfo tool - add agent availability info

### Established Patterns
- Result<T> pattern for all service functions
- Per-host env var resolution pattern (SSH_PASSPHRASE_{HOST}) - can inspire SSH_AUTH_SOCK handling
- Zod schemas for MCP tool inputs
- ErrorCode enum with descriptive constants

### Integration Points
- execute_command tool (src/tools/execute.ts) - receives forwardAgent parameter
- get_security_info tool (src/tools/security-info.ts) - reports agent availability
- get_command_status tool (src/tools/status.ts) - shows forwardAgent in response
- ProcessInfo (src/types.ts and src/ssh/process-manager.ts) - stores forwardAgent flag

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. SSH config ForwardAgent parsing is explicitly out of scope per PROJECT.md, not deferred from this phase.

</deferred>

---

*Phase: 04-core-agent-forwarding*
*Context gathered: 2026-03-13*
