import type { DbContextClient } from "@/lib/db-context";
import { normalizeRequestId } from "@/lib/request-id";

const IDEMPOTENCY_PREFIX = "signup.accepted:";

export function signupAcceptanceIdempotencyKey(userId: string) {
  const normalized = userId.trim();
  if (!normalized) throw new Error("auth.signup_acceptance_user_required");
  return `${IDEMPOTENCY_PREFIX}${normalized}`;
}

export function recordSignupAccepted(
  db: DbContextClient,
  userId: string,
  correlationId?: string,
) {
  const normalizedUserId = userId.trim();
  const idempotencyKey = signupAcceptanceIdempotencyKey(normalizedUserId);
  const normalizedCorrelationId = normalizeRequestId(correlationId);

  return db.signupOutbox.upsert({
    where: { userId: normalizedUserId },
    create: {
      userId: normalizedUserId,
      idempotencyKey,
      correlationId: normalizedCorrelationId,
    },
    update: {},
    select: { id: true, idempotencyKey: true, status: true },
  });
}
