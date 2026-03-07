# Technology Stack

**Project:** ssh-exoman (MCP SSH Server)
**Researched:** 2026-03-07

## Recommended Stack

### Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Bun | ^1.3 | Runtime & package manager | Project constraint. Native TS execution, fast startup (important for stdio MCP servers), built-in test runner. | HIGH |

### MCP Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @modelcontextprotocol/sdk | ^1.27.1 | MCP protocol implementation | The official SDK from Anthropic. Provides `McpServer` high-level API with `registerTool`, `registerResource`, `registerPrompt`. Supports both stdio and Streamable HTTP transports. Has first-class Bun support via `WebStandardStreamableHTTPServerTransport`. | HIGH |

### Schema Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | ^3.25 or ^4.0 | Tool input/output schema validation | MCP SDK peer dependency. Tool registration uses Zod schemas directly for input validation. The SDK accepts either Zod 3.25+ or Zod 4.x. Use Zod 4 since it installed as latest and the SDK supports it. | HIGH |

### SSH Libraries

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ssh2 | ^1.17.0 | SSH connections, command execution, SFTP | The only mature, pure-JS SSH2 implementation for Node/Bun. No native bindings (critical for Bun compatibility). Supports connection pooling patterns, exec, shell, SFTP subsystem. Used by ssh2-sftp-client under the hood. | HIGH |
| @types/ssh2 | ^1.15.5 | TypeScript types for ssh2 | ssh2 does not ship its own types. DefinitelyTyped provides comprehensive type definitions. | HIGH |

### SSH Config Parsing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ssh-config | ^5.1.0 | Parse ~/.ssh/config files | Zero-dependency, TypeScript types included, handles Host/Match blocks, wildcards, ProxyJump. The standard library for SSH config parsing in JS/TS. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| uuid | ^11.x | Generate UUIDs for background process tracking | Every background command needs a tracking UUID. Could also use `crypto.randomUUID()` (built into Bun) instead to avoid the dependency. | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runtime | Bun | Node.js | Project constraint mandates Bun. Bun also has faster startup (matters for stdio MCP servers launched per-session). |
| SSH | ssh2 | node-ssh | node-ssh is a thin wrapper around ssh2. We need low-level control for connection pooling and background process management. Go direct. |
| SSH | ssh2 | ssh2-promise | Tiny wrapper, last updated 2020, only 1.0.3. Dead project. |
| SFTP | ssh2 (built-in) | ssh2-sftp-client | ssh2-sftp-client is a convenience wrapper around ssh2's SFTP subsystem. For our use case (upload/download single files), using ssh2's SFTP directly is simpler and avoids an extra dependency. The wrapper adds reconnect logic we don't need (we have our own connection pool). |
| Config parsing | ssh-config | Manual parsing | SSH config is surprisingly complex (Match blocks, wildcards, Include directives). Don't reinvent this. |
| Schema validation | Zod 4 | Zod 3.25 | Both work with MCP SDK. Zod 4 is the current latest and has better performance. Since this is a new project, go with latest. |
| HTTP transport | WebStandardStreamableHTTPServerTransport | StreamableHTTPServerTransport (Node.js wrapper) | The web-standard version works natively with Bun.serve(). The Node.js wrapper adds unnecessary @hono/node-server dependency. |
| HTTP transport | WebStandardStreamableHTTPServerTransport | Express-based SSE transport | The SDK's SSE transport is legacy. Streamable HTTP is the current MCP transport spec. |
| Logging | console + MCP sendLoggingMessage | pino / consola | MCP servers communicate logs via the protocol's `notifications/message` method (sendLoggingMessage). External logging libraries add complexity. Use console for stderr debug output and MCP logging for client-visible messages. |
| Process UUIDs | crypto.randomUUID() | uuid package | Built into Bun/Web APIs. Zero dependencies. Prefer this over adding uuid. |

## Key Architecture Decisions from Stack

### 1. Transport Strategy

The MCP SDK v1.27 provides three server transports:

- **StdioServerTransport** -- For Claude Desktop integration. Reads stdin, writes stdout. Uses `node:stream` Readable/Writable (Bun compatible).
- **WebStandardStreamableHTTPServerTransport** -- For remote HTTP access. Uses Web Standard `Request`/`Response` APIs. Explicitly documented as Bun-compatible. Integrates directly with `Bun.serve()`.
- **StreamableHTTPServerTransport** -- Node.js HTTP wrapper. Skip this; use the web-standard version.

**Decision:** Use `StdioServerTransport` for Claude Desktop, `WebStandardStreamableHTTPServerTransport` for HTTP. Both transports connect to the same `McpServer` instance.

### 2. Tool Registration Pattern

The SDK provides `McpServer.registerTool()` (new API, replaces deprecated `.tool()`):

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { z } from "zod";

const server = new McpServer({ name: "ssh-exoman", version: "1.0.0" });

server.registerTool("ssh_execute", {
  description: "Execute a command on a remote host",
  inputSchema: {
    host: z.string().describe("SSH host to connect to"),
    command: z.string().describe("Command to execute"),
  },
}, async (args, extra) => {
  // Implementation
  return { content: [{ type: "text", text: "output" }] };
});
```

### 3. No Express, No Hono

The MCP SDK bundles express and hono as dependencies internally, but for Bun-native HTTP we bypass those entirely. The `WebStandardStreamableHTTPServerTransport.handleRequest()` accepts a standard `Request` and returns a `Response` -- exactly what `Bun.serve()` routes expect.

```typescript
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

Bun.serve({
  port: 3000,
  async fetch(req) {
    return transport.handleRequest(req);
  },
});
```

### 4. Zod Version

The MCP SDK accepts `zod@^3.25 || ^4.0` as a peer dependency. Zod 4 (currently 4.3.6) installed as `latest`. The SDK's internal `zod-compat.js` handles both versions transparently.

## Installation

```bash
# Core dependencies
bun add @modelcontextprotocol/sdk ssh2 ssh-config zod

# Dev dependencies
bun add -d @types/ssh2 @types/bun
```

**That's it.** No express, no dotenv, no uuid, no logging library. The stack is deliberately minimal:
- 3 runtime dependencies (MCP SDK, ssh2, ssh-config) + zod as peer dep
- 2 dev dependencies (types)

## Bun Compatibility Notes

| Library | Bun Compatible | Notes |
|---------|---------------|-------|
| @modelcontextprotocol/sdk | YES | WebStandardStreamableHTTPServerTransport explicitly lists Bun support. StdioServerTransport uses node:stream (Bun compatible). |
| ssh2 | YES | Pure JavaScript implementation (no native addons). Uses node:crypto, node:net, node:stream -- all supported by Bun. Optional CPU-intensive crypto can fall back to JS when native bindings unavailable. |
| ssh-config | YES | Zero dependencies, pure JS parsing. |
| zod | YES | Pure JS, no runtime dependencies. |

## Potential Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ssh2 crypto performance in Bun | LOW | ssh2 has optional native crypto bindings (`cpu-features`). Without them, falls back to pure JS. Performance impact negligible for typical SSH session counts. |
| StdioServerTransport uses node:stream | LOW | Bun has mature node:stream compatibility. This is a well-tested code path. |
| MCP SDK ships express/hono as hard deps | LOW | They install but we don't import them. Tree-shaking at the import level means they don't affect runtime. Just bloats node_modules. |

## Sources

- npm registry: `@modelcontextprotocol/sdk@1.27.1` (published 2026-02-24) -- verified via `npm view`
- MCP SDK type definitions: inspected `dist/esm/server/mcp.d.ts`, `stdio.d.ts`, `streamableHttp.d.ts`, `webStandardStreamableHttp.d.ts` directly from installed package
- WebStandardStreamableHTTPServerTransport docs comment: "can run on any runtime that supports Web Standards: Node.js 18+, Cloudflare Workers, Deno, Bun, etc."
- npm registry: `ssh2@1.17.0`, `ssh-config@5.1.0`, `ssh2-sftp-client@12.1.0`, `zod@4.3.6` -- all verified via `npm view`
- Bun version: 1.3.10 (local installation)
