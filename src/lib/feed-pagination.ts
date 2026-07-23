export type FeedMode = "public" | "friends";
export type FeedModeInput = FeedMode | "for-you" | "latest";

export type FeedCursor = {
  version: 1;
  mode: FeedMode;
  window: 0;
  bucket: 0;
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

export function canonicalFeedMode(
  mode: FeedModeInput | null | undefined
): FeedMode {
  return mode === "friends" ? "friends" : "public";
}

export function feedRankBucket(
  candidate: Pick<
    FeedRankCandidate,
    "pinnedAt" | "connectedActor" | "followedTopic"
  >
): FeedCursor["bucket"] {
  void candidate;
  return 0;
}

export function feedWindow(
  candidate: Pick<FeedRankCandidate, "createdAt" | "pinnedAt">,
  now = new Date()
): FeedCursor["window"] {
  void candidate;
  void now;
  return 0;
}

export function compareFeedCandidates(
  left: FeedRankCandidate,
  right: FeedRankCandidate,
  mode: FeedMode,
  now = new Date()
) {
  void mode;
  void now;
  const leftTime = left.createdAt.getTime();
  const rightTime = right.createdAt.getTime();
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
    window: 0,
    bucket: 0,
    createdAt: candidate.createdAt.toISOString(),
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
      parsed.window !== 0 ||
      parsed.bucket !== 0 ||
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
