/**
 * Schema for get_command_status MCP tool input
 */

import { z } from "zod";

export const GetCommandStatusSchema = z.object({
  process_id: z.string().uuid("Process ID must be a valid UUID"),
});

export type GetCommandStatusInput = z.infer<typeof GetCommandStatusSchema>;
