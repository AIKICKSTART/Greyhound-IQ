import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { cleanText } from "@/lib/content";
import { prisma } from "@/lib/db";

const createThreadSchema = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(20).max(20_000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const category = await prisma.forumCategory.findUnique({
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
  });
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
    const parsed = createThreadSchema.parse(await request.json());
    const category = await prisma.forumCategory.findUnique({ where: { slug } });
    if (!category) throw new Error("forum.category_not_found");

    const thread = await prisma.$transaction(async (tx) => {
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
