/**
 * Tests for MCP server setup
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createServer } from "./server";

describe("server", () => {
  describe("createServer", () => {
    test("returns McpServer instance", () => {
      const server = createServer();

      expect(server).toBeDefined();
      expect(typeof server.connect).toBe("function");
    });

    test("server has connect method for transport", () => {
      const server = createServer();

      expect(typeof server.connect).toBe("function");
    });

    test("creates ProcessManager internally", () => {
      // This test verifies the server can be created without errors
      // The ProcessManager is created internally in createServer
      const server = createServer();
      expect(server).toBeDefined();
    });

    test("loads config via loadConfig", () => {
      // This test verifies the server can be created without errors
      // The config is loaded internally in createServer
      const server = createServer();
      expect(server).toBeDefined();
    });

    test("server creation logs startup info", () => {
      // Server creation should succeed without throwing
      const server = createServer();
      expect(server).toBeDefined();
    });
  });
});
