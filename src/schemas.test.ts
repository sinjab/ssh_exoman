import { test, describe, expect } from "bun:test";
import {
  ExecuteCommandSchema,
  GetCommandOutputSchema,
  GetCommandStatusSchema,
  KillCommandSchema,
  GetSecurityInfoSchema,
  validateInput,
} from "./schemas";
import type { Result } from "./types";
import { ErrorCode } from "./errors";

describe("schemas", () => {
  describe("ExecuteCommandSchema", () => {
    test("validates host and command as required", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "example.com",
        command: "ls -la",
      });
      expect(result.success).toBe(true);
    });

    test("accepts optional timeout", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "example.com",
        command: "ls -la",
        timeout: 5000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(5000);
      }
    });

    test("rejects empty host", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "",
        command: "ls -la",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("Host"))).toBe(true);
      }
    });

    test("rejects empty command", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "example.com",
        command: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("Command"))).toBe(true);
      }
    });

    test("rejects missing host", () => {
      const result = ExecuteCommandSchema.safeParse({
        command: "ls -la",
      });
      expect(result.success).toBe(false);
    });

    test("rejects missing command", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "example.com",
      });
      expect(result.success).toBe(false);
    });

    test("rejects negative timeout", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "example.com",
        command: "ls -la",
        timeout: -100,
      });
      expect(result.success).toBe(false);
    });

    test("rejects host name too long (>253 chars)", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "a".repeat(254) + ".com",
        command: "ls -la",
      });
      expect(result.success).toBe(false);
    });

    test("rejects command too long (>10000 chars)", () => {
      const result = ExecuteCommandSchema.safeParse({
        host: "example.com",
        command: "x".repeat(10001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetCommandOutputSchema", () => {
    test("validates process_id as required UUID", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    test("applies default byte_offset of 0", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.byte_offset).toBe(0);
      }
    });

    test("applies default max_bytes of 65536", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.max_bytes).toBe(65536);
      }
    });

    test("accepts custom byte_offset and max_bytes", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
        byte_offset: 1024,
        max_bytes: 32768,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.byte_offset).toBe(1024);
        expect(result.data.max_bytes).toBe(32768);
      }
    });

    test("rejects invalid UUID", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    test("rejects negative byte_offset", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
        byte_offset: -1,
      });
      expect(result.success).toBe(false);
    });

    test("rejects max_bytes > 1048576 (1MB)", () => {
      const result = GetCommandOutputSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
        max_bytes: 2000000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetCommandStatusSchema", () => {
    test("validates process_id as required UUID", () => {
      const result = GetCommandStatusSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    test("rejects invalid UUID", () => {
      const result = GetCommandStatusSchema.safeParse({
        process_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    test("rejects missing process_id", () => {
      const result = GetCommandStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("KillCommandSchema", () => {
    test("validates process_id as required UUID", () => {
      const result = KillCommandSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    test("applies default force of false", () => {
      const result = KillCommandSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(false);
      }
    });

    test("accepts force true", () => {
      const result = KillCommandSchema.safeParse({
        process_id: "123e4567-e89b-12d3-a456-426614174000",
        force: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(true);
      }
    });

    test("rejects invalid UUID", () => {
      const result = KillCommandSchema.safeParse({
        process_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetSecurityInfoSchema", () => {
    test("accepts empty object", () => {
      const result = GetSecurityInfoSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test("handles undefined input gracefully", () => {
      // MCP tools will typically pass an empty object, not undefined
      // But we test that undefined is rejected cleanly (not throwing)
      const result = GetSecurityInfoSchema.safeParse(undefined);
      expect(result.success).toBe(false); // undefined is not a valid object
      // But it doesn't throw - see "never throws" test
    });
  });

  describe("validateInput helper", () => {
    test("returns success result for valid input", () => {
      const result = validateInput(ExecuteCommandSchema, {
        host: "example.com",
        command: "ls -la",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.host).toBe("example.com");
        expect(result.data.command).toBe("ls -la");
      }
    });

    test("returns error result for invalid input", () => {
      const result = validateInput(ExecuteCommandSchema, {
        host: "",
        command: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.error.message).toBeDefined();
      }
    });

    test("never throws - uses safeParse", () => {
      // Should not throw, even for completely invalid input
      expect(() =>
        validateInput(ExecuteCommandSchema, null)
      ).not.toThrow();
      expect(() =>
        validateInput(ExecuteCommandSchema, undefined)
      ).not.toThrow();
      expect(() =>
        validateInput(ExecuteCommandSchema, "not an object")
      ).not.toThrow();
    });

    test("combines multiple error messages", () => {
      const result = validateInput(ExecuteCommandSchema, {
        host: "",
        command: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should contain multiple validation error messages joined
        expect(result.error.message).toContain(";");
      }
    });
  });

  describe("safeParse behavior - never throws", () => {
    test("ExecuteCommandSchema.safeParse never throws", () => {
      expect(() => ExecuteCommandSchema.safeParse(null)).not.toThrow();
      expect(() => ExecuteCommandSchema.safeParse(undefined)).not.toThrow();
      expect(() => ExecuteCommandSchema.safeParse("invalid")).not.toThrow();
    });

    test("GetCommandOutputSchema.safeParse never throws", () => {
      expect(() => GetCommandOutputSchema.safeParse(null)).not.toThrow();
      expect(() => GetCommandOutputSchema.safeParse({})).not.toThrow();
    });

    test("schemas return success: false instead of throwing", () => {
      const result = ExecuteCommandSchema.safeParse({});
      expect(result.success).toBe(false);
      // TypeScript narrowing
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.issues).toBeInstanceOf(Array);
      }
    });
  });
});
