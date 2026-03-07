# Roadmap: ssh-exoman

## Overview

This roadmap delivers a working MCP SSH server in three phases following bottom-up dependency order: foundation services first (config, security, logging, process tracking), then the SSH execution layer built on those services, then MCP protocol integration that wires everything together into a stdio-connected server for Claude Desktop. Each phase delivers independently testable modules. The v1 goal is a working stdio MCP server that Claude Desktop can use to securely execute and manage SSH commands on remote hosts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation Services** - Config, security validator, process tracker, logging, error types, and Zod schemas
- [ ] **Phase 2: SSH Execution Layer** - SSH config parsing, connection management, and background command execution
- [ ] **Phase 3: MCP Server Integration** - Tool handlers, resource, prompt, stdio transport, and end-to-end Claude Desktop integration

## Phase Details

### Phase 1: Foundation Services
**Goal**: All core service modules exist and are independently testable with zero external dependencies -- security validation, process lifecycle tracking, structured logging, configuration, error handling, and input schemas
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, INFRA-01, INFRA-02, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):
  1. Security validator correctly blocks commands matching default blacklist patterns and passes safe commands, in all three modes (blacklist/whitelist/disabled)
  2. User can inspect the current security configuration (mode, pattern count, sample patterns) via a callable function
  3. Structured log messages are written to stderr (never stdout) with timestamp, level, and context fields
  4. All tool input shapes are defined as Zod schemas and all service functions return structured responses with success/error_message shape
  5. All settings (security mode, timeouts, log level) are loadable from environment variables
**Plans**: 4 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md — Types & Errors Foundation (Result type, ErrorCode enum, shared types)
- [x] 01-02-PLAN.md — Configuration Module (env var loading, defaults, validation)
- [x] 01-03-PLAN.md — Structured Logger (JSON to stderr, log levels, convenience methods)
- [x] 01-04-PLAN.md — Security Validator & Schemas (command validation, Zod schemas, barrel exports)

### Phase 2: SSH Execution Layer
**Goal**: Commands can be executed on remote SSH hosts with background process tracking, output retrieval, status checking, and process termination -- all using ~/.ssh/config for host resolution
**Depends on**: Phase 1
**Requirements**: SSH-01, SSH-02, SSH-03, EXEC-01, EXEC-02, EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. Server resolves host aliases from ~/.ssh/config (Host, HostName, User, Port, IdentityFile) and connects to remote hosts with configurable timeout
  2. A command executed in background returns a UUID immediately, and the process runs to completion on the remote host
  3. User can retrieve command output in chunks using byte-offset pagination, and can check command status (running/completed/exit code) without fetching output
  4. User can kill a running background process, with SIGTERM followed by SIGKILL escalation if the process does not exit
  5. Server correctly distinguishes simple vs complex commands and routes execution accordingly (direct exec vs shell wrapper)
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 02-01-PLAN.md — SSH Config Parser & Command Detection (host resolution, complexity detection, shell wrapping)
- [ ] 02-02-PLAN.md — Process Manager (background tracking, output persistence, status/kill operations)
- [ ] 02-03-PLAN.md — SSH Client & Executor (connection management, execution orchestration)

### Phase 3: MCP Server Integration
**Goal**: A complete, working MCP server that Claude Desktop can connect to via stdio, exposing all SSH tools, the hosts resource, and the help prompt
**Depends on**: Phase 2
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. Server starts via stdio transport and Claude Desktop can discover and call all tools (execute_command, get_command_output, get_command_status, kill_command, get_security_info)
  2. Claude Desktop can read the ssh://hosts resource and see a list of configured SSH hosts from ~/.ssh/config
  3. Claude Desktop can access the ssh_help prompt and receive structured usage guidance for all available tools
  4. End-to-end workflow works: execute a command on a remote host, check its status, retrieve its output, all through Claude Desktop
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Services | 4/4 | Complete | 01-01, 01-02, 01-03, 01-04 |
| 2. SSH Execution Layer | 0/3 | Not started | - |
| 3. MCP Server Integration | 0/? | Not started | - |
