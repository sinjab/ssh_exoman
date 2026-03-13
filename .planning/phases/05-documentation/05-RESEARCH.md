# Phase 5: Documentation - Research

**Researched:** 2026-03-13
**Domain:** SSH Agent Forwarding Security Documentation
**Confidence:** HIGH

## Summary

This phase adds security warnings and usage guidance for SSH agent forwarding to help users understand the risks and proper usage. The implementation is straightforward documentation updates to two files: README.md and src/prompts/help.ts. The key security concern is that root users on remote hosts can access the forwarded agent socket and authenticate to other servers using the user's credentials.

**Primary recommendation:** Follow the user's locked decisions from CONTEXT.md exactly - brief admonition in README, parameter description in ssh_help prompt, with SCP/rsync hop as the primary use case example.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### README Security Warning
- **Placement**: Expand existing Security section with new "Agent Forwarding Security" subheading
- **Depth**: Brief admonition - essentials only, not technical deep-dive
- **Content**: "Only use forwardAgent on trusted hosts. Root users on remote systems can access your forwarded agent socket."
- **Visibility**: Dedicated subheading under Security section (not inline paragraph)

#### README Usage Examples
- **Include**: Yes - brief examples (1-2 scenarios)
- **Primary use case**: SCP/rsync hop - transfer files between remote servers using local SSH key
- **Example format**: Short description + benefit explanation, not full command walkthroughs

#### ssh_help Prompt Update
- **Scope**: Parameter mention only (not full guidance section)
- **Format**: Descriptive entry in execute_command parameters list
- **Text**: "forwardAgent (boolean, optional, default: false) - Forward local SSH agent to remote host. Allows remote commands to authenticate with other SSH servers using your local keys. Only enable on fully trusted hosts."

#### Claude's Discretion
- Exact wording of security warning (within "brief admonition" guideline)
- Exact placement of examples section in README
- Whether to include secondary example (git clone) or just SCP/rsync hop

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | README includes security warning about agent forwarding on untrusted hosts (root socket hijacking risk) | OpenSSH man page confirms socket is "easily abused by root or another instance of the same user" - brief admonition per locked decision |
| DOCS-02 | `ssh_help` MCP prompt includes guidance on when and how to use `forwardAgent` | Parameter entry in execute_command parameters list per locked decision |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown | N/A | Documentation format | Standard README format, already in use |
| TypeScript template literals | N/A | Prompt text definition | Existing pattern in src/prompts/help.ts |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `bun test` | Verify no regressions | After changes |
| `bun run build` | Ensure TypeScript compiles | After changes |

## Architecture Patterns

### README Structure Pattern
The existing README follows a clear section hierarchy:
```
# SSH Exoman
## Features
### Tools / Resources / Prompts
## Installation
## Configuration
### Environment Variables
#### Per-Host Passphrases
## Claude Desktop Integration
## Security
### Default Blacklist
### Security Modes
## Requirements
## License
```

The new "Agent Forwarding Security" subheading should be added under the existing `## Security` section, following the same `###` subheading pattern used for "Default Blacklist" and "Security Modes".

### ssh_help Prompt Pattern
The existing prompt structure in `src/prompts/help.ts`:
- Uses template literal for multi-line text
- `## Available Tools` section with numbered list
- Each tool shows: `**tool_name** - description` followed by parameter list
- Parameters formatted as: `parameter_name (type, optional/required, default: X) - description`

Example from existing code:
```typescript
1. **execute_command** - Run a command on a remote host via SSH
   - Parameters: host (string), command (string), timeout (number, optional)
```

The forwardAgent parameter should be added to this parameter list, maintaining the same format.

### Anti-Patterns to Avoid
- **Verbose security deep-dive**: User explicitly requested "brief admonition, essentials only"
- **Full command walkthroughs**: User specified "short description + benefit explanation"
- **Separate guidance section in ssh_help**: User locked decision to "parameter mention only"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security documentation | New admonition format | Existing README section structure | Consistency with existing Security section |
| Prompt guidance | New guidance section | Parameter description in existing list | Per locked decision |

## Common Pitfalls

### Pitfall 1: Over-documenting the security risk
**What goes wrong:** Writing paragraphs explaining the technical details of socket hijacking
**Why it happens:** Developer instinct to be thorough and educational
**How to avoid:** Stick to the locked decision: one sentence warning, essentials only
**Warning signs:** More than 2-3 sentences in the security warning section

### Pitfall 2: Inconsistent parameter formatting
**What goes wrong:** forwardAgent parameter doesn't match the existing parameter format
**Why it happens:** Not reviewing the existing prompt text carefully
**How to avoid:** Use exact format: `forwardAgent (boolean, optional, default: false) - description`
**Warning signs:** Parameter description looks different from other parameters

### Pitfall 3: Placing examples in wrong section
**What goes wrong:** Adding agent forwarding examples in a new section instead of integrating naturally
**Why it happens:** Not considering where examples fit best in existing structure
**How to avoid:** Consider placement after Security section or within a new "Agent Forwarding" subsection

## Code Examples

### README Security Section Update Pattern
Based on existing README structure (lines 85-109), the new subheading should follow:

```markdown
## Security

SSH Exoman includes built-in command filtering to prevent accidental destructive operations.

### Agent Forwarding Security

Only use `forwardAgent` on trusted hosts. Root users on remote systems can access your forwarded agent socket and authenticate to other servers using your credentials.

### Default Blacklist (36 patterns)
...
```

### ssh_help Parameter Update Pattern
Based on existing prompt text (line 42):

```typescript
1. **execute_command** - Run a command on a remote host via SSH
   - Parameters: host (string), command (string), timeout (number, optional), forwardAgent (boolean, optional, default: false) - Forward local SSH agent to remote host. Allows remote commands to authenticate with other SSH servers using your local keys. Only enable on fully trusted hosts.
```

### README Usage Example Pattern
Based on locked decision for brief examples:

```markdown
### Agent Forwarding Usage

Use agent forwarding when you need to authenticate from a remote host using your local SSH keys:

- **SCP/rsync hops**: Transfer files between remote servers without copying private keys. Your local key authenticates both connections.
- **Git clone on remote**: Clone private repositories on a jump host using your local credentials.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Verbose security explanations | Brief admonitions | User decision | Concise, scannable documentation |
| Command walkthroughs | Use case descriptions | User decision | Faster to read, less maintenance |

**Deprecated/outdated:**
- None for this documentation phase

## Open Questions

1. **Exact placement of usage examples section**
   - What we know: Examples should be brief, focused on SCP/rsync hop
   - What's unclear: Should examples be under Security section or a separate section
   - Recommendation: Add as `### Agent Forwarding Usage` after the security warning, keeping all agent forwarding info together

2. **Whether to include git clone example**
   - What we know: User gave discretion on secondary example
   - What's unclear: If both examples add value or just add noise
   - Recommendation: Include both - git clone is a common use case that demonstrates the benefit clearly

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun built-in test runner |
| Config file | None (Bun auto-discovers *.test.ts files) |
| Quick run command | `bun test` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | README security warning present | Manual | N/A - documentation | N/A |
| DOCS-02 | ssh_help prompt includes forwardAgent | Manual | N/A - documentation | N/A |

### Sampling Rate
- **Per task commit:** `bun test && bun run build`
- **Per wave merge:** `bun test && bun run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None - documentation changes do not require new test infrastructure. Existing tests should pass (no functional code changes).

## Sources

### Primary (HIGH confidence)
- OpenBSD ssh-agent(1) man page - https://man.openbsd.org/ssh-agent.1 - Socket accessibility warning: "easily abused by root or another instance of the same user"
- SSH.com Academy - https://www.ssh.com/academy/ssh/agent - Agent forwarding mechanism and security considerations

### Secondary (MEDIUM confidence)
- Existing README.md structure and formatting patterns (lines 85-109)
- Existing src/prompts/help.ts parameter formatting (line 42)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Simple markdown/TypeScript changes, existing patterns well-documented
- Architecture: HIGH - User locked all major decisions in CONTEXT.md
- Pitfalls: HIGH - Clear scope prevents over-documentation

**Research date:** 2026-03-13
**Valid until:** 30 days (documentation patterns are stable)
