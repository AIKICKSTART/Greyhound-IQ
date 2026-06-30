type ExpectedStatus = number | number[];

type SmokeCheck = {
  label: string;
  path: string;
  expected: ExpectedStatus;
};

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const requireReady = process.env.SMOKE_REQUIRE_READY !== "false";

const checks: SmokeCheck[] = [
  { label: "liveness", path: "/api/health", expected: 200 },
  { label: "readiness", path: "/api/health/ready", expected: requireReady ? 200 : [200, 503] },
  { label: "feed status", path: "/api/health/feeds", expected: 200 },
  { label: "current user requires auth", path: "/api/users/me", expected: 401 },
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
      const response = await fetch(url, { redirect: "manual" });
      const allowed = Array.isArray(check.expected)
        ? check.expected
        : [check.expected];

      if (isVercelProtectedRedirect(response)) {
        console.log(`${check.label}: ${response.status} (Vercel deployment protection)`);
        continue;
      }

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

function isVercelProtectedRedirect(response: Response) {
  if (![301, 302, 303, 307, 308].includes(response.status)) return false;
  const location = response.headers.get("location");
  return Boolean(location?.startsWith("https://vercel.com/sso-api"));
}

export {};
