/**
 * Schema for execute_command MCP tool input
 */

import { z } from "zod";

export const ExecuteCommandSchema = z.object({
  host: z.string().min(1, "Host is required").max(253, "Host name too long"),
  command: z.string().min(1, "Command is required").max(10000, "Command too long"),
  timeout: z.number().int().positive().optional(),
});

export type ExecuteCommandInput = z.infer<typeof ExecuteCommandSchema>;
