import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "./emergency-controls";

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  assert.equal(isEmergencyControlActive(undefined), false);
  assert.equal(isEmergencyControlActive("false"), false);
  assert.equal(isEmergencyControlActive(" FALSE "), false);
  assert.equal(isEmergencyControlActive("true"), true);
  assert.equal(isEmergencyControlActive(""), true, "invalid configured values fail closed");
  assert.equal(isEmergencyControlActive("typo"), true, "invalid configured values fail closed");

  const response = emergencyControlResponse();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("retry-after"), "60");
  assert.deepEqual(await response.json(), {
    error: {
      code: "service.temporarily_unavailable",
      message: "Temporarily unavailable",
    },
  });

  const searchRoute = readFileSync(
    new URL("../app/api/dogs/search/route.ts", import.meta.url),
    "utf8"
  );
  const uploadRoute = readFileSync(
    new URL("../app/api/media/sign-upload/route.ts", import.meta.url),
    "utf8"
  );
  const exportRoute = readFileSync(
    new URL("../app/api/users/me/export/route.ts", import.meta.url),
    "utf8"
  );
  const agentRunRoute = readFileSync(
    new URL("../app/api/agents/[type]/run/route.ts", import.meta.url),
    "utf8"
  );
  const agentService = readFileSync(new URL("./agent-service.ts", import.meta.url), "utf8");
  const dogCardService = readFileSync(
    new URL("./dog-card-service.ts", import.meta.url),
    "utf8"
  );
  const agentRunService = agentService.slice(
    agentService.indexOf("export async function runAgentForCurrentUser")
  );
  const searchGuard = searchRoute.indexOf("process.env.SEARCH_DISABLED");
  const uploadGuard = uploadRoute.indexOf("process.env.UPLOAD_DISABLED");
  const exportGuard = exportRoute.indexOf("process.env.EXPORT_DISABLED");
  const agentRouteGuard = agentRunRoute.indexOf("process.env.AI_DISABLED");
  const agentServiceGuard = agentRunService.indexOf("process.env.AI_DISABLED");
  const dogCardGuard = dogCardService.indexOf("process.env.AI_DISABLED");
  assert.ok(
    searchGuard >= 0 && searchGuard < searchRoute.indexOf("checkRateLimit("),
    "search suppression must run before rate limiting and database search"
  );
  assert.ok(
    uploadGuard >= 0 &&
      uploadGuard < uploadRoute.indexOf("requireCurrentUserProfile("),
    "upload suppression must run before authentication and storage signing"
  );
  assert.ok(
    exportGuard >= 0 &&
      exportGuard < exportRoute.indexOf("requireCurrentUserProfile("),
    "export suppression must run before authentication and database fan-out"
  );
  assert.ok(
    agentRouteGuard >= 0 &&
      agentRouteGuard < agentRunRoute.indexOf("requireCurrentUserProfile("),
    "agent suppression must run before authentication and rate limiting"
  );
  assert.ok(
    agentServiceGuard >= 0 &&
      agentServiceGuard < agentRunService.indexOf("assertAgentTier("),
    "direct agent-service callers must fail before database or memory work"
  );
  assert.ok(
    dogCardGuard >= 0 &&
      dogCardGuard < dogCardService.indexOf("assertPaidFeatureAccess("),
    "image generation must fail before database, file, storage or provider work"
  );
  assert.doesNotMatch(agentService, /api\.openai\.com/);
  assert.match(dogCardService, /https:\/\/api\.openai\.com\/v1\/images\/edits/);

  for (const path of [
    "../app/api/agents/context/route.ts",
    "../app/api/agents/runs/route.ts",
    "../app/api/agents/runs/[id]/route.ts",
    "../app/api/agents/runs/[id]/cancel/route.ts",
  ]) {
    assert.doesNotMatch(
      readFileSync(new URL(path, import.meta.url), "utf8"),
      /AI_DISABLED/,
      `${path} must remain available while new optional AI work is disabled`
    );
  }

  console.log("emergency control tests passed");
}
