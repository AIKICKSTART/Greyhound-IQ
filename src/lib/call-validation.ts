import { z } from "zod";

export const callRoomCreateSchema = z.object({
  conversationId: z.string().trim().min(1).max(120),
});

export const callRoomIdSchema = z.string().trim().min(1).max(120);
