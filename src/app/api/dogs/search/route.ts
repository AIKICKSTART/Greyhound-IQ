import { NextResponse } from "next/server";
import { searchDogs } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchDogs(q, 20);
  return NextResponse.json(results);
}
