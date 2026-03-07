/**
 * Command detection module for ssh-exoman
 *
 * Detects whether commands are simple or complex (contain shell metacharacters),
 * and provides a wrapper function to ensure consistent execution behavior.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Regex pattern matching shell metacharacters that indicate complexity.
 * These characters require shell interpretation:
 * - | : pipe
 * - & : background/AND
 * - ; : command separator
 * - < > : redirects
 * - $ : variable expansion
 * - ` : command substitution (backtick)
 * - \\ : escape
 * - " ' : quoting
 * - * ? : glob patterns
 * - [ ] : character class
 * - { } : brace expansion
 * - ( ) : subshell
 */
const SHELL_META_CHARS = /[|;&<>\$`\\"'*?[\]{}()]/;

/**
 * Pattern for && and || logical operators
 */
const LOGICAL_OPERATORS = /\s(&&|\|\|)\s/;

// ============================================================================
// Command Detection
// ============================================================================

/**
 * Detect whether a command contains shell metacharacters that require
 * shell interpretation.
 *
 * Complex commands include:
 * - Pipes: cat file | grep foo
 * - Redirects: echo hello > file
 * - Semicolons: cmd1; cmd2
 * - Variables: echo $HOME
 * - Subshells: $(command) or `command`
 * - Globs: *.txt
 * - Logical operators: && and ||
 * - Quoting: 'single' or "double" quotes
 *
 * @param command - Command string to analyze
 * @returns true if command is complex, false if simple
 */
export function isComplexCommand(command: string): boolean {
  // Check for shell metacharacters
  if (SHELL_META_CHARS.test(command)) {
    return true;
  }

  // Check for logical operators (&& ||)
  if (LOGICAL_OPERATORS.test(command)) {
    return true;
  }

  // Check for subshell syntax $(...)
  if (command.includes("$(")) {
    return true;
  }

  return false;
}

// ============================================================================
// Command Wrapping
// ============================================================================

/**
 * Wrap a command in a shell wrapper for consistent execution behavior.
 *
 * All commands are wrapped in `/bin/sh -c "{escaped}"` to ensure
 * predictable behavior with pipes, redirects, globbing, etc.
 *
 * Double quotes in the command are escaped as \\" to preserve them
 * in the shell wrapper.
 *
 * @param command - Command string to wrap
 * @returns Shell-wrapped command string
 */
export function wrapCommand(command: string): string {
  // Escape double quotes in the command
  const escaped = command.replace(/"/g, '\\"');

  return `/bin/sh -c "${escaped}"`;
}
