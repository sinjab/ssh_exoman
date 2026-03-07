/**
 * SSH module barrel exports for ssh-exoman
 *
 * Exports all public APIs from the SSH module for use by other modules.
 */

// ============================================================================
// SSH Config Parser
// ============================================================================

export { parseSSHConfig, resolveHost, listHosts } from "./config-parser";
export type { HostConfig } from "./config-parser";

// ============================================================================
// Command Detection
// ============================================================================

export { isComplexCommand, wrapCommand } from "./command-detection";

// ============================================================================
// Process Manager
// ============================================================================

export { ProcessManager } from "./process-manager";
export type { ProcessStatusInfo, OutputChunk } from "./process-manager";
