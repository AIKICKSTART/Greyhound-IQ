import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { buildPrototypeDemoHref } from "../src/components/prototype-dock-navigation";
import {
  BROWSER_CLIENT_LOG_ALLOWLIST,
  BROWSER_DATA_HANDLING_MASTER_EVIDENCE,
  BROWSER_HISTORY_SURFACE_FILES,
  BROWSER_HTML_HYDRATION_SURFACES,
  BROWSER_PERSISTENCE_ALLOWLIST,
  BROWSER_URL_QUERY_CAPABILITY_DECISION,
  BROWSER_URL_SURFACE_FILES,
  OPEN_BROWSER_DATA_HANDLING_GAPS,
} from "./browser-data-handling-evidence";

const sourceFiles = collectCodeFiles("src").filter(isProductionSource);
const publicFiles = collectCodeFiles("public");
const allSource = [...sourceFiles, ...publicFiles];

const storageFiles = filesMatching(
  allSource,
  /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)|indexedDB\.|\bcaches\.(?:open|match|delete|keys)|navigator\.serviceWorker|serviceWorker\.register/,
);
assert.deepEqual(
  storageFiles,
  BROWSER_PERSISTENCE_ALLOWLIST.map(({ path }) => path).toSorted(),
);

const cookieConsent = readFile("src/components/cookie-consent.tsx");
assert.match(cookieConsent, /greyhoundiq\.cookie-consent\.v1/);
assert.match(cookieConsent, /value === "accepted" \|\| value === "declined"/);
assert.match(cookieConsent, /localStorage\.setItem\(STORAGE_KEY, value\)/);

const interactiveHelp = readFile("src/components/interactive-help.tsx");
const interactiveHelpState = readFile(
  "src/components/interactive-help-state.ts",
);
assert.match(interactiveHelp, /localStorage\.setItem\(INTERACTIVE_HELP_STORAGE_KEY, memorySnapshot\)/);
assert.match(interactiveHelpState, /completed: boolean/);
assert.match(interactiveHelpState, /enabled: boolean/);
assert.match(interactiveHelpState, /JSON\.stringify\(state\)/);

const trainerOs = readFile("public/trainer-os.html");
for (const key of [
  "ghiq-demo-completed",
  "ghiq-demo-activities",
  "ghiq-demo-owner-sent",
  "ghiq-demo-nominated",
]) {
  assert.match(trainerOs, new RegExp(`localStorage\\.(?:getItem|setItem)\\('${key}'`));
}
assert.match(trainerOs, /state\.activities\.slice\(0,20\)/);
assert.match(trainerOs, /const detail=\[l\.data\.product,l\.data\.dose,l\.data\.route\]/);
assert.doesNotMatch(
  trainerOs,
  /state\.activities\.unshift\([^\n]*(?:notes|vet|admin)/,
);
assert.match(trainerOs, /Synthetic Trainer OS demonstration data/);

const sourceText = allSource.map(readFile).join("\n");
assert.doesNotMatch(sourceText, /sessionStorage\.(?:getItem|setItem|removeItem|clear)/);
assert.doesNotMatch(sourceText, /indexedDB\./);
assert.doesNotMatch(
  sourceText,
  /\bcaches\.(?:open|match|delete|keys)|navigator\.serviceWorker|serviceWorker\.register/,
);

const urlFiles = filesMatching(
  sourceFiles,
  /URLSearchParams|router\.(?:push|replace)|window\.location|window\.history|navigator\.share|navigator\.clipboard\.writeText/,
);
assert.deepEqual(urlFiles, [...BROWSER_URL_SURFACE_FILES].toSorted());

const historyFiles = filesMatching(
  sourceFiles,
  /router\.(?:push|replace)|window\.history\.(?:pushState|replaceState)|window\.location\.(?:assign|replace)/,
);
assert.deepEqual(historyFiles, [...BROWSER_HISTORY_SURFACE_FILES].toSorted());

const adminUsers = readFile("src/app/admin/users/page.tsx");
const adminUserLookup = readFile("src/app/admin/users/actions.ts");
assert.match(adminUsers, /action=\{lookupAdminUserAction\}/);
assert.match(adminUsers, /placeholder="Email or exact user ID"/);
assert.doesNotMatch(adminUsers, /name="q"|query\.q|searchParams\.q/);
assert.doesNotMatch(adminUsers, /email:\s*\{\s*contains:/);
assert.match(adminUsers, /ADMIN_USER_ID_PATTERN\.test\(selectedUserId\)/);
assert.match(adminUserLookup, /const current = await requireAdminProfile\(\)/);
assert.match(adminUserLookup, /admin-user-lookup:\$\{current\.dbUserId\}/);
assert.match(adminUserLookup, /\{ failClosed: true \}/);
assert.match(adminUserLookup, /where: \{ email: lookup \}/);
assert.match(adminUserLookup, /where: \{ id: lookup \}/);
assert.match(adminUserLookup, /user=\$\{encodeURIComponent\(user\.id\)\}/);
assert.doesNotMatch(adminUserLookup, /[?&](?:email|lookup)=\$\{/);

const masterAudit = readFile("src/components/master-audit-checklist.tsx");
const pendingWork = readFile("src/components/design-lab-pending-work-panel.tsx");
for (const [source, key] of [
  [masterAudit, "auditQuery"],
  [pendingWork, "workQuery"],
] as const) {
  assert.match(source, /const \[query, setQuery\] = useState\(""\)/);
  assert.match(source, new RegExp(`url\\.searchParams\\.delete\\("${key}"\\)`));
  assert.doesNotMatch(source, new RegExp(`searchParams\\.get\\("${key}"\\)`));
  assert.doesNotMatch(source, new RegExp(`setOrDelete\\([^\\n]+"${key}"`));
}
const transientUrlState = readFile("src/components/design-lab-url-state.ts");
assert.match(transientUrlState, /"auditQuery"/);
assert.match(transientUrlState, /"workQuery"/);
assert.match(transientUrlState, /searchParams\.delete\(key\)/);

const replayProxy = readFile("src/lib/live/replay-proxy.ts");
const replayRoute = readFile("src/app/api/replay/stream/handler.ts");
const replayPlayer = readFile("src/components/race-replay-player.tsx");
const listingShare = readFile("src/components/listing-share-button.tsx");
const marketplaceNavigation = readFile("src/lib/marketplace-navigation.ts");
assert.match(replayProxy, /\/api\/replay\/stream\?t=\$\{token\}/);
assert.match(replayProxy, /REPLAY_TOKEN_TTL_SECONDS = 10 \* 60/);
assert.match(replayProxy, /createCipheriv\("aes-256-gcm"/);
assert.match(replayProxy, /validateReplayTarget\(target\)/);
assert.deepEqual(
  [...replayRoute.matchAll(/params\.get\("([^"]+)"\)/g)].map(
    (match) => match[1],
  ),
  [BROWSER_URL_QUERY_CAPABILITY_DECISION.parameter],
);
assert.match(replayRoute, /"cache-control": "private, no-store"/);
assert.match(replayRoute, /"referrer-policy": "no-referrer"/);
assert.match(replayRoute, /"cross-origin-resource-policy": "same-origin"/);
assert.match(replayPlayer, /media\.src = streamUrl/);
assert.match(replayPlayer, /nextHls\.loadSource\(streamUrl\)/);
assert.match(listingShare, /`\/marketplace\/\$\{encodeURIComponent\(listingId\)\}`/);
assert.doesNotMatch(listingShare, /(?:token|password|secret|email)\s*[:=]/i);
assert.match(marketplaceNavigation, /\.trim\(\)\.slice\(0, 200\)/);
assert.match(marketplaceNavigation, /params\.set\("q", q\)/);
assert.doesNotMatch(
  marketplaceNavigation,
  /params\.set\("(?:token|password|secret|email|userId)"/i,
);
assert.ok(BROWSER_URL_QUERY_CAPABILITY_DECISION.necessity.length > 100);
assert.ok(BROWSER_URL_QUERY_CAPABILITY_DECISION.dataMinimisation.length > 100);
assert.ok(BROWSER_URL_QUERY_CAPABILITY_DECISION.persistence.length > 80);
assert.ok(BROWSER_URL_QUERY_CAPABILITY_DECISION.containment.length > 100);
assert.equal(
  buildPrototypeDemoHref(
    "?token=secret&password=secret&variant=B2&dock=D2&sponsored=off",
  ),
  "/feed?variant=B2&dock=D2&sponsored=off&demo=1",
);

const packageJson = JSON.parse(readFile("package.json")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const directPackages = Object.keys({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});
assert.deepEqual(
  directPackages.filter((name) =>
    /(?:sentry|posthog|mixpanel|segment|analytics|newrelic|datadog)/i.test(name),
  ),
  [],
);
assert.doesNotMatch(
  sourceText,
  /(?:window\.)?(?:gtag|posthog|mixpanel)\s*\(|(?:analytics|segment)\.(?:track|identify|page)\s*\(|dataLayer\.push\s*\(/,
);
assert.doesNotMatch(
  sourceText,
  /(?:Sentry\.)?(?:captureException|captureMessage)\s*\(|reportError\s*\(/,
);

const clientLogFiles = sourceFiles
  .filter((path) => /^\s*["']use client["'];/m.test(readFile(path)))
  .filter((path) => /console\.(?:log|error|warn|info|debug)\s*\(/.test(readFile(path)))
  .toSorted();
assert.deepEqual(clientLogFiles, [...BROWSER_CLIENT_LOG_ALLOWLIST].toSorted());

for (const path of BROWSER_CLIENT_LOG_ALLOWLIST.slice(0, 5)) {
  const source = readFile(path);
  assert.match(source, /console\.error\("[a-z.]+segment_error", \{\s*digest: error\.digest \?\? "unknown"/);
  assert.doesNotMatch(source, /console\.error\([\s\S]*?,\s*error\s*\)/);
}
assert.match(
  readFile("src/components/dog-search.tsx"),
  /console\.error\("dog_search\.request_failed"\)/,
);

const htmlHydrationFiles = filesMatching(
  sourceFiles,
  /dangerouslySetInnerHTML|suppressHydrationWarning/,
);
assert.deepEqual(
  htmlHydrationFiles,
  [...BROWSER_HTML_HYDRATION_SURFACES].toSorted(),
);
const layout = readFile("src/app/layout.tsx");
assert.match(layout, /delete \(initialAuth as \{ accessToken\?: unknown \}\)\.accessToken/);
assert.match(layout, /<AuthKitProvider initialAuth=\{initialAuth\}>/);
assert.match(layout, /conversations=\{conversations\}/);

const nextConfig = readFile("next.config.ts");
assert.doesNotMatch(nextConfig, /productionBrowserSourceMaps\s*:\s*true/);

const verifiedIds = Object.keys(BROWSER_DATA_HANDLING_MASTER_EVIDENCE);
assert.equal(verifiedIds.length, 11);
for (const requirementId of verifiedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    BROWSER_DATA_HANDLING_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const [requirementId, gap] of Object.entries(
  OPEN_BROWSER_DATA_HANDLING_GAPS,
)) {
  assert.ok(gap.length > 40, `${requirementId}: gap must be explicit`);
  assert.equal(BROWSER_DATA_HANDLING_MASTER_EVIDENCE[requirementId], undefined);
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), false);
}

console.log(
  "Browser data handling passed: 11 source controls verified; rendered HTML/hydration payload and artifact source-map proof remain open",
);

function collectCodeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return collectCodeFiles(path);
    return [".cjs", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"].includes(
      extname(entry.name),
    )
      ? [path]
      : [];
  });
}

function isProductionSource(path: string) {
  return !/\.test\.(?:ts|tsx)$/.test(path) && !/-evidence\.(?:ts|tsx)$/.test(path);
}

function filesMatching(files: readonly string[], pattern: RegExp) {
  return files.filter((path) => pattern.test(readFile(path))).toSorted();
}

function readFile(path: string) {
  return readFileSync(path, "utf8");
}
