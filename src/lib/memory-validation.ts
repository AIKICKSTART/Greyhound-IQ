import { z } from "zod";
import { cleanText } from "@/lib/content";

export const memoryCreateSchema = z.object({
  kind: z
    .enum(["episodic", "semantic", "preference", "unfinished"])
    .optional()
    .default("episodic"),
  content: z.string().trim().min(3).max(2_000).transform(cleanText),
  source: z
    .enum([
      "conversation",
      "explicit_user_input",
      "agent_inference",
      "tool_observation",
    ])
    .optional()
    .default("explicit_user_input"),
  sourceRef: z.string().trim().max(200).optional().nullable(),
  importance: z.number().min(0.1).max(1).optional().default(0.5),
});

export const memorySupersedeSchema = z
  .object({
    supersededById: z.string().trim().min(1).optional(),
    replacementContent: z
      .string()
      .trim()
      .min(3)
      .max(2_000)
      .transform(cleanText)
      .optional(),
  })
  .refine((value) => value.supersededById || value.replacementContent, {
    message: "Provide supersededById or replacementContent",
  });
