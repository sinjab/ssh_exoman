---
phase: 03-mcp-server-integration
plan: "02"
subsystem: mcp-server
tags: [mcp, resource, prompt, ssh-config, help]
dependency_graph:
  requires:
    - 03-01 (MCP server with tools)
  provides:
    - ssh://hosts resource for host discovery
    - ssh_help prompt for usage guidance
  affects: []
tech_stack:
  added:
    - "@modelcontextprotocol/sdk server resources and prompts"
  patterns:
    - "MCP resource registration pattern"
    - "MCP prompt registration pattern"
key_files:
  created:
    - src/resources/hosts.ts
    - src/resources/hosts.test.ts
    - src/prompts/help.ts
    - src/prompts/help.test.ts
  modified:
    - src/server.ts
    - src/server.test.ts
decisions:
  - "[03-02] Resource returns only host aliases (JSON array), not full config details"
  - "[03-02] Prompt content includes all 5 tools with workflow example"
  - "[03-02] Resource uses existing listHosts() which filters wildcards"
metrics:
  duration: 6m
  tasks_completed: 3
  files_modified: 6
  tests_added: 10
---

# Phase 03 Plan 02: MCP Resource and Prompt Summary

## One-liner

Added MCP resource (ssh://hosts) and prompt (ssh_help) to complete the MCP server with host discovery and usage guidance.

## What was done

### Task 1: Create ssh://hosts resource handler

Created `src/resources/hosts.ts` that registers an MCP resource at `ssh://hosts` returning a JSON array of configured SSH host aliases from `~/.ssh/config`. The resource uses the existing `listHosts()` function from `config-parser.ts` which automatically filters out wildcard patterns.

**Tests:** 5 tests verifying registration URI, metadata, response structure, and wildcard filtering.

### Task 2: Create ssh_help prompt handler

Created `src/prompts/help.ts` that registers an MCP prompt named `ssh_help` providing structured guidance for using the SSH tools. The prompt includes:
- All 5 tools with descriptions and parameters
- Typical workflow example (execute -> status -> output -> kill)
- Error handling guidance
- Reference to the ssh://hosts resource

**Tests:** 5 tests verifying prompt name, message structure, tool names, workflow content, and metadata.

### Task 3: Update server to register resource and prompt

Updated `src/server.ts` to import and call `registerHostsResource()` and `registerHelpPrompt()` during server creation. The log message now includes resources and prompts in addition to tools.

**Tests:** Added 3 new tests for resource/prompt integration, verifying imports and server creation.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All tests pass (252 total):
```
bun test
```

Resource returns JSON array:
```typescript
// ssh://hosts returns:
["host1", "host2", "host3"]
```

Prompt returns structured guidance with all 5 tools documented.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/resources/hosts.ts` | Created | MCP resource handler for ssh://hosts |
| `src/resources/hosts.test.ts` | Created | Tests for hosts resource |
| `src/prompts/help.ts` | Created | MCP prompt handler for ssh_help |
| `src/prompts/help.test.ts` | Created | Tests for help prompt |
| `src/server.ts` | Modified | Added resource and prompt registration |
| `src/server.test.ts` | Modified | Added integration tests |

## Commits

- `f095d0a` test(03-02): add failing tests for ssh://hosts resource handler
- `de7f467` feat(03-02): implement ssh_help prompt handler
- `5e77ef7` feat(03-02): register resource and prompt in server

## Next Steps

Per user_setup in plan, end-to-end testing requires Claude Desktop configuration:
1. Add MCP server to Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Restart Claude Desktop
3. Verify Claude can read ssh://hosts resource
4. Verify Claude can access ssh_help prompt

## Self-Check: PASSED

All files and commits verified:
- Created files: hosts.ts, hosts.test.ts, help.ts, help.test.ts
- Summary file: 03-02-SUMMARY.md
- Commits: f095d0a, de7f467, 5e77ef7
