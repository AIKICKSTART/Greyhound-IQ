import { randomUUID } from "crypto";
import { z } from "zod";
import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import {
  DEFAULT_TIER_ENTITLEMENT_LIMITS,
  type BillingTier,
} from "@/lib/billing/entitlements";
import { cleanText } from "@/lib/content";
import { prisma } from "@/lib/db";

export const AGENT_TYPES = {
  "race-analyst": "race_analyst",
  race_analyst: "race_analyst",
  "breeding-advisor": "breeding_advisor",
  breeding_advisor: "breeding_advisor",
  "form-reader": "form_reader",
  form_reader: "form_reader",
} as const;

export type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES];

export const AGENT_TIER: Record<AgentType, BillingTier> = {
  race_analyst: "pro",
  breeding_advisor: "pro_plus",
  form_reader: "pro",
};

const MEMORY_DECAY_DAYS = 30;
const MEMORY_REINFORCE_DAYS = 14;
const MEMORY_DECAY_STEP = 0.05;
const MEMORY_REINFORCE_STEP = 0.1;
const MEMORY_MIN_IMPORTANCE = 0.1;
const MEMORY_MAX_IMPORTANCE = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGENT_RUN_TIMEOUT_HOURS = 24;

export interface MemoryMaintenanceResult {
  decayedCount: number;
  reinforcedCount: number;
  floorCount: number;
  cappedCount: number;
  ranAt: string;
  idleCutoff: string;
  recentCutoff: string;
}

export interface AgentCleanupResult {
  timedOutCount: number;
  ranAt: string;
  timeoutCutoff: string;
}

export const agentRunSchema = z.object({
  input: z.string().trim().min(10).max(5_000).transform(cleanText),
  conversationContextId: z.string().optional().nullable(),
});

export function normalizeAgentType(type: string) {
  return AGENT_TYPES[type as keyof typeof AGENT_TYPES] ?? null;
}

export function assertAgentTier(current: CurrentUserProfile, agentType: AgentType) {
  const currentAllowance =
    DEFAULT_TIER_ENTITLEMENT_LIMITS[current.tier].agent_runs_per_month;
  const requiredAllowance =
    DEFAULT_TIER_ENTITLEMENT_LIMITS[AGENT_TIER[agentType]].agent_runs_per_month;

  if (currentAllowance < requiredAllowance) {
    throw new Error("payment.required");
  }
}

export async function runAgentForCurrentUser(
  current: CurrentUserProfile,
  agentType: AgentType,
  input: z.infer<typeof agentRunSchema>
) {
  assertAgentTier(current, agentType);

  const started = Date.now();
  const harnessSessionId = `local-${randomUUID()}`;
  const context = await getOrCreateConversationContext(
    current.dbUserId,
    agentType,
    input.conversationContextId
  );
  const memory = await loadAgentMemory(current.dbUserId);
  await markMemoriesAccessed(memory.top);

  const run = await prisma.agentRun.create({
    data: {
      agentType,
      userId: current.dbUserId,
      inputJson: JSON.stringify({
        input: input.input,
        conversationContextId: context.id,
      }),
      status: "running",
      harnessSessionId,
    },
  });

  try {
    const output = await buildAgentOutput(agentType, input.input, memory);
    const createdMemory = await createMemoryFromAgentInput(
      current.dbUserId,
      agentType,
      input.input,
      run.id
    );
    await prisma.conversationContext.update({
      where: { id: context.id },
      data: {
        lastMessageAt: new Date(),
        pendingAction:
          createdMemory.kind === "unfinished"
            ? JSON.stringify({
                runId: run.id,
                agentType,
                content: createdMemory.content,
              })
            : null,
      },
    });

    const completed = await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        outputJson: JSON.stringify(output),
        toolInvocations: JSON.stringify(output.toolInvocations),
        createdMemoryIds: JSON.stringify([createdMemory.id]),
        status: "completed",
        promptTokens: estimateTokens(input.input) + memory.promptTokens,
        completionTokens: estimateTokens(JSON.stringify(output)),
        durationMs: Date.now() - started,
        completedAt: new Date(),
      },
    });

    await createAuditLog({
      actorId: current.dbUserId,
      actorType: "agent",
      action: "agent.run",
      targetType: "agentRun",
      targetId: completed.id,
      metadata: {
        agentType,
        status: completed.status,
        createdMemoryIds: [createdMemory.id],
      },
    });

    return completed;
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : "agent.failed",
        durationMs: Date.now() - started,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

export async function listAgentRunsForCurrentUser(current: CurrentUserProfile) {
  return prisma.agentRun.findMany({
    where: { userId: current.dbUserId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getAgentRunForCurrentUser(
  current: CurrentUserProfile,
  runId: string
) {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== current.dbUserId) {
    throw new Error("agent.run_not_found");
  }
  return run;
}

export async function cancelAgentRunForCurrentUser(
  current: CurrentUserProfile,
  runId: string
) {
  const run = await getAgentRunForCurrentUser(current, runId);
  if (run.status !== "pending" && run.status !== "running") return run;

  return prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: "cancelled",
      completedAt: new Date(),
    },
  });
}

export async function runMemoryMaintenance(
  now = new Date()
): Promise<MemoryMaintenanceResult> {
  const idleCutoff = daysBefore(now, MEMORY_DECAY_DAYS);
  const recentCutoff = daysBefore(now, MEMORY_REINFORCE_DAYS);
  const staleMemories = await prisma.memoryEntry.findMany({
    where: {
      deletedAt: null,
      supersededAt: null,
      lastAccessedAt: { lt: idleCutoff },
      importance: { gt: MEMORY_MIN_IMPORTANCE },
    },
    select: {
      id: true,
      importance: true,
      lastAccessedAt: true,
      lastMaintainedAt: true,
    },
  });
  const recentMemories = await prisma.memoryEntry.findMany({
    where: {
      deletedAt: null,
      supersededAt: null,
      accessCount: { gt: 0 },
      lastAccessedAt: { gte: recentCutoff },
      importance: { lt: MEMORY_MAX_IMPORTANCE },
    },
    select: {
      id: true,
      importance: true,
      lastAccessedAt: true,
      lastMaintainedAt: true,
    },
  });

  let decayedCount = 0;
  let reinforcedCount = 0;
  let floorCount = 0;
  let cappedCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const memory of staleMemories) {
      const periods = unappliedDecayPeriods(memory, now);
      if (periods === 0) continue;
      const importance = Math.max(
        MEMORY_MIN_IMPORTANCE,
        roundImportance(memory.importance - MEMORY_DECAY_STEP * periods)
      );
      decayedCount += 1;
      if (importance === MEMORY_MIN_IMPORTANCE) floorCount += 1;
      await tx.memoryEntry.update({
        where: { id: memory.id },
        data: { importance, lastMaintainedAt: now },
      });
    }

    for (const memory of recentMemories) {
      if (
        memory.lastMaintainedAt &&
        memory.lastMaintainedAt >= memory.lastAccessedAt
      ) {
        continue;
      }
      const importance = Math.min(
        MEMORY_MAX_IMPORTANCE,
        roundImportance(memory.importance + MEMORY_REINFORCE_STEP)
      );
      reinforcedCount += 1;
      if (importance === MEMORY_MAX_IMPORTANCE) cappedCount += 1;
      await tx.memoryEntry.update({
        where: { id: memory.id },
        data: { importance, lastMaintainedAt: now },
      });
    }
  });

  const result: MemoryMaintenanceResult = {
    decayedCount,
    reinforcedCount,
    floorCount,
    cappedCount,
    ranAt: now.toISOString(),
    idleCutoff: idleCutoff.toISOString(),
    recentCutoff: recentCutoff.toISOString(),
  };

  if (result.decayedCount > 0 || result.reinforcedCount > 0) {
    await createAuditLog({
      actorType: "system",
      action: "memory.maintenance",
      targetType: "memoryEntry",
      metadata: { ...result },
    });
  }

  return result;
}

export async function runAgentCleanup(
  now = new Date()
): Promise<AgentCleanupResult> {
  const timeoutCutoff = hoursBefore(now, AGENT_RUN_TIMEOUT_HOURS);
  const timedOut = await prisma.agentRun.updateMany({
    where: {
      status: { in: ["pending", "running"] },
      createdAt: { lt: timeoutCutoff },
    },
    data: {
      status: "failed",
      error: "agent.cleanup.timeout",
      completedAt: now,
    },
  });

  const result: AgentCleanupResult = {
    timedOutCount: timedOut.count,
    ranAt: now.toISOString(),
    timeoutCutoff: timeoutCutoff.toISOString(),
  };

  if (result.timedOutCount > 0) {
    await createAuditLog({
      actorType: "system",
      action: "agent.cleanup",
      targetType: "agentRun",
      metadata: { ...result },
    });
  }

  return result;
}

export async function getAgentContextForCurrentUser(
  current: CurrentUserProfile,
  agentType: AgentType
) {
  assertAgentTier(current, agentType);

  const context = await getOrCreateConversationContext(current.dbUserId, agentType);
  const memory = await loadAgentMemory(current.dbUserId);
  return { context, memory };
}

export async function loadAgentMemory(userId: string) {
  const [top, recent] = await Promise.all([
    prisma.memoryEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        supersededAt: null,
        importance: { gte: 0.2 },
      },
      orderBy: [{ importance: "desc" }, { lastAccessedAt: "desc" }],
      take: 20,
    }),
    prisma.memoryEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        supersededAt: null,
        kind: "episodic",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    top,
    recent,
    promptTokens: estimateTokens(
      [...top, ...recent].map((entry) => entry.content).join("\n")
    ),
  };
}

async function getOrCreateConversationContext(
  userId: string,
  agentType: AgentType,
  contextId?: string | null
) {
  if (contextId) {
    const existing = await prisma.conversationContext.findFirst({
      where: { id: contextId, userId, agentType },
    });
    if (existing) return existing;
  }

  return prisma.conversationContext.upsert({
    where: { userId_agentType: { userId, agentType } },
    update: { lastMessageAt: new Date() },
    create: { userId, agentType },
  });
}

async function buildAgentOutput(
  agentType: AgentType,
  input: string,
  memory: Awaited<ReturnType<typeof loadAgentMemory>>
) {
  if (agentType === "race_analyst") {
    return buildRaceAnalystOutput(input, memory);
  }
  if (agentType === "breeding_advisor") {
    return buildBreedingAdvisorOutput(input, memory);
  }
  return buildFormReaderOutput(input, memory);
}

async function buildRaceAnalystOutput(
  input: string,
  memory: Awaited<ReturnType<typeof loadAgentMemory>>
) {
  const race = await prisma.race.findFirst({
    where: { raceTime: { gte: new Date() } },
    orderBy: { raceTime: "asc" },
    include: {
      meeting: { include: { track: true } },
      runners: {
        orderBy: { boxNumber: "asc" },
        include: {
          trainer: true,
          dog: {
            include: {
              formEntries: {
                orderBy: { date: "desc" },
                take: 5,
                include: { track: true },
              },
            },
          },
        },
      },
    },
  });

  const selections =
    race?.runners
      .map((runner) => {
        const recent = runner.dog.formEntries;
        const wins = recent.filter((entry) => entry.finish === 1).length;
        const averageFinish =
          recent.reduce((sum, entry) => sum + (entry.finish ?? 8), 0) /
          Math.max(recent.length, 1);
        const boxBoost = runner.boxNumber === 1 ? 0.08 : runner.boxNumber <= 3 ? 0.04 : 0;
        const score = Math.max(0.05, 0.35 - averageFinish * 0.025 + wins * 0.06 + boxBoost);
        return {
          dogId: runner.dogId,
          name: runner.dog.name,
          box: runner.boxNumber,
          score: Number(score.toFixed(3)),
          factors: [
            `${recent.length} recent starts loaded`,
            `${wins} wins in the recent form window`,
            runner.trainer?.name
              ? `Trainer: ${runner.trainer.name}`
              : "Trainer signal unavailable",
          ],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) ?? [];

  return {
    mode: "local_harness",
    agentType: "race_analyst",
    summary: race
      ? `Analysed R${race.raceNumber} at ${race.meeting.track.name} using seeded/live form, boxes, and trainer context.`
      : `Captured race analysis request: ${input}`,
    selections,
    memoryUsed: memory.top.slice(0, 5).map((entry) => entry.content),
    toolInvocations: [
      {
        name: "race.load_upcoming",
        resultSize: race?.runners.length ?? 0,
      },
      {
        name: "memory.load",
        resultSize: memory.top.length,
      },
    ],
    disclaimer:
      "AI predictions are statistical estimates, not guarantees. Bet responsibly.",
  };
}

async function buildBreedingAdvisorOutput(
  input: string,
  memory: Awaited<ReturnType<typeof loadAgentMemory>>
) {
  const [left, right] = splitPair(input);
  const [sire, dam] = await Promise.all([
    left
      ? prisma.dog.findFirst({
          where: { name: { contains: left } },
          include: { sire: true, dam: true },
        })
      : null,
    right
      ? prisma.dog.findFirst({
          where: { name: { contains: right } },
          include: { sire: true, dam: true },
        })
      : null,
  ]);

  const overlap = [
    sire?.sireId && sire.sireId === dam?.sireId ? sire.sire?.name : null,
    sire?.damId && sire.damId === dam?.damId ? sire.dam?.name : null,
  ].filter(Boolean);

  return {
    mode: "local_harness",
    agentType: "breeding_advisor",
    summary:
      sire && dam
        ? `Assessed ${sire.name} x ${dam.name} against available pedigree links.`
        : `Captured breeding request and could not confidently match both dogs: ${input}`,
    pairing: {
      sire: sire?.name ?? left ?? "Unmatched sire",
      dam: dam?.name ?? right ?? "Unmatched dam",
    },
    coiEstimate: overlap.length > 0 ? "medium" : "low/unknown",
    riskFlags:
      overlap.length > 0
        ? [`Shared ancestor signal: ${overlap.join(", ")}`]
        : ["No shared sire/dam overlap in the loaded pedigree window."],
    memoryUsed: memory.top.slice(0, 5).map((entry) => entry.content),
    toolInvocations: [
      { name: "dog.lookup_pair", resultSize: [sire, dam].filter(Boolean).length },
      { name: "memory.load", resultSize: memory.top.length },
    ],
  };
}

async function buildFormReaderOutput(
  input: string,
  memory: Awaited<ReturnType<typeof loadAgentMemory>>
) {
  const candidates = await prisma.dog.findMany({
    include: {
      formEntries: {
        orderBy: { date: "desc" },
        take: 5,
        include: { track: true },
      },
    },
    take: 80,
    orderBy: { createdAt: "desc" },
  });
  const lowerInput = input.toLowerCase();
  const dog =
    candidates.find((candidate) =>
      lowerInput.includes(candidate.name.toLowerCase())
    ) ?? candidates[0];

  const finishes = dog?.formEntries.map((entry) => entry.finish ?? 8) ?? [];
  const improving =
    finishes.length >= 2 && finishes[0] < finishes[finishes.length - 1];

  return {
    mode: "local_harness",
    agentType: "form_reader",
    summary: dog
      ? `${dog.name} has ${finishes.length} recent form entries loaded.`
      : `Captured form reading request: ${input}`,
    dog: dog?.name ?? null,
    pattern: dog
      ? improving
        ? "Recent finishing positions show improvement in the loaded window."
        : "Recent form is mixed or flat in the loaded window."
      : "No matching dog was found in the local data set.",
    recentStarts:
      dog?.formEntries.map((entry) => ({
        track: entry.track?.name ?? "Unknown track",
        date: entry.date,
        finish: entry.finish,
        time: entry.time,
        distance: entry.distance,
      })) ?? [],
    memoryUsed: memory.top.slice(0, 5).map((entry) => entry.content),
    toolInvocations: [
      { name: "dog.load_recent_form", resultSize: dog?.formEntries.length ?? 0 },
      { name: "memory.load", resultSize: memory.top.length },
    ],
  };
}

async function createMemoryFromAgentInput(
  userId: string,
  agentType: AgentType,
  input: string,
  runId: string
) {
  const kind = inferMemoryKind(input);
  const importance = kind === "unfinished" ? 0.9 : kind === "preference" ? 0.8 : 0.6;
  return prisma.memoryEntry.create({
    data: {
      userId,
      kind,
      content: `${labelAgent(agentType)}: ${input.slice(0, 240)}`,
      source: "agent_inference",
      sourceRef: runId,
      importance,
    },
  });
}

async function markMemoriesAccessed(memories: { id: string }[]) {
  if (memories.length === 0) return;
  await prisma.memoryEntry.updateMany({
    where: { id: { in: memories.map((entry) => entry.id) } },
    data: {
      lastAccessedAt: new Date(),
      accessCount: { increment: 1 },
    },
  });
}

function splitPair(input: string) {
  const match = input.match(/(.+?)\s+(?:x|×|\+|to)\s+(.+)/i);
  if (!match) return [null, null] as const;
  return [cleanName(match[1]), cleanName(match[2])] as const;
}

function cleanName(value: string) {
  return value
    .replace(/^(assess|testmate|check|breed|breeding|sire|dam)\s+/i, "")
    .replace(/[?.!].*$/, "")
    .trim();
}

function inferMemoryKind(input: string) {
  const lower = input.toLowerCase();
  if (/\b(always|prefer|usually|favourite|favorite)\b/.test(lower)) {
    return "preference";
  }
  if (/\b(need|remind|later|tomorrow|friday|saturday|sunday|pending)\b/.test(lower)) {
    return "unfinished";
  }
  return "episodic";
}

function labelAgent(agentType: AgentType) {
  return agentType.replace(/_/g, " ");
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function daysBefore(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function hoursBefore(date: Date, hours: number) {
  const result = new Date(date);
  result.setHours(result.getHours() - hours);
  return result;
}

function roundImportance(value: number) {
  return Number(value.toFixed(2));
}

function unappliedDecayPeriods(
  memory: { lastAccessedAt: Date; lastMaintainedAt: Date | null },
  now: Date
) {
  const currentPeriods = elapsedDecayPeriods(memory.lastAccessedAt, now);
  const appliedPeriods = memory.lastMaintainedAt
    ? elapsedDecayPeriods(memory.lastAccessedAt, memory.lastMaintainedAt)
    : 0;
  return Math.max(currentPeriods - appliedPeriods, 0);
}

function elapsedDecayPeriods(lastAccessedAt: Date, date: Date) {
  const elapsedMs = date.getTime() - lastAccessedAt.getTime();
  return Math.max(0, Math.floor(elapsedMs / (MEMORY_DECAY_DAYS * DAY_MS)));
}
