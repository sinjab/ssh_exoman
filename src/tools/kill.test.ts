/**
 * Tests for kill_command MCP tool
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { registerKillCommand } from "./kill";
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

describe("kill_command tool", () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockPM: MockProcessManager;

  beforeEach(() => {
    mockServer = createMockServer();
    mockPM = new MockProcessManager();
  });

  test("registers with correct tool name", () => {
    registerKillCommand(mockServer as unknown as Parameters<typeof registerKillCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerKillCommand>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    expect(mockServer.tools).toHaveLength(1);
    expect(mockServer.tools[0].name).toBe("kill_command");
  });

  test("calls killProcess with valid processId", async () => {
    registerKillCommand(mockServer as unknown as Parameters<typeof registerKillCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerKillCommand>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    mockPM.setProcess("test-uuid", { status: "running" });

    const handler = mockServer.tools[0].handler;
    const response = await handler({ process_id: "test-uuid" });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe("killed");
    expect(response.isError).toBeUndefined();

    expect(mockPM.calls.killProcess).toHaveLength(1);
    expect(mockPM.calls.killProcess[0].processId).toBe("test-uuid");
    expect(mockPM.calls.killProcess[0].force).toBe(false);
  });

  test("passes force=true when specified", async () => {
    registerKillCommand(mockServer as unknown as Parameters<typeof registerKillCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerKillCommand>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    mockPM.setProcess("test-uuid", { status: "running" });

    const handler = mockServer.tools[0].handler;
    await handler({ process_id: "test-uuid", force: true });

    expect(mockPM.calls.killProcess).toHaveLength(1);
    expect(mockPM.calls.killProcess[0].force).toBe(true);
  });

  test("returns PROCESS_NOT_FOUND for unknown processId", async () => {
    registerKillCommand(mockServer as unknown as Parameters<typeof registerKillCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerKillCommand>[1]["processManager"],
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
});
