import { z } from "zod";

export const storedConfigSchema = z.object({
  org: z.string().trim().min(1).optional(),
  pat: z.string().trim().min(1).optional(),
  defaultLimit: z.number().int().positive().max(500).optional(),
  defaultRepo: z.string().trim().min(1).optional()
});

export type StoredConfig = z.infer<typeof storedConfigSchema>;
