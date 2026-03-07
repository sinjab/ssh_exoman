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
  return new Promise((resolve) => {
    const client = new Client();
    const { passphrase, timeout = 30000, ...hostConfig } = options;

    client.on("ready", () => {
      resolve({
        success: true,
        data: { client, hostConfig },
      });
    });

    client.on("error", (err: Error & { code?: string }) => {
      // Distinguish between auth failures and other connection errors
      const errorCode =
        err.code === "ECONNREFUSED" ||
        err.message.includes("Authentication failed")
          ? ErrorCode.SSH_AUTH_FAILED
          : ErrorCode.SSH_CONNECTION_FAILED;

      resolve(
        errorResult(
          errorCode,
          `SSH connection failed: ${err.message}`
        )
      );
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

    client.connect(connectConfig);
  });
}
