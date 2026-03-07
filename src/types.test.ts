import { test, expect, describe } from "bun:test";
import type {
  Result,
  SecurityMode,
  ProcessStatus,
  SecurityConfig,
  ValidationResult,
  LogLevel,
} from "./types";

// Runtime type guards to verify types at runtime
function isSuccess<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success === true;
}

function isFailure<T>(result: Result<T>): result is { success: false; error: { code: string; message: string } } {
  return result.success === false;
}

describe("Result type", () => {
  test("success case narrows to data access", () => {
    const result: Result<string> = { success: true, data: "test data" };

    expect(result.success).toBe(true);
    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data).toBe("test data");
    }
  });

  test("failure case narrows to error access", () => {
    const result: Result<string> = {
      success: false,
      error: { code: "TEST_ERROR", message: "Something went wrong" },
    };

    expect(result.success).toBe(false);
    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe("TEST_ERROR");
      expect(result.error.message).toBe("Something went wrong");
    }
  });
});

describe("SecurityMode type", () => {
  test("accepts 'blacklist' value", () => {
    const mode: SecurityMode = "blacklist";
    expect(mode).toBe("blacklist");
  });

  test("accepts 'whitelist' value", () => {
    const mode: SecurityMode = "whitelist";
    expect(mode).toBe("whitelist");
  });

  test("accepts 'disabled' value", () => {
    const mode: SecurityMode = "disabled";
    expect(mode).toBe("disabled");
  });
});

describe("ProcessStatus type", () => {
  test("accepts 'running' value", () => {
    const status: ProcessStatus = "running";
    expect(status).toBe("running");
  });

  test("accepts 'completed' value", () => {
    const status: ProcessStatus = "completed";
    expect(status).toBe("completed");
  });

  test("accepts 'failed' value", () => {
    const status: ProcessStatus = "failed";
    expect(status).toBe("failed");
  });

  test("accepts 'killed' value", () => {
    const status: ProcessStatus = "killed";
    expect(status).toBe("killed");
  });
});

describe("SecurityConfig interface", () => {
  test("accepts valid config object", () => {
    const config: SecurityConfig = {
      mode: "blacklist",
      patterns: ["rm -rf", "dd"],
    };

    expect(config.mode).toBe("blacklist");
    expect(config.patterns).toEqual(["rm -rf", "dd"]);
  });

  test("accepts whitelist mode with patterns", () => {
    const config: SecurityConfig = {
      mode: "whitelist",
      patterns: ["ls", "cat"],
    };

    expect(config.mode).toBe("whitelist");
    expect(config.patterns).toHaveLength(2);
  });
});

describe("ValidationResult interface", () => {
  test("accepts allowed result without optional fields", () => {
    const result: ValidationResult = {
      allowed: true,
    };

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.matchedPattern).toBeUndefined();
  });

  test("accepts blocked result with reason and matchedPattern", () => {
    const result: ValidationResult = {
      allowed: false,
      reason: "Command matches blacklist pattern",
      matchedPattern: "rm -rf",
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Command matches blacklist pattern");
    expect(result.matchedPattern).toBe("rm -rf");
  });
});

describe("LogLevel type", () => {
  test("accepts 'debug' value", () => {
    const level: LogLevel = "debug";
    expect(level).toBe("debug");
  });

  test("accepts 'info' value", () => {
    const level: LogLevel = "info";
    expect(level).toBe("info");
  });

  test("accepts 'warn' value", () => {
    const level: LogLevel = "warn";
    expect(level).toBe("warn");
  });

  test("accepts 'error' value", () => {
    const level: LogLevel = "error";
    expect(level).toBe("error");
  });
});
