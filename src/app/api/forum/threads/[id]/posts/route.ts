import { NextResponse } from "next/server";
import { assertPaidFeatureAccess, requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { cleanText } from "@/lib/content";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";
import { forumPostCreateSchema } from "@/lib/forum-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const createPostSchema = forumPostCreateSchema;

const POST_CREATE_RATE_LIMIT = 5;
const POST_CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const thread = await withDbSystemContext((tx) =>
    tx.thread.findUnique({
      where: { id },
      include: {
        category: true,
        author: true,
        posts: {
          orderBy: { createdAt: "asc" },
          include: { author: true },
        },
      },
    })
  );
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
    assertPaidFeatureAccess(current);
    const rateLimit = await checkRateLimit(
      `forum:post:create:${current.dbUserId}:${id}`,
      POST_CREATE_RATE_LIMIT,
      POST_CREATE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        POST_CREATE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = createPostSchema.parse(await readBoundedJsonRequest(request));
    const thread = await withDbRequestContext(current, (tx) =>
      tx.thread.findUnique({ where: { id } })
    );
    if (!thread || thread.locked) throw new Error("forum.thread_not_found");

    const post = await withDbRequestContext(current, async (tx) => {
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
