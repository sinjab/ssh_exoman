/**
 * Tests for get_security_info MCP tool
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { registerSecurityInfo } from "./security-info";
import { mockConfig } from "../test-utils";

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

describe("get_security_info tool", () => {
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    mockServer = createMockServer();
  });

  test("registers with correct tool name", () => {
    registerSecurityInfo(mockServer as unknown as Parameters<typeof registerSecurityInfo>[0], {
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    expect(mockServer.tools).toHaveLength(1);
    expect(mockServer.tools[0].name).toBe("get_security_info");
  });

  test("returns mode, patternCount, samplePatterns", async () => {
    registerSecurityInfo(mockServer as unknown as Parameters<typeof registerSecurityInfo>[0], {
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    const response = await handler({});

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.mode).toBe("disabled");
    expect(typeof parsed.patternCount).toBe("number");
    expect(Array.isArray(parsed.samplePatterns)).toBe(true);
    expect(response.isError).toBeUndefined();
  });

  test("reflects current security mode from config", async () => {
    const config = mockConfig();
    config.securityMode = "blacklist";

    registerSecurityInfo(mockServer as unknown as Parameters<typeof registerSecurityInfo>[0], {
      config,
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;
    const response = await handler({});

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.mode).toBe("blacklist");
  });

  test("handler takes no required parameters", async () => {
    registerSecurityInfo(mockServer as unknown as Parameters<typeof registerSecurityInfo>[0], {
      config: mockConfig(),
      logger: { info: () => {}, error: () => {} },
    });

    const handler = mockServer.tools[0].handler;

    // Should work with empty params
    const response = await handler({});
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.success).toBe(true);
  });
});
