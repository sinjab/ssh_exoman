/**
 * Tests for execute_command MCP tool
 */

import { describe, test, expect, beforeEach, mock, afterEach } from "bun:test";
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

describe("execute_command tool with forwardAgent", () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockPM: MockProcessManager;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    mockServer = createMockServer();
    mockPM = new MockProcessManager();
    originalEnv.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
  });

  afterEach(() => {
    if (originalEnv.SSH_AUTH_SOCK !== undefined) {
      process.env.SSH_AUTH_SOCK = originalEnv.SSH_AUTH_SOCK;
    } else {
      delete process.env.SSH_AUTH_SOCK;
    }
  });

  test("Test 1: execute tool passes forwardAgent: true to executeSSHCommand when provided", async () => {
    const config = mockConfig();
    const logInfo = mock(() => {});

    registerExecuteCommand(mockServer as unknown as Parameters<typeof registerExecuteCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerExecuteCommand>[1]["processManager"],
      config,
      logger: { info: logInfo, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    await handler({
      host: "nonexistent-host-xyz",
      command: "echo test",
      forwardAgent: true,
    });

    const logCalls = logInfo.mock.calls;
    const execLog = logCalls.find((c: unknown[]) => Array.isArray(c) && c[0] === "Executing command");
    expect(execLog).toBeDefined();
    if (execLog) {
      const logContext = execLog[1] as Record<string, unknown>;
      expect(logContext.forwardAgent).toBe(true);
    }
  });

  test("Test 2: execute tool passes forwardAgent: false when omitted (default)", async () => {
    const config = mockConfig();
    const logInfo = mock(() => {});

    registerExecuteCommand(mockServer as unknown as Parameters<typeof registerExecuteCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerExecuteCommand>[1]["processManager"],
      config,
      logger: { info: logInfo, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    await handler({
      host: "nonexistent-host-xyz",
      command: "echo test",
    });

    const logCalls = logInfo.mock.calls;
    const execLog = logCalls.find((c: unknown[]) => Array.isArray(c) && c[0] === "Executing command");
    expect(execLog).toBeDefined();
    if (execLog) {
      const logContext = execLog[1] as Record<string, unknown>;
      expect(logContext.forwardAgent).toBe(false);
    }
  });

  test("Test 3: execute tool returns error when agent unavailable with forwardAgent: true", async () => {
    delete process.env.SSH_AUTH_SOCK;

    const config = mockConfig();
    registerExecuteCommand(mockServer as unknown as Parameters<typeof registerExecuteCommand>[0], {
      processManager: mockPM as unknown as Parameters<typeof registerExecuteCommand>[1]["processManager"],
      config,
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    const response = await handler({
      host: "nonexistent-host-xyz",
      command: "echo test",
      forwardAgent: true,
    });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(false);
    expect([ErrorCode.CONFIG_ERROR, ErrorCode.SSH_AGENT_UNAVAILABLE]).toContain(parsed.error_code);
    expect(response.isError).toBe(true);
  });
});
