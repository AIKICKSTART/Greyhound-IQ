import { z } from "zod";

export const MESSENGER_LAYOUTS = ["dual", "adaptive", "compact"] as const;

export const messengerLayoutSchema = z.enum(MESSENGER_LAYOUTS);

export type MessengerLayout = z.infer<typeof messengerLayoutSchema>;

export const DEFAULT_MESSENGER_LAYOUT: MessengerLayout = "dual";

export const MESSENGER_LAYOUT_OPTIONS: ReadonlyArray<{
  value: MessengerLayout;
  label: string;
  description: string;
}> = [
  {
    value: "dual",
    label: "Dual floating panels",
    description: "Keep the inbox and focused conversations visible together.",
  },
  {
    value: "adaptive",
    label: "Adaptive list + detail",
    description: "Use one joined workspace for the inbox and active chat.",
  },
  {
    value: "compact",
    label: "Compact bubble rail",
    description: "Use the smallest desktop footprint and open one chat at a time.",
  },
];

export function normalizeMessengerLayout(value: unknown): MessengerLayout {
  const parsed = messengerLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_MESSENGER_LAYOUT;
}
