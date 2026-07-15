import "server-only";

import { withDbSystemContext } from "@/lib/db-context";
import {
  logExecutionError,
  logExecutionInfo,
  logExecutionWarn,
} from "@/lib/logger";
import {
  SCHEDULED_TASK_POLICIES,
  type ScheduledTaskId,
} from "@/lib/scheduled-task-policy";

export type ScheduledTaskExecution<T> =
  | { status: "completed"; value: T }
  | { status: "overlap" };

export async function executeScheduledTask<T>(
  taskId: ScheduledTaskId,
  run: () => Promise<T>,
): Promise<ScheduledTaskExecution<T>> {
  const { timeoutMs } = SCHEDULED_TASK_POLICIES[taskId];
  const startedAt = Date.now();

  try {
    // ponytail: one advisory-lock transaction holds one pool slot per active
    // task; move to renewable leases if scheduler concurrency reaches pool headroom.
    const execution = await withDbSystemContext(
      async (tx) => {
        const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(
            hashtextextended(${`greyhoundiq:scheduled-task:${taskId}`}, 0)
          ) AS acquired
        `;
        if (!lock?.acquired) return { status: "overlap" } as const;

        await logExecutionInfo("scheduled_task.started", {
          taskId,
          timeoutMs,
          outcome: "started",
        });
        return { status: "completed", value: await run() } as const;
      },
      { maxWait: 30_000, timeout: timeoutMs },
    );

    if (execution.status === "overlap") {
      await logExecutionWarn("scheduled_task.overlap", {
        taskId,
        timeoutMs,
        outcome: "skipped_overlap",
        durationMs: Date.now() - startedAt,
      });
      return execution;
    }

    await logExecutionInfo("scheduled_task.completed", {
      taskId,
      timeoutMs,
      outcome: "completed",
      durationMs: Date.now() - startedAt,
    });
    return execution;
  } catch (error) {
    await logExecutionError(
      "scheduled_task.failed",
      {
        taskId,
        timeoutMs,
        outcome: "failed",
        durationMs: Date.now() - startedAt,
      },
      error,
    );
    throw error;
  }
}
