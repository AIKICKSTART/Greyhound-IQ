import { NextResponse } from "next/server";
import { requireCurrentUserProfile, requireModeratorProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { reportCreateSchema } from "@/lib/report-validation";
import { createReportForUser } from "@/lib/report-service";

export async function GET(request: Request) {
  try {
    await requireModeratorProfile();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const reports = await prisma.report.findMany({
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
    });

    return NextResponse.json({ items: reports });
  } catch (err) {
    return jsonError(err, "Could not load reports");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const parsed = reportCreateSchema.parse(await request.json());
    const report = await createReportForUser(current, parsed);

    return NextResponse.json({ item: report }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create report");
  }
}
