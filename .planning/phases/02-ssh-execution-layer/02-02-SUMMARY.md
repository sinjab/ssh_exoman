---
phase: 02-ssh-execution-layer
plan: 02
subsystem: ssh-execution
tags: [process-manager, uuid-tracking, temp-files, kill-escalation, chunked-output]

# Dependency graph
requires:
  - phase: 01-foundation-services
    provides: Result<T> type, ErrorCode enum, errorResult helper, ProcessStatus type
provides:
  - ProcessManager class for background process tracking with UUID
  - Temp file persistence for output retrieval after completion
  - Chunked byte-offset output reading with pagination
  - Kill escalation: SIGTERM -> 5s wait -> SIGKILL
  - ProcessInfo interface for process metadata
affects: [02-03, mcp-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Hybrid streaming + temp file persistence for output
    - UUID-based process tracking with Map storage
    - SIGTERM/SIGKILL escalation pattern (5 second timeout)
    - Bun.file().slice() for async chunked file reading

key-files:
  created:
    - src/ssh/process-manager.ts
    - src/ssh/process-manager.test.ts
  modified:
    - src/types.ts
    - src/types.test.ts
    - src/ssh/index.ts
    - src/index.ts

key-decisions:
  - "Hybrid approach: stream output during execution AND persist to temp file"
  - "Default chunk size: 4KB for pagination"
  - "SIGTERM, wait 5 seconds, then SIGKILL escalation"
  - "channel and connection typed as unknown to avoid circular deps with ssh2"

patterns-established:
  - "Pattern: UUID process tracking with Map<UUID, ProcessInfo>"
  - "Pattern: Temp file naming ${os.tmpdir()}/ssh-exoman-${processId}.{out,err}"
  - "Pattern: Async chunked reading with Bun.file().slice()"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03, EXEC-04]

# Metrics
duration: 10min
completed: 2026-03-07
---

# Phase 2 Plan 2: Process Manager Summary

**Background process tracking with UUID, temp file persistence, chunked output retrieval, and SIGTERM/SIGKILL escalation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-07T15:28:19Z
- **Completed:** 2026-03-07T15:38:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- ProcessManager class with full lifecycle management for background SSH commands
- UUID-based process tracking with Map storage for O(1) lookup
- Temp file persistence enabling output retrieval after process completion
- Chunked byte-offset output reading with 4KB default pagination
- Kill escalation pattern: SIGTERM -> 5 second wait -> SIGKILL

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types with ProcessInfo interface** - `1a8b9b9` (feat)
2. **Task 2: Implement ProcessManager class** - `0bc8133` (test - TDD RED), `9f6c171` (feat - TDD GREEN)
3. **Task 3: Update SSH module barrel exports** - `5627544` (feat)

## Files Created/Modified

- `src/types.ts` - Added ProcessInfo interface for background process metadata
- `src/types.test.ts` - Added tests for ProcessInfo interface with all status variants
- `src/ssh/process-manager.ts` - ProcessManager class implementation
- `src/ssh/process-manager.test.ts` - 19 tests covering all ProcessManager functionality
- `src/ssh/index.ts` - Added ProcessManager export to SSH module barrel
- `src/index.ts` - Added ProcessInfo type and SSH module exports to main barrel

## Decisions Made

- **Hybrid output handling:** Stream output during execution AND persist to temp files for post-completion retrieval
- **Default chunk size:** 4KB for pagination (configurable via maxBytes parameter)
- **Kill escalation:** 5 second wait between SIGTERM and SIGKILL (matching CONTEXT.md decision)
- **Type safety:** channel and connection typed as `unknown` to avoid circular dependencies with ssh2 types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertion for output size**
- **Found during:** Task 2 (ProcessManager tests - GREEN phase)
- **Issue:** Test expected 12 bytes but "hello" (5) + " world" (6) = 11 bytes
- **Fix:** Corrected test expectation to 11 bytes
- **Files modified:** src/ssh/process-manager.test.ts
- **Verification:** Test passes
- **Committed in:** 9f6c171 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed SIGTERM test timeout issue**
- **Found during:** Task 3 (verification)
- **Issue:** Test 11 was timing out because killProcess waits 5 seconds for escalation
- **Fix:** Refactored test to use force=true for immediate SIGKILL, added separate test for SIGTERM verification
- **Files modified:** src/ssh/process-manager.test.ts
- **Verification:** All 19 tests pass
- **Committed in:** 5627544 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Minor test fixes, no scope creep.

## Issues Encountered

None - TDD approach caught issues early during test development.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Process manager ready for integration with SSH client (02-03)
- ProcessInfo type exported from main barrel for MCP tool use
- All EXEC requirements (01-04) implemented

---
*Phase: 02-ssh-execution-layer*
*Completed: 2026-03-07*

## Self-Check: PASSED

All files verified:
- src/ssh/process-manager.ts - FOUND
- src/ssh/process-manager.test.ts - FOUND
- 02-02-SUMMARY.md - FOUND

All commits verified:
- 1a8b9b9 feat(02-02): extend types with ProcessInfo interface
- 0bc8133 test(02-02): add failing tests for ProcessManager class
- 9f6c171 feat(02-02): implement ProcessManager class
- 5627544 feat(02-02): update barrel exports for ProcessManager
