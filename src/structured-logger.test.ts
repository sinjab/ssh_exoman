import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { log, logger } from "./structured-logger";

describe("structured-logger", () => {
  let consoleErrorOutput: string[];
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleErrorOutput = [];
    // Mock console.error to capture output
    consoleErrorSpy = spyOn(console, "error").mockImplementation((message: string) => {
      consoleErrorOutput.push(message);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("log function", () => {
    test("writes to stderr via console.error", () => {
      log("info", "test message");
      expect(consoleErrorOutput.length).toBeGreaterThan(0);
    });

    test("outputs valid JSON", () => {
      log("info", "test message");
      const output = consoleErrorOutput.join("");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    test("includes timestamp in ISO 8601 format", () => {
      log("info", "test message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.timestamp).toBeDefined();
      // ISO 8601 regex pattern
      expect(output.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
      );
    });

    test("includes level field", () => {
      log("info", "test message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("info");
    });

    test("includes message field", () => {
      log("info", "test message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.message).toBe("test message");
    });

    test("includes service field", () => {
      log("info", "test message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.service).toBe("ssh-exoman");
    });

    test("optionally includes context object", () => {
      const context = { host: "example.com", port: 22 };
      log("info", "test message", context);
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.context).toEqual(context);
    });

    test("optionally includes traceId", () => {
      log("info", "test message", undefined, "trace-123");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.traceId).toBe("trace-123");
    });

    test("includes both context and traceId when provided", () => {
      const context = { userId: "user-1" };
      log("info", "test message", context, "trace-123");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.context).toEqual(context);
      expect(output.traceId).toBe("trace-123");
    });

    test("omits context when not provided", () => {
      log("info", "test message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.context).toBeUndefined();
    });

    test("omits traceId when not provided", () => {
      log("info", "test message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.traceId).toBeUndefined();
    });
  });

  describe("logger convenience methods", () => {
    test("logger.debug logs with debug level", () => {
      logger.debug("debug message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("debug");
      expect(output.message).toBe("debug message");
    });

    test("logger.info logs with info level", () => {
      logger.info("info message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("info");
      expect(output.message).toBe("info message");
    });

    test("logger.warn logs with warn level", () => {
      logger.warn("warn message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("warn");
      expect(output.message).toBe("warn message");
    });

    test("logger.error logs with error level", () => {
      logger.error("error message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("error");
      expect(output.message).toBe("error message");
    });

    test("logger convenience methods pass context through", () => {
      const context = { key: "value" };
      logger.info("message with context", context);
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.context).toEqual(context);
    });
  });

  describe("all log levels", () => {
    test("debug level works", () => {
      log("debug", "debug message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("debug");
    });

    test("info level works", () => {
      log("info", "info message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("info");
    });

    test("warn level works", () => {
      log("warn", "warn message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("warn");
    });

    test("error level works", () => {
      log("error", "error message");
      const output = JSON.parse(consoleErrorOutput.join(""));
      expect(output.level).toBe("error");
    });
  });
});
