import { test, expect, describe } from "bun:test";
import type {
  Result,
  SecurityMode,
  ProcessStatus,
  SecurityConfig,
  ValidationResult,
  LogLevel,
  ProcessInfo,
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

describe("ProcessInfo interface", () => {
  test("accepts valid ProcessInfo object with running status", () => {
    const info: ProcessInfo = {
      processId: "123e4567-e89b-12d3-a456-426614174000",
      host: "example.com",
      command: "ls -la",
      status: "running",
      exitCode: null,
      signal: null,
      startTime: new Date(),
      endTime: null,
      outputSize: 0,
      errorSize: 0,
      tempOutputPath: "/tmp/ssh-exoman-123e4567-e89b-12d3-a456-426614174000.out",
      tempErrorPath: "/tmp/ssh-exoman-123e4567-e89b-12d3-a456-426614174000.err",
      channel: null,
      connection: null,
    };

    expect(info.processId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(info.status).toBe("running");
    expect(info.exitCode).toBeNull();
  });

  test("accepts valid ProcessInfo object with completed status", () => {
    const info: ProcessInfo = {
      processId: "123e4567-e89b-12d3-a456-426614174001",
      host: "server.example.com",
      command: "echo hello",
      status: "completed",
      exitCode: 0,
      signal: null,
      startTime: new Date("2026-03-07T10:00:00Z"),
      endTime: new Date("2026-03-07T10:00:01Z"),
      outputSize: 6,
      errorSize: 0,
      tempOutputPath: "/tmp/ssh-exoman-123e4567-e89b-12d3-a456-426614174001.out",
      tempErrorPath: "/tmp/ssh-exoman-123e4567-e89b-12d3-a456-426614174001.err",
      channel: null,
      connection: null,
    };

    expect(info.status).toBe("completed");
    expect(info.exitCode).toBe(0);
    expect(info.outputSize).toBe(6);
  });

  test("accepts valid ProcessInfo object with failed status", () => {
    const info: ProcessInfo = {
      processId: "123e4567-e89b-12d3-a456-426614174002",
      host: "localhost",
      command: "exit 1",
      status: "failed",
      exitCode: 1,
      signal: null,
      startTime: new Date(),
      endTime: new Date(),
      outputSize: 0,
      errorSize: 0,
      tempOutputPath: "/tmp/out",
      tempErrorPath: "/tmp/err",
      channel: null,
      connection: null,
    };

    expect(info.status).toBe("failed");
    expect(info.exitCode).toBe(1);
  });

  test("accepts valid ProcessInfo object with killed status", () => {
    const info: ProcessInfo = {
      processId: "123e4567-e89b-12d3-a456-426614174003",
      host: "remote.host",
      command: "sleep 100",
      status: "killed",
      exitCode: null,
      signal: "TERM",
      startTime: new Date(),
      endTime: new Date(),
      outputSize: 0,
      errorSize: 0,
      tempOutputPath: "/tmp/out",
      tempErrorPath: "/tmp/err",
      channel: null,
      connection: null,
    };

    expect(info.status).toBe("killed");
    expect(info.signal).toBe("TERM");
  });
});
