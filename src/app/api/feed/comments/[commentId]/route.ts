import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  deleteFeedCommentForCurrentUser,
  editFeedCommentForCurrentUser,
} from "@/lib/feed-service";
import { feedCommentEditSchema } from "@/lib/feed-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const FEED_COMMENT_MUTATION_LIMIT = 30;
const FEED_COMMENT_MUTATION_WINDOW_MS = 60 * 1000;

const editCommentSchema = feedCommentEditSchema;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const [{ commentId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkMutationRate(current.dbUserId);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        FEED_COMMENT_MUTATION_LIMIT,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const { body } = editCommentSchema.parse(await readBoundedJsonRequest(request));
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
    const rateLimit = await checkMutationRate(current.dbUserId);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        FEED_COMMENT_MUTATION_LIMIT,
        { code: "rate_limit.exceeded", message: "rate_limit.exceeded" }
      );
    }
    const item = await deleteFeedCommentForCurrentUser(current, commentId);
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete feed comment");
  }
}

async function checkMutationRate(userId: string) {
  return checkRateLimit(
    `feed:comment-mutation:${userId}`,
    FEED_COMMENT_MUTATION_LIMIT,
    FEED_COMMENT_MUTATION_WINDOW_MS
  );
}
