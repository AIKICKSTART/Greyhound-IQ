import { logRequestInfo } from "@/lib/logger";

import { handleOnboardingAnalyticsPost } from "./handler";

export async function POST(request: Request) {
  const { checkRateLimit } = await import("@/lib/rate-limit");
  return handleOnboardingAnalyticsPost(request, {
    checkLimit: checkRateLimit,
    record: logRequestInfo,
  });
}
