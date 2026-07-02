import { NextResponse } from "next/server";
import { getLagoEnv } from "@/lib/billing/lago-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    getLagoEnv();

    return NextResponse.json({
      status: "ready",
      checks: { lagoBilling: "configured" },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { lagoBilling: "not_configured" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
