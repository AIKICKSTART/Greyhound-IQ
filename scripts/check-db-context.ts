import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Static gate: every src file that pulls in the raw Prisma client must route its
// access through a DB-context wrapper (withDbRequestContext / withDbSystemContext).
// The production role greyhoundiq_app is NOBYPASSRLS, so a bare prisma.* call sets
// no app.* GUC and gets denied (42501) or silently returns nothing on RLS tables.
//
// Heuristic: a file importing `prisma` from "@/lib/db" MUST contain at least one
// withDb*Context call. Files where every raw usage is legitimately un-wrappable
// (RLS-exempt tables only, public USING(true) reads, or the wrappers themselves)
// are listed in ALLOWLIST with a justification.

const SRC_DIR = join(process.cwd(), "src");

// Files exempt from the "must contain a wrapper" rule. Keep each entry justified.
const ALLOWLIST: Record<string, string> = {
  // The wrappers and client themselves.
  "src/lib/db.ts": "defines the prisma client + safeQuery",
  "src/lib/db-context.ts": "defines the withDb*Context wrappers",

  // Only touches non-RLS tables and/or public USING(true) racing reads, so a raw
  // client already satisfies RLS. Wrapping would add a transaction per hot read.
  "src/lib/agent-service.ts":
    "agentRun/conversationContext/memoryEntry are non-RLS; race/dog reads are USING(true)",
  "src/lib/moderation-service.ts":
    "bannedPhrase/trustSafetyFlag are non-RLS tables",
  "src/lib/pedigree.ts":
    "only reads public dog reference data (Dog is USING(true)); wrapping each breadth-first ancestor query in a transaction would slow a hot cached read",

  // Account/admin surfaces and API routes that ONLY read/write tables without RLS
  // (support, compliance, org/membership, retention, feedback, memory, marketing,
  // reports intake, deletion/export jobs, admin actions, data-source health).
  "src/app/account/notifications/page.tsx": "marketingPreference is non-RLS",
  "src/app/account/privacy/page.tsx":
    "consentEvent/exportArtifact/marketingPreference/termsAcceptance are non-RLS",
  "src/app/account/support/page.tsx": "supportTicket is non-RLS",
  "src/app/account/team/page.tsx": "membership is non-RLS",
  "src/app/admin/actions/page.tsx": "adminAction is non-RLS",
  "src/app/admin/bug-reports/page.tsx": "bugReport is non-RLS",
  "src/app/admin/compliance/page.tsx":
    "consentEvent/marketingPreference/termsAcceptance are non-RLS",
  "src/app/admin/exports/page.tsx": "exportArtifact is non-RLS",
  "src/app/admin/feedback/page.tsx": "feedback is non-RLS",
  "src/app/admin/invitations/page.tsx": "organizationInvitation is non-RLS",
  "src/app/admin/organizations/page.tsx": "organization is non-RLS",
  "src/app/admin/retention/page.tsx": "deletionJob/retentionPolicy are non-RLS",
  "src/app/admin/source-health/page.tsx": "dataSourceHealth is non-RLS",
  "src/app/admin/support/page.tsx": "supportTicket is non-RLS",
  "src/app/api/memory/route.ts": "memoryEntry is non-RLS",
  "src/app/api/memory/[id]/route.ts": "memoryEntry is non-RLS",
  "src/app/api/memory/[id]/supersede/route.ts": "memoryEntry is non-RLS",
  "src/app/api/reports/route.ts": "report is non-RLS",
  "src/app/api/users/me/marketing-preferences/route.ts":
    "marketingPreference is non-RLS",
};

const PRISMA_IMPORT = /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']@\/lib\/db["']/;
const WRAPPER = /withDb(?:Request|System)Context/;
// Any raw member access on the imported client: prisma.model.op / prisma.$queryRaw.
const RAW_PRISMA = /\bprisma\.\w/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function toRepoPath(abs: string): string {
  return relative(process.cwd(), abs).split(sep).join("/");
}

const findings: string[] = [];
const files = walk(SRC_DIR);

for (const abs of files) {
  const repoPath = toRepoPath(abs);
  const source = readFileSync(abs, "utf8");

  if (!PRISMA_IMPORT.test(source)) continue;
  if (!RAW_PRISMA.test(source)) continue; // imports prisma only for a type

  if (repoPath in ALLOWLIST) continue;

  if (!WRAPPER.test(source)) {
    findings.push(
      `${repoPath}: imports prisma from "@/lib/db" and calls prisma.* but has no ` +
        `withDbRequestContext/withDbSystemContext wrapper. Wrap every access (or add ` +
        `an ALLOWLIST entry in scripts/check-db-context.ts with justification).`
    );
  }
}

if (findings.length > 0) {
  console.error("DB context gate FAILED:\n");
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error(
    `\n${findings.length} file(s) access Prisma without a DB-context wrapper.`
  );
  process.exit(1);
}

console.log(
  `DB context gate passed: ${files.length} src files scanned, ` +
    `${Object.keys(ALLOWLIST).length} allowlisted.`
);
