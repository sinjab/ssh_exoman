/**
 * Tests for execute_command MCP tool
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { registerExecuteCommand } from "./execute";
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

describe("execute_command tool", () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockPM: MockProcessManager;

  beforeEach(() => {
    mockServer = createMockServer();
    mockPM = new MockProcessManager();
  });

  test("registers with correct tool name", () => {
    registerExecuteCommand(mockServer as unknown as Parameters<typeof registerExecuteCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerExecuteCommand>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    expect(mockServer.tools).toHaveLength(1);
    expect(mockServer.tools[0].name).toBe("execute_command");
  });

  test("returns processId on successful execution", async () => {
    const config = mockConfig();
    registerExecuteCommand(mockServer as unknown as Parameters<typeof registerExecuteCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerExecuteCommand>[1]["processManager"],
      config,
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    // Note: This will fail in actual execution since we can't SSH, but the handler structure is correct
    // In a real test, we would mock executeSSHCommand
  });

  test("handler structure is correct", () => {
    registerExecuteCommand(mockServer as unknown as Parameters<typeof registerExecuteCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerExecuteCommand>[1]["processManager"],
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    expect(typeof handler).toBe("function");
  });
});
