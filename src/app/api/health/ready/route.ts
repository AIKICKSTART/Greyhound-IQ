import { NextResponse } from "next/server";
import { databaseConfigurationError } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";
import {
  logCorrelatedError,
  logCorrelationContextFromHeaders,
} from "@/lib/logger";

const READINESS_DB_MAX_WAIT_MS = 1_000;
const READINESS_DB_TIMEOUT_MS = 2_000;
const READINESS_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: Request) {
  const logContext = logCorrelationContextFromHeaders(request.headers);
  const dbConfigurationError = databaseConfigurationError();

  if (dbConfigurationError) {
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: "configuration_error" },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: READINESS_HEADERS }
    );
  }

  try {
    await withDbSystemContext(
      (tx) => tx.track.findFirst({ select: { id: true } }),
      {
        maxWait: READINESS_DB_MAX_WAIT_MS,
        timeout: READINESS_DB_TIMEOUT_MS,
      }
    );
    return NextResponse.json(
      {
        status: "ready",
        checks: { database: "ok" },
        timestamp: new Date().toISOString(),
      },
      { headers: READINESS_HEADERS }
    );
  } catch (err) {
    logCorrelatedError(logContext, "health.ready.database", undefined, err);
    return NextResponse.json(
      {
        status: "not_ready",
        checks: { database: "error" },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: READINESS_HEADERS }
    );
  }
}
