import { test, describe, expect, beforeEach } from "bun:test";
import {
  validateCommand,
  validateCommandWithResult,
  getSecurityInfo,
  loadPatterns,
} from "./security-validator";
import type { SecurityConfig, ValidationResult, Result } from "./types";
import { ErrorCode } from "./errors";

describe("security-validator", () => {
  // Load actual patterns from JSON for realistic tests
  const patterns = loadPatterns();

  describe("loadPatterns", () => {
    test("loads patterns from JSON file", () => {
      expect(patterns.length).toBeGreaterThan(30);
    });

    test("patterns are valid regex strings", () => {
      for (const pattern of patterns) {
        expect(() => new RegExp(pattern, "i")).not.toThrow();
      }
    });
  });

  describe("validateCommand - blacklist mode", () => {
    const blacklistConfig: SecurityConfig = {
      mode: "blacklist",
      patterns: patterns,
    };

    test("blocks 'rm -rf /'", () => {
      const result = validateCommand("rm -rf /", blacklistConfig);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.matchedPattern).toBeDefined();
    });

    test("blocks 'sudo rm file'", () => {
      const result = validateCommand("sudo rm file", blacklistConfig);
      expect(result.allowed).toBe(false);
    });

    test("blocks 'shutdown' command", () => {
      const result = validateCommand("shutdown -h now", blacklistConfig);
      expect(result.allowed).toBe(false);
    });

    test("allows 'ls -la'", () => {
      const result = validateCommand("ls -la", blacklistConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows 'cat /etc/hosts'", () => {
      const result = validateCommand("cat /etc/hosts", blacklistConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows 'echo hello'", () => {
      const result = validateCommand("echo hello", blacklistConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows 'docker ps'", () => {
      const result = validateCommand("docker ps", blacklistConfig);
      expect(result.allowed).toBe(true);
    });

    test("blocks 'dd if=/dev/zero of=/dev/sda'", () => {
      const result = validateCommand(
        "dd if=/dev/zero of=/dev/sda bs=1M",
        blacklistConfig
      );
      expect(result.allowed).toBe(false);
    });

    test("is case-insensitive", () => {
      const result = validateCommand("SUDO ls", blacklistConfig);
      expect(result.allowed).toBe(false);
    });
  });

  describe("validateCommand - whitelist mode", () => {
    const whitelistConfig: SecurityConfig = {
      mode: "whitelist",
      patterns: ["^ls", "^cat\\s+", "^echo\\s+"],
    };

    test("allows matching 'ls' command", () => {
      const result = validateCommand("ls -la", whitelistConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows matching 'cat' command", () => {
      const result = validateCommand("cat /etc/hosts", whitelistConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows matching 'echo' command", () => {
      const result = validateCommand("echo hello world", whitelistConfig);
      expect(result.allowed).toBe(true);
    });

    test("blocks non-matching command", () => {
      const result = validateCommand("rm -rf /", whitelistConfig);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("does not match");
    });

    test("blocks partial match that doesn't start with pattern", () => {
      const result = validateCommand("echo; rm -rf /", whitelistConfig);
      expect(result.allowed).toBe(false);
    });
  });

  describe("validateCommand - disabled mode", () => {
    const disabledConfig: SecurityConfig = {
      mode: "disabled",
      patterns: [],
    };

    test("allows 'rm -rf /'", () => {
      const result = validateCommand("rm -rf /", disabledConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows 'sudo shutdown'", () => {
      const result = validateCommand("sudo shutdown", disabledConfig);
      expect(result.allowed).toBe(true);
    });

    test("allows any command when disabled", () => {
      const dangerousCommands = [
        "dd if=/dev/zero of=/dev/sda",
        "mkfs.ext4 /dev/sda1",
        "iptables -F",
        "reboot",
      ];
      for (const cmd of dangerousCommands) {
        const result = validateCommand(cmd, disabledConfig);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe("getSecurityInfo", () => {
    test("returns config details for blacklist mode", () => {
      const config: SecurityConfig = {
        mode: "blacklist",
        patterns: patterns,
      };
      const info = getSecurityInfo(config);
      expect(info.mode).toBe("blacklist");
      expect(info.patternCount).toBe(patterns.length);
      expect(info.samplePatterns.length).toBe(5);
    });

    test("returns config details for whitelist mode", () => {
      const config: SecurityConfig = {
        mode: "whitelist",
        patterns: ["^ls", "^cat"],
      };
      const info = getSecurityInfo(config);
      expect(info.mode).toBe("whitelist");
      expect(info.patternCount).toBe(2);
      expect(info.samplePatterns.length).toBe(2);
    });

    test("returns config details for disabled mode", () => {
      const config: SecurityConfig = {
        mode: "disabled",
        patterns: [],
      };
      const info = getSecurityInfo(config);
      expect(info.mode).toBe("disabled");
      expect(info.patternCount).toBe(0);
      expect(info.samplePatterns.length).toBe(0);
    });

    test("sample patterns are first 5 from list", () => {
      const config: SecurityConfig = {
        mode: "blacklist",
        patterns: patterns,
      };
      const info = getSecurityInfo(config);
      expect(info.samplePatterns).toEqual(patterns.slice(0, 5));
    });
  });

  describe("validateCommandWithResult", () => {
    const blacklistConfig: SecurityConfig = {
      mode: "blacklist",
      patterns: patterns,
    };

    test("returns success result for allowed command", () => {
      const result = validateCommandWithResult("ls -la", blacklistConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowed).toBe(true);
      }
    });

    test("returns error result for blocked command", () => {
      const result = validateCommandWithResult("rm -rf /", blacklistConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.SECURITY_BLOCKED);
        expect(result.error.message).toBeDefined();
      }
    });

    test("includes reason in error message", () => {
      const result = validateCommandWithResult("sudo ls", blacklistConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("blocked");
      }
    });
  });

  describe("edge cases", () => {
    test("handles empty command", () => {
      const config: SecurityConfig = {
        mode: "blacklist",
        patterns: patterns,
      };
      const result = validateCommand("", config);
      expect(result.allowed).toBe(true);
    });

    test("handles command with special regex characters", () => {
      const config: SecurityConfig = {
        mode: "blacklist",
        patterns: patterns,
      };
      // Should not throw on special regex chars in command
      const result = validateCommand("echo $((1+1))", config);
      expect(result.allowed).toBe(true);
    });

    test("handles very long command", () => {
      const config: SecurityConfig = {
        mode: "blacklist",
        patterns: patterns,
      };
      const longCmd = "ls " + "-la ".repeat(1000);
      const result = validateCommand(longCmd, config);
      expect(result.allowed).toBe(true);
    });

    test("skips invalid regex patterns gracefully", () => {
      const config: SecurityConfig = {
        mode: "whitelist",
        patterns: ["[invalid(regex", "^ls"],
      };
      // Should not throw, just skip invalid pattern
      // With whitelist, ^ls should match "ls -la" and allow it
      const result = validateCommand("ls -la", config);
      expect(result.allowed).toBe(true);
    });
  });
});
