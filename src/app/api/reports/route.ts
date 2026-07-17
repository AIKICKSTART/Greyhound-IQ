import { NextResponse } from "next/server";
import { requireCurrentUserProfile, requireModeratorProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { withDbRequestContext } from "@/lib/db-context";
import { reportCreateSchema } from "@/lib/report-validation";
import { createReportForUser } from "@/lib/report-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const REPORT_CREATE_RATE_LIMIT = 10;
const REPORT_CREATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  try {
    const current = await requireModeratorProfile();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const reports = await withDbRequestContext(current, (tx) =>
      tx.report.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          reported: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      })
    );

    return NextResponse.json({ items: reports });
  } catch (err) {
    return jsonError(err, "Could not load reports");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `report:create:${current.dbUserId}`,
      REPORT_CREATE_RATE_LIMIT,
      REPORT_CREATE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        REPORT_CREATE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = reportCreateSchema.parse(await readBoundedJsonRequest(request));
    const report = await createReportForUser(current, parsed);

    return NextResponse.json({ item: report }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create report");
  }
}
