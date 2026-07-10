type ExpectedStatus = number | number[];

type SmokeCheck = {
  label: string;
  path: string;
  expected: ExpectedStatus;
  baseUrl?: string;
  method?: "GET" | "POST";
  body?: unknown;
};

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const liveKitBaseUrl =
  process.env.SMOKE_LIVEKIT_BASE_URL ??
  (baseUrl.includes("greyhoundsiq.com.au")
    ? "https://livekit.greyhoundsiq.com.au"
    : "");
const requireReady = process.env.SMOKE_REQUIRE_READY !== "false";

const checks: SmokeCheck[] = [
  { label: "liveness", path: "/api/health", expected: 200 },
  { label: "readiness", path: "/api/health/ready", expected: requireReady ? 200 : [200, 503] },
  { label: "feed status", path: "/api/health/feeds", expected: 200 },
  { label: "current user requires auth", path: "/api/users/me", expected: 401 },
  { label: "conversations require auth", path: "/api/conversations", expected: 401 },
  { label: "community feed api", path: "/api/feed?limit=1", expected: 200 },
  {
    label: "conversation create requires auth",
    path: "/api/conversations",
    method: "POST",
    body: { recipientProfileId: "profile_smoke" },
    expected: 401,
  },
  {
    label: "listing create requires auth",
    path: "/api/listings",
    method: "POST",
    body: {
      type: "wanted",
      title: "Smoke listing",
      description: "Smoke listing body long enough for validation.",
    },
    expected: 401,
  },
  {
    label: "listing enquiry requires auth",
    path: "/api/listings/listing_smoke/enquiry",
    method: "POST",
    body: { message: "Smoke marketplace enquiry" },
    expected: 401,
  },
  {
    label: "listing save requires auth",
    path: "/api/listings/listing_smoke/save",
    method: "POST",
    expected: 401,
  },
  {
    label: "feed post create requires auth",
    path: "/api/feed",
    method: "POST",
    body: {
      body: "Smoke feed post body long enough for validation.",
      topicId: null,
      mediaIds: [],
    },
    expected: 401,
  },
  {
    label: "feed comment create requires auth",
    path: "/api/feed/post_smoke/comments",
    method: "POST",
    body: { body: "Smoke feed comment" },
    expected: 401,
  },
  {
    label: "feed reaction requires auth",
    path: "/api/feed/post_smoke/reaction",
    method: "POST",
    expected: 401,
  },
  {
    label: "media upload signing requires auth",
    path: "/api/media/sign-upload",
    method: "POST",
    body: {
      filename: "smoke.txt",
      mimeType: "text/plain",
      sizeBytes: 16,
      mediaContext: "messages",
    },
    expected: 401,
  },
  {
    label: "call room create requires auth",
    path: "/api/calls/rooms",
    method: "POST",
    body: { conversationId: "conversation_smoke" },
    expected: 401,
  },
  {
    label: "call token requires auth",
    path: "/api/calls/call_room_smoke/token",
    method: "POST",
    expected: 401,
  },
  {
    label: "aggregate refresh requires internal auth",
    path: "/api/internal/aggregate-refresh",
    method: "POST",
    expected: 403,
  },
  ...(liveKitBaseUrl
    ? [
        {
          label: "livekit validate requires auth",
          baseUrl: liveKitBaseUrl,
          path: "/rtc/validate",
          expected: 401,
        },
      ]
    : []),
  { label: "forum categories", path: "/api/forum/categories", expected: 200 },
  { label: "marketplace listings", path: "/api/listings", expected: 200 },
];

main().catch((err) => {
  console.error("Smoke gate failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  const failures: string[] = [];

  for (const check of checks) {
    const url = new URL(check.path, check.baseUrl ?? baseUrl);
    try {
      const response = await fetch(url, {
        method: check.method ?? "GET",
        redirect: "manual",
        headers: check.body ? { "content-type": "application/json" } : undefined,
        body: check.body ? JSON.stringify(check.body) : undefined,
      });
      const allowed = Array.isArray(check.expected)
        ? check.expected
        : [check.expected];

      if (!allowed.includes(response.status)) {
        const body = await response.text();
        failures.push(
          `${check.label}: expected ${allowed.join(" or ")} from ${url}, got ${response.status} ${body.slice(0, 200)}`
        );
        continue;
      }

      console.log(`${check.label}: ${response.status}`);
    } catch (err) {
      failures.push(`${check.label}: request failed for ${url} (${String(err)})`);
    }
  }

  if (failures.length > 0) {
    console.error("Smoke gate failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  // ── Security headers check ─────────────────────────────────────────────────
  await checkSecurityHeaders(failures);
  if (failures.length > 0) {
    console.error("Security headers check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  // ── End security headers check ─────────────────────────────────────────────

  console.log(`Smoke gate passed against ${baseUrl}`);
}

async function checkSecurityHeaders(failures: string[]) {
  const url = new URL("/", baseUrl).toString();
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", redirect: "follow" });
  } catch (err) {
    failures.push(`security-headers: request to ${url} failed (${String(err)})`);
    return;
  }

  const csp = response.headers.get("content-security-policy") ?? "";
  if (!csp.includes("default-src")) {
    failures.push(
      `security-headers: content-security-policy missing "default-src" (got: ${csp.slice(0, 120) || "(none)"})`
    );
  } else {
    console.log("security-headers: content-security-policy present");
  }

  const sts = response.headers.get("strict-transport-security") ?? "";
  if (!sts) {
    failures.push("security-headers: strict-transport-security header missing");
  } else {
    console.log("security-headers: strict-transport-security present");
  }

  const xcto = response.headers.get("x-content-type-options") ?? "";
  if (xcto.toLowerCase() !== "nosniff") {
    failures.push(
      `security-headers: x-content-type-options expected "nosniff", got "${xcto}"`
    );
  } else {
    console.log("security-headers: x-content-type-options = nosniff");
  }

  const pp = response.headers.get("permissions-policy") ?? "";
  if (!pp.toLowerCase().includes("camera=")) {
    failures.push(
      `security-headers: permissions-policy missing camera directive (got: ${pp.slice(0, 120) || "(none)"})`
    );
  } else {
    console.log("security-headers: permissions-policy camera directive present");
  }
}

export {};
