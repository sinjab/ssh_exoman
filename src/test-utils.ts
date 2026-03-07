/**
 * Test utilities and shared MCP response helpers for ssh-exoman
 *
 * Provides mock implementations and response formatting for MCP tools.
 */

import type { Result, AppConfig, ProcessStatus } from "./types";
import { ErrorCode } from "./errors";
import type { ProcessStatusInfo, OutputChunk } from "./ssh/process-manager";

// ============================================================================
// MCP Response Types
// ============================================================================

/**
 * MCP tool response content
 */
export interface McpContent {
  type: "text";
  text: string;
}

/**
 * MCP tool response shape
 */
export interface McpResponse {
  content: McpContent[];
  isError?: boolean;
}

// ============================================================================
// resultToMcpResponse Helper
// ============================================================================

/**
 * Convert a Result<T> to an MCP response.
 *
 * CRITICAL: Never throws. All responses are valid MCP content.
 * - Success: Returns content with success=true and data spread
 * - Failure: Returns content with success=false, error_code, error_message, and isError=true
 *
 * @param result - The Result<T> from a service function
 * @returns McpResponse with appropriate content and isError flag
 */
export function resultToMcpResponse<T>(result: Result<T>): McpResponse {
  if (result.success) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, ...result.data }),
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error_code: result.error.code,
            error_message: result.error.message,
          }),
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// Mock ProcessManager
// ============================================================================

/**
 * Mock ProcessManager for testing MCP tools
 */
export class MockProcessManager {
  private processes = new Map<
    string,
    {
      status: ProcessStatusInfo;
      output?: OutputChunk;
    }
  >();

  // Track calls for assertions
  public calls = {
    getStatus: [] as string[],
    getOutput: [] as { processId: string; byteOffset: number; maxBytes: number }[],
    killProcess: [] as { processId: string; force: boolean }[],
  };

  /**
   * Set up a mock process with status and optional output
   */
  setProcess(
    processId: string,
    status: Partial<ProcessStatusInfo>,
    output?: OutputChunk
  ): void {
    this.processes.set(processId, {
      status: {
        status: status.status ?? "running",
        exitCode: status.exitCode ?? null,
        signal: status.signal ?? null,
        outputSize: status.outputSize ?? 0,
        errorSize: status.errorSize ?? 0,
        startTime: status.startTime ?? new Date(),
        endTime: status.endTime ?? null,
      },
      output,
    });
  }

  /**
   * Mock getStatus implementation
   */
  getStatus(processId: string): Result<ProcessStatusInfo> {
    this.calls.getStatus.push(processId);
    const process = this.processes.get(processId);
    if (!process) {
      return {
        success: false,
        error: {
          code: ErrorCode.PROCESS_NOT_FOUND,
          message: `Process ${processId} not found`,
        },
      };
    }
    return { success: true, data: process.status };
  }

  /**
   * Mock getOutput implementation
   */
  async getOutput(
    processId: string,
    byteOffset: number,
    maxBytes: number
  ): Promise<Result<OutputChunk>> {
    this.calls.getOutput.push({ processId, byteOffset, maxBytes });
    const process = this.processes.get(processId);
    if (!process) {
      return {
        success: false,
        error: {
          code: ErrorCode.PROCESS_NOT_FOUND,
          message: `Process ${processId} not found`,
        },
      };
    }
    return {
      success: true,
      data: process.output ?? { data: "", totalSize: 0, hasMore: false },
    };
  }

  /**
   * Mock killProcess implementation
   */
  async killProcess(
    processId: string,
    force: boolean = false
  ): Promise<Result<{ status: ProcessStatus }>> {
    this.calls.killProcess.push({ processId, force });
    const process = this.processes.get(processId);
    if (!process) {
      return {
        success: false,
        error: {
          code: ErrorCode.PROCESS_NOT_FOUND,
          message: `Process ${processId} not found`,
        },
      };
    }
    return { success: true, data: { status: "killed" } };
  }

  /**
   * Clear all tracked state
   */
  reset(): void {
    this.processes.clear();
    this.calls.getStatus = [];
    this.calls.getOutput = [];
    this.calls.killProcess = [];
  }
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Create a mock ProcessManager with sensible defaults
 */
export function mockProcessManager(): MockProcessManager {
  return new MockProcessManager();
}

/**
 * Create a mock AppConfig with test-friendly defaults
 */
export function mockConfig(): AppConfig {
  return {
    securityMode: "disabled", // Safest for tests
    sshConnectTimeout: 5000,
    commandTimeout: 10000,
    logLevel: "error",
  };
}
