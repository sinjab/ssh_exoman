/**
 * Tests for test utilities and shared MCP response helpers
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  resultToMcpResponse,
  MockProcessManager,
  mockProcessManager,
  mockConfig,
} from "./test-utils";
import { ErrorCode } from "./errors";

describe("test-utils", () => {
  describe("mockProcessManager", () => {
    test("returns consistent mock with all required methods", () => {
      const pm = mockProcessManager();

      expect(pm).toBeDefined();
      expect(typeof pm.getStatus).toBe("function");
      expect(typeof pm.getOutput).toBe("function");
      expect(typeof pm.killProcess).toBe("function");
      expect(typeof pm.setProcess).toBe("function");
      expect(typeof pm.reset).toBe("function");
    });

    test("getStatus returns PROCESS_NOT_FOUND for unknown process", () => {
      const pm = mockProcessManager();
      const result = pm.getStatus("nonexistent-uuid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.PROCESS_NOT_FOUND);
      }
    });

    test("getStatus returns status for known process", () => {
      const pm = mockProcessManager();
      pm.setProcess("test-uuid", { status: "running" });

      const result = pm.getStatus("test-uuid");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("running");
      }
    });

    test("tracks calls for assertions", () => {
      const pm = mockProcessManager();
      pm.getStatus("process-1");
      pm.getStatus("process-2");

      expect(pm.calls.getStatus).toEqual(["process-1", "process-2"]);
    });
  });

  describe("mockConfig", () => {
    test("returns valid AppConfig with defaults", () => {
      const config = mockConfig();

      expect(config.securityMode).toBe("disabled");
      expect(config.sshConnectTimeout).toBe(5000);
      expect(config.commandTimeout).toBe(10000);
      expect(config.logLevel).toBe("error");
    });
  });

  describe("resultToMcpResponse", () => {
    test("converts success Result to MCP content without isError", () => {
      const result = { success: true as const, data: { processId: "abc-123" } };
      const response = resultToMcpResponse(result);

      expect(response.isError).toBeUndefined();
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.processId).toBe("abc-123");
    });

    test("converts failure Result to MCP content with isError: true", () => {
      const result = {
        success: false as const,
        error: {
          code: ErrorCode.PROCESS_NOT_FOUND,
          message: "Process not found",
        },
      };
      const response = resultToMcpResponse(result);

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe(ErrorCode.PROCESS_NOT_FOUND);
      expect(parsed.error_message).toBe("Process not found");
    });

    test("spreads data correctly for complex success results", () => {
      const result = {
        success: true as const,
        data: {
          status: "completed" as const,
          exitCode: 0,
          outputSize: 1024,
          startTime: "2024-01-01T00:00:00Z",
        },
      };
      const response = resultToMcpResponse(result);

      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.status).toBe("completed");
      expect(parsed.exitCode).toBe(0);
      expect(parsed.outputSize).toBe(1024);
    });
  });
});
