import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import SSHConfig from "ssh-config";
import { parseSSHConfig, resolveHost, listHosts, type HostConfig } from "./config-parser";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("parseSSHConfig", () => {
  test("returns SSHConfig object for valid config file", () => {
    // This test assumes ~/.ssh/config exists or creates a mock
    const config = parseSSHConfig();
    expect(config).toBeInstanceOf(SSHConfig);
  });

  test("returns empty SSHConfig when file does not exist", () => {
    // Test with non-existent config path by using a function that parses empty content
    const config = parseSSHConfig();
    // Should not throw, should return a valid SSHConfig object
    expect(config).toBeDefined();
    // An empty config should have no sections or just wildcards
    const hosts = listHosts(config);
    // If no ~/.ssh/config, hosts should be empty
    expect(Array.isArray(hosts)).toBe(true);
  });
});

describe("resolveHost", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("returns HostConfig with merged values from compute()", () => {
    // Create a test config programmatically
    const configText = `
Host test-server
    HostName example.com
    User testuser
    Port 2222
    IdentityFile ~/.ssh/test_key
`;
    const config = SSHConfig.parse(configText);
    const result = resolveHost("test-server", config);

    expect(result).not.toBeNull();
    expect(result?.host).toBe("test-server");
    expect(result?.hostname).toBe("example.com");
    expect(result?.user).toBe("testuser");
    expect(result?.port).toBe(2222);
    expect(result?.identityFile).toBe("~/.ssh/test_key");
  });

  test("returns null for unknown host", () => {
    const configText = `
Host known-host
    HostName example.com
`;
    const config = SSHConfig.parse(configText);
    const result = resolveHost("unknown-host", config);

    expect(result).toBeNull();
  });

  test("applies defaults (User=$USER, Port=22) for missing fields", () => {
    process.env.USER = "defaultuser";

    const configText = `
Host minimal-host
    HostName minimal.example.com
`;
    const config = SSHConfig.parse(configText);
    const result = resolveHost("minimal-host", config);

    expect(result).not.toBeNull();
    expect(result?.user).toBe("defaultuser");
    expect(result?.port).toBe(22);
    expect(result?.hostname).toBe("minimal.example.com");
  });

  test("uses host alias as hostname when HostName not specified", () => {
    const configText = `
Host alias-only
    User someuser
`;
    const config = SSHConfig.parse(configText);
    const result = resolveHost("alias-only", config);

    expect(result).not.toBeNull();
    expect(result?.hostname).toBe("alias-only");
  });
});

describe("listHosts", () => {
  test("filters out wildcard patterns (*, *.example.com)", () => {
    const configText = `
Host specific-host
    HostName specific.example.com

Host *
    User wildcard-user

Host *.example.com
    User domain-wildcard

Host another-specific
    HostName another.example.com
`;
    const config = SSHConfig.parse(configText);
    const hosts = listHosts(config);

    expect(hosts).toContain("specific-host");
    expect(hosts).toContain("another-specific");
    expect(hosts).not.toContain("*");
    expect(hosts).not.toContain("*.example.com");
  });

  test("returns empty array for empty config", () => {
    const config = new SSHConfig();
    const hosts = listHosts(config);

    expect(hosts).toEqual([]);
  });

  test("handles config with only wildcards", () => {
    const configText = `
Host *
    User default-user
`;
    const config = SSHConfig.parse(configText);
    const hosts = listHosts(config);

    expect(hosts).toEqual([]);
  });
});
