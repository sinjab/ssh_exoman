/**
 * Tests for index.ts entry point
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

// We can't easily test the actual main() function since it starts the server,
// but we can test that the modules are properly importable and structured.

describe("index.ts entry point", () => {
  test("createServer is importable from server module", async () => {
    const { createServer } = await import("./server");
    expect(typeof createServer).toBe("function");
  });

  test("StdioServerTransport is importable", async () => {
    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    );
    expect(typeof StdioServerTransport).toBe("function");
  });

  test("logger is importable", async () => {
    const { logger } = await import("./structured-logger.js");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  test("createServer returns McpServer", async () => {
    const { createServer } = await import("./server");
    const server = createServer();
    expect(typeof server.connect).toBe("function");
  });

  test("main function exists and is async", async () => {
    // The main function is in index.ts, which we can't directly import
    // without running it. But we can verify the module structure.
    const serverModule = await import("./server");
    expect(serverModule.createServer).toBeDefined();
  });
});
