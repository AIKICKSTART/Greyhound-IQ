import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { cleanText } from "@/lib/content";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const createPostSchema = z.object({
  body: z.string().trim().min(20).max(20_000),
});

const POST_CREATE_RATE_LIMIT = 5;
const POST_CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      category: true,
      author: true,
      posts: {
        orderBy: { createdAt: "asc" },
        include: { author: true },
      },
    },
  });
  if (!thread) {
    return NextResponse.json(
      { error: { code: "forum.thread_not_found", message: "Thread not found" } },
      { status: 404 }
    );
  }
  return NextResponse.json({ item: thread });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = checkRateLimit(
      `forum:post:create:${current.dbUserId}:${id}`,
      POST_CREATE_RATE_LIMIT,
      POST_CREATE_RATE_LIMIT_WINDOW_MS
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

    const parsed = createPostSchema.parse(await request.json());
    const thread = await prisma.thread.findUnique({ where: { id } });
    if (!thread || thread.locked) throw new Error("forum.thread_not_found");

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          threadId: thread.id,
          authorId: current.profileId,
          body: cleanText(parsed.body),
        },
      });
      await tx.thread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });
      return created;
    });

    return NextResponse.json({ item: post }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create forum post");
  }
}
