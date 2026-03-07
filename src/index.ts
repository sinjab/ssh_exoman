#!/usr/bin/env bun
/**
 * SSH Exoman MCP Server - Entry Point
 *
 * Thin entry point that connects stdio transport to the MCP server.
 * All tool/resource/prompt registration happens in server.ts.
 *
 * CRITICAL: This file logs to stderr only - never stdout.
 * MCP stdio transport reserves stdout for protocol messages.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./structured-logger.js";

async function main() {
  logger.info("Starting SSH Exoman MCP server...");

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("Server connected via stdio transport");
}

main().catch((error) => {
  logger.error("Fatal error", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
