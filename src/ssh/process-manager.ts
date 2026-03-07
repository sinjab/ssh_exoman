/**
 * Process Manager for background SSH command execution
 *
 * Tracks background processes with UUID, status, and output persistence.
 * Enables chunked output retrieval and graceful/forced process termination.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ProcessInfo, ProcessStatus, Result } from "../types";
import { ErrorCode, errorResult } from "../errors";

const TEMP_DIR = os.tmpdir();
const TEMP_PREFIX = "ssh-exoman";

/**
 * Status info returned by getStatus (excludes channel/connection for safety)
 */
export interface ProcessStatusInfo {
  status: ProcessStatus;
  exitCode: number | null;
  signal: string | null;
  outputSize: number;
  errorSize: number;
  startTime: Date;
  endTime: Date | null;
}

/**
 * Output chunk returned by getOutput
 */
export interface OutputChunk {
  data: string;
  totalSize: number;
  hasMore: boolean;
}

/**
 * Process Manager for tracking background SSH commands
 */
export class ProcessManager {
  private processes = new Map<string, ProcessInfo>();

  /**
   * Start tracking a new background process
   *
   * @param host - The host the command is running on
   * @param command - The command being executed
   * @param channel - The ssh2 Channel for the process
   * @param connection - The ssh2 Client connection
   * @returns The UUID process ID for tracking
   */
  startProcess(
    host: string,
    command: string,
    channel: unknown,
    connection: unknown
  ): string {
    const processId = crypto.randomUUID();
    const tempOutputPath = path.join(TEMP_DIR, `${TEMP_PREFIX}-${processId}.out`);
    const tempErrorPath = path.join(TEMP_DIR, `${TEMP_PREFIX}-${processId}.err`);

    this.processes.set(processId, {
      processId,
      host,
      command,
      status: "running",
      exitCode: null,
      signal: null,
      startTime: new Date(),
      endTime: null,
      outputSize: 0,
      errorSize: 0,
      tempOutputPath,
      tempErrorPath,
      channel,
      connection,
    });

    return processId;
  }

  /**
   * Append output data to the process's temp file
   *
   * @param processId - The process ID
   * @param data - The output data buffer
   * @param isStderr - Whether this is stderr (true) or stdout (false)
   */
  appendOutput(processId: string, data: Buffer, isStderr: boolean): void {
    const process = this.processes.get(processId);
    if (!process) return;

    const filePath = isStderr ? process.tempErrorPath : process.tempOutputPath;
    fs.appendFileSync(filePath, data);

    if (isStderr) {
      process.errorSize += data.length;
    } else {
      process.outputSize += data.length;
    }
  }

  /**
   * Mark a process as completed
   *
   * @param processId - The process ID
   * @param exitCode - The exit code (null if killed by signal)
   * @param signal - The signal that killed the process (null if normal exit)
   */
  completeProcess(
    processId: string,
    exitCode: number | null,
    signal: string | null
  ): void {
    const process = this.processes.get(processId);
    if (!process) return;

    process.status = exitCode === 0 ? "completed" : "failed";
    process.exitCode = exitCode;
    process.signal = signal;
    process.endTime = new Date();

    // Close the SSH connection
    const connection = process.connection as { end: () => void } | null;
    if (connection && typeof connection.end === "function") {
      connection.end();
    }
  }

  /**
   * Get the full ProcessInfo for a process
   *
   * @param processId - The process ID
   * @returns The ProcessInfo or undefined if not found
   */
  getProcess(processId: string): ProcessInfo | undefined {
    return this.processes.get(processId);
  }

  /**
   * Get the status info for a process (without channel/connection)
   *
   * @param processId - The process ID
   * @returns Result with status info or PROCESS_NOT_FOUND error
   */
  getStatus(processId: string): Result<ProcessStatusInfo> {
    const process = this.processes.get(processId);
    if (!process) {
      return errorResult(
        ErrorCode.PROCESS_NOT_FOUND,
        `Process ${processId} not found`
      );
    }

    return {
      success: true,
      data: {
        status: process.status,
        exitCode: process.exitCode,
        signal: process.signal,
        outputSize: process.outputSize,
        errorSize: process.errorSize,
        startTime: process.startTime,
        endTime: process.endTime,
      },
    };
  }

  /**
   * Get output from a process with byte-offset pagination
   *
   * @param processId - The process ID
   * @param byteOffset - Starting byte offset
   * @param maxBytes - Maximum bytes to return (default 4KB)
   * @returns Result with output chunk or PROCESS_NOT_FOUND error
   */
  async getOutput(
    processId: string,
    byteOffset: number,
    maxBytes: number = 4096
  ): Promise<Result<OutputChunk>> {
    const process = this.processes.get(processId);
    if (!process) {
      return errorResult(
        ErrorCode.PROCESS_NOT_FOUND,
        `Process ${processId} not found`
      );
    }

    if (!fs.existsSync(process.tempOutputPath)) {
      return {
        success: true,
        data: { data: "", totalSize: 0, hasMore: false },
      };
    }

    const stat = fs.statSync(process.tempOutputPath);
    const totalSize = stat.size;

    if (byteOffset >= totalSize) {
      return {
        success: true,
        data: { data: "", totalSize, hasMore: false },
      };
    }

    const endOffset = Math.min(byteOffset + maxBytes, totalSize);
    const file = Bun.file(process.tempOutputPath);
    const buffer = await file.slice(byteOffset, endOffset).arrayBuffer();
    const data = Buffer.from(buffer).toString("utf8");

    return {
      success: true,
      data: {
        data,
        totalSize,
        hasMore: endOffset < totalSize,
      },
    };
  }

  /**
   * Kill a running process
   *
   * @param processId - The process ID
   * @param force - If true, send SIGKILL immediately; if false, SIGTERM then SIGKILL after 5s
   * @returns Result with new status or error
   */
  async killProcess(
    processId: string,
    force: boolean = false
  ): Promise<Result<{ status: ProcessStatus }>> {
    const process = this.processes.get(processId);
    if (!process) {
      return errorResult(
        ErrorCode.PROCESS_NOT_FOUND,
        `Process ${processId} not found`
      );
    }

    // Already completed - return current status
    if (process.status !== "running") {
      return { success: true, data: { status: process.status } };
    }

    try {
      const channel = process.channel as {
        signal: (sig: string) => void;
      } | null;

      if (force) {
        // Immediate SIGKILL
        if (channel && typeof channel.signal === "function") {
          channel.signal("KILL");
        }
      } else {
        // Graceful SIGTERM, then SIGKILL after 5s
        if (channel && typeof channel.signal === "function") {
          channel.signal("TERM");
        }

        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Escalate to SIGKILL if still running
            if (process.status === "running") {
              if (channel && typeof channel.signal === "function") {
                channel.signal("KILL");
              }
            }
            resolve();
          }, 5000);

          // Check periodically if process has exited
          const checkInterval = setInterval(() => {
            if (process.status !== "running") {
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      process.status = "killed";
      process.endTime = new Date();

      return { success: true, data: { status: "killed" } };
    } catch (err) {
      return errorResult(
        ErrorCode.INTERNAL_ERROR,
        `Failed to kill process: ${err}`
      );
    }
  }

  /**
   * Clean up a process - delete temp files and remove from tracking
   *
   * @param processId - The process ID
   */
  cleanupProcess(processId: string): void {
    const process = this.processes.get(processId);
    if (!process) return;

    // Delete temp files (ignore errors)
    try {
      if (fs.existsSync(process.tempOutputPath)) {
        fs.unlinkSync(process.tempOutputPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    try {
      if (fs.existsSync(process.tempErrorPath)) {
        fs.unlinkSync(process.tempErrorPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Remove from tracking
    this.processes.delete(processId);
  }
}
