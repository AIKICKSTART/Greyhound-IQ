import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  missingRequiredLanes,
  resolveStagingLoadProfile,
  stableJson,
  stagingLoadConfigDigest,
  stagingLoadPreflightFindings,
  stagingLoadThresholdFindings,
  summarizeStagingLoad,
  type StagingLoadLane,
  type StagingLoadSample,
} from "./staging-load-evidence";
import {
  resolveApprovedGcsSignedUploadUrl,
  resolveApprovedSignedUploadUrl,
  resolveLoadObjectStorageProvider,
  resolveSignedUploadHeaders,
  resolveStagingLoadBaseUrl,
  resolveStagingRequestUrl,
  resolveStagingSupabaseUrl,
} from "./staging-load-policy";

type Method = "GET" | "POST";

type Probe = {
  label: string;
  method?: Method;
  path: string;
  expected: number[];
  auth?: boolean;
  body?: unknown;
};

type Result = StagingLoadSample;

type ProbeTargets = {
  conversationId: string | null;
  callRoomId: string | null;
  feedPostId: string | null;
  listingId: string | null;
};

const baseUrl = resolveStagingLoadBaseUrl(process.env.LOAD_BASE_URL);
const iterations = positiveInt(process.env.LOAD_ITERATIONS, 5);
const concurrency = positiveInt(process.env.LOAD_CONCURRENCY, 4);
const loadProfile = resolveStagingLoadProfile(process.env.LOAD_PROFILE, {
  iterations,
  concurrency,
});
const cookie = process.env.LOAD_TEST_COOKIE?.trim();
const includeMutations = process.env.LOAD_INCLUDE_MUTATIONS === "true";
const includeInternalWriteFlow =
  process.env.LOAD_INCLUDE_INTERNAL_WRITE_FLOW === "true";
const internalSecret =
  process.env.LOAD_INTERNAL_SECRET?.trim() ?? process.env.INTERNAL_API_SECRET?.trim();
const conversationId = process.env.LOAD_CONVERSATION_ID?.trim();
const callRoomId = process.env.LOAD_CALL_ROOM_ID?.trim();
const listingId = process.env.LOAD_LISTING_ID?.trim();
const feedPostId = process.env.LOAD_FEED_POST_ID?.trim();
const requestTimeoutMs = positiveInt(process.env.LOAD_REQUEST_TIMEOUT_MS, 60_000);

const includeRealtime = process.env.LOAD_INCLUDE_REALTIME === "true";
const realtimeClients = positiveInt(process.env.LOAD_REALTIME_CLIENTS, 5);
const includeMediaFlow = process.env.LOAD_INCLUDE_MEDIA_FLOW === "true";
const objectStorageProvider = resolveLoadObjectStorageProvider(
  process.env.LOAD_OBJECT_STORAGE_PROVIDER ??
    process.env.OBJECT_STORAGE_PROVIDER
);
const supabaseUrl =
  includeRealtime ||
  (includeMediaFlow && objectStorageProvider === "supabase")
    ? resolveStagingSupabaseUrl(
        process.env.LOAD_SUPABASE_URL,
        process.env.LOAD_APPROVED_SUPABASE_HOST
      )
    : undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const approvedGcsBucket =
  includeMediaFlow && objectStorageProvider === "gcs"
    ? process.env.LOAD_APPROVED_GCS_BUCKET?.trim()
    : undefined;
const mediaStorageApproved =
  objectStorageProvider === "gcs"
    ? Boolean(approvedGcsBucket)
    : Boolean(supabaseUrl);

const includeCallTokenLoad = process.env.LOAD_INCLUDE_CALL_TOKEN_LOAD === "true";
const callTokenConcurrency = positiveInt(process.env.LOAD_CALL_TOKEN_CONCURRENCY, 10);
const callTokenRoomId =
  process.env.LOAD_CALL_TOKEN_ROOM_ID?.trim() || "load-probe-fake-room";

const includePoolSaturation = process.env.LOAD_INCLUDE_POOL_SATURATION === "true";
const poolSaturationRequests = positiveInt(process.env.LOAD_POOL_SATURATION_REQUESTS, 50);
const poolSaturationUrl = resolveStagingRequestUrl(
  process.env.LOAD_POOL_SATURATION_PATH?.trim() || "/api/dogs/search?q=load",
  baseUrl
);
const poolSaturationPath = `${poolSaturationUrl.pathname}${poolSaturationUrl.search}`;

// 1x1 transparent PNG — smallest valid image for the media sign+upload+finalize path.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const publicProbes: Probe[] = [
  { label: "ready", path: "/api/health/ready", expected: [200] },
  { label: "feed health", path: "/api/health/feeds", expected: [200] },
  { label: "browse listings api", path: "/api/listings?limit=20", expected: [200] },
  { label: "browse marketplace page", path: "/marketplace", expected: [200] },
  { label: "feed page", path: "/feed", expected: [200] },
];

// ponytail: auto-discovery uses existing read APIs; explicit env IDs still win.
async function buildAuthProbes(): Promise<{
  probes: Probe[];
  targets: ProbeTargets;
}> {
  const targets = await resolveProbeTargets();
  if (!cookie) return { probes: [], targets };

  return {
    targets,
    probes: [
      { label: "current user", path: "/api/users/me", expected: [200], auth: true },
      { label: "conversations", path: "/api/conversations", expected: [200], auth: true },
      { label: "messages", path: "/api/messages", expected: [200], auth: true },
      ...(targets.conversationId
        ? [
            {
              label: "conversation messages",
              path: `/api/conversations/${targets.conversationId}/messages`,
              expected: [200],
              auth: true,
            },
          ]
        : []),
      ...(includeMutations
        ? [
            {
              label: "feed post create",
              method: "POST" as const,
              path: "/api/feed",
              expected: [201],
              auth: true,
              body: {
                topicId: null,
                body: "Authenticated staging load probe feed post.",
                mediaIds: [],
              },
            },
            ...(targets.feedPostId
              ? [
                  {
                    label: "feed comment",
                    method: "POST" as const,
                    path: `/api/feed/${targets.feedPostId}/comments`,
                    expected: [201],
                    auth: true,
                    body: { body: "Authenticated staging load probe comment." },
                  },
                  {
                    label: "feed reaction",
                    method: "POST" as const,
                    path: `/api/feed/${targets.feedPostId}/reaction`,
                    expected: [200],
                    auth: true,
                  },
                ]
              : []),
            ...(targets.conversationId
              ? [
                  {
                    label: "conversation message send",
                    method: "POST" as const,
                    path: `/api/conversations/${targets.conversationId}/messages`,
                    expected: [201],
                    auth: true,
                    body: {
                      body: "Authenticated staging load probe message.",
                      mediaIds: [],
                    },
                  },
                ]
              : []),
            {
              label: "media sign upload",
              method: "POST" as const,
              path: "/api/media/sign-upload",
              expected: [201],
              auth: true,
              body: {
                filename: "load-probe.png",
                mimeType: "image/png",
                sizeBytes: 1024,
                bucket: "private-user-media",
                mediaContext: "messages",
                linkedEntityType: "load-probe",
                linkedEntityId: "pending",
              },
            },
            ...(targets.listingId
              ? [
                  {
                    label: "listing enquiry",
                    method: "POST" as const,
                    path: `/api/listings/${targets.listingId}/enquiry`,
                    expected: [200],
                    auth: true,
                    body: { message: "Authenticated staging load probe enquiry." },
                  },
                  {
                    label: "listing save toggle",
                    method: "POST" as const,
                    path: `/api/listings/${targets.listingId}/save`,
                    expected: [200],
                    auth: true,
                  },
                ]
              : []),
            ...(targets.callRoomId
              ? [
                  {
                    label: "call token",
                    method: "POST" as const,
                    path: `/api/calls/${targets.callRoomId}/token`,
                    expected: [200],
                    auth: true,
                  },
                ]
              : []),
          ]
        : []),
    ],
  };
}

// ponytail: this is a bounded probe, not k6; add k6 when authenticated scenarios are stable.
main().catch((err) => {
  console.error("Load probe failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  const configuredLanes = configuredLoadLanes();
  const targetHost = new URL(baseUrl).hostname.toLowerCase();
  const environment =
    process.env.LOAD_ENVIRONMENT?.trim() ||
    (loadProfile.name === "smoke" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(targetHost)
      ? "local"
      : "staging");
  const sourceSha =
    process.env.LOAD_SOURCE_SHA?.trim() ||
    (loadProfile.name === "smoke" ? localSourceSha() : "");
  const imageDigest =
    process.env.LOAD_IMAGE_DIGEST?.trim() ||
    (loadProfile.name === "smoke" ? "not-applicable-local-smoke" : "");
  const preflightFindings = stagingLoadPreflightFindings({
    profile: loadProfile,
    targetOrigin: baseUrl,
    environment,
    sourceSha,
    imageDigest,
    configuredLanes,
  });
  if (preflightFindings.length > 0) {
    throw new Error(`Load profile preflight failed: ${preflightFindings.join("; ")}`);
  }

  const auth = await buildAuthProbes();
  const probes = [...publicProbes, ...auth.probes];
  const results: Result[] = [];
  const executedLanes = new Set<StagingLoadLane>();
  for (const stage of loadProfile.stages) {
    const stageResults = await runPool(
      probes.flatMap((probe) => repeat(probe, stage.iterations)),
      stage.concurrency,
    );
    results.push(
      ...stageResults.map((result) => ({
        ...result,
        label:
          loadProfile.name === "smoke"
            ? result.label
            : `${stage.name} / ${result.label}`,
      })),
    );
  }
  if (publicProbes.length > 0) executedLanes.add("public");
  if (auth.probes.some((probe) => probe.auth && (probe.method ?? "GET") === "GET")) {
    executedLanes.add("authenticated");
  }
  if (auth.probes.some((probe) => probe.method === "POST")) {
    executedLanes.add("mutations");
  }

  const dependentResults = await runDependentProbes(auth.targets);
  results.push(...dependentResults);
  if (dependentResults.length > 0) executedLanes.add("mutations");
  if (includeInternalWriteFlow) {
    if (!internalSecret) {
      throw new Error(
        "LOAD_INTERNAL_SECRET or INTERNAL_API_SECRET is required for LOAD_INCLUDE_INTERNAL_WRITE_FLOW=true"
      );
    }
    results.push(await runInternalWriteFlowProbe());
    executedLanes.add("internal-write");
  }
  if (includeMediaFlow) {
    const mediaResults = await runMediaFlowProbe(auth.targets);
    results.push(...mediaResults);
    if (mediaResults.length > 0) executedLanes.add("media");
  }
  if (includeCallTokenLoad) {
    const callResults = await runCallTokenLoadProbe();
    results.push(...callResults);
    if (callResults.length > 0) executedLanes.add("call-token");
  }
  if (includePoolSaturation) {
    const poolResults = await runPoolSaturationProbe();
    results.push(...poolResults);
    if (poolResults.length > 0) executedLanes.add("pool-saturation");
  }
  const failures = results.filter((result) => !result.ok);
  const realtimeReport = includeRealtime ? await runRealtimeProbe() : null;
  if (realtimeReport && realtimeReport.status !== "SKIPPED") {
    executedLanes.add("realtime");
  }
  const summary = summarizeStagingLoad(results);

  for (const [label, labelSummary] of Object.entries(summary.byLabel)) {
    const statuses = Object.entries(labelSummary.statuses)
      .map(([status, count]) => `${status}x${count}`)
      .join(",");
    console.log(
      `${label}: count=${labelSummary.count} status=${statuses} p50=${labelSummary.p50Milliseconds}ms p95=${labelSummary.p95Milliseconds}ms p99=${labelSummary.p99Milliseconds}ms max=${labelSummary.maximumMilliseconds}ms errorRate=${labelSummary.errorRate}`,
    );
  }

  if (realtimeReport) {
    console.log(formatRealtime(realtimeReport));
  }

  if (!cookie) {
    console.log("authenticated probes skipped: set LOAD_TEST_COOKIE to run them");
  } else if (!includeMutations) {
    console.log("mutation probes skipped: set LOAD_INCLUDE_MUTATIONS=true");
  }
  if (cookie && !auth.targets.conversationId) {
    console.log("conversation message/call room probes skipped: set LOAD_CONVERSATION_ID");
  }
  if (cookie && includeMutations && !auth.targets.feedPostId) {
    console.log("feed comment/reaction probes skipped: set LOAD_FEED_POST_ID");
  }
  if (
    cookie &&
    includeMutations &&
    !auth.targets.callRoomId &&
    !auth.targets.conversationId
  ) {
    console.log("call token probe skipped: set LOAD_CALL_ROOM_ID");
  }
  if (cookie && includeMutations && !auth.targets.listingId) {
    console.log("listing enquiry probe skipped: set LOAD_LISTING_ID");
  }
  if (!includeInternalWriteFlow) {
    console.log(
      "internal community write-flow probe skipped: set LOAD_INCLUDE_INTERNAL_WRITE_FLOW=true"
    );
  }
  if (!includeRealtime) {
    console.log("realtime subscribe/presence probe skipped: set LOAD_INCLUDE_REALTIME=true");
  }
  if (!includeMediaFlow) {
    console.log(
      "media sign+upload+finalize probe skipped: set LOAD_INCLUDE_MEDIA_FLOW=true (requires LOAD_TEST_COOKIE)"
    );
  } else if (!cookie) {
    console.log("media sign+upload+finalize probe skipped: set LOAD_TEST_COOKIE");
  }
  if (!includeCallTokenLoad) {
    console.log(
      "LiveKit token concurrency probe skipped: set LOAD_INCLUDE_CALL_TOKEN_LOAD=true"
    );
  }
  if (!includePoolSaturation) {
    console.log(
      "DB pool-saturation probe skipped: set LOAD_INCLUDE_POOL_SATURATION=true"
    );
  }

  const gateFindings = [
    ...stagingLoadThresholdFindings(loadProfile, summary.overall),
    ...missingRequiredLanes(loadProfile.requiredLanes, [...executedLanes]).map(
      (lane) => `required lane produced no evidence: ${lane}`,
    ),
    ...(realtimeReport?.status === "FAILED"
      ? [`realtime lane failed: ${realtimeReport.reason ?? "unknown error"}`]
      : []),
  ];
  const timestamp = new Date().toISOString();
  const config = {
    profile: loadProfile,
    targetOrigin: baseUrl,
    requestTimeoutMs,
    configuredLanes: [...configuredLanes].sort(),
    realtimeClients,
    callTokenConcurrency,
    poolSaturationRequests,
  };
  const configDigest = stagingLoadConfigDigest(config);
  const evidence = {
    schemaVersion: 1,
    status: gateFindings.length === 0 ? "passed" : "failed",
    identity: {
      environment,
      timestamp,
      targetOrigin: baseUrl,
      sourceSha,
      imageDigest,
      configDigest,
    },
    configuration: config,
    coverage: {
      requiredLanes: loadProfile.requiredLanes,
      configuredLanes,
      executedLanes: [...executedLanes].sort(),
    },
    summary,
    realtime: realtimeReport,
    findings: gateFindings,
  };
  console.log(`evidence: ${writeEvidence(evidence, loadProfile.name, timestamp)}`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${failure.label}: got ${failure.status} in ${failure.ms}ms`);
    }
  }
  if (gateFindings.length > 0) {
    for (const finding of gateFindings) console.error(`load gate: ${finding}`);
    process.exit(1);
  }
}

// Scenario 2: media sign -> upload PNG to signed URL -> finalize, end-to-end.
async function runMediaFlowProbe(targets: ProbeTargets): Promise<Result[]> {
  if (!cookie) return [];

  const sign = await runProbeWithBody({
    label: "media flow: sign",
    method: "POST",
    path: "/api/media/sign-upload",
    expected: [201],
    auth: true,
    body: {
      filename: "load-probe.png",
      mimeType: "image/png",
      sizeBytes: pngBytes().length,
      bucket: "private-user-media",
      mediaContext: "messages",
      linkedEntityType: "load-probe",
      linkedEntityId: targets.conversationId ?? "pending",
    },
  });
  const results = [sign.result];
  const signData = recordValue(sign.data);
  const mediaId = stringValue(signData?.mediaId);
  const uploadUrl = stringValue(signData?.uploadUrl);
  const objectPath = stringValue(signData?.objectPath);
  if (!sign.result.ok || !mediaId || !uploadUrl || !objectPath) return results;

  results.push(
    await runUploadToSignedUrl(
      uploadUrl,
      objectPath,
      signData?.uploadHeaders
    )
  );

  const finalize = await runProbeWithBody({
    label: "media flow: finalize",
    method: "POST",
    path: `/api/media/${mediaId}/finalize`,
    expected: [200],
    auth: true,
    body: {},
  });
  results.push(finalize.result);
  return results;
}

async function runUploadToSignedUrl(
  uploadUrl: string,
  objectPath: string,
  uploadHeaders: unknown
): Promise<Result> {
  const started = Date.now();
  const bytes = pngBytes();
  try {
    const approvedUploadUrl = objectStorageProvider === "gcs"
      ? resolveApprovedGcsSignedUploadUrl(
          uploadUrl,
          approvedGcsBucket,
          objectPath
        )
      : resolveApprovedSignedUploadUrl(
          uploadUrl,
          supabaseUrl ?? ""
        );
    const approvedHeaders = resolveSignedUploadHeaders(
      uploadHeaders,
      objectStorageProvider,
      "image/png"
    );
    const response = await fetch(approvedUploadUrl, {
      method: "PUT",
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: approvedHeaders,
      body: bytes,
    });
    await response.arrayBuffer();
    return {
      label: "media flow: upload",
      status: response.status,
      ms: Date.now() - started,
      ok: response.status >= 200 && response.status < 300,
    };
  } catch (error) {
    console.error(
      `media flow: upload refused: ${error instanceof Error ? error.message : "unknown error"}`
    );
    return { label: "media flow: upload", status: 0, ms: Date.now() - started, ok: false };
  }
}

// Scenario 3: LiveKit token issuance under concurrency. Without auth the endpoint
// returns 401; we measure latency + status distribution rather than success.
async function runCallTokenLoadProbe(): Promise<Result[]> {
  const path = `/api/calls/${encodeURIComponent(callTokenRoomId)}/token`;
  // Any of these mean the endpoint rejected cleanly under load (the point of the test).
  const cleanRejects = [401, 403, 404, 429];
  const expected = cookie ? [200, ...cleanRejects] : cleanRejects;
  const requests = Array.from({ length: callTokenConcurrency }, () => ({
    label: "call token concurrency",
    method: "POST" as const,
    path,
    expected,
    auth: true,
  }));
  return Promise.all(requests.map((probe) => runProbe(probe)));
}

// Scenario 4: DB pool saturation. Fire M > pool-size concurrent requests at a
// DB-heavy endpoint and confirm it degrades with clean errors instead of hanging.
async function runPoolSaturationProbe(): Promise<Result[]> {
  const requests = Array.from({ length: poolSaturationRequests }, () => ({
    label: "db pool saturation",
    method: "GET" as const,
    path: poolSaturationPath,
    // Clean handling = success or a clear back-pressure/error status, never a hang.
    expected: [200, 429, 503, 500],
    auth: Boolean(cookie),
  }));
  // Fire all at once (no pool) to actually saturate the server's DB connections.
  return Promise.all(requests.map((probe) => runProbe(probe)));
}

async function runInternalWriteFlowProbe(): Promise<Result> {
  const started = Date.now();
  try {
    const response = await fetch(
      resolveStagingRequestUrl(
        "/api/internal/community-readiness?write=true",
        baseUrl
      ),
      {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(requestTimeoutMs),
        headers: { "x-internal-secret": internalSecret ?? "" },
      }
    );
    const data = parseJson(await response.text());
    const record = recordValue(data);
    const checks = recordValue(record?.checks);
    const writeFlow = recordValue(checks?.writeFlow);
    const writeChecks = recordValue(writeFlow?.checks);
    return {
      label: "internal community write flow",
      status: response.status,
      ms: Date.now() - started,
      ok:
        response.status === 200 &&
        record?.ok === true &&
        writeFlow?.ok === true &&
        writeChecks?.cleanup === true,
    };
  } catch {
    return {
      label: "internal community write flow",
      status: 0,
      ms: Date.now() - started,
      ok: false,
    };
  }
}

async function runDependentProbes(targets: ProbeTargets) {
  if (!cookie || !includeMutations || !targets.conversationId || targets.callRoomId) {
    return [];
  }

  const createRoom = await runProbeWithBody({
    label: "call room create",
    method: "POST",
    path: "/api/calls/rooms",
    expected: [201],
    auth: true,
    body: { conversationId: targets.conversationId },
  });
  const results = [createRoom.result];
  const createRoomData = recordValue(createRoom.data);
  const room = recordValue(createRoomData?.item);
  const roomId = stringValue(room?.id);
  if (!roomId) return results;

  const token = await runProbeWithBody({
    label: "call token",
    method: "POST",
    path: `/api/calls/${roomId}/token`,
    expected: [200],
    auth: true,
  });
  results.push(token.result);
  return results;
}

async function resolveProbeTargets(): Promise<ProbeTargets> {
  const targets: ProbeTargets = {
    conversationId: conversationId || null,
    callRoomId: callRoomId || null,
    feedPostId: feedPostId || null,
    listingId: listingId || null,
  };
  if (!cookie) return targets;

  const currentProfileId = await discoverCurrentProfileId();
  targets.conversationId ??= await discoverFirstId("/api/conversations");
  targets.feedPostId ??= await discoverFirstId("/api/feed?limit=1");
  targets.listingId ??= await discoverListingId(currentProfileId);
  return targets;
}

async function discoverCurrentProfileId() {
  const data = await getJson("/api/users/me", true);
  return stringValue(data?.user?.profileId) ?? stringValue(data?.profile?.id);
}

async function discoverFirstId(path: string) {
  const data = await getJson(path, true);
  return stringValue(data?.items?.[0]?.id);
}

async function discoverListingId(currentProfileId: string | null) {
  const data = await getJson("/api/listings?limit=20", true);
  const items: unknown[] = Array.isArray(data?.items) ? data.items : [];
  const listing = items.find((item) => {
    const record = recordValue(item);
    const profile = recordValue(record?.profile);
    const ownerId = stringValue(profile?.id) ?? stringValue(record?.profileId);
    return !currentProfileId || ownerId !== currentProfileId;
  });
  return stringValue(recordValue(listing)?.id);
}

async function getJson(path: string, auth: boolean) {
  try {
    const response = await fetch(resolveStagingRequestUrl(path, baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: auth && cookie ? { cookie } : undefined,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function runPool(items: Probe[], concurrencyLimit = concurrency) {
  const results: Result[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrencyLimit, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results.push(await runProbe(items[index]));
      }
    })
  );
  return results;
}

async function runProbe(probe: Probe): Promise<Result> {
  const started = Date.now();
  try {
    const response = await fetch(resolveStagingRequestUrl(probe.path, baseUrl), {
      method: probe.method ?? "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {
        ...(probe.auth && cookie ? { cookie } : {}),
        ...(probe.body ? { "content-type": "application/json" } : {}),
      },
      body: probe.body ? JSON.stringify(probe.body) : undefined,
    });
    await response.arrayBuffer();
    const ms = Date.now() - started;
    return {
      label: probe.label,
      status: response.status,
      ms,
      ok: probe.expected.includes(response.status),
    };
  } catch {
    return {
      label: probe.label,
      status: 0,
      ms: Date.now() - started,
      ok: false,
    };
  }
}

async function runProbeWithBody(probe: Probe): Promise<{
  result: Result;
  data: unknown;
}> {
  const started = Date.now();
  try {
    const response = await fetch(resolveStagingRequestUrl(probe.path, baseUrl), {
      method: probe.method ?? "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {
        ...(probe.auth && cookie ? { cookie } : {}),
        ...(probe.body ? { "content-type": "application/json" } : {}),
      },
      body: probe.body ? JSON.stringify(probe.body) : undefined,
    });
    const text = await response.text();
    const ms = Date.now() - started;
    return {
      result: {
        label: probe.label,
        status: response.status,
        ms,
        ok: probe.expected.includes(response.status),
      },
      data: parseJson(text),
    };
  } catch {
    return {
      result: {
        label: probe.label,
        status: 0,
        ms: Date.now() - started,
        ok: false,
      },
      data: null,
    };
  }
}

function repeat<T>(value: T, count: number) {
  return Array.from({ length: count }, () => value);
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0;
  const index = Math.ceil((pct / 100) * values.length) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))];
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function recordValue(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson(value: string) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function pngBytes() {
  return Buffer.from(TINY_PNG_BASE64, "base64");
}

type RealtimeReport = {
  status: "OK" | "SKIPPED" | "FAILED";
  reason?: string;
  subscribed: number;
  attempted: number;
  times: number[];
};

// Scenario 1: connect N realtime clients to a throwaway broadcast channel and
// measure subscribe latency. Degrades to SKIPPED when realtime env is absent.
async function runRealtimeProbe(): Promise<RealtimeReport> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: "SKIPPED",
      reason: "LOAD_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY not set",
      subscribed: 0,
      attempted: 0,
      times: [],
    };
  }

  let createClient: typeof import("@supabase/supabase-js").createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    return {
      status: "SKIPPED",
      reason: "@supabase/supabase-js unavailable",
      subscribed: 0,
      attempted: 0,
      times: [],
    };
  }

  const channelName = `load-probe-${Date.now()}`;
  const times: number[] = [];
  const clients = Array.from({ length: realtimeClients }, () =>
    createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 1 } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
  );

  try {
    const outcomes = await Promise.all(
      clients.map((client) => subscribeOnce(client, channelName))
    );
    for (const outcome of outcomes) {
      if (outcome.ok) times.push(outcome.ms);
    }
  } finally {
    await Promise.all(
      clients.map((client) =>
        client.removeAllChannels().catch(() => undefined)
      )
    );
  }

  return {
    status: times.length > 0 ? "OK" : "FAILED",
    reason: times.length === 0 ? "no client reached SUBSCRIBED" : undefined,
    subscribed: times.length,
    attempted: realtimeClients,
    times: times.sort((a, b) => a - b),
  };
}

async function subscribeOnce(
  client: import("@supabase/supabase-js").SupabaseClient,
  channelName: string
): Promise<{ ok: boolean; ms: number }> {
  const started = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, ms: Date.now() - started }),
      requestTimeoutMs
    );
    const channel = client.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve({ ok: true, ms: Date.now() - started });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        resolve({ ok: false, ms: Date.now() - started });
      }
    });
  });
}

function formatRealtime(report: RealtimeReport) {
  const base = `realtime subscribe: status=${report.status}`;
  if (report.status === "SKIPPED") {
    return `${base} (${report.reason})`;
  }
  const stats =
    report.times.length > 0
      ? ` p50=${percentile(report.times, 50)}ms p95=${percentile(report.times, 95)}ms max=${Math.max(...report.times)}ms`
      : "";
  const reason = report.reason ? ` (${report.reason})` : "";
  return `${base} subscribed=${report.subscribed}/${report.attempted}${stats}${reason}`;
}

function configuredLoadLanes(): StagingLoadLane[] {
  return [
    "public" as const,
    ...(cookie ? (["authenticated"] as const) : []),
    ...(cookie && includeMutations ? (["mutations"] as const) : []),
    ...(includeInternalWriteFlow && internalSecret
      ? (["internal-write"] as const)
      : []),
    ...(includeRealtime && supabaseUrl && supabaseAnonKey
      ? (["realtime"] as const)
      : []),
    ...(includeMediaFlow && cookie && mediaStorageApproved
      ? (["media"] as const)
      : []),
    ...(includeCallTokenLoad ? (["call-token"] as const) : []),
    ...(includePoolSaturation ? (["pool-saturation"] as const) : []),
  ];
}

function localSourceSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unresolved-local-working-tree";
  }
}

function writeEvidence(evidence: unknown, profile: string, timestamp: string) {
  const directory = join(process.cwd(), "output", "staging-load");
  mkdirSync(directory, { recursive: true });
  const stamp = timestamp.replace(/[-:.]/g, "");
  const historyPath = join(directory, `${profile}-${stamp}.json`);
  const content = stableJson(evidence);
  writeFileSync(historyPath, content, "utf8");
  writeFileSync(join(directory, "latest.json"), content, "utf8");
  return relative(process.cwd(), historyPath).replace(/\\/g, "/");
}

export {};
