type ExpectedStatus = number | number[];

type SmokeCheck = {
  label: string;
  path: string;
  expected: ExpectedStatus;
  method?: "GET" | "POST";
  body?: unknown;
};

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
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
    const url = new URL(check.path, baseUrl);
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

  console.log(`Smoke gate passed against ${baseUrl}`);
}

export {};
