type Method = "GET" | "POST";

type Probe = {
  label: string;
  method?: Method;
  path: string;
  expected: number[];
  auth?: boolean;
  body?: unknown;
};

type Result = {
  label: string;
  status: number;
  ms: number;
  ok: boolean;
};

type ProbeTargets = {
  conversationId: string | null;
  callRoomId: string | null;
  feedPostId: string | null;
  listingId: string | null;
};

const baseUrl = process.env.LOAD_BASE_URL ?? "https://greyhoundsiq.com.au";
const iterations = positiveInt(process.env.LOAD_ITERATIONS, 5);
const concurrency = positiveInt(process.env.LOAD_CONCURRENCY, 4);
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

const publicProbes: Probe[] = [
  { label: "ready", path: "/api/health/ready", expected: [200] },
  { label: "feed health", path: "/api/health/feeds", expected: [200] },
  { label: "browse listings api", path: "/api/listings?limit=20", expected: [200] },
  { label: "browse listings page", path: "/listings", expected: [200] },
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
  const auth = await buildAuthProbes();
  const probes = [...publicProbes, ...auth.probes];
  const results = await runPool(probes.flatMap((probe) => repeat(probe, iterations)));
  results.push(...(await runDependentProbes(auth.targets)));
  if (includeInternalWriteFlow) {
    if (!internalSecret) {
      throw new Error(
        "LOAD_INTERNAL_SECRET or INTERNAL_API_SECRET is required for LOAD_INCLUDE_INTERNAL_WRITE_FLOW=true"
      );
    }
    results.push(await runInternalWriteFlowProbe());
  }
  const failures = results.filter((result) => !result.ok);

  for (const [label, group] of groupByLabel(results)) {
    const times = group.map((result) => result.ms).sort((a, b) => a - b);
    const statuses = [...new Set(group.map((result) => result.status))].join(",");
    console.log(
      `${label}: count=${group.length} status=${statuses} p50=${percentile(times, 50)}ms p95=${percentile(times, 95)}ms max=${Math.max(...times)}ms`
    );
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

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${failure.label}: got ${failure.status} in ${failure.ms}ms`);
    }
    process.exit(1);
  }
}

async function runInternalWriteFlowProbe(): Promise<Result> {
  const started = Date.now();
  try {
    const response = await fetch(
      new URL("/api/internal/community-readiness?write=true", baseUrl),
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
    const response = await fetch(new URL(path, baseUrl), {
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

async function runPool(items: Probe[]) {
  const results: Result[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
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
    const response = await fetch(new URL(probe.path, baseUrl), {
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
    const response = await fetch(new URL(probe.path, baseUrl), {
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

function groupByLabel(results: Result[]) {
  const groups = new Map<string, Result[]>();
  for (const result of results) {
    groups.set(result.label, [...(groups.get(result.label) ?? []), result]);
  }
  return groups;
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

export {};
