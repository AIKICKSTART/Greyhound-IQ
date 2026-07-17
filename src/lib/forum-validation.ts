import { z } from "zod";

export const forumThreadCreateSchema = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(20).max(20_000),
});

export const forumPostCreateSchema = z.object({
  body: z.string().trim().min(20).max(20_000),
});
