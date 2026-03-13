/**
 * SSH Client module for ssh-exoman
 *
 * Provides SSH connection management with configurable timeout,
 * identity file loading, and structured error handling.
 */

import { Client } from "ssh2";
import * as fs from "fs";
import * as os from "os";
import type { HostConfig } from "./config-parser";
import type { Result } from "../types";
import { ErrorCode, errorResult } from "../errors";
import { discoverAgentSocket, type DiscoveredAgent } from "./agent-discovery";

// ============================================================================
// Passphrase Resolution
// ============================================================================

/**
 * Resolve the passphrase for an SSH private key.
 *
 * Resolution order:
 * 1. Per-host env var: SSH_PASSPHRASE_{HOST} (host alias uppercased, hyphens to underscores)
 * 2. Global fallback: SSH_PASSPHRASE
 *
 * @param hostAlias - The host alias from SSH config
 * @returns The passphrase if found, undefined otherwise
 */
export function getPassphrase(hostAlias: string): string | undefined {
  // Normalize host alias: uppercase and replace hyphens with underscores
  const normalizedHost = hostAlias.toUpperCase().replace(/-/g, "_");

  // Check per-host passphrase first
  const perHostPassphrase = process.env[`SSH_PASSPHRASE_${normalizedHost}`];
  if (perHostPassphrase) {
    return perHostPassphrase;
  }

  // Fall back to global passphrase
  return process.env.SSH_PASSPHRASE;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Represents an active SSH connection
 */
export interface SSHConnection {
  /** The ssh2 Client instance */
  client: Client;
  /** The resolved host configuration used for the connection */
  hostConfig: HostConfig;
}

/**
 * Connection options extending HostConfig
 */
export interface ConnectOptions extends HostConfig {
  /** Passphrase for encrypted private key */
  passphrase?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable SSH agent forwarding */
  forwardAgent?: boolean;
}

// ============================================================================
// Agent Forwarding
// ============================================================================

/** Cache for discovered agent socket */
let cachedAgent: DiscoveredAgent | null = null;

/**
 * Validate that SSH agent is available for forwarding.
 *
 * Uses automatic discovery on macOS when SSH_AUTH_SOCK is not set.
 *
 * Discovery order:
 * 1. SSH_AUTH_SOCK environment variable (preserves existing behavior)
 * 2. Environment file (~/.config/ssh-exoman/agent-sock)
 * 3. macOS launchd socket (/private/tmp/com.apple.launchd.XXX/Listeners)
 * 4. Standard Unix socket paths (/tmp/ssh-XXX/agent.NNN)
 *
 * @returns Result with socketPath on success, SSH_AGENT_UNAVAILABLE error on failure
 */
export async function validateAgent(): Promise<Result<{ socketPath: string }>> {
  // Use cached socket if available and still valid
  if (cachedAgent) {
    try {
      if (fs.existsSync(cachedAgent.socketPath) && fs.statSync(cachedAgent.socketPath).isSocket()) {
        return { success: true, data: { socketPath: cachedAgent.socketPath } };
      }
    } catch {
      // Cache invalid, re-discover
    }
    cachedAgent = null;
  }

  // Discover socket
  const discovered = await discoverAgentSocket();

  if (!discovered) {
    return errorResult(
      ErrorCode.SSH_AGENT_UNAVAILABLE,
      "SSH agent socket not found. " +
        "On macOS, ensure ssh-agent is running (it starts automatically). " +
        "On Linux, run: eval \"$(ssh-agent -s)\" && ssh-add ~/.ssh/id_ed25519"
    );
  }

  cachedAgent = discovered;
  return { success: true, data: { socketPath: discovered.socketPath } };
}

/**
 * Clear the agent discovery cache.
 * Useful when the agent socket may have changed.
 */
export function clearAgentCache(): void {
  cachedAgent = null;
}

// ============================================================================
// Connection Functions
// ============================================================================

/**
 * Connect to an SSH host with configurable timeout.
 *
 * @param options - Connection options including host config, passphrase, and timeout
 * @returns Promise resolving to Result with SSHConnection on success
 */
export async function connect(
  options: ConnectOptions
): Promise<Result<SSHConnection>> {
  // Validate agent availability if forwarding requested (async discovery)
  let agentSocketPath: string | undefined;
  if (options.forwardAgent) {
    const agentResult = await validateAgent();
    if (!agentResult.success) {
      return agentResult as Result<SSHConnection>;
    }
    agentSocketPath = agentResult.data.socketPath;
  }

  return new Promise((resolve) => {
    const client = new Client();
    const { passphrase, timeout = 30000, forwardAgent = false, ...hostConfig } = options;

    client.on("ready", () => {
      resolve({
        success: true,
        data: { client, hostConfig },
      });
    });

    client.on("error", (err: Error & { code?: string }) => {
      // Check for encrypted private key error (missing passphrase)
      const isEncryptedKeyError =
        err.message.includes("passphrase") ||
        err.message.includes("Encrypted") ||
        err.message.includes("no passphrase given");

      // Distinguish between auth failures and other connection errors
      let errorCode: ErrorCode;
      let errorMessage: string;

      if (isEncryptedKeyError) {
        errorCode = ErrorCode.SSH_AUTH_FAILED;
        errorMessage = `Encrypted private key detected but no passphrase provided. Set SSH_PASSPHRASE_${hostConfig.host.toUpperCase().replace(/-/g, "_")} or SSH_PASSPHRASE environment variable.`;
      } else if (
        err.code === "ECONNREFUSED" ||
        err.message.includes("Authentication failed")
      ) {
        errorCode = ErrorCode.SSH_AUTH_FAILED;
        errorMessage = `SSH connection failed: ${err.message}`;
      } else {
        errorCode = ErrorCode.SSH_CONNECTION_FAILED;
        errorMessage = `SSH connection failed: ${err.message}`;
      }

      resolve(errorResult(errorCode, errorMessage));
    });

    // Build connection config
    // Use hostname if available, otherwise use host alias
    const connectConfig: {
      host: string;
      port: number;
      username: string;
      readyTimeout: number;
      privateKey?: Buffer;
      passphrase?: string;
      agent?: string;
      agentForward?: boolean;
    } = {
      host: hostConfig.hostname || hostConfig.host,
      port: hostConfig.port,
      username: hostConfig.user,
      readyTimeout: timeout,
    };

    // Load private key if specified
    if (hostConfig.identityFile) {
      // Expand ~ to home directory
      const keyPath = hostConfig.identityFile.replace(/^~/, os.homedir());

      if (fs.existsSync(keyPath)) {
        try {
          connectConfig.privateKey = fs.readFileSync(keyPath);
          // Add passphrase if provided
          if (passphrase) {
            connectConfig.passphrase = passphrase;
          }
        } catch {
          // If we can't read the key, let the connection fail naturally
          // This will result in an SSH_CONNECTION_FAILED error
        }
      }
    }

    // Add agent forwarding if requested (uses discovered socket path)
    if (forwardAgent && agentSocketPath) {
      connectConfig.agent = agentSocketPath;
      connectConfig.agentForward = true;
    }

    client.connect(connectConfig);
  });
}
