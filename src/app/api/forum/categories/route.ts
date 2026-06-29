import { NextResponse } from "next/server";
import { getForumOverview } from "@/lib/queries";

export async function GET() {
  const categories = await getForumOverview();
  return NextResponse.json({ items: categories });
}
