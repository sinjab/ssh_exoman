/**
 * Schema for resolve_host MCP tool input
 */

import { z } from "zod";

export const ResolveHostSchema = z.object({
  host: z.string().min(1, "Host is required").max(253, "Host name too long"),
});

export type ResolveHostInput = z.infer<typeof ResolveHostSchema>;
