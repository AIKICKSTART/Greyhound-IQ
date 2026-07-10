export type FeedMode = "for-you" | "latest";

export type FeedCursor = {
  version: 1;
  mode: FeedMode;
  window: 0 | 1;
  bucket: 0 | 1 | 2 | 3;
  createdAt: string;
  id: string;
};

export type FeedRankCandidate = {
  id: string;
  createdAt: Date;
  pinnedAt: Date | null;
  connectedActor: boolean;
  followedTopic: boolean;
};

const CURSOR_MAX_LENGTH = 512;

export function feedRankBucket(
  candidate: Pick<
    FeedRankCandidate,
    "pinnedAt" | "connectedActor" | "followedTopic"
  >
): FeedCursor["bucket"] {
  if (candidate.pinnedAt) return 0;
  if (candidate.connectedActor) return 1;
  if (candidate.followedTopic) return 2;
  return 3;
}

export function feedWindow(
  candidate: Pick<FeedRankCandidate, "createdAt" | "pinnedAt">,
  now = new Date()
): FeedCursor["window"] {
  if (candidate.pinnedAt) return 0;
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return candidate.createdAt.getTime() >= cutoff ? 0 : 1;
}

export function compareFeedCandidates(
  left: FeedRankCandidate,
  right: FeedRankCandidate,
  mode: FeedMode,
  now = new Date()
) {
  if (mode === "for-you") {
    const windowDifference = feedWindow(left, now) - feedWindow(right, now);
    if (windowDifference !== 0) return windowDifference;
    const bucketDifference = feedRankBucket(left) - feedRankBucket(right);
    if (bucketDifference !== 0) return bucketDifference;
  }
  const leftTime =
    mode === "for-you"
      ? (left.pinnedAt ?? left.createdAt).getTime()
      : left.createdAt.getTime();
  const rightTime =
    mode === "for-you"
      ? (right.pinnedAt ?? right.createdAt).getTime()
      : right.createdAt.getTime();
  if (leftTime !== rightTime) return rightTime - leftTime;
  return right.id.localeCompare(left.id);
}

export function cursorForCandidate(
  candidate: FeedRankCandidate,
  mode: FeedMode,
  now = new Date()
): FeedCursor {
  return {
    version: 1,
    mode,
    window: mode === "for-you" ? feedWindow(candidate, now) : 0,
    bucket: mode === "for-you" ? feedRankBucket(candidate) : 0,
    createdAt:
      mode === "for-you"
        ? (candidate.pinnedAt ?? candidate.createdAt).toISOString()
        : candidate.createdAt.toISOString(),
    id: candidate.id,
  };
}

export function encodeFeedCursor(cursor: FeedCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeFeedCursor(
  value: string | null | undefined,
  expectedMode: FeedMode
): FeedCursor | null {
  if (!value) return null;
  if (value.length > CURSOR_MAX_LENGTH) throw new Error("feed.invalid_cursor");
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<FeedCursor>;
    if (
      parsed.version !== 1 ||
      parsed.mode !== expectedMode ||
      (parsed.window !== 0 && parsed.window !== 1) ||
      ![0, 1, 2, 3].includes(parsed.bucket as number) ||
      typeof parsed.createdAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      parsed.id.length > 191
    ) {
      throw new Error("feed.invalid_cursor");
    }
    const cursor = parsed as FeedCursor;
    const normalizedId = /^(?:post|share):/u.test(cursor.id)
      ? cursor.id
      : `post:${cursor.id}`;
    if (normalizedId.length > 191) throw new Error("feed.invalid_cursor");
    return { ...cursor, id: normalizedId };
  } catch {
    throw new Error("feed.invalid_cursor");
  }
}

export function isAfterFeedCursor(
  candidate: FeedRankCandidate,
  cursor: FeedCursor,
  now = new Date()
) {
  const candidateCursor = cursorForCandidate(candidate, cursor.mode, now);
  if (candidateCursor.window !== cursor.window) {
    return candidateCursor.window > cursor.window;
  }
  if (candidateCursor.bucket !== cursor.bucket) {
    return candidateCursor.bucket > cursor.bucket;
  }
  if (candidateCursor.createdAt !== cursor.createdAt) {
    return candidateCursor.createdAt < cursor.createdAt;
  }
  return candidateCursor.id < cursor.id;
}
