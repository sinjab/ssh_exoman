import { describe, test, expect } from "bun:test";
import { isComplexCommand, wrapCommand } from "./command-detection";

describe("isComplexCommand", () => {
  test("returns false for simple command 'ls -la'", () => {
    expect(isComplexCommand("ls -la")).toBe(false);
  });

  test("returns true for pipe 'cat file | grep foo'", () => {
    expect(isComplexCommand("cat file | grep foo")).toBe(true);
  });

  test("returns true for redirect 'echo hello > file'", () => {
    expect(isComplexCommand("echo hello > file")).toBe(true);
  });

  test("returns true for semicolon 'cmd1; cmd2'", () => {
    expect(isComplexCommand("cmd1; cmd2")).toBe(true);
  });

  test("returns true for variable 'echo $HOME'", () => {
    expect(isComplexCommand("echo $HOME")).toBe(true);
  });

  test("returns true for subshell '$(command)'", () => {
    expect(isComplexCommand("echo $(date)")).toBe(true);
  });

  test("returns true for glob 'cat *.txt'", () => {
    expect(isComplexCommand("cat *.txt")).toBe(true);
  });

  test("returns true for && operator 'cmd1 && cmd2'", () => {
    expect(isComplexCommand("cmd1 && cmd2")).toBe(true);
  });

  test("returns true for || operator 'cmd1 || cmd2'", () => {
    expect(isComplexCommand("cmd1 || cmd2")).toBe(true);
  });

  test("returns true for backtick command substitution", () => {
    expect(isComplexCommand("echo `date`")).toBe(true);
  });

  test("returns false for command with simple arguments", () => {
    expect(isComplexCommand("git status")).toBe(false);
  });

  test("returns false for command with path argument", () => {
    expect(isComplexCommand("cat /etc/passwd")).toBe(false);
  });

  test("returns true for output append redirect", () => {
    expect(isComplexCommand("echo test >> file.txt")).toBe(true);
  });

  test("returns true for input redirect", () => {
    expect(isComplexCommand("wc -l < file.txt")).toBe(true);
  });

  test("returns true for single quotes", () => {
    expect(isComplexCommand("echo 'hello world'")).toBe(true);
  });

  test("returns true for double quotes", () => {
    expect(isComplexCommand('echo "hello world"')).toBe(true);
  });
});

describe("wrapCommand", () => {
  test("wraps simple command in /bin/sh -c", () => {
    const result = wrapCommand("ls -la");
    expect(result).toBe('/bin/sh -c "ls -la"');
  });

  test("escapes double quotes in command", () => {
    const result = wrapCommand('echo "hello world"');
    expect(result).toBe('/bin/sh -c "echo \\"hello world\\""');
  });

  test("wraps command with pipes", () => {
    const result = wrapCommand("cat file | grep foo");
    expect(result).toBe('/bin/sh -c "cat file | grep foo"');
  });

  test("wraps command with redirects", () => {
    const result = wrapCommand("echo hello > file");
    expect(result).toBe('/bin/sh -c "echo hello > file"');
  });

  test("handles multiple escaped quotes", () => {
    const result = wrapCommand('echo "test" && echo "more"');
    expect(result).toBe('/bin/sh -c "echo \\"test\\" && echo \\"more\\""');
  });

  test("preserves single quotes (no escaping needed)", () => {
    const result = wrapCommand("echo 'hello'");
    expect(result).toBe("/bin/sh -c \"echo 'hello'\"");
  });
});
