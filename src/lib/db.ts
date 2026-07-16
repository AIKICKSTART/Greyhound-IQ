import { Prisma, PrismaClient } from "@prisma/client";

import {
  databaseUrlConfigurationError,
  runtimeDatabaseUrl,
} from "@/lib/database-url";
import { logExecutionWarn, logRequestError } from "@/lib/logger";
import { isFullAccessDemo } from "@/lib/demo-access";

// Slow-query threshold. Above this a single WARNING line is emitted per query so
// pathological queries surface in Cloud Logging without flooding it.
const SLOW_QUERY_MS = 500;
const DEVELOPMENT_DATABASE_CONNECTION_LIMIT = "10";
const DISPOSABLE_REPLAY_QUERY_EVIDENCE_MODE =
  "capture-sanitized-statements-on-disposable-loopback-55734";
const ENDPOINT_OVERRIDE_PARAMETERS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "socket",
]);

export type DisposableReplayQueryEvent = Pick<
  Prisma.QueryEvent,
  "query" | "params" | "duration" | "target"
>;

let disposableReplayQuerySink:
  | ((event: DisposableReplayQueryEvent) => void)
  | null = null;
let disposableReplayQueryCaptureConfigured = false;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaConfigurationError = databaseConfigurationError();

function makePrisma(): PrismaClient | null {
  if (prismaConfigurationError) return null;
  try {
    const queryEvidenceEnabled = isDisposableReplayQueryEvidenceEnabled();
    const client = new PrismaClient({
      datasources: {
        db: {
          url: runtimeDatabaseUrl(process.env.DATABASE_URL ?? "", {
            connectionLimit:
              process.env.NODE_ENV === "development"
                ? DEVELOPMENT_DATABASE_CONNECTION_LIMIT
                : undefined,
          }),
        },
      },
      ...(queryEvidenceEnabled
        ? { log: [{ emit: "event", level: "query" }] as const }
        : {}),
    });
    if (queryEvidenceEnabled) {
      const onQuery = client.$on as unknown as (
        eventType: "query",
        callback: (event: Prisma.QueryEvent) => void,
      ) => void;
      onQuery.call(client, "query", (event) => {
        disposableReplayQuerySink?.({
          query: event.query,
          params: event.params,
          duration: event.duration,
          target: event.target,
        });
      });
      disposableReplayQueryCaptureConfigured = true;
    }
    // $extends returns a structurally-wider client; callers only use the
    // PrismaClient surface, so cast back for the existing export contract.
    return client.$extends(slowQueryLogger) as unknown as PrismaClient;
  } catch {
    return null;
  }
}

const slowQueryLogger = {
  query: {
    async $allOperations({
      model,
      operation,
      args,
      query,
    }: {
      model?: string;
      operation: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) {
      const start = performance.now();
      try {
        return await query(args);
      } finally {
        const durationMs = Math.round(performance.now() - start);
        if (durationMs > SLOW_QUERY_MS) {
          await logExecutionWarn("db.slow_query", {
            model: model ?? "raw",
            operation,
            durationMs,
          });
        }
      }
    },
  },
} as const;

export function databaseConfigurationError() {
  const error = databaseUrlConfigurationError(process.env.DATABASE_URL, {
    production: process.env.NODE_ENV === "production",
    required: process.env.NODE_ENV === "production",
    allowManagedSupabase: isFullAccessDemo(),
  });

  return error ? `DATABASE_URL ${error}.` : null;
}

const realPrisma = globalForPrisma.prisma ?? makePrisma();

if (realPrisma && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = realPrisma;
}

// ponytail: development-only no-op DB so local UI can render before env setup.
// Production fails fast above; this must never be the live source of truth.
const stub = new Proxy({} as PrismaClient, {
  get: (_target, model) => {
    if (typeof model === "string" && model.startsWith("$")) {
      return () =>
        prismaConfigurationError
          ? Promise.reject(new Error(prismaConfigurationError))
          : Promise.resolve(model === "$executeRaw" ? 0 : []);
    }
    return new Proxy({}, {
      get: (_t, method) => {
        if (prismaConfigurationError) {
          return () => Promise.reject(new Error(prismaConfigurationError));
        }
        // findUnique / findFirst → return null
        if (method === "findUnique" || method === "findFirst") {
          return () => Promise.resolve(null);
        }
        // findMany / groupBy / aggregate → return empty array
        if (
          method === "findMany" ||
          method === "groupBy" ||
          method === "aggregate"
        ) {
          return () => Promise.resolve([]);
        }
        // count → 0
        if (method === "count") {
          return () => Promise.resolve(0);
        }
        // create / update / delete / upsert → no-op stub
        return () => Promise.resolve({});
      },
    });
  },
});

export const prisma: PrismaClient = (realPrisma as PrismaClient) ?? (stub as PrismaClient);

export async function captureDisposableReplayQueries<T>(
  operation: () => Promise<T>,
) {
  if (
    !isDisposableReplayQueryEvidenceEnabled() ||
    !disposableReplayQueryCaptureConfigured
  ) {
    throw new Error("database.disposable_query_evidence_disabled");
  }
  if (disposableReplayQuerySink) {
    throw new Error("database.disposable_query_evidence_capture_active");
  }

  const queries: DisposableReplayQueryEvent[] = [];
  disposableReplayQuerySink = (event) => queries.push(event);
  try {
    const result = await operation();
    return { result, queries } as const;
  } finally {
    disposableReplayQuerySink = null;
  }
}

function isDisposableReplayQueryEvidenceEnabled() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEMO_FIXTURE_QUERY_EVIDENCE_MODE !==
      DISPOSABLE_REPLAY_QUERY_EVIDENCE_MODE
  ) {
    return false;
  }
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return (
      url.protocol === "postgresql:" &&
      ["127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
      url.port === "55734" &&
      url.pathname === "/greyhoundiq" &&
      decodeURIComponent(url.username) === "greyhoundiq_runtime" &&
      url.password === "" &&
      [...url.searchParams.keys()].every(
        (key) => !ENDPOINT_OVERRIDE_PARAMETERS.has(key.toLowerCase()),
      )
    );
  } catch {
    return false;
  }
}

function summarizeDatabaseError(err: unknown) {
  const maybeRecord = err && typeof err === "object" ? err as Record<string, unknown> : null;
  const name = err instanceof Error ? err.name : "DatabaseError";
  const code = typeof maybeRecord?.code === "string" ? maybeRecord.code : null;
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (code === "P2024" || /connection pool|Timed out fetching a new connection/i.test(rawMessage)) {
    return `${name}: connection pool timeout${code ? ` (${code})` : ""}`;
  }
  if (code === "P1001" || /can't reach database server|database server/i.test(rawMessage)) {
    return `${name}: database unreachable${code ? ` (${code})` : ""}`;
  }
  if (/57014|statement timeout|canceling statement due to statement timeout/i.test(rawMessage)) {
    return `${name}: statement timeout (Postgres 57014)`;
  }

  const message = rawMessage.replace(/\s+/g, " ").trim();
  const shortMessage = message.length > 360 ? `${message.slice(0, 360)}...` : message;

  return code ? `${name} ${code}: ${shortMessage}` : `${name}: ${shortMessage}`;
}

// ponytail: development-only graceful query wrapper. Production must fail closed
// so source-of-truth database problems cannot render as empty or stale states.
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (process.env.NODE_ENV === "production" && prismaConfigurationError) {
    throw new Error(prismaConfigurationError);
  }

  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      // Summarized only: raw Prisma errors can embed connection strings.
      await logRequestError("db.safe_query_failed", {
        summary: `DB error, failing closed: ${summarizeDatabaseError(err)}`,
      });
      throw err;
    }
    return fallback;
  }
}
