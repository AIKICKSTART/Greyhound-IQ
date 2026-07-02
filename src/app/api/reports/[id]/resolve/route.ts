import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/account-service";
import { requireModeratorProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportResolveSchema } from "@/lib/report-validation";

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
    const rateLimit = checkRateLimit(
      `report:resolve:${current.dbUserId}`,
      REPORT_RESOLVE_RATE_LIMIT,
      REPORT_RESOLVE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const parsed = reportResolveSchema.parse(await request.json());

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new Error("report.not_found");

    const status = parsed.action === "dismiss" ? "dismissed" : "resolved";
    const resolved = await prisma.report.update({
      where: { id: report.id },
      data: {
        status,
        resolvedBy: current.dbUserId,
        resolvedAt: new Date(),
        resolutionNotes: parsed.notes,
      },
    });

    await createAuditLog({
      actorId: current.dbUserId,
      actorType: "admin",
      action: "report.resolve",
      targetType: report.targetType,
      targetId: report.targetId,
      metadata: {
        reportId: report.id,
        action: parsed.action,
        status,
      },
    });

    return NextResponse.json({ item: resolved });
  } catch (err) {
    return jsonError(err, "Could not resolve report");
  }
}
