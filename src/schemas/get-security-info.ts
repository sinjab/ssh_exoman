/**
 * Schema for get_security_info MCP tool input
 *
 * get_security_info takes no parameters, so this is an empty object schema.
 */

import { z } from "zod";

export const GetSecurityInfoSchema = z.object({});

export type GetSecurityInfoInput = z.infer<typeof GetSecurityInfoSchema>;
