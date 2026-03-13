import { test, expect, describe } from "bun:test";
import { ErrorCode, createError, errorResult, type Result } from "./errors";

describe("ErrorCode enum", () => {
  test("contains all required codes", () => {
    expect(ErrorCode.SECURITY_BLOCKED).toBe("SECURITY_BLOCKED");
    expect(ErrorCode.PROCESS_NOT_FOUND).toBe("PROCESS_NOT_FOUND");
    expect(ErrorCode.PROCESS_TIMEOUT).toBe("PROCESS_TIMEOUT");
    expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
    expect(ErrorCode.CONFIG_ERROR).toBe("CONFIG_ERROR");
    expect(ErrorCode.SSH_CONNECTION_FAILED).toBe("SSH_CONNECTION_FAILED");
    expect(ErrorCode.SSH_AUTH_FAILED).toBe("SSH_AUTH_FAILED");
    expect(ErrorCode.SSH_AGENT_UNAVAILABLE).toBe("SSH_AGENT_UNAVAILABLE");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });

  test("codes are string values (not numeric)", () => {
    // Verify all codes are string values
    expect(typeof ErrorCode.SECURITY_BLOCKED).toBe("string");
    expect(typeof ErrorCode.PROCESS_NOT_FOUND).toBe("string");
    expect(typeof ErrorCode.INTERNAL_ERROR).toBe("string");
  });
});

describe("createError factory", () => {
  test("returns correct shape with code and message", () => {
    const error = createError(ErrorCode.INVALID_INPUT, "Input cannot be empty");

    expect(error).toEqual({
      code: ErrorCode.INVALID_INPUT,
      message: "Input cannot be empty",
    });
  });

  test("works with all error codes", () => {
    const securityError = createError(ErrorCode.SECURITY_BLOCKED, "Command blocked by security policy");
    expect(securityError.code).toBe("SECURITY_BLOCKED");

    const processError = createError(ErrorCode.PROCESS_NOT_FOUND, "Process with ID not found");
    expect(processError.code).toBe("PROCESS_NOT_FOUND");

    const sshError = createError(ErrorCode.SSH_CONNECTION_FAILED, "Failed to connect to host");
    expect(sshError.code).toBe("SSH_CONNECTION_FAILED");
  });
});

describe("errorResult helper", () => {
  test("returns Result failure shape", () => {
    type TestType = { value: string };
    const result = errorResult<TestType>(ErrorCode.INVALID_INPUT, "Invalid parameter");

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.message).toBe("Invalid parameter");
    }
  });

  test("preserves type parameter for type safety", () => {
    // Verify the the Result type is properly returned
    const result = errorResult<string>(ErrorCode.CONFIG_ERROR, "Missing config");

    // TypeScript should infer T as string
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Missing config");
    }
  });
});
