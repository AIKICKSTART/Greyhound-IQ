import { NextResponse } from "next/server";
import { getLiveFeedStatus } from "@/lib/live/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getLiveFeedStatus());
}
