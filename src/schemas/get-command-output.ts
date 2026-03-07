/**
 * Schema for get_command_output MCP tool input
 */

import { z } from "zod";

export const GetCommandOutputSchema = z.object({
  process_id: z.string().uuid("Process ID must be a valid UUID"),
  byte_offset: z.number().int().min(0).default(0),
  max_bytes: z.number().int().positive().max(1048576).default(65536),
});

export type GetCommandOutputInput = z.infer<typeof GetCommandOutputSchema>;
