/**
 * Tests for get_command_output MCP tool
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { registerGetOutput } from "./output";
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
    tool: mock((name: string, _def: unknown, handler: (params: Record<string, unknown>) => Promise<unknown>) => {
      tools.push({ name, handler });
    }),
  };
}

describe("get_command_output tool", () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockPM: MockProcessManager;

  beforeEach(() => {
    mockServer = createMockServer();
    mockPM = new MockProcessManager();
  });

  test("registers with correct tool name", () => {
    registerGetOutput(mockServer as unknown as Parameters<typeof registerGetOutput>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetOutput>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    expect(mockServer.tools).toHaveLength(1);
    expect(mockServer.tools[0].name).toBe("get_command_output");
  });

  test("returns output chunk for valid processId", async () => {
    registerGetOutput(mockServer as unknown as Parameters<typeof registerGetOutput>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetOutput>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    mockPM.setProcess(
      "test-uuid",
      { status: "running" },
      { data: "Hello, world!", totalSize: 13, hasMore: false }
    );

    const handler = mockServer.tools[0].handler;
    const response = await handler({ process_id: "test-uuid" });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe("Hello, world!");
    expect(parsed.totalSize).toBe(13);
    expect(parsed.hasMore).toBe(false);
    expect(response.isError).toBeUndefined();
  });

  test("returns PROCESS_NOT_FOUND for unknown processId", async () => {
    registerGetOutput(mockServer as unknown as Parameters<typeof registerGetOutput>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetOutput>[1]["processManager"],
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

  test("calls getOutput with correct parameters", async () => {
    registerGetOutput(mockServer as unknown as Parameters<typeof registerGetOutput>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerGetOutput>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    mockPM.setProcess("test-uuid", { status: "running" });

    const handler = mockServer.tools[0].handler;
    await handler({ process_id: "test-uuid", byte_offset: 100, max_bytes: 1024 });

    expect(mockPM.calls.getOutput).toHaveLength(1);
    expect(mockPM.calls.getOutput[0]).toEqual({
      processId: "test-uuid",
      byteOffset: 100,
      maxBytes: 1024,
    });
  });
});
