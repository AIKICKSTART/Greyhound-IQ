import { z } from "zod";

export const billingCheckoutRequestSchema = z.object({
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
  plan: z.literal("pro"),
});
