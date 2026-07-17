import "server-only";

import { notFound } from "next/navigation";

import { requireAdminProfile } from "@/lib/auth";
import { isFullAccessDemo } from "@/lib/demo-access";
import { resolveDesignLabAccessDecision } from "@/lib/design-lab-access-policy";

export async function requireDesignLabReviewer() {
  const decision = resolveDesignLabAccessDecision({
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.ENABLE_DEVICE_PREVIEWS,
    isolatedDemo: isFullAccessDemo(),
  });

  if (decision === "deny") notFound();
  if (decision === "require-administrator") {
    try {
      await requireAdminProfile();
    } catch {
      notFound();
    }
  }
}
