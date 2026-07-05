import { z } from "zod";

export const callRoomCreateSchema = z.object({
  conversationId: z.string().trim().min(1).max(120),
  callType: z.enum(["voice", "video"]).default("video"),
});

export const callInviteActionSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export const callRoomIdSchema = z.string().trim().min(1).max(120);
