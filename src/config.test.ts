import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "./config";
import type { AppConfig } from "./types";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all SSH_EXOMAN_ env vars before each test
    delete process.env.SSH_EXOMAN_SECURITY_MODE;
    delete process.env.SSH_EXOMAN_CONNECT_TIMEOUT;
    delete process.env.SSH_EXOMAN_COMMAND_TIMEOUT;
    delete process.env.SSH_EXOMAN_LOG_LEVEL;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("default values", () => {
    test("returns default values when no env vars set", () => {
      const config = loadConfig();

      expect(config.securityMode).toBe("blacklist");
      expect(config.sshConnectTimeout).toBe(30000);
      expect(config.commandTimeout).toBe(60000);
      expect(config.logLevel).toBe("info");
    });
  });

  describe("SSH_EXOMAN_SECURITY_MODE", () => {
    test('reads "blacklist" from env', () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "blacklist";
      const config = loadConfig();
      expect(config.securityMode).toBe("blacklist");
    });

    test('reads "whitelist" from env', () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "whitelist";
      const config = loadConfig();
      expect(config.securityMode).toBe("whitelist");
    });

    test('reads "disabled" from env', () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "disabled";
      const config = loadConfig();
      expect(config.securityMode).toBe("disabled");
    });

    test('falls back to "blacklist" for invalid value', () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "invalid-mode";
      const config = loadConfig();
      expect(config.securityMode).toBe("blacklist");
    });

    test("falls back to blacklist for empty string", () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "";
      const config = loadConfig();
      expect(config.securityMode).toBe("blacklist");
    });

    test("falls back to blacklist for case-sensitive mismatch", () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "BLACKLIST";
      const config = loadConfig();
      expect(config.securityMode).toBe("blacklist");
    });
  });

  describe("SSH_EXOMAN_CONNECT_TIMEOUT", () => {
    test("parses valid numeric value", () => {
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "15000";
      const config = loadConfig();
      expect(config.sshConnectTimeout).toBe(15000);
    });

    test("falls back to default for non-numeric value", () => {
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "not-a-number";
      const config = loadConfig();
      expect(config.sshConnectTimeout).toBe(30000);
    });

    test("falls back to default for empty string", () => {
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "";
      const config = loadConfig();
      expect(config.sshConnectTimeout).toBe(30000);
    });

    test("falls back to default for negative number", () => {
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "-5000";
      const config = loadConfig();
      expect(config.sshConnectTimeout).toBe(30000);
    });

    test("parses zero as valid value", () => {
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "0";
      const config = loadConfig();
      expect(config.sshConnectTimeout).toBe(0);
    });

    test("handles whitespace in value", () => {
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "  20000  ";
      const config = loadConfig();
      // parseInt with radix handles leading/trailing whitespace
      expect(config.sshConnectTimeout).toBe(20000);
    });
  });

  describe("SSH_EXOMAN_COMMAND_TIMEOUT", () => {
    test("parses valid numeric value", () => {
      process.env.SSH_EXOMAN_COMMAND_TIMEOUT = "120000";
      const config = loadConfig();
      expect(config.commandTimeout).toBe(120000);
    });

    test("falls back to default for non-numeric value", () => {
      process.env.SSH_EXOMAN_COMMAND_TIMEOUT = "abc";
      const config = loadConfig();
      expect(config.commandTimeout).toBe(60000);
    });

    test("falls back to default for negative number", () => {
      process.env.SSH_EXOMAN_COMMAND_TIMEOUT = "-1000";
      const config = loadConfig();
      expect(config.commandTimeout).toBe(60000);
    });
  });

  describe("SSH_EXOMAN_LOG_LEVEL", () => {
    test('reads "debug" from env', () => {
      process.env.SSH_EXOMAN_LOG_LEVEL = "debug";
      const config = loadConfig();
      expect(config.logLevel).toBe("debug");
    });

    test('reads "info" from env', () => {
      process.env.SSH_EXOMAN_LOG_LEVEL = "info";
      const config = loadConfig();
      expect(config.logLevel).toBe("info");
    });

    test('reads "warn" from env', () => {
      process.env.SSH_EXOMAN_LOG_LEVEL = "warn";
      const config = loadConfig();
      expect(config.logLevel).toBe("warn");
    });

    test('reads "error" from env', () => {
      process.env.SSH_EXOMAN_LOG_LEVEL = "error";
      const config = loadConfig();
      expect(config.logLevel).toBe("error");
    });

    test('falls back to "info" for invalid value', () => {
      process.env.SSH_EXOMAN_LOG_LEVEL = "verbose";
      const config = loadConfig();
      expect(config.logLevel).toBe("info");
    });

    test("falls back to info for case-sensitive mismatch", () => {
      process.env.SSH_EXOMAN_LOG_LEVEL = "DEBUG";
      const config = loadConfig();
      expect(config.logLevel).toBe("info");
    });
  });

  describe("edge cases", () => {
    test("handles all env vars set to valid values", () => {
      process.env.SSH_EXOMAN_SECURITY_MODE = "whitelist";
      process.env.SSH_EXOMAN_CONNECT_TIMEOUT = "25000";
      process.env.SSH_EXOMAN_COMMAND_TIMEOUT = "90000";
      process.env.SSH_EXOMAN_LOG_LEVEL = "debug";

      const config = loadConfig();

      expect(config.securityMode).toBe("whitelist");
      expect(config.sshConnectTimeout).toBe(25000);
      expect(config.commandTimeout).toBe(90000);
      expect(config.logLevel).toBe("debug");
    });

    test("returns a new object each call (no singleton caching)", () => {
      const config1 = loadConfig();
      const config2 = loadConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
