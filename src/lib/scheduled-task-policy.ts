export const SCHEDULED_TASK_POLICIES = {
  "account-deletion": { timeoutMs: 240_000 },
  "agent-cleanup": { timeoutMs: 240_000 },
  "aggregate-refresh": { timeoutMs: 780_000 },
  "call-maintenance": { timeoutMs: 240_000 },
  "community-readiness": { timeoutMs: 120_000 },
  "dog-profile-sync": { timeoutMs: 240_000 },
  "listing-expiry": { timeoutMs: 240_000 },
  "live-sync": { timeoutMs: 240_000 },
  "media-maintenance": { timeoutMs: 840_000 },
  "memory-decay": { timeoutMs: 240_000 },
  "notification-delivery": { timeoutMs: 240_000 },
  "usage-delivery": { timeoutMs: 120_000 },
} as const;

export type ScheduledTaskId = keyof typeof SCHEDULED_TASK_POLICIES;
