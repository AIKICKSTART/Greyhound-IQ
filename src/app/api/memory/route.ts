import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { memoryCreateSchema } from "@/lib/memory-validation";
import { checkRateLimit } from "@/lib/rate-limit";

const MEMORY_CREATE_RATE_LIMIT = 10;
const MEMORY_CREATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const memories = await prisma.memoryEntry.findMany({
      where: {
        userId: current.dbUserId,
        deletedAt: null,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({ items: memories });
  } catch (err) {
    return jsonError(err, "Could not load memory");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = checkRateLimit(
      `memory:create:${current.dbUserId}`,
      MEMORY_CREATE_RATE_LIMIT,
      MEMORY_CREATE_RATE_LIMIT_WINDOW_MS
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

    const parsed = memoryCreateSchema.parse(await request.json());
    const item = await prisma.memoryEntry.create({
      data: {
        userId: current.dbUserId,
        kind: parsed.kind,
        content: parsed.content,
        source: parsed.source,
        sourceRef: parsed.sourceRef ?? null,
        importance: parsed.importance,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create memory");
  }
}
