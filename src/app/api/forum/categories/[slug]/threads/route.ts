import { NextResponse } from "next/server";
import { assertPaidFeatureAccess, requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { cleanText } from "@/lib/content";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";
import { forumThreadCreateSchema } from "@/lib/forum-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const createThreadSchema = forumThreadCreateSchema;

const THREAD_CREATE_RATE_LIMIT = 3;
const THREAD_CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const category = await withDbSystemContext((tx) =>
    tx.forumCategory.findUnique({
      where: { slug },
      include: {
        threads: {
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          include: {
            author: true,
            _count: { select: { posts: true } },
          },
        },
      },
    })
  );
  if (!category) {
    return NextResponse.json(
      { error: { code: "forum.category_not_found", message: "Category not found" } },
      { status: 404 }
    );
  }
  return NextResponse.json({ item: category });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const [{ slug }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    assertPaidFeatureAccess(current);
    const rateLimit = await checkRateLimit(
      `forum:thread:create:${current.dbUserId}:${slug}`,
      THREAD_CREATE_RATE_LIMIT,
      THREAD_CREATE_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        THREAD_CREATE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = createThreadSchema.parse(await readBoundedJsonRequest(request));
    const category = await withDbRequestContext(current, (tx) =>
      tx.forumCategory.findUnique({ where: { slug } })
    );
    if (!category) throw new Error("forum.category_not_found");

    const thread = await withDbRequestContext(current, async (tx) => {
      const created = await tx.thread.create({
        data: {
          categoryId: category.id,
          title: cleanText(parsed.title),
          authorId: current.profileId,
        },
      });
      await tx.post.create({
        data: {
          threadId: created.id,
          authorId: current.profileId,
          body: cleanText(parsed.body),
        },
      });
      return created;
    });

    return NextResponse.json({ item: thread }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not create forum thread");
  }
}
