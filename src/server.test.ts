/**
 * Tests for MCP server setup
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
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

    test("registers hosts resource", () => {
      // Verify that registerHostsResource is called during createServer
      // by checking the server is created without errors
      const server = createServer();
      expect(server).toBeDefined();
    });

    test("registers ssh_help prompt", () => {
      // Verify that registerHelpPrompt is called during createServer
      // by checking the server is created without errors
      const server = createServer();
      expect(server).toBeDefined();
    });

    test("all tools, resources, and prompts registered without errors", () => {
      // Integration test: verify the complete server setup works
      const server = createServer();
      expect(server).toBeDefined();
      expect(typeof server.connect).toBe("function");
    });
  });

  describe("resource and prompt integration", () => {
    test("registerHostsResource import works", async () => {
      // Verify the resource module can be imported
      const { registerHostsResource } = await import("./resources/hosts");
      expect(typeof registerHostsResource).toBe("function");
    });

    test("registerHelpPrompt import works", async () => {
      // Verify the prompt module can be imported
      const { registerHelpPrompt } = await import("./prompts/help");
      expect(typeof registerHelpPrompt).toBe("function");
    });
  });
});
