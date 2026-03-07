/**
 * SSH config parser module for ssh-exoman
 *
 * Parses ~/.ssh/config and resolves host aliases to connection parameters.
 * Uses the ssh-config library for robust parsing with wildcard support.
 */

import SSHConfig from "ssh-config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// Types
// ============================================================================

/**
 * Resolved host configuration from SSH config
 */
export interface HostConfig {
  /** Host alias name */
  host: string;
  /** Actual hostname/IP (defaults to host alias if not specified) */
  hostname?: string;
  /** Username (defaults to $USER env var) */
  user: string;
  /** Port number (defaults to 22) */
  port: number;
  /** Path to identity file (private key) */
  identityFile?: string;
}

// ============================================================================
// SSH Config Parsing
// ============================================================================

/**
 * Parse the user's ~/.ssh/config file.
 *
 * Returns an empty SSHConfig object if the file doesn't exist,
 * rather than throwing an error.
 *
 * @returns SSHConfig object (parsed or empty)
 */
export function parseSSHConfig(): SSHConfig {
  const configPath = path.join(os.homedir(), ".ssh", "config");

  if (!fs.existsSync(configPath)) {
    return new SSHConfig();
  }

  const content = fs.readFileSync(configPath, "utf8");
  return SSHConfig.parse(content);
}

/**
 * Resolve a host alias to full connection parameters.
 *
 * Uses SSHConfig.compute() to merge wildcard patterns with specific
 * host configuration, then applies defaults for missing fields.
 *
 * @param alias - Host alias to resolve
 * @param config - Parsed SSHConfig object
 * @returns HostConfig with resolved values, or null if host not found
 */
export function resolveHost(alias: string, config: SSHConfig): HostConfig | null {
  // compute() merges wildcard patterns with specific host config
  const computed = config.compute(alias);

  // compute() returns empty object for unknown hosts
  // A known host will have at least the Host property set
  if (!computed || !computed.Host) {
    return null;
  }

  // Apply defaults for missing fields
  const user = computed.User || process.env.USER || "root";
  const port = computed.Port ? parseInt(computed.Port, 10) : 22;

  // Handle IdentityFile which may be an array
  let identityFile: string | undefined;
  if (computed.IdentityFile) {
    identityFile = Array.isArray(computed.IdentityFile)
      ? computed.IdentityFile[0]
      : computed.IdentityFile;
  }

  return {
    host: alias,
    hostname: computed.HostName || alias,
    user,
    port: isNaN(port) ? 22 : port,
    identityFile,
  };
}

/**
 * List all non-wildcard hosts from SSH config.
 *
 * Filters out patterns containing '*' (e.g., "*", "*.example.com")
 * to return only concrete host aliases.
 *
 * @param config - Parsed SSHConfig object
 * @returns Array of host alias names
 */
export function listHosts(config: SSHConfig): string[] {
  const hosts: string[] = [];

  for (const section of config) {
    // Check if this is a Host directive
    if (section.param === "Host" && typeof section.value === "string") {
      // Skip wildcard patterns
      if (!section.value.includes("*")) {
        hosts.push(section.value);
      }
    }
  }

  return hosts;
}
