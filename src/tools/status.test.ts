/**
 * Tests for get_command_status MCP tool
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { registerGetStatus } from "./status";
import { MockProcessManager, mockConfig } from "../test-utils";
import { ErrorCode } from "../errors";

// Mock McpServer
function createMockServer() {
  const tools: Array<{
    name: string;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  }> = [];

  return {
    tools,
    registerTool: mock((name: string, _def: unknown, handler: (params: Record<string, unknown>) => Promise<unknown>) => {
      tools.push({ name, handler });
    }),
  };
}

describe("get_command_status tool", () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockPM: MockProcessManager;

  beforeEach(() => {
    mockServer = createMockServer();
    mockPM = new MockProcessManager();
  });

  test("registers with correct tool name", () => {
    registerGetStatus(mockServer as unknown as Parameters<typeof registerGetStatus>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetStatus>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    expect(mockServer.tools).toHaveLength(1);
    expect(mockServer.tools[0].name).toBe("get_command_status");
  });

  test("returns status info for valid processId", async () => {
    registerGetStatus(mockServer as unknown as Parameters<typeof registerGetStatus>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetStatus>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    mockPM.setProcess("test-uuid", {
      status: "completed",
      exitCode: 0,
      outputSize: 1024,
    });

    const handler = mockServer.tools[0].handler;
    const response = await handler({ process_id: "test-uuid" });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe("completed");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.outputSize).toBe(1024);
    expect(response.isError).toBeUndefined();
  });

  test("returns PROCESS_NOT_FOUND for unknown processId", async () => {
    registerGetStatus(mockServer as unknown as Parameters<typeof registerGetStatus>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetStatus>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    const response = await handler({ process_id: "unknown-uuid" });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error_code).toBe(ErrorCode.PROCESS_NOT_FOUND);
    expect(response.isError).toBe(true);
  });

  test("returns all status fields", async () => {
    registerGetStatus(mockServer as unknown as Parameters<typeof registerGetStatus>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetStatus>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    const startTime = new Date("2024-01-01T00:00:00Z");
    const endTime = new Date("2024-01-01T00:00:10Z");

    mockPM.setProcess("test-uuid", {
      status: "completed",
      exitCode: 0,
      signal: null,
      outputSize: 1024,
      errorSize: 0,
      startTime,
      endTime,
    });

    const handler = mockServer.tools[0].handler;
    const response = await handler({ process_id: "test-uuid" });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.status).toBe("completed");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.signal).toBeNull();
    expect(parsed.outputSize).toBe(1024);
    expect(parsed.errorSize).toBe(0);
  });
});
