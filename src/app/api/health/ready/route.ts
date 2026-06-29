import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const dbConfigured =
    databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");

  if (!dbConfigured) {
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: "not_configured" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    await prisma.track.count();
    return NextResponse.json({
      status: "ready",
      checks: { database: "ok" },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health/ready] database check failed:", err);
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: "error" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
