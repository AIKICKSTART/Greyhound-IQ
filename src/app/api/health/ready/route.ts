import { NextResponse } from "next/server";
import { databaseConfigurationError, prisma } from "@/lib/db";

export async function GET() {
  const dbConfigurationError = databaseConfigurationError();

  if (dbConfigurationError) {
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: dbConfigurationError },
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
