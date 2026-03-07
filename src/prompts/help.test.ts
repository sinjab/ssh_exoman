/**
 * Tests for ssh_help prompt handler
 *
 * These tests verify MCP prompt registration and content structure.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock server for testing
const mockRegisterPrompt = mock(() => {});

const mockServer = {
  registerPrompt: mockRegisterPrompt,
} as unknown as ReturnType<typeof import("@modelcontextprotocol/sdk/server/mcp.js").McpServer>;

describe("help prompt", () => {
  beforeEach(() => {
    mockRegisterPrompt.mockClear();
  });

  describe("registerHelpPrompt", () => {
    test("calls server.registerPrompt with name ssh_help", async () => {
      const { registerHelpPrompt } = await import("./help");

      registerHelpPrompt(mockServer);

      expect(mockRegisterPrompt).toHaveBeenCalledTimes(1);
      const [name] = mockRegisterPrompt.mock.calls[0];
      expect(name).toBe("ssh_help");
    });

    test("prompt returns messages array with assistant role", async () => {
      const { registerHelpPrompt } = await import("./help");

      registerHelpPrompt(mockServer);

      const handler = mockRegisterPrompt.mock.calls[0][2];
      const result = handler();

      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);

      const firstMessage = result.messages[0];
      expect(firstMessage.role).toBe("assistant");
    });

    test("prompt content includes all 5 tool names", async () => {
      const { registerHelpPrompt } = await import("./help");

      registerHelpPrompt(mockServer);

      const handler = mockRegisterPrompt.mock.calls[0][2];
      const result = handler();

      const content = result.messages[0].content;
      expect(content.type).toBe("text");

      const text = content.text;

      // Verify all 5 tools are mentioned
      expect(text).toContain("execute_command");
      expect(text).toContain("get_command_status");
      expect(text).toContain("get_command_output");
      expect(text).toContain("kill_command");
      expect(text).toContain("get_security_info");
    });

    test("prompt content includes workflow example", async () => {
      const { registerHelpPrompt } = await import("./help");

      registerHelpPrompt(mockServer);

      const handler = mockRegisterPrompt.mock.calls[0][2];
      const result = handler();

      const text = result.messages[0].content.text;

      // Should mention workflow steps
      expect(text.toLowerCase()).toMatch(/workflow|example/i);
    });

    test("prompt metadata has correct title and description", async () => {
      const { registerHelpPrompt } = await import("./help");

      registerHelpPrompt(mockServer);

      const metadata = mockRegisterPrompt.mock.calls[0][1];
      expect(metadata.title).toBe("SSH Help");
      expect(metadata.description.toLowerCase()).toContain("guidance");
    });
  });
});
