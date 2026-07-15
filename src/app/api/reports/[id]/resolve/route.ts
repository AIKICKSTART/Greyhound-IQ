import { NextResponse } from "next/server";
import { requireModeratorProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveReportForModerator } from "@/lib/report-service";
import { reportResolveSchema } from "@/lib/report-validation";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const REPORT_RESOLVE_RATE_LIMIT = 30;
const REPORT_RESOLVE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireModeratorProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `report:resolve:${current.dbUserId}`,
      REPORT_RESOLVE_RATE_LIMIT,
      REPORT_RESOLVE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        REPORT_RESOLVE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = reportResolveSchema.parse(await readBoundedJsonRequest(request));
    const resolved = await resolveReportForModerator(current, id, parsed);

    return NextResponse.json({ item: resolved });
  } catch (err) {
    return jsonError(err, "Could not resolve report");
  }
}
