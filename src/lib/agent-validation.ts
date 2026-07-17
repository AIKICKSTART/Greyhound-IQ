import { z } from "zod";

import { cleanText } from "@/lib/content";

export const agentRunSchema = z.object({
  input: z.string().trim().min(10).max(5_000).transform(cleanText),
  conversationContextId: z.string().trim().min(1).max(120).optional().nullable(),
});

export type AgentRunInput = z.infer<typeof agentRunSchema>;
