/**
 * Tests for ssh://hosts resource handler
 *
 * These tests verify MCP registration behavior. The underlying
 * listHosts() function's wildcard filtering is tested in
 * src/ssh/config-parser.test.ts.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import SSHConfig from "ssh-config";

// Mock server for testing
const mockRegisterResource = mock(() => {});

const mockServer = {
  registerResource: mockRegisterResource,
} as unknown as ReturnType<typeof import("@modelcontextprotocol/sdk/server/mcp.js").McpServer>;

// We need to mock the config-parser module to provide test data
const testConfig = new SSHConfig();

describe("hosts resource", () => {
  beforeEach(() => {
    mockRegisterResource.mockClear();
  });

  describe("registerHostsResource", () => {
    test("calls server.registerResource with correct URI", async () => {
      const { registerHostsResource } = await import("./hosts");

      registerHostsResource(mockServer);

      expect(mockRegisterResource).toHaveBeenCalledTimes(1);
      const [name, uri] = mockRegisterResource.mock.calls[0];
      expect(name).toBe("hosts");
      expect(uri).toBe("ssh://hosts");
    });

    test("resource returns correct metadata", async () => {
      const { registerHostsResource } = await import("./hosts");

      registerHostsResource(mockServer);

      const metadata = mockRegisterResource.mock.calls[0][2];
      expect(metadata.title).toBe("SSH Hosts");
      expect(metadata.description).toContain("host aliases");
      expect(metadata.mimeType).toBe("application/json");
    });

    test("resource handler returns proper MCP response structure", async () => {
      const { registerHostsResource } = await import("./hosts");

      registerHostsResource(mockServer);

      const handler = mockRegisterResource.mock.calls[0][3];
      const result = await handler(new URL("ssh://hosts"));

      // Verify MCP resource response structure
      expect(result).toHaveProperty("contents");
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.contents).toHaveLength(1);

      const content = result.contents[0];
      expect(content).toHaveProperty("uri", "ssh://hosts");
      expect(content).toHaveProperty("mimeType", "application/json");
      expect(content).toHaveProperty("text");
    });

    test("resource handler returns JSON array that can be parsed", async () => {
      const { registerHostsResource } = await import("./hosts");

      registerHostsResource(mockServer);

      const handler = mockRegisterResource.mock.calls[0][3];
      const result = await handler(new URL("ssh://hosts"));

      const content = result.contents[0];
      // Should be valid JSON
      const hosts = JSON.parse(content.text);
      expect(Array.isArray(hosts)).toBe(true);
    });

    test("resource handler filters out wildcard patterns via listHosts", async () => {
      // This test verifies that the resource uses listHosts which already
      // filters wildcards. The actual wildcard filtering logic is tested
      // in src/ssh/config-parser.test.ts.
      // Here we just verify the integration works.
      const { registerHostsResource } = await import("./hosts");

      registerHostsResource(mockServer);

      const handler = mockRegisterResource.mock.calls[0][3];
      const result = await handler(new URL("ssh://hosts"));

      const hosts = JSON.parse(result.contents[0].text);
      // listHosts should never return patterns containing "*"
      const hasWildcards = hosts.some((h: string) => h.includes("*"));
      expect(hasWildcards).toBe(false);
    });
  });
});
