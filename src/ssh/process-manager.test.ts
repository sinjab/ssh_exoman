import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { ProcessManager } from "./process-manager";
import type { ProcessInfo, ProcessStatus, Result } from "../types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Helper to create mock channel
function createMockChannel() {
  return {
    signal: mock(() => {}),
    on: mock(() => {}),
    close: mock(() => {}),
  };
}

// Helper to create mock connection
function createMockConnection() {
  return {
    end: mock(() => {}),
    on: mock(() => {}),
  };
}

describe("ProcessManager", () => {
  let manager: ProcessManager;
  const tempFiles: string[] = [];

  beforeEach(() => {
    manager = new ProcessManager();
  });

  afterEach(() => {
    // Clean up any temp files created during tests
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    tempFiles.length = 0;
  });

  describe("startProcess", () => {
    test("Test 1: startProcess creates process entry with UUID", () => {
      const processId = manager.startProcess(
        "example.com",
        "ls -la",
        createMockChannel(),
        createMockConnection()
      );

      // UUID format: 8-4-4-4-12 hex characters
      expect(processId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      const process = manager.getProcess(processId);
      expect(process).toBeDefined();
      expect(process?.host).toBe("example.com");
      expect(process?.command).toBe("ls -la");
    });

    test("Test 2: startProcess creates temp file paths", () => {
      const processId = manager.startProcess(
        "example.com",
        "ls -la",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      expect(process?.tempOutputPath).toContain("ssh-exoman-");
      expect(process?.tempOutputPath).toContain(processId);
      expect(process?.tempOutputPath).toMatch(/\.out$/);

      expect(process?.tempErrorPath).toContain("ssh-exoman-");
      expect(process?.tempErrorPath).toContain(processId);
      expect(process?.tempErrorPath).toMatch(/\.err$/);

      // Track for cleanup
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);
    });
  });

  describe("appendOutput", () => {
    test("Test 3: appendOutput appends data to temp file", () => {
      const processId = manager.startProcess(
        "example.com",
        "echo hello",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.appendOutput(processId, Buffer.from("hello\n"), false);

      expect(fs.existsSync(process?.tempOutputPath)).toBe(true);
      const content = fs.readFileSync(process?.tempOutputPath || "", "utf8");
      expect(content).toBe("hello\n");
    });

    test("Test 4: appendOutput updates outputSize/errorSize counters", () => {
      const processId = manager.startProcess(
        "example.com",
        "echo hello",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.appendOutput(processId, Buffer.from("hello"), false);
      manager.appendOutput(processId, Buffer.from(" world"), false);

      const updatedProcess = manager.getProcess(processId);
      expect(updatedProcess?.outputSize).toBe(12);

      manager.appendOutput(processId, Buffer.from("error"), true);

      const finalProcess = manager.getProcess(processId);
      expect(finalProcess?.errorSize).toBe(5);
    });
  });

  describe("completeProcess", () => {
    test("Test 5: completeProcess updates status, exitCode, signal, endTime", () => {
      const processId = manager.startProcess(
        "example.com",
        "ls -la",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      expect(process?.status).toBe("running");
      expect(process?.endTime).toBeNull();

      manager.completeProcess(processId, 0, null);

      const completedProcess = manager.getProcess(processId);
      expect(completedProcess?.status).toBe("completed");
      expect(completedProcess?.exitCode).toBe(0);
      expect(completedProcess?.signal).toBeNull();
      expect(completedProcess?.endTime).toBeInstanceOf(Date);
    });

    test("completeProcess sets status to failed when exitCode is non-zero", () => {
      const processId = manager.startProcess(
        "example.com",
        "exit 1",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.completeProcess(processId, 1, null);

      const completedProcess = manager.getProcess(processId);
      expect(completedProcess?.status).toBe("failed");
      expect(completedProcess?.exitCode).toBe(1);
    });
  });

  describe("getStatus", () => {
    test("Test 6: getStatus returns process status info", () => {
      const processId = manager.startProcess(
        "example.com",
        "ls -la",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.appendOutput(processId, Buffer.from("output"), false);
      manager.appendOutput(processId, Buffer.from("error"), true);
      manager.completeProcess(processId, 0, null);

      const result = manager.getStatus(processId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("completed");
        expect(result.data.exitCode).toBe(0);
        expect(result.data.outputSize).toBe(6);
        expect(result.data.errorSize).toBe(5);
        expect(result.data.startTime).toBeInstanceOf(Date);
        expect(result.data.endTime).toBeInstanceOf(Date);
      }
    });

    test("Test 7: getStatus returns PROCESS_NOT_FOUND for unknown process", () => {
      const result = manager.getStatus("non-existent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PROCESS_NOT_FOUND");
        expect(result.error.message).toContain("non-existent-id");
      }
    });
  });

  describe("getOutput", () => {
    test("Test 8: getOutput reads chunk from temp file with byte offset", async () => {
      const processId = manager.startProcess(
        "example.com",
        "echo hello world",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.appendOutput(processId, Buffer.from("hello world"), false);

      const result = await manager.getOutput(processId, 0, 5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toBe("hello");
        expect(result.data.totalSize).toBe(11);
      }
    });

    test("Test 9: getOutput returns hasMore=true when more data available", async () => {
      const processId = manager.startProcess(
        "example.com",
        "echo hello",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.appendOutput(processId, Buffer.from("hello world"), false);

      const result = await manager.getOutput(processId, 0, 5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasMore).toBe(true);
        expect(result.data.data).toBe("hello");
      }
    });

    test("Test 10: getOutput returns empty data when offset >= file size", async () => {
      const processId = manager.startProcess(
        "example.com",
        "echo hello",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.appendOutput(processId, Buffer.from("hello"), false);

      const result = await manager.getOutput(processId, 100, 10);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toBe("");
        expect(result.data.hasMore).toBe(false);
        expect(result.data.totalSize).toBe(5);
      }
    });
  });

  describe("killProcess", () => {
    test("Test 11: killProcess sends SIGTERM to channel", async () => {
      const mockChannel = createMockChannel();
      const processId = manager.startProcess(
        "example.com",
        "sleep 100",
        mockChannel,
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      // Start kill but don't wait for escalation (will resolve quickly since we're not really running)
      const killPromise = manager.killProcess(processId, false);

      // Check that SIGTERM was sent
      expect(mockChannel.signal).toHaveBeenCalledWith("TERM");

      const result = await killPromise;
      expect(result.success).toBe(true);
    });

    test("Test 12: killProcess escalates to SIGKILL after 5 seconds", async () => {
      const mockChannel = createMockChannel();
      const processId = manager.startProcess(
        "example.com",
        "sleep 100",
        mockChannel,
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      // Start kill with escalation (force=false)
      const startTime = Date.now();
      const result = await manager.killProcess(processId, false);
      const elapsed = Date.now() - startTime;

      // Should have waited for escalation timeout (5s) since process stays "running"
      expect(elapsed).toBeGreaterThanOrEqual(4900); // Allow some tolerance
      expect(mockChannel.signal).toHaveBeenCalledWith("KILL");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("killed");
      }
    }, 10000); // Increase timeout for this test

    test("Test 13: killProcess with force=true sends SIGKILL immediately", async () => {
      const mockChannel = createMockChannel();
      const processId = manager.startProcess(
        "example.com",
        "sleep 100",
        mockChannel,
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      const startTime = Date.now();
      const result = await manager.killProcess(processId, true);
      const elapsed = Date.now() - startTime;

      // Should complete immediately without waiting
      expect(elapsed).toBeLessThan(100);
      expect(mockChannel.signal).toHaveBeenCalledWith("KILL");
      expect(mockChannel.signal).not.toHaveBeenCalledWith("TERM");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("killed");
      }
    });

    test("killProcess returns error for non-existent process", async () => {
      const result = await manager.killProcess("non-existent-id", false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("PROCESS_NOT_FOUND");
      }
    });

    test("killProcess returns current status if already completed", async () => {
      const processId = manager.startProcess(
        "example.com",
        "ls",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);
      tempFiles.push(process!.tempOutputPath, process!.tempErrorPath);

      manager.completeProcess(processId, 0, null);

      const result = await manager.killProcess(processId, false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("completed");
      }
    });
  });

  describe("cleanupProcess", () => {
    test("Test 14: cleanupProcess deletes temp files and removes from map", () => {
      const processId = manager.startProcess(
        "example.com",
        "ls -la",
        createMockChannel(),
        createMockConnection()
      );

      const process = manager.getProcess(processId);

      // Write some data to create the files
      manager.appendOutput(processId, Buffer.from("output"), false);

      expect(fs.existsSync(process?.tempOutputPath)).toBe(true);

      manager.cleanupProcess(processId);

      // Files should be deleted
      expect(fs.existsSync(process?.tempOutputPath)).toBe(false);
      expect(fs.existsSync(process?.tempErrorPath)).toBe(false);

      // Process should be removed from map
      expect(manager.getProcess(processId)).toBeUndefined();
    });

    test("cleanupProcess handles missing files gracefully", () => {
      const processId = manager.startProcess(
        "example.com",
        "ls -la",
        createMockChannel(),
        createMockConnection()
      );

      // Don't write any data - files don't exist

      // Should not throw
      expect(() => manager.cleanupProcess(processId)).not.toThrow();

      // Process should be removed from map
      expect(manager.getProcess(processId)).toBeUndefined();
    });
  });
});
