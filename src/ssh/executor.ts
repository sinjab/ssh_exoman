/**
 * SSH Command Executor for ssh-exoman
 *
 * Orchestrates the full execution flow:
 * 1. Security validation
 * 2. Host config resolution
 * 3. SSH connection
 * 4. Background process tracking
 * 5. Command execution with output streaming
 */

import { validateCommandWithResult, loadPatterns } from "../security-validator";
import { parseSSHConfig, resolveHost } from "./config-parser";
import { connect, getPassphrase } from "./client";
import { wrapCommand } from "./command-detection";
import { ProcessManager } from "./process-manager";
import type { Result, AppConfig } from "../types";
import { ErrorCode, errorResult } from "../errors";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of starting a background SSH command
 */
export interface ExecuteResult {
  /** UUID of the started process */
  processId: string;
}

// ============================================================================
// Executor Function
// ============================================================================

/**
 * Execute an SSH command in the background.
 *
 * This function orchestrates the complete execution flow:
 * 1. Validates the command against security policy
 * 2. Resolves the host alias from SSH config
 * 3. Establishes an SSH connection
 * 4. Registers the process with the ProcessManager
 * 5. Executes the command and streams output
 * 6. Completes the process when done
 *
 * The function returns immediately with a process ID, allowing the
 * command to run in the background while the caller can check status
 * and retrieve output asynchronously.
 *
 * @param hostAlias - The host alias from ~/.ssh/config
 * @param command - The command to execute
 * @param config - Application configuration (security mode, timeouts, etc.)
 * @param processManager - The ProcessManager instance to track this process
 * @returns Promise resolving to Result with processId on success
 */
export async function executeSSHCommand(
  hostAlias: string,
  command: string,
  config: AppConfig,
  processManager: ProcessManager
): Promise<Result<ExecuteResult>> {
  // Step 1: Security validation
  const securityResult = validateCommandWithResult(command, {
    mode: config.securityMode,
    patterns: loadPatterns(),
  });

  if (!securityResult.success) {
    return securityResult as Result<ExecuteResult>;
  }

  // Step 2: Resolve host config
  const sshConfig = parseSSHConfig();
  const hostConfig = resolveHost(hostAlias, sshConfig);

  if (!hostConfig) {
    return errorResult(
      ErrorCode.CONFIG_ERROR,
      `Host "${hostAlias}" not found in SSH config`
    );
  }

  // Step 3: Connect (with per-host passphrase resolution)
  const connectionResult = await connect({
    ...hostConfig,
    passphrase: getPassphrase(hostAlias),
    timeout: config.sshConnectTimeout,
  });

  if (!connectionResult.success) {
    return connectionResult as Result<ExecuteResult>;
  }

  const connection = connectionResult.data;

  // Step 4: Start process tracking (with placeholder channel)
  const processId = processManager.startProcess(
    hostAlias,
    command,
    null, // channel will be set after exec
    connection.client
  );

  // Step 5: Execute command
  const wrappedCommand = wrapCommand(command);

  connection.client.exec(wrappedCommand, (err, stream) => {
    if (err) {
      processManager.completeProcess(processId, 1, null);
      return;
    }

    // Update channel reference in process info
    const process = processManager.getProcess(processId);
    if (process) {
      process.channel = stream;
    }

    // Stream stdout
    stream.on("data", (data: Buffer) => {
      processManager.appendOutput(processId, data, false);
    });

    // Stream stderr
    stream.stderr.on("data", (data: Buffer) => {
      processManager.appendOutput(processId, data, true);
    });

    // Handle exit (code and signal)
    stream.on("exit", (code: number | null, signal: string | null) => {
      // Store exit info, but don't complete yet - wait for close
      const proc = processManager.getProcess(processId);
      if (proc) {
        proc.exitCode = code;
        proc.signal = signal;
      }
    });

    // Complete process on stream close
    stream.on("close", () => {
      const proc = processManager.getProcess(processId);
      if (proc) {
        processManager.completeProcess(
          processId,
          proc.exitCode,
          proc.signal
        );
      }
    });
  });

  // Return process ID immediately (background execution)
  return {
    success: true,
    data: { processId },
  };
}
