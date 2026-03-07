/**
 * Schema for kill_command MCP tool input
 */

import { z } from "zod";

export const KillCommandSchema = z.object({
  process_id: z.string().uuid("Process ID must be a valid UUID"),
  force: z.boolean().optional().default(false),
});

export type KillCommandInput = z.infer<typeof KillCommandSchema>;
