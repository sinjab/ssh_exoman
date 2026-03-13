/**
 * SSH Agent Socket Discovery
 *
 * Automatically discovers SSH agent socket on various platforms.
 * On macOS, finds launchd-managed agent without requiring SSH_AUTH_SOCK.
 *
 * Discovery order:
 * 1. SSH_AUTH_SOCK environment variable (preserves existing behavior)
 * 2. Environment file (~/.config/ssh-exoman/agent-sock)
 * 3. macOS launchd socket (/private/tmp/com.apple.launchd.XXX/Listeners)
 * 4. Standard Unix socket paths (/tmp/ssh-XXX/agent.NNN)
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** Source of discovered agent socket */
export type AgentSocketSource = "env" | "launchd" | "standard" | "file";

/** Result of agent socket discovery */
export interface DiscoveredAgent {
  /** Path to the agent socket */
  socketPath: string;
  /** How the socket was discovered */
  source: AgentSocketSource;
}

/**
 * Discover SSH agent socket using multiple strategies.
 *
 * @returns Discovered agent info, or null if not found
 */
export async function discoverAgentSocket(): Promise<DiscoveredAgent | null> {
  // Strategy 1: Environment variable (fastest, preserves existing behavior)
  const envSocket = discoverFromEnv();
  if (envSocket) return envSocket;

  // Strategy 2: Environment file (opt-in persistent storage)
  const fileSocket = await discoverFromFile();
  if (fileSocket) return fileSocket;

  // Strategy 3: macOS launchd socket
  if (process.platform === "darwin") {
    const launchdSocket = await discoverLaunchdSocket();
    if (launchdSocket) return launchdSocket;
  }

  // Strategy 4: Standard Unix socket paths
  const standardSocket = await discoverStandardSocket();
  if (standardSocket) return standardSocket;

  return null;
}

/**
 * Check if a path is a valid socket owned by the current user.
 */
function isValidSocket(socketPath: string): boolean {
  try {
    const stat = fs.statSync(socketPath);
    // Check if it's a socket and owned by current user (security)
    return stat.isSocket() && stat.uid === process.getuid();
  } catch {
    return false;
  }
}

/**
 * Discover agent socket from SSH_AUTH_SOCK environment variable.
 */
function discoverFromEnv(): DiscoveredAgent | null {
  const socketPath = process.env.SSH_AUTH_SOCK;
  if (!socketPath) return null;

  if (isValidSocket(socketPath)) {
    return { socketPath, source: "env" };
  }

  return null;
}

/**
 * Discover agent socket from environment file.
 * Allows users to manually set a persistent socket path.
 */
async function discoverFromFile(): Promise<DiscoveredAgent | null> {
  const envPath = path.join(
    os.homedir(),
    ".config",
    "ssh-exoman",
    "agent-sock"
  );

  try {
    const socketPath = fs.readFileSync(envPath, "utf8").trim();
    if (isValidSocket(socketPath)) {
      return { socketPath, source: "file" };
    }
  } catch {
    // File doesn't exist or can't be read
  }

  return null;
}

/**
 * Discover macOS launchd-managed SSH agent socket.
 *
 * The socket is located at /private/tmp/com.apple.launchd.XXX/Listeners
 * where XXX is a random UUID managed by launchd.
 */
async function discoverLaunchdSocket(): Promise<DiscoveredAgent | null> {
  const tmpDir = "/private/tmp";

  try {
    const entries = fs.readdirSync(tmpDir);
    for (const entry of entries) {
      if (!entry.startsWith("com.apple.launchd.")) continue;

      const listenersPath = path.join(tmpDir, entry, "Listeners");
      if (isValidSocket(listenersPath)) {
        return { socketPath: listenersPath, source: "launchd" };
      }
    }
  } catch {
    // Can't read /private/tmp
  }

  return null;
}

/**
 * Discover standard Unix ssh-agent socket paths.
 *
 * Standard paths: /tmp/ssh-XXXXXXXXXX/agent.NNN where NNN is the PID.
 */
async function discoverStandardSocket(): Promise<DiscoveredAgent | null> {
  const tmpDir = "/tmp";

  try {
    const entries = fs.readdirSync(tmpDir);
    for (const entry of entries) {
      if (!entry.startsWith("ssh-")) continue;

      const sockDir = path.join(tmpDir, entry);
      try {
        const socks = fs.readdirSync(sockDir);
        for (const sock of socks) {
          if (!sock.startsWith("agent.")) continue;

          const sockPath = path.join(sockDir, sock);
          if (isValidSocket(sockPath)) {
            return { socketPath: sockPath, source: "standard" };
          }
        }
      } catch {
        // Can't read this ssh-* directory
      }
    }
  } catch {
    // Can't read /tmp
  }

  return null;
}

/**
 * Clear the agent discovery cache.
 * Used for testing or when socket may have changed.
 */
export function clearAgentCache(): void {
  // This function exists for API symmetry with the cache in client.ts
  // The actual cache is managed in client.ts
}
