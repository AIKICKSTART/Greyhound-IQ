import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { cleanText } from "@/lib/content";
import {
  deleteFeedCommentForCurrentUser,
  editFeedCommentForCurrentUser,
} from "@/lib/feed-service";
import { checkRateLimit } from "@/lib/rate-limit";

const editCommentSchema = z.object({
  body: z.string().trim().min(2).max(2000).transform(cleanText),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const [{ commentId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    await assertMutationRate(current.dbUserId);
    const { body } = editCommentSchema.parse(await request.json());
    const item = await editFeedCommentForCurrentUser(current, commentId, body);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not edit feed comment");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const [{ commentId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    await assertMutationRate(current.dbUserId);
    const item = await deleteFeedCommentForCurrentUser(current, commentId);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete feed comment");
  }
}

async function assertMutationRate(userId: string) {
  const result = await checkRateLimit(
    `feed:comment-mutation:${userId}`,
    30,
    60 * 1000
  );
  if (!result.allowed) throw new Error("rate_limit.exceeded");
}
