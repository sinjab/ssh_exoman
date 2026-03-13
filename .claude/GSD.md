# GSD Workflow

> **MANDATORY**: This project follows the GSD (Get Shit Done) development system. All development work MUST use GSD commands.

## Core Flow

```
discuss → plan → execute → verify → repeat
```

| Stage | Command | What It Does |
|-------|---------|--------------|
| 1. Discuss | `/gsd:discuss-phase [N]` | Capture implementation decisions before planning |
| 2. Plan | `/gsd:plan-phase [N]` | Research + create atomic task plans + verify |
| 3. Execute | `/gsd:execute-phase <N>` | Run plans in parallel waves, atomic commits |
| 4. Verify | `/gsd:verify-work [N]` | User acceptance testing |

## Navigation

| Command | When to Use |
|---------|-------------|
| `/gsd:progress` | **Start here** - Check status and route to next action |
| `/gsd:help` | Show all commands and usage guide |

## Quick Mode

For ad-hoc tasks (bug fixes, small features, config changes):

```
/gsd:quick
```

Gives GSD guarantees (atomic commits, state tracking) with faster path.

## Utilities

| Command | What It Does |
|---------|-------------|
| `/gsd:debug [desc]` | Systematic debugging with persistent state |
| `/gsd:add-todo [desc]` | Capture idea for later |
| `/gsd:check-todos` | List pending todos |
| `/gsd:pause-work` | Create handoff when stopping mid-phase |
| `/gsd:resume-work` | Restore from last session |

## Milestone Commands

| Command | What It Does |
|---------|-------------|
| `/gsd:complete-milestone` | Archive milestone, tag release |
| `/gsd:new-milestone` | Start next version cycle |

## Decision Guide

- **Where am I?** → `/gsd:progress`
- **Bug to fix** → `/gsd:debug` or `/gsd:quick`
- **Feature to build** → `/gsd:discuss-phase` → `/gsd:plan-phase` → `/gsd:execute-phase` → `/gsd:verify-work`
- **Small task** → `/gsd:quick`
- **Stopping work** → `/gsd:pause-work`
- **Resuming work** → `/gsd:resume-work`
