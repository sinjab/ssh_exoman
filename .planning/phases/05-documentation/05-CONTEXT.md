# Phase 5: Documentation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add security warnings and usage guidance for SSH agent forwarding so users understand the risks on untrusted hosts and when/how to use the `forwardAgent` parameter. Documentation updates to README.md and the ssh_help MCP prompt.

**In scope:**
- README security warning about agent forwarding risks (root socket hijacking)
- ssh_help prompt guidance on forwardAgent parameter
- Brief usage examples

**Out of scope:**
- New documentation files (update existing docs only)
- Full tutorial or how-to guide
- Changelog or release notes

</domain>

<decisions>
## Implementation Decisions

### README Security Warning
- **Placement**: Expand existing Security section with new "Agent Forwarding Security" subheading
- **Depth**: Brief admonition - essentials only, not technical deep-dive
- **Content**: "Only use forwardAgent on trusted hosts. Root users on remote systems can access your forwarded agent socket."
- **Visibility**: Dedicated subheading under Security section (not inline paragraph)

### README Usage Examples
- **Include**: Yes - brief examples (1-2 scenarios)
- **Primary use case**: SCP/rsync hop - transfer files between remote servers using local SSH key
- **Example format**: Short description + benefit explanation, not full command walkthroughs

### ssh_help Prompt Update
- **Scope**: Parameter mention only (not full guidance section)
- **Format**: Descriptive entry in execute_command parameters list
- **Text**: "forwardAgent (boolean, optional, default: false) - Forward local SSH agent to remote host. Allows remote commands to authenticate with other SSH servers using your local keys. Only enable on fully trusted hosts."

### Claude's Discretion
- Exact wording of security warning (within "brief admonition" guideline)
- Exact placement of examples section in README
- Whether to include secondary example (git clone) or just SCP/rsync hop

</decisions>

<specifics>
## Specific Ideas

- Follow existing README section structure and formatting
- Security warning should be prominent but not alarmist
- ssh_help prompt update should match existing parameter description style

</specifics>

<code_context>
## Existing Code Insights

### Files to Modify
- `README.md` - Security section expansion
- `src/prompts/help.ts` - ssh_help prompt text

### Established Patterns
- README uses markdown subheadings under main sections
- ssh_help prompt has structured "Available Tools" format with parameter lists
- Security warnings use standard admonition formatting

### Integration Points
- README Security section currently covers blacklist patterns (lines 85-109)
- ssh_help prompt lists execute_command with host, command, timeout parameters (line 42)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-documentation*
*Context gathered: 2026-03-13*
