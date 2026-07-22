import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tasks = [];
const allowedStates = new Set([
  "TODO",
  "IN PROGRESS",
  "BLOCKED",
  "READY FOR VERIFICATION",
  "RETEST REQUIRED",
  "DONE",
]);

const owners = {
  P0: "P0 replay and historical-source lead",
  GLOBAL: "Production safety coordinator",
  A: "Recovery coordination and production safety agent",
  B: "Contabo host, Docker, Caddy and networking agent",
  C: "Database completeness and historical-data agent",
  D: "Pedigree and database-relationship agent",
  E: "RLS, API, authentication and storage-security agent",
  F: "LiveKit and Realtime agent",
  G: "Help-tour, accessibility and responsive-design agent",
  H: "Role and interaction-testing agent",
  I: "Browser evidence and training-capture agent",
  J: "Cloud cost-comparison agent",
  K: "Final regression and production sign-off agent",
};

const genericChecks = {
  P0: [
    "Run read-only SQL/export checks against the recovered production dataset and retain exact row counts, date ranges, identifiers and hashes.",
    "Use an authenticated browser only after the recovery/startup gates pass; capture desktop and mobile network, console and visual evidence without private data.",
  ],
  GLOBAL: [
    "Review the planned command against the non-negotiable production controls before execution.",
    "Record a read-only pre-check, named approval for any write, rollback point, raw evidence and post-check.",
  ],
  A: [
    "Use local-socket, least-privilege PostgreSQL checks plus `docker compose ps --all` and scoped service logs from `/opt/greyhoundiq`.",
    "Save raw output with UTC/AEST timestamps; do not start or restart dependent services until the stated gate passes.",
  ],
  B: [
    "Use read-only host/network checks such as `uname -a`, `lscpu`, `free -h`, `df -hT`, `docker info`, `docker inspect`, `ss -lntup` and `ufw status numbered` as applicable.",
    "Compare exact output with the 2026-07-22 baseline and record drift; do not weaken firewall rules or restart the host without approval.",
  ],
  C: [
    "Run a repeatable read-only SQL report (`psql -X --set=ON_ERROR_STOP=1`) inside a read-only transaction where supported.",
    "Store exact totals, grouped coverage, anomalies, query text, database identity and capture timestamp; measure before proposing tuning or repair.",
  ],
  D: [
    "Run read-only catalog and relationship queries, then trace representative records from rendered route through API/auth/database and back.",
    "Record canonical IDs and source evidence; fail closed on ambiguous identity and do not perform name-only linkage.",
  ],
  E: [
    "Export PostgreSQL/PostgREST/Realtime policy metadata read-only and test positive and negative cases with isolated test identities.",
    "Test each operation directly at the API boundary; redact tokens and credentials and prove denial as well as legitimate access.",
  ],
  F: [
    "Use isolated test rooms/accounts, browser WebRTC diagnostics and scoped LiveKit/Realtime logs after service health gates pass.",
    "Capture entitlement, transport, reconnect and privacy evidence without exposing token secrets or contacting real users.",
  ],
  G: [
    "Use automated viewport/accessibility checks plus keyboard, touch, rotation, zoom and screen-reader verification on the affected route.",
    "Capture before/after evidence and rerun the exact failing case after the smallest approved fix.",
  ],
  H: [
    "Execute the interaction with the applicable role, record initial state, action, visual/state result, console/network output, refresh persistence and direct URL/API authorization.",
    "Repeat on the required browser/device/input matrix and attach a retest for every defect.",
  ],
  I: [
    "Use the Browser capability only after functional, security, responsive and accessibility gates pass.",
    "Check the capture against privacy, resolution, frame-rate, naming, manifest and approval requirements before accepting footage.",
  ],
  J: [
    "Use dated primary vendor pricing calculators, service documentation and region pages; archive assumptions, currency, taxes and egress model.",
    "Normalize each alternative to the observed Contabo workload and report uncertainty without initiating migration.",
  ],
  K: [
    "Reconcile the task ledger, defect register and immutable evidence index; rerun the named release check rather than relying on summaries.",
    "Block sign-off for any missing exact result, evidence path, retest, completion time or unresolved critical/high defect.",
  ],
};

const defaultActual =
  "NOT EXECUTED in this documentation-only ledger pass; no task-specific production evidence has been collected.";

function addTask({
  id,
  title,
  workstream,
  dependencies = [],
  acceptance,
  checks,
  expected,
  actual = defaultActual,
  status,
  defect = "NONE ASSIGNED",
  changed = "NONE — verification/planning task not executed",
  evidence = "PENDING — no task-specific evidence location recorded",
  retest = "NOT RUN",
  completion = null,
}) {
  const resolvedStatus = status ?? (dependencies.length ? "BLOCKED" : "TODO");
  tasks.push({
    task_id: id,
    title,
    assigned_agent: owners[workstream],
    workstream,
    dependencies,
    acceptance_criterion:
      acceptance ??
      `Exact, timestamped evidence demonstrates: ${title}. Any mismatch is recorded as a defect and the task remains incomplete.`,
    commands_or_checks: checks ?? genericChecks[workstream],
    expected_result:
      expected ??
      "The acceptance criterion is met exactly, raw evidence is linked, and any confirmed defect is repaired only after approval and then retested.",
    actual_result: actual,
    status: resolvedStatus,
    defect_reference: defect,
    changed_files_or_commit: changed,
    evidence_location: evidence,
    retest_result: retest,
    completion_time: completion,
  });
}

function addNumbered(workstream, start, titles, options = {}) {
  titles.forEach((title, index) => {
    const number = start + index;
    const id = `${workstream}${String(number).padStart(3, "0")}`;
    const dependencies = options.dependencies?.(id, number, index) ?? [];
    addTask({
      id,
      title,
      workstream,
      dependencies,
      acceptance: options.acceptance?.(id, title, number, index),
      checks: options.checks?.(id, title, number, index),
      expected: options.expected?.(id, title, number, index),
      actual: options.actual?.(id, title, number, index) ?? defaultActual,
      status: options.status?.(id, title, number, index),
      defect: options.defect?.(id, title, number, index) ?? "NONE ASSIGNED",
      changed:
        options.changed?.(id, title, number, index) ??
        "NONE — verification/planning task not executed",
      evidence: options.evidence?.(id, title, number, index) ??
        "PENDING — no task-specific evidence location recorded",
      retest: options.retest?.(id, title, number, index) ?? "NOT RUN",
      completion: options.completion?.(id, title, number, index) ?? null,
    });
  });
}

// Priority Zero must remain first in ledger order.
addTask({
  id: "P0-001",
  title: "Freeze the replay audit scope, cutoff and evidence schema for every production race from 2006-01-01 through the exact execution timestamp",
  workstream: "P0",
  acceptance:
    "A versioned scope names the authoritative production database, UTC/AEST cutoff, all race jurisdictions/entities, required count/grouping fields, evidence format and zero-silent-omission rule.",
  checks: [
    "Record `current_database()`, server time/time zone, recovery timestamp and exact audit cutoff before querying coverage.",
    "Define the race/meeting/replay manifest columns and deterministic sort/key rules; do not mutate production.",
  ],
});
addTask({
  id: "P0-002",
  title: "Discover and register lawful official replay and race-result sources for every jurisdiction and era from 2006 onward",
  workstream: "P0",
  dependencies: ["P0-001"],
  acceptance:
    "Each source entry records official authority, canonical HTTPS host, jurisdiction, coverage dates, access method, terms/robots/licensing constraints, rate limits and separate permission states for outbound linking, embedding, downloading, bulk acquisition and rehosting. Public availability is never treated as a content licence; unsupported or unlawful acquisition paths are rejected.",
  checks: [
    "Review official governing-body/provider pages and terms using read-only web access; retain dated URLs and access-policy evidence.",
    "Do not bypass authentication, robots controls, paywalls, anti-bot controls or source/TLS boundaries.",
  ],
  actual:
    "HARD LEGAL GAP: GRNSW/TheDogs and GRV terms restrict copying, downloading, framing or republication. Racing Queensland, SA official YouTube, Tasracing, Greyhounds WA Vimeo and Greyhound Racing New Zealand sources establish public availability but not bulk-scrape, embed, download or rehost rights. No NT official archive has been found. Written permission or approved API scope is not linked.",
  status: "IN PROGRESS",
  defect: "P0-DEF-002 — replay licensing/authority gap",
  evidence:
    "docs/production/contabo-master-2026-07-22/replay-source-authority-2026-07-22.md",
});
addTask({
  id: "P0-003",
  title: "Export the complete canonical production race, meeting, runner, result and replay inventory from 2006-01-01 to the audit cutoff",
  workstream: "P0",
  dependencies: ["A024", "P0-001"],
  acceptance:
    "The manifest has one deterministic row per canonical race and includes exact totals and coverage by year, month, track, jurisdiction and source, with explicit zero-count gaps and a stable checksum.",
  actual:
    "FINALIZED INVENTORY / COMPANION BLOCKED: the isolated read-only D-drive export contains 841,615 deterministic rows and 841,615 unique canonical race IDs, 440,612 anomaly rows, restricted-ledger SHA-256 3bc5e90b2d6b6c401c19e5ab5a6bbd8c6aec628e2dc39d1286287fdea2baa653, four independently rehashed manifest-bound files and year/state/track/provider aggregates. It explicitly records playbackVerified=false. Acceptance remains incomplete because its zero-filled month/source provenance companion must rehash the 3.89 GB recovery dump, and G: physically disconnected during that read; the unfinished A024 and P0-001 prerequisites also remain declared.",
  status: "BLOCKED",
  defect: "EXTERNAL BLOCKER — G: source dump unavailable for companion validation",
  changed:
    "scripts/replay-production-inventory/*; docs/production/contabo-master-2026-07-22/replay-photo-release-evidence-2026-07-22.md",
  evidence:
    "docs/production/contabo-master-2026-07-22/replay-photo-release-evidence-2026-07-22.md; D:\\GreyhoundIQ Backup\\05-replay-audit\\replay-inventory-20260722T222502AEST\\manifest.json",
  retest:
    "PASS — all four manifest-bound files were independently rehashed after finalization; companion NOT RUN because G: disconnected.",
});
addTask({
  id: "P0-004",
  title: "Verify a single authoritative live-sync owner and prevent duplicate schedulers or writers during replay inventory and repair",
  workstream: "P0",
  dependencies: ["P0-001"],
  acceptance:
    "The VPS-local owner timer is the sole enabled live scheduler, its cadence and last-cycle counts are evidenced, and all Google/GitHub live schedulers are proven paused or disabled.",
  actual:
    "READY EVIDENCE SUPPLIED: the VPS-local timer is active and enabled on its five-minute calendar. The post-results-release 22:50 AEST cycle exited 0 with upcoming 64 meetings/732 races/5,934 runners and results 25 meetings/301 races/2,405 runners/1,919 results, 10 replay candidates and zero replay errors. Google live schedulers are paused and the GitHub live workflow is disabled.",
  status: "READY FOR VERIFICATION",
  evidence:
    "docs/production/contabo-master-2026-07-22/replay-photo-release-evidence-2026-07-22.md",
});
addTask({
  id: "P0-005",
  title: "Reconcile the production inventory against lawful official sources and classify every missing, extra or conflicting race/replay",
  workstream: "P0",
  dependencies: ["P0-002", "P0-003", "P0-004"],
  acceptance:
    "Every canonical production race is matched, explicitly unavailable, disputed or defective; every official-source race absent from production is listed with exact source evidence and no aggregate-only gaps remain.",
});
addTask({
  id: "P0-006",
  title: "Define and verify stable canonical race identity across production records, official sources, search, UI and replay assets",
  workstream: "P0",
  dependencies: ["P0-003", "P0-005"],
  acceptance:
    "Each link resolves through a stable canonical race ID/key and a documented composite identity (jurisdiction, track, date, meeting/race number and corroborating fields); mutable URLs or display names are not the sole identity.",
});
addTask({
  id: "P0-007",
  title: "Apply strict fail-closed identity verification before linking or repairing any historical replay",
  workstream: "P0",
  dependencies: ["P0-006"],
  acceptance:
    "Candidate links require authoritative corroboration of race identity and runner/result context; name-only, ambiguous, conflicting, circular or many-to-one matches are quarantined for manual review with no automated mutation.",
});
addTask({
  id: "P0-008",
  title: "Attach immutable provenance and source evidence to every accepted canonical race/replay linkage",
  workstream: "P0",
  dependencies: ["P0-002", "P0-006", "P0-007"],
  acceptance:
    "Every accepted link records source authority/URL, retrieval time, source identifier, licence/permission scope, media/document checksum or immutable locator, confidence, resolver version, decision evidence and replacement lineage in an append-only store; provenance survives URL/display changes and quarantine cannot be bypassed by serving backfill.",
  actual:
    "HARD MODEL GAP: existing Race/RaceVideo records do not persist playback verification, licence scope, confidence, immutable evidence or replacement lineage. `sourceStatus` is upstream metadata only, and serving backfill can skip quarantine persistence.",
  status: "BLOCKED",
  defect: "P0-DEF-001 — replay verification/provenance persistence gap",
});
addTask({
  id: "P0-009",
  title: "Audit replay asset existence, reachability, format, duration and production-to-canonical-race linkage for the full 2006-present manifest",
  workstream: "P0",
  dependencies: ["P0-003", "P0-008", "P0-017"],
  acceptance:
    "Every manifest row has an exact replay state; reachable assets pass actual media metadata/playback checks, broken/blocked/duplicate/mislinked assets are enumerated, and totals reconcile to RaceVideo without assuming one replay per race. HTTP 2xx responses and populated status rows alone never count as a verified replay.",
  actual:
    "BLOCKED: current live RaceVideo=469,039 and the supplied last sync cycle reported zero replay errors, but neither proves full historical coverage, canonical linkage or playable media. The user narrowed delivery to canonical official links and provider-supported iframes, with outbound-link fallback; append-only verification/quarantine persistence and the full inventory remain missing.",
  status: "BLOCKED",
  defect: "P0-DEF-001 — replay verification/provenance persistence gap",
});
addTask({
  id: "P0-010",
  title: "Verify replay playback on supported desktop browsers at representative and boundary races across every year/source/state class",
  workstream: "P0",
  dependencies: ["A045", "B035", "B038", "B042", "P0-009"],
  acceptance:
    "Desktop playback starts, seeks, pauses, resumes, finishes and reports errors correctly on supported Chrome, Edge, Firefox and Safari where applicable; console/network/media evidence is linked for the stratified corpus and every exception.",
});
addTask({
  id: "P0-011",
  title: "Verify replay playback and canonical race navigation on supported mobile and tablet browsers in portrait and landscape",
  workstream: "P0",
  dependencies: ["A045", "B035", "B038", "B042", "P0-009"],
  acceptance:
    "Playback and race/replay navigation pass on iOS Safari, Android Chrome and Samsung Internet across required mobile/tablet widths, orientation changes, touch controls and background/foreground transitions without off-screen or hover-only controls.",
});
addTask({
  id: "P0-012",
  title: "Verify stable canonical replay linkage from search, race cards, results, historical pages and direct URLs on desktop and mobile",
  workstream: "P0",
  dependencies: ["P0-006", "P0-010", "P0-011"],
  acceptance:
    "Every tested entry path resolves to the same canonical race and replay, refresh/back/forward/deep links remain stable, roles see legitimate public history, and no stale cache or slug points to another race.",
});
addTask({
  id: "P0-013",
  title: "Create an exact replay defect register and rollback-first repair plan",
  workstream: "P0",
  dependencies: ["P0-005", "P0-009", "P0-010", "P0-011", "P0-012"],
  acceptance:
    "Every defect has canonical IDs, severity, reproduction, source proof, proposed minimal repair, affected rows/assets, protected-data assertions, rollback command and required retest; ambiguous cases remain manual and blocked.",
});
addTask({
  id: "P0-014",
  title: "Apply only approved replay repairs after the verified fresh recovery point, then prove idempotency and protected-data invariants",
  workstream: "P0",
  dependencies: ["A029", "P0-013", "P0-017"],
  acceptance:
    "A named approval and verified rollback point precede each write; exact IDs and preconditions are asserted, protected racing-data hashes remain equal, rerun changes zero rows, and all changed files/commits/rows are recorded.",
  expected:
    "Only evidence-backed, fail-closed repairs are applied; this task remains BLOCKED without explicit production-write authority and a verified recovery point.",
});
addTask({
  id: "P0-015",
  title: "Repeat the complete inventory, source reconciliation, canonical-link and desktop/mobile playback suite after every repair",
  workstream: "P0",
  dependencies: ["P0-014"],
  acceptance:
    "Post-repair manifests and checksums reconcile exactly, every fixed defect passes its original reproduction plus regression cases, no new gap/conflict appears and remaining exceptions are explicit.",
});
addTask({
  id: "P0-016",
  title: "Publish the exact Priority Zero completion report and independent verification gate",
  workstream: "P0",
  dependencies: ["P0-015"],
  acceptance:
    "The report states exact cutoff, totals by year/track/source/status, official-source coverage, matched/unmatched/ambiguous/broken/repaired counts, desktop/mobile pass counts, defects, evidence paths, retests and all blocked/unverified items; an independent verifier signs the evidence with no general completeness claim.",
});
addTask({
  id: "P0-017",
  title: "Design, review and migrate an append-only replay-verification, licensing, evidence, quarantine and replacement-lineage schema",
  workstream: "P0",
  dependencies: ["A029", "P0-006", "P0-007"],
  acceptance:
    "A reviewed forward-only migration stores canonical race/replay IDs, verification method/time/result, playable-media evidence, source authority, granular licence scope, confidence, immutable evidence hash, quarantine reason/status and replacement lineage; serving/backfill cannot publish an unverified or quarantined replay, rollback is documented and protected racing data is unchanged.",
  expected:
    "The append-only verification contract exists and passes migration, policy, fail-closed serving and rollback checks before any provider-wide replay repair. This remains BLOCKED until the fresh off-VPS recovery point completes and the migration receives explicit approval.",
  actual:
    "BLOCKED: the verifier confirmed Race/RaceVideo lack playback, licence, confidence, evidence and replacement-lineage persistence; sourceStatus is insufficient and serving backfill can skip quarantine persistence. No approved schema/migration evidence exists.",
  status: "BLOCKED",
  defect: "P0-DEF-001 — replay verification/provenance persistence gap",
});
addTask({
  id: "P0-018",
  title: "Obtain provider authority for automated bulk acquisition, restricted framing, download, retention, repair or rehosting",
  workstream: "P0",
  dependencies: ["P0-002"],
  acceptance:
    "For each provider/jurisdiction, dated written authority or API terms explicitly cover the intended operation and retention/publication model. Without it, only independently permitted canonical outbound links may be used and provider-wide gap filling remains externally blocked; NT remains an explicit no-official-archive gap until proven otherwise.",
  expected:
    "Every proposed operation is within documented rights. Independently permitted canonical links and standard provider-supported YouTube/Vimeo players remain distinct from restricted first-party framing, automated bulk acquisition, download, retention and rehosting.",
  actual:
    "OUT-OF-SCOPE EXTERNAL BLOCKER: written permission/approved API scope is absent for bulk acquisition, download, retained copies, rehosting and first-party-page framing. The user excluded those operations. This does not block exact canonical outbound links or standard provider-supported YouTube/Vimeo iframes with a safe outbound fallback.",
  status: "BLOCKED",
  defect: "P0-DEF-002 — replay licensing/authority gap",
  evidence:
    "docs/production/contabo-master-2026-07-22/replay-source-authority-2026-07-22.md",
});

const controls = [
  "Keep the Contabo VPS as the final production target",
  "Treat the recovered production database as the authoritative production dataset",
  "Never rebuild, reset, reseed or replace the production database",
  "Do not start dependent services while recovery is incomplete",
  "Do not interrupt PostgreSQL, Caddy or LiveKit during recovery unless evidence proves it is required",
  "Do not delete or recreate persistent Docker volumes",
  "Do not change either production database name",
  "Keep PostgreSQL port 5432 private",
  "Keep LiveKit port 7880 private and restricted to the intended backend route",
  "Do not weaken UFW to make testing easier",
  "Never expose environment values, JWT secrets, LiveKit keys or database credentials",
  "Do not migrate cloud providers during this mission",
  "Create and verify a fresh recovery point after validation and before schema or data repair",
  "Test destructive actions only against isolated test records",
  "Use sandbox payments only",
  "Prevent tests from contacting real users",
  "Exclude private information from screenshots and recordings",
  "Require evidence before any task completion claim",
  "Repair confirmed defects only with approval and retest every fix",
  "Record training footage only after the related workflow passes",
  "Verify the full observed production baseline read-only and record drift before any change",
  "Keep app, PostgREST, Realtime and realtime-gateway stopped until recovery validation gates permit controlled startup",
  "Stop only affected dependent services on failure and preserve diagnostic logs",
];
addNumbered("GLOBAL", 1, controls, {
  status: () => "TODO",
  acceptance: (_id, title) =>
    `The execution ledger and evidence prove the invariant was continuously enforced: ${title}. Any exception has named approval, scope, timestamp and rollback evidence.`,
});

const aTitles = [
  "Confirm the AlloyDB recovery process completed successfully",
  "Confirm no restore, import or recovery process is still writing",
  "Check PostgreSQL logs for fatal errors, corruption, aborted transactions or incomplete restore activity",
  "Confirm the production database is named giq_production_stage11_20260718_r2",
  "Confirm the Realtime database is named giq_realtime_stage11",
  "Confirm both databases accept local authenticated connections",
  "Confirm required schemas, roles and extensions exist",
  "Record exact database sizes and available disk space",
  "Confirm WAL and temporary files are not consuming unexpected disk capacity",
  "Validate Runner=5,298,108 at the 2026-07-21 23:36:00 UTC recovery point",
  "Validate Result=4,664,787 at the 2026-07-21 23:36:00 UTC recovery point",
  "Confirm all expected schemas and tables exist",
  "Confirm primary keys and foreign keys",
  "Confirm indexes and unique constraints",
  "Confirm sequences are ahead of existing identifiers",
  "Confirm views and materialised views",
  "Confirm triggers and stored functions",
  "Confirm application and Realtime database roles",
  "Confirm grants and RLS policies",
  "Confirm required extensions",
  "Confirm database encoding, collation and time zone",
  "Refresh planner statistics where required",
  "Run safe database consistency checks",
  "Confirm representative production queries return correct results",
  "Create a fresh backup or snapshot of the validated Contabo production database",
  "Verify the fresh backup is readable and complete",
  "Record the fresh backup creation time, size and checksum",
  "Document the fresh-backup restoration procedure",
  "Confirm the fresh backup is stored separately from the active PostgreSQL volume",
  "Confirm the final Docker Compose configuration resolves successfully",
  "Confirm all expected image names and digests",
  "Start realtime-gateway in the controlled dependency order",
  "Confirm realtime-gateway is healthy",
  "Start PostgREST in the controlled dependency order",
  "Confirm PostgREST connects to the correct production database",
  "Start Realtime in the controlled dependency order",
  "Confirm Realtime connects to giq_realtime_stage11",
  "Start the application in the controlled dependency order",
  "Confirm the application image SHA-256 is 7c909258044a9ca4728c3a3cd5778593698d21125cffdde119cb2599f07efb2c",
  "Confirm the application runs as nextjs",
  "Confirm the application root filesystem remains read-only",
  "Confirm Caddy reaches the application",
  "Confirm Caddy reaches LiveKit on the intended internal route",
  "Confirm all containers remain healthy after startup",
  "Check all relevant logs for errors before opening public traffic",
];
addNumbered("A", 1, aTitles, {
  dependencies: (_id, number) => {
    if (number === 1) return [];
    if (number === 10) return ["A009"];
    if (number === 12) return ["A010", "A011"];
    if (number === 25) return ["A024"];
    if (number === 30) return ["A029"];
    return [`A${String(number - 1).padStart(3, "0")}`];
  },
  actual: (id) => {
    if (id === "A010")
      return "PASS: `source-verification.tsv` records count|Runner|5298108 for recovery_point_utc=2026-07-21T23:36:00Z. Current live Runner=5,299,489 after legitimate live sync, so this is a recovery-point gate rather than an immutable live total.";
    if (id === "A011")
      return "PASS: `source-verification.tsv` records count|Result|4664787 for recovery_point_utc=2026-07-21T23:36:00Z. Current live Result=4,665,223 after legitimate live sync, so this is a recovery-point gate rather than an immutable live total.";
    if (id === "A012")
      return "PARTIAL: supplied recovery evidence records 115 tables and 5 materialised views; expected-object reconciliation and full schema list verification remain outstanding.";
    if (id === "A013")
      return "PARTIAL: supplied recovery evidence records 209 valid foreign keys and zero invalid foreign keys; primary-key completeness is not yet evidenced.";
    if (id === "A019")
      return "PARTIAL: supplied recovery evidence records 114 RLS-enabled and 114 FORCE RLS tables; grant and policy-definition completeness remains outstanding.";
    if (id === "A025")
      return "IN PROGRESS: a fresh off-VPS pre-repair pg_dump is currently running. It is not a completed or verified recovery point and does not release any repair task.";
    if (id === "A026")
      return "BLOCKED pending completion of the fresh off-VPS pg_dump; the earlier PITR recovery package does not substitute for a post-validation pre-repair restore test.";
    if (id === "A027")
      return "BLOCKED pending completion of the fresh off-VPS pg_dump; its final creation time, size and checksum are not yet available.";
    if (id === "A029")
      return "BLOCKED: the new off-VPS pre-repair pg_dump is in progress and has not yet passed checksum, readability, completeness and separate-storage verification.";
    if (id === "A042")
      return "READY EVIDENCE: the supplied stack observation is healthy and readiness returns HTTP 200; route-specific Caddy evidence remains to be linked.";
    if (id === "A044")
      return "READY EVIDENCE: the supplied observation says the stack is healthy and readiness returns HTTP 200; exact `docker compose ps` output and sustained-health window remain to be linked.";
    return defaultActual;
  },
  status: (id) => {
    if (["A010", "A011"].includes(id)) return "DONE";
    if (["A012", "A013", "A019", "A025"].includes(id)) return "IN PROGRESS";
    if (["A026", "A027", "A029"].includes(id)) return "BLOCKED";
    if (["A042", "A044"].includes(id)) return "READY FOR VERIFICATION";
    return undefined;
  },
  acceptance: (id, title) => {
    if (id === "A010")
      return "At the fixed PITR recovery point only, a raw count query proves exactly 5,298,108 Runner rows; subsequent legitimate live ingestion is reported separately and is not treated as failure.";
    if (id === "A011")
      return "At the fixed PITR recovery point only, a raw count query proves exactly 4,664,787 Result rows; subsequent legitimate live ingestion is reported separately and is not treated as failure.";
    return `Exact, timestamped recovery evidence demonstrates: ${title}. Recovery must stop on corruption or unexplained discrepancy.`;
  },
  checks: (id) => {
    if (id === "A010")
      return [
        "Reviewed the immutable `source-verification.tsv` recovery-point row `count|Runner|5298108` and its `recovery_point_utc` value.",
        "Compared the fixed recovery-point gate with the separately reported live Runner total after legitimate sync.",
      ];
    if (id === "A011")
      return [
        "Reviewed the immutable `source-verification.tsv` recovery-point row `count|Result|4664787` and its `recovery_point_utc` value.",
        "Compared the fixed recovery-point gate with the separately reported live Result total after legitimate sync.",
      ];
    return genericChecks.A;
  },
  changed: (id) =>
    id === "A010" || id === "A011"
      ? "NONE — read-only recovery-package validation"
      : "NONE — verification/planning task not executed",
  evidence: (id) =>
    ["A010", "A011", "A012", "A013", "A019"].includes(id)
      ? "C:\\Users\\verri\\Desktop\\CLever bee Backup\\04-database\\final-live-pitr-20260722T093600AEST\\source-verification.tsv; sibling SHA256SUMS manifest"
      : "PENDING — no task-specific evidence location recorded",
  retest: (id) =>
    id === "A010" || id === "A011"
      ? "PASS at fixed recovery point; live-sync totals are intentionally tracked separately"
      : "NOT RUN",
  completion: (id) =>
    id === "A010" || id === "A011" ? "2026-07-22T07:09:48.604087Z" : null,
});

const bTitles = [
  "Verify Ubuntu, kernel, architecture, CPU, RAM and disk against the baseline",
  "Confirm current security-update status",
  "Confirm time synchronisation and Australia/Sydney application time zone",
  "Confirm Docker Engine and Compose versions",
  "Confirm Docker is configured to restart after host reboot",
  "Confirm the Docker API is not publicly exposed",
  "Confirm no container is privileged",
  "Confirm read-only root filesystems remain enabled",
  "Audit writable mounts and persistent volumes",
  "Confirm secrets are not embedded in images or committed configuration",
  "Confirm container logs have rotation and retention controls",
  "Confirm host and Docker disk-usage alerts",
  "Confirm database-volume monitoring",
  "Confirm recovery after a safe controlled restart when authorised",
  "Measure idle CPU and memory usage",
  "Measure database-query load",
  "Measure combined application and LiveKit load",
  "Check historical and current OOM events",
  "Confirm memory headroom during peak workloads",
  "Assess the no-swap configuration",
  "Do not add swap without measured evidence and approval",
  "Test CPU contention between PostgreSQL, the application and LiveKit",
  "Establish warning and critical disk thresholds",
  "Confirm disk capacity for WAL, temporary files, logs, media and backups",
  "Confirm UFW is enabled",
  "Confirm only required ports are exposed",
  "Confirm PostgreSQL 5432 is not publicly reachable",
  "Confirm LiveKit 7880 is not publicly reachable",
  "Confirm LiveKit 7880/TCP is restricted to giq-backend0",
  "Confirm LiveKit 7881/TCP works for RTC",
  "Confirm 3478/UDP works for TURN",
  "Confirm 50000-60000/UDP works for RTC media",
  "Confirm SSH access is restricted and hardened without risking lockout",
  "Confirm Caddy publishes only intended public web ports",
  "Confirm greyhoundsiq.com.au DNS points to 217.216.76.124",
  "Confirm all required subdomains",
  "Confirm HTTP redirects to HTTPS",
  "Confirm valid certificate issuance and renewal",
  "Confirm TLS configuration",
  "Confirm HTTP/2 and HTTP/3 behaviour",
  "Confirm security headers",
  "Confirm reverse-proxy routes",
  "Confirm request-size and timeout settings",
  "Confirm a clean maintenance response is shown until the application is ready",
  "Confirm Caddy logs do not expose credentials or private data",
];
addNumbered("B", 1, bTitles, {
  dependencies: (_id, number) => {
    if (number === 1) return [];
    if (number === 14) return ["A045", "B013"];
    if (number === 15) return ["A045"];
    if (number === 25) return ["B024"];
    if (number === 35) return ["B034"];
    return [`B${String(number - 1).padStart(3, "0")}`];
  },
});

const cExplicitTitles = [
  "Verify max_connections=150",
  "Verify shared_buffers=12 GiB",
  "Verify effective_cache_size=48 GiB",
  "Verify maintenance_work_mem=2 GiB",
  "Verify work_mem=16 MiB",
  "Verify max_wal_size=16 GiB",
  "Verify checkpoint_timeout=30 minutes",
  "Verify WAL compression is enabled",
  "Verify password encryption uses SCRAM-SHA-256",
  "Confirm the exact Runner and Result recovery-point counts",
  "Generate complete yearly coverage from 2006 onward",
  "Generate counts by track and source",
  "Detect missing historical periods",
  "Detect duplicate and near-duplicate records",
  "Detect invalid dates and unexpected nulls",
  "Confirm every breeding and stud book",
  "Confirm search indexes cover the complete dataset",
  "Confirm caches do not hide restored records",
  "Confirm media and storage references",
  "Safely repair only confirmed data defects",
  "Repeat all counts and integrity tests after repair",
];
addNumbered("C", 1, cExplicitTitles, {
  dependencies: (_id, number) => {
    if (number <= 9) return ["A024"];
    if (number === 10) return ["A010", "A011"];
    if (number >= 11 && number <= 19) return ["P0-016"];
    if (number === 20) return ["A029", "C019"];
    return ["C020"];
  },
  actual: (id) => {
    if (id === "C010")
      return "PASS at the fixed recovery point: Runner=5,298,108 and Result=4,664,787. Current live totals subsequently advanced to Runner=5,299,489 and Result=4,665,223 through legitimate live sync.";
    return defaultActual;
  },
  status: (id) => (id === "C010" ? "DONE" : undefined),
  checks: (id) =>
    id === "C010"
      ? [
          "Reviewed `source-verification.tsv` Runner and Result count rows at recovery_point_utc=2026-07-21T23:36:00Z.",
          "Kept current live Runner/Result totals separate from the fixed recovery-point acceptance values.",
        ]
      : genericChecks.C,
  changed: (id) =>
    id === "C010"
      ? "NONE — read-only recovery-package validation"
      : "NONE — verification/planning task not executed",
  evidence: (id) =>
    id === "C010"
      ? "C:\\Users\\verri\\Desktop\\CLever bee Backup\\04-database\\final-live-pitr-20260722T093600AEST\\source-verification.tsv"
      : "PENDING — no task-specific evidence location recorded",
  retest: (id) =>
    id === "C010" ? "PASS at fixed recovery point; live totals tracked separately" : "NOT RUN",
  completion: (id) => (id === "C010" ? "2026-07-22T07:09:48.604087Z" : null),
});

const pgAudits = [
  "Audit autovacuum configuration and effectiveness",
  "Audit query-statistics collection",
  "Identify and measure slow queries",
  "Audit connection usage",
  "Audit connection pooling",
  "Audit lock contention",
  "Audit deadlocks",
  "Audit checkpoint frequency",
  "Audit WAL growth",
  "Audit temporary-file usage",
  "Audit index usage",
  "Audit table and index bloat",
  "Audit replication settings where applicable",
  "Audit backup retention",
  "Test restoration without changing production",
];
addNumbered("C", 22, pgAudits, { dependencies: () => ["A024"] });

const historicalEntities = [
  "Greyhounds",
  "Races",
  "Meetings",
  "Tracks",
  "Distances",
  "Runners",
  "Results",
  "Placings",
  "Race times",
  "Sectional times",
  "Box numbers",
  "Starting prices and odds",
  "Trainers",
  "Owners",
  "Breeders",
  "Sires and dams",
  "Litters",
  "Breeding records",
  "Breeding and stud books",
  "Prizemoney",
  "Steward information",
  "Performance records",
  "Videos, images and documents",
  "Every other production entity discovered by schema inventory",
].map((entity) => `Validate complete 2006-present historical coverage for ${entity}`);
addNumbered("C", 37, historicalEntities, { dependencies: () => ["P0-016"] });

const coverageDimensions = [
  "Report the exact total for every major entity",
  "Report the earliest date for every major entity",
  "Report the latest date for every major entity",
  "Report counts grouped by year from 2006 onward for every major entity",
  "Report counts grouped by track or source for every major entity",
  "Detect missing years or months",
  "Detect missing meetings or import batches",
  "Detect duplicate records",
  "Detect orphaned records",
  "Detect invalid dates",
  "Detect unexpected null values",
  "Detect invalid identifiers",
  "Detect records present in the database but absent from search or the UI",
];
addNumbered("C", 61, coverageDimensions, { dependencies: () => ["P0-016"] });

const breedingFields = [
  "book titles",
  "volumes",
  "editions",
  "publication years",
  "pages",
  "entry identifiers",
  "registered names",
  "aliases",
  "registration numbers",
  "sires and dams",
  "litters and offspring",
  "breeders and owners",
  "birth dates",
  "sex and colour",
  "source references",
  "scans, documents and images",
  "links to canonical greyhound records",
].map((field) => `Validate every production breeding/stud-book ${field}`);
addNumbered("C", 74, breedingFields, { dependencies: () => ["P0-016"] });

const dSchema = [
  "Audit every primary key",
  "Audit every foreign key",
  "Audit every unique constraint",
  "Audit every check constraint",
  "Audit every index",
  "Audit every sequence",
  "Audit every view",
  "Audit every materialised view",
  "Audit every trigger",
  "Audit every stored function",
  "Audit every RPC endpoint",
  "Audit every ORM relationship",
  "Audit every API relationship",
  "Audit every storage reference",
  "Audit every search-index relationship and public URL/slug",
];
const dRelationships = [
  "Validate sire-to-offspring relationships",
  "Validate dam-to-offspring relationships",
  "Validate offspring-to-parent relationships",
  "Validate litter and sibling relationships",
  "Validate ancestor and descendant traversal",
  "Validate multi-generation pedigrees",
  "Validate test-mating relationships",
  "Validate breeder and owner relationships",
  "Validate breeding-book references",
  "Validate canonical identity resolution",
];
const dDefects = [
  "Detect broken pedigree links",
  "Detect missing or incorrect parents",
  "Detect circular pedigrees",
  "Detect self-parent relationships",
  "Detect duplicate identities",
  "Detect orphaned records",
  "Detect ambiguous registration numbers",
  "Detect pedigrees stopping while more data exists",
  "Detect relationships stored in the database but missing from the UI",
  "Detect relationship links failing on mobile",
  "Detect relationship links incorrectly restricted by user role",
];
addNumbered("D", 1, dSchema, { dependencies: () => ["A024"] });
addNumbered("D", 16, dRelationships, { dependencies: () => ["P0-016"] });
addNumbered("D", 26, dDefects, { dependencies: () => ["P0-016"] });
addTask({
  id: "D037",
  title: "Trace every major feature from rendered interface through action, API, authentication, authorisation, query, relationship, response and rendered result",
  workstream: "D",
  dependencies: ["D015", "D036", "E025", "H033"],
  acceptance:
    "Each major feature has an evidence-linked end-to-end trace covering all nine hops, exact route/API/database identifiers, positive and negative authorization and desktop/mobile rendered results.",
});

addTask({
  id: "E001",
  title: "Produce the complete RLS inventory for every exposed table, view, function, RPC and storage object",
  workstream: "E",
  dependencies: ["A024"],
  acceptance:
    "Every exposed object records RLS enabled/forced state, policy name, operation, role, USING, WITH CHECK, anonymous/authenticated/admin/service access and PostgREST/Realtime exposure; zero objects are silently omitted.",
});
addNumbered("E", 2, [
  "Test RLS SELECT separately",
  "Test RLS INSERT separately",
  "Test RLS UPDATE separately",
  "Test RLS DELETE separately",
], { dependencies: () => ["E001"] });

const roles = [
  "anonymous visitor",
  "unverified user",
  "free user",
  "Pro user",
  "Pro+ user",
  "punter",
  "owner",
  "trainer",
  "breeder",
  "marketplace user",
  "moderator",
  "support user",
  "administrator",
  "super administrator",
  "suspended user",
  "expired or downgraded subscriber",
  "disabled account",
  "service identity",
].map((role) => `Execute positive and negative data-access tests for the ${role} role`);
addNumbered("E", 6, roles, {
  dependencies: () => ["E002", "E003", "E004", "E005"],
  acceptance: (_id, title) =>
    `${title}, covering own/cross-user access, unauthorized create/update/delete, guessed IDs, direct API/protected URL access, ownership/role/subscription manipulation, expired sessions and access after logout/suspension/downgrade. Raw allow and deny evidence is linked.`,
});
addTask({
  id: "E024",
  title: "Detect and register every listed RLS, API, JWT, security-definer, IDOR, Realtime and storage exposure class",
  workstream: "E",
  dependencies: ["E001", "E023"],
  acceptance:
    "The audit explicitly tests missing RLS, broad true policies/checks, client-controlled ownership, leakage/escalation/bypass, unsafe JWT/service credentials/security-definer search paths, view/RPC bypass, IDOR, Realtime row leakage, storage exposure and UI-only admin controls; findings have severity and evidence.",
});
addTask({
  id: "E025",
  title: "Prove legitimate public racing, historical and pedigree access remains available after security enforcement",
  workstream: "E",
  dependencies: ["E024", "P0-016"],
  acceptance:
    "Anonymous/public positive tests pass only the intended racing/history/pedigree surface while every protected cross-user/admin/storage path remains denied, with no security fix breaking lawful public data.",
});

const fTests = [
  "Validate LiveKit server health",
  "Validate secure WebSocket connectivity",
  "Validate LiveKit TLS",
  "Validate room creation",
  "Validate joining and leaving rooms",
  "Validate token generation",
  "Validate token expiry",
  "Validate role scopes",
  "Validate voice calls",
  "Validate video calls",
  "Validate microphone and camera permissions",
  "Validate mute and unmute",
  "Validate camera enable and disable",
  "Validate device switching",
  "Validate screen sharing if supported",
  "Validate reconnection",
  "Validate network interruption recovery",
  "Validate slow connections",
  "Validate TURN fallback",
  "Validate RTC media ports",
  "Validate mobile background and foreground transitions",
  "Validate room cleanup",
  "Validate LiveKit webhooks",
  "Validate recording or egress if enabled",
  "Validate concurrent rooms",
  "Validate resource usage",
  "Validate privacy and entitlement rules",
];
addNumbered("F", 1, fTests, { dependencies: () => ["A045", "B043", "E025"] });
addNumbered("F", 28, [
  "Confirm livekit.yaml remains mounted read-only",
  "Confirm LiveKit 7880 remains internal",
  "Confirm public RTC and TURN ports function correctly",
  "Confirm token secrets are never exposed to clients",
  "Confirm Free, Pro and Pro+ call entitlements and Realtime RLS isolation operate exactly as designed",
], { dependencies: () => ["F027"] });

const gTour = [
  "Prevent help-tour overflow outside the viewport",
  "Prevent the help tour from breaking or obscuring the header",
  "Position help-tour pop-ups using available space",
  "Use mobile bottom sheets where required",
  "Keep help-tour navigation controls visible",
  "Maintain touch targets of at least 44 by 44 CSS pixels",
  "Respect safe-area insets",
  "Handle virtual keyboards",
  "Scroll targets into view without hiding them under sticky headers",
  "Recalculate help-tour placement after scrolling, resizing, zooming and rotation",
  "Restore scroll position and page state",
  "Preserve focus management and keyboard navigation",
  "Support screen readers and reduced motion",
  "Handle missing or loading targets safely",
  "Support help-tour exit, resume and restart",
  "Adapt all help-tour steps to mobile rather than removing them",
];
addNumbered("G", 1, gTour, { dependencies: () => ["A045"] });
addTask({
  id: "G017",
  title: "Audit every page and state for the complete responsive, touch, orientation, zoom and interaction defect list",
  workstream: "G",
  dependencies: ["G016", "H032"],
  acceptance:
    "Every page covers horizontal overflow, clipping, navigation, stacking, touch targets, tables, modals, keyboard-obscured forms, media scaling, hover-only actions, touch/swipe, layout shift, orientation, zoom, state loss and loading/empty/validation/success/error states; every defect is fixed and retested.",
});

const interactions = [
  "route",
  "page",
  "link",
  "button",
  "form",
  "menu",
  "tab",
  "modal",
  "drawer",
  "tooltip",
  "filter",
  "search control",
  "sort control",
  "pagination control",
  "upload",
  "media control",
  "subscription action",
  "marketplace action",
  "feed and community action",
  "messaging action",
  "LiveKit action",
  "pedigree action",
  "test-mating action",
  "administrative action and loading/empty/error/recovery state",
].map((item) => `Inventory every production ${item}`);
addNumbered("H", 1, interactions, { dependencies: () => ["P0-016"] });
addTask({
  id: "H025",
  title: "Execute the full sixteen-step interaction procedure for every inventory row and applicable role",
  workstream: "H",
  dependencies: ["H024", "E025"],
  acceptance:
    "Each row records correct role, initial state, action, visual/state result, console/network, refresh persistence, back/forward, cancellation/recovery, keyboard/touch, direct URL/API permissions, defect/fix/retest, evidence and video approval.",
});
addTask({
  id: "H026",
  title: "Run the mobile-width matrix at 280, 320, 360, 375, 390, 393, 412, 414, 428, 430, 480 and 540 CSS pixels",
  workstream: "H",
  dependencies: ["H025"],
});
addTask({
  id: "H027",
  title: "Run the tablet-width matrix at 600, 720, 768, 800, 810, 820, 834, 912 and 1024 CSS pixels",
  workstream: "H",
  dependencies: ["H025"],
});
addTask({
  id: "H028",
  title: "Run the desktop-resolution matrix from 1024x768 through 3840x2160 including ultrawide",
  workstream: "H",
  dependencies: ["H025"],
  acceptance:
    "Interaction rows pass at 1024x768, 1280x720, 1280x800, 1366x768, 1440x900, 1536x864, 1600x900, 1920x1080, 2560x1440, 3440x1440 and 3840x2160 with exact evidence counts.",
});
addTask({
  id: "H029",
  title: "Test portrait and landscape orientation wherever applicable",
  workstream: "H",
  dependencies: ["H026", "H027"],
});
addTask({
  id: "H030",
  title: "Test browser zoom at 80, 90, 100, 110, 125, 150, 175 and 200 percent",
  workstream: "H",
  dependencies: ["H025"],
});
addTask({
  id: "H031",
  title: "Test supported Chrome, Safari, iOS Safari, Edge, Firefox, Android Chrome, Samsung Internet and installed PWA versions",
  workstream: "H",
  dependencies: ["H025"],
});
addTask({
  id: "H032",
  title: "Run automated viewport sweeps continuously from 280 through 3840 CSS pixels",
  workstream: "H",
  dependencies: ["H026", "H027", "H028"],
});
addTask({
  id: "H033",
  title: "Map every interaction to every applicable user type and prove no role/interaction combination is silently omitted",
  workstream: "H",
  dependencies: ["H024", "E023", "H031", "H032"],
});

addNumbered("I", 1, [
  "Visually verify every workflow with the Browser capability",
  "Enforce the functional, security, responsive and accessibility pass gate before recording",
  "Record clean desktop 1920x1080, mobile 1080x1920 and native-tablet footage at at least 30fps with all capture-quality rules",
  "Create and verify the required greyhoundsiq-university raw-capture, screenshot, manifest, evidence and Remotion folder structure",
  "Apply the GHIQ_role_module_action_device_v001.mp4 filename convention",
  "Create the complete video manifest with interaction ID, role, route, viewport, action, expected result, duration, narration notes, callouts, evidence and approval",
], { dependencies: (_id, number) => (number === 1 ? ["H033", "P0-016"] : [`I${String(number - 1).padStart(3, "0")}`]) });

addNumbered("J", 1, [
  "Capture Contabo actual configuration and dated monthly price as the active baseline",
  "Price an equivalent Google Cloud environment",
  "Price an equivalent AWS environment",
  "Price an equivalent Microsoft Azure environment",
  "Price an equivalent Oracle Cloud environment",
  "Compare compute, 96GB RAM, 600GB storage, PostgreSQL, LiveKit traffic, CDN/load balancing, backups, monitoring, bandwidth/egress, Australian regions, monthly cost, trials/credits, expiry, migration, downtime, residency and performance",
  "Verify physical data-centre location independently rather than inferring it from IP",
  "Publish a costed recommendation without migrating or selecting a provider merely for temporary credits",
], { dependencies: (_id, number) => (number === 1 ? ["B024"] : number <= 5 ? ["J001"] : ["J002", "J003", "J004", "J005"]) });

const kChecks = [
  "Database recovery finished successfully",
  "Recovery-point Runner count is exactly 5,298,108",
  "Recovery-point Result count is exactly 4,664,787",
  "Both production databases pass validation",
  "A fresh verified recovery point exists",
  "All services are running and healthy",
  "DNS and TLS work",
  "PostgreSQL remains private",
  "LiveKit ports and internal routing work",
  "All expected data from 2006 onward is accounted for",
  "Every breeding book is validated",
  "Every pedigree relationship passes",
  "RLS passes positive and negative testing",
  "PostgREST and Realtime expose no unauthorised data",
  "Every route and interaction is inventoried",
  "Every applicable interaction passes for every relevant role",
  "The help tour works across the device matrix",
  "No known critical or high-severity defect remains",
  "No unexplained console or network error remains",
  "Every approved workflow has clean training footage and every completion claim has evidence",
];
addNumbered("K", 1, kChecks.map((item) => `Final sign-off gate: ${item}`), {
  dependencies: () => ["P0-016", "D037", "E025", "F032", "G017", "H033", "I006", "J008"],
});

const deliverables = [
  "Master task ledger",
  "Recovery validation report",
  "Exact database-count report",
  "Production architecture inventory",
  "Docker and host security report",
  "PostgreSQL performance report",
  "Historical data coverage from 2006 onward",
  "Breeding-book inventory",
  "Pedigree-integrity report",
  "Database-relationship map",
  "RLS policy inventory",
  "Role-by-operation access matrix",
  "PostgREST and Realtime security report",
  "LiveKit validation report",
  "Route and interaction inventory",
  "Responsive device and browser report",
  "Help-tour and accessibility report",
  "Defect and completed-fix report",
  "Browser screenshots and evidence",
  "Organised training recordings",
  "Video manifest",
  "Remotion notes",
  "GreyhoundsIQ University course structure",
  "Contabo versus cloud cost comparison",
  "Final production sign-off",
  "Exact details of every blocked or unverified item",
];
deliverables.forEach((title, index) => {
  const id = `DEL${String(index + 1).padStart(3, "0")}`;
  addTask({
    id,
    title: `Publish deliverable: ${title}`,
    workstream: "K",
    dependencies: index === 0 ? [] : ["K020"],
    acceptance:
      index === 0
        ? "The authoritative JSON ledger and concise Markdown index exist, validate, preserve all task IDs and contain no unsupported completion claim."
        : `The ${title} exists at a stable evidence path, contains exact results rather than a general assurance, links its source evidence and names every limitation or unverified item.`,
    status: index === 0 ? "READY FOR VERIFICATION" : "BLOCKED",
    actual:
      index === 0
        ? "Created by this documentation pass; final validation output is recorded in the Markdown index."
        : defaultActual,
    evidence:
      index === 0
        ? "docs/production/contabo-master-2026-07-22/task-ledger.json; docs/production/contabo-master-2026-07-22/README.md"
        : "PENDING — no deliverable location recorded",
    changed:
      index === 0
        ? "docs/production/contabo-master-2026-07-22/build-ledger.mjs; docs/production/contabo-master-2026-07-22/task-ledger.json; docs/production/contabo-master-2026-07-22/README.md"
        : "NONE — deliverable not created",
  });
});

const requiredFields = [
  "task_id",
  "title",
  "assigned_agent",
  "workstream",
  "dependencies",
  "acceptance_criterion",
  "commands_or_checks",
  "expected_result",
  "actual_result",
  "status",
  "defect_reference",
  "changed_files_or_commit",
  "evidence_location",
  "retest_result",
  "completion_time",
];

// A task cannot advance beyond BLOCKED while any declared prerequisite is not
// DONE. Keep partial observations in actual_result, but do not let those
// observations imply that the task's dependency gate has passed.
const taskById = new Map(tasks.map((task) => [task.task_id, task]));
const dependencyStateAdjustments = [];
let dependencyStateChanged = true;
while (dependencyStateChanged) {
  dependencyStateChanged = false;
  for (const task of tasks) {
    if (task.status === "BLOCKED") continue;
    const unfinished = task.dependencies.filter((dependency) => {
      const prerequisite = taskById.get(dependency);
      return prerequisite && prerequisite.status !== "DONE";
    });
    if (unfinished.length === 0) continue;

    dependencyStateAdjustments.push({
      task_id: task.task_id,
      prior_status: task.status,
      unfinished_dependencies: unfinished,
    });
    task.status = "BLOCKED";
    task.actual_result = `${task.actual_result} STATUS GATE: blocked until declared prerequisite(s) are DONE: ${unfinished.join(", ")}.`;
    dependencyStateChanged = true;
  }
}

const ids = tasks.map((task) => task.task_id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
const idSet = new Set(ids);
const missingFields = [];
const emptyRequiredValues = [];
const invalidStates = [];
const unknownDependencies = [];
const activeWithoutEvidence = [];
const unfinishedDependencies = [];
for (const task of tasks) {
  for (const field of requiredFields) {
    if (!Object.hasOwn(task, field)) missingFields.push(`${task.task_id}:${field}`);
  }
  for (const field of [
    "task_id",
    "title",
    "assigned_agent",
    "workstream",
    "acceptance_criterion",
    "expected_result",
    "actual_result",
    "status",
    "defect_reference",
    "changed_files_or_commit",
    "evidence_location",
    "retest_result",
  ]) {
    if (typeof task[field] !== "string" || task[field].trim() === "") {
      emptyRequiredValues.push(`${task.task_id}:${field}`);
    }
  }
  if (!Array.isArray(task.commands_or_checks) || task.commands_or_checks.length === 0) {
    emptyRequiredValues.push(`${task.task_id}:commands_or_checks`);
  }
  if (!allowedStates.has(task.status)) invalidStates.push(`${task.task_id}:${task.status}`);
  for (const dependency of task.dependencies) {
    if (!idSet.has(dependency)) unknownDependencies.push(`${task.task_id}:${dependency}`);
  }
  if (
    ["IN PROGRESS", "READY FOR VERIFICATION", "RETEST REQUIRED", "DONE"].includes(task.status) &&
    task.evidence_location.startsWith("PENDING")
  ) {
    activeWithoutEvidence.push(task.task_id);
  }
  const unfinished = task.dependencies.filter(
    (dependency) => taskById.get(dependency)?.status !== "DONE",
  );
  if (task.status !== "BLOCKED" && unfinished.length > 0) {
    unfinishedDependencies.push(`${task.task_id}:${unfinished.join(",")}`);
  }
}

const dependencyCycles = [];
const visitState = new Map();
const visitStack = [];
function visitDependency(taskId) {
  const state = visitState.get(taskId);
  if (state === "done") return;
  if (state === "visiting") {
    const start = visitStack.indexOf(taskId);
    dependencyCycles.push([...visitStack.slice(start), taskId].join(" -> "));
    return;
  }
  visitState.set(taskId, "visiting");
  visitStack.push(taskId);
  for (const dependency of taskById.get(taskId)?.dependencies ?? []) {
    if (taskById.has(dependency)) visitDependency(dependency);
  }
  visitStack.pop();
  visitState.set(taskId, "done");
}
for (const id of ids) visitDependency(id);
const requiredRanges = [
  ...Array.from({ length: 45 }, (_, i) => `A${String(i + 1).padStart(3, "0")}`),
  ...Array.from({ length: 45 }, (_, i) => `B${String(i + 1).padStart(3, "0")}`),
  ...Array.from({ length: 21 }, (_, i) => `C${String(i + 1).padStart(3, "0")}`),
];
const absentRequiredIds = requiredRanges.filter((id) => !idSet.has(id));
const p0First = tasks.slice(0, 18).every((task) => task.task_id.startsWith("P0-"));
const doneWithoutEvidence = tasks
  .filter(
    (task) =>
      task.status === "DONE" &&
      (task.actual_result === defaultActual ||
        task.evidence_location.startsWith("PENDING") ||
        !task.completion_time),
  )
  .map((task) => task.task_id);

const validation = {
  valid:
    duplicates.length === 0 &&
    missingFields.length === 0 &&
    emptyRequiredValues.length === 0 &&
    invalidStates.length === 0 &&
    unknownDependencies.length === 0 &&
    dependencyCycles.length === 0 &&
    unfinishedDependencies.length === 0 &&
    activeWithoutEvidence.length === 0 &&
    absentRequiredIds.length === 0 &&
    p0First &&
    doneWithoutEvidence.length === 0,
  task_count: tasks.length,
  unique_task_id_count: idSet.size,
  required_field_count: requiredFields.length,
  duplicate_task_ids: duplicates,
  missing_fields: missingFields,
  empty_required_values: emptyRequiredValues,
  invalid_states: invalidStates,
  unknown_dependencies: unknownDependencies,
  dependency_cycles: dependencyCycles,
  non_blocked_tasks_with_unfinished_dependencies: unfinishedDependencies,
  active_tasks_without_evidence: activeWithoutEvidence,
  dependency_state_adjustments: dependencyStateAdjustments,
  absent_explicit_ids: absentRequiredIds,
  priority_zero_tasks_first: p0First,
  done_without_exact_evidence: doneWithoutEvidence,
};

if (!validation.valid) {
  throw new Error(`Ledger validation failed:\n${JSON.stringify(validation, null, 2)}`);
}

const countsByWorkstream = Object.fromEntries(
  [...new Set(tasks.map((task) => task.workstream))].map((workstream) => [
    workstream,
    tasks.filter((task) => task.workstream === workstream).length,
  ]),
);
const countsByStatus = Object.fromEntries(
  [...allowedStates].map((status) => [status, tasks.filter((task) => task.status === status).length]),
);

const ledger = {
  ledger_id: "GIQ-CONTABO-MASTER-2026-07-22",
  title: "GreyhoundsIQ Contabo production completion master task ledger",
  authoritative_artifact: "task-ledger.json",
  generated_at: new Date().toISOString(),
  source_prompt_date: "2026-07-22 AEST",
  production_target: {
    provider: "Contabo",
    hostname: "vmi3457792",
    public_ipv4: "217.216.76.124",
    stack_path: "/opt/greyhoundiq",
    production_database: "giq_production_stage11_20260718_r2",
    realtime_database: "giq_realtime_stage11",
    recovery_point_utc: "2026-07-21T23:36:00Z",
  },
  evidence_boundary:
    "This ledger was assembled from the master prompt and supplied local recovery evidence. Except for the explicitly linked recovery-package observations, tasks were not executed by the ledger author. Current/live counts are observations, not substitutes for fixed recovery-point gates or full 2006-present coverage.",
  current_evidence_snapshot: {
    recovery_point_counts: { Runner: 5298108, Result: 4664787 },
    current_live_counts_after_legitimate_sync: {
      Race: 841615,
      Runner: 5299489,
      Result: 4665223,
      RaceVideo: 469039,
    },
    restored_schema_observation: {
      tables: 115,
      materialised_views: 5,
      rls_enabled: 114,
      force_rls: 114,
      valid_foreign_keys: 209,
      invalid_foreign_keys: 0,
    },
    service_observation: "Stack reported healthy; readiness HTTP 200. Raw per-service evidence remains to be linked.",
    scheduler_observation:
      "VPS-local owner timer reported enabled every 5 minutes; last supplied cycle upcoming 64/733/5916 and results 26/315/2534/1487 with zero replay errors. Google live schedulers paused; GitHub live workflow disabled.",
    recovery_package:
      "C:\\Users\\verri\\Desktop\\CLever bee Backup\\04-database\\final-live-pitr-20260722T093600AEST",
    checksum_manifest_sha256:
      "137445b54b55a9c4ca15aac4a365ac3a3b2ff18c5f9c74b2e66b3b8463beec",
    reported_checksum_entries_passing: 140,
  },
  task_states: [...allowedStates],
  required_task_fields: requiredFields,
  summary: {
    task_count: tasks.length,
    unique_task_id_count: idSet.size,
    counts_by_workstream: countsByWorkstream,
    counts_by_status: countsByStatus,
  },
  validation,
  tasks,
};

await mkdir(here, { recursive: true });
await writeFile(join(here, "task-ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

const workstreamRows = Object.entries(countsByWorkstream)
  .map(([workstream, count]) => `| ${workstream} | ${count} |`)
  .join("\n");
const statusRows = Object.entries(countsByStatus)
  .map(([status, count]) => `| ${status} | ${count} |`)
  .join("\n");
const readme = `# Contabo production master ledger\n\nThe authoritative ledger is [task-ledger.json](./task-ledger.json). It begins with the 18 Priority Zero replay tasks, then global safety controls and A-K execution/deliverable tasks. A-K work that requires a proven historical/replay baseline is explicitly blocked by \`P0-016\`.\n\nNo production mutation was run while creating this ledger. Supplied recovery and live-service observations remain attached to their tasks, but an observation does not advance a task while any declared prerequisite is unfinished. The generator therefore normalises such tasks to \`BLOCKED\` and records every adjustment in its validation output. The 15 required fields are structurally present on every task; incomplete tasks intentionally retain pending evidence, retest and completion values until their acceptance criteria actually pass.\n\n## Validation\n\nRegenerate and validate from the repository root with:\n\n\`\`\`powershell\nnode docs/production/contabo-master-2026-07-22/build-ledger.mjs\n\`\`\`\n\n- Tasks: **${tasks.length}**\n- Unique task IDs: **${idSet.size}**\n- Required fields per task: **${requiredFields.length}**\n- Duplicate IDs: **0**\n- Missing fields: **0**\n- Unknown dependencies: **0**\n- Dependency cycles: **0**\n- Non-blocked tasks with unfinished prerequisites: **0**\n- Active tasks without an evidence path: **0**\n- Missing explicit A001-A045/B001-B045/C001-C021 IDs: **0**\n- Unsupported \`DONE\` claims: **0**\n- Priority Zero first: **yes**\n\n## Counts by workstream\n\n| Workstream | Tasks |\n| --- | ---: |\n${workstreamRows}\n\n## Counts by status\n\n| Status | Tasks |\n| --- | ---: |\n${statusRows}\n\n## Evidence boundary\n\nThe recovery package evidence is recorded at \`G:\\CLever bee Backup\\04-database\\final-live-pitr-20260722T093600AEST\`. Its \`source-verification.tsv\` fixes the recovery-point counts at Runner 5,298,108 and Result 4,664,787; it does not freeze current live totals. The reported 140-entry checksum pass and manifest SHA-256 \`137445b54b55a9c4ca15aac4a365ac3a3b2ff18c5f9c74b2e66b3b8463beec\` are retained verbatim.\n\nP0 source discovery must remain official, lawful and fail closed. Public availability or HTTP 2xx does not prove playable media or rights to embed, download, bulk acquire or rehost. Provider-wide gap filling is externally blocked until written permission or approved API scope exists. Race/RaceVideo currently lack the required append-only playback/licence/confidence/evidence/replacement-lineage and quarantine contract, so linkage repair remains blocked. No replay may be linked or repaired by name alone. Production repair tasks require a verified fresh recovery point, explicit approval, exact identity assertions, rollback evidence and a complete retest.\n`;
const clarifiedReplayScope = `\n## Clarified replay delivery scope\n\nThe requested production behavior is now limited to exact canonical public-source links and provider-supported iframes. GreyhoundsIQ will not download, retain, proxy as its own media or rehost replay files. A verified public YouTube/Vimeo player may be used when the exact authority-owned video permits embedding; a first-party page that blocks framing, or any unresolved player, must fall back to a clear **Watch on official source** link. Missing commercial/bulk/download/rehost authority remains recorded in \`P0-018\` but no longer blocks this narrower link/iframe workflow.\n`;
const operationalEvidence = `\n## Current VPS release evidence\n\nThe app-only replay/photo-finish release, database invariants, provider playback checks, five-minute sync evidence and finalized 841,615-race base inventory are recorded in [replay-photo-release-evidence-2026-07-22.md](./replay-photo-release-evidence-2026-07-22.md). The zero-filled month/source provenance companion and remaining browser/mobile task matrix are not complete.\n`;
await writeFile(
  join(here, "README.md"),
  `${readme}${clarifiedReplayScope}${operationalEvidence}`,
  "utf8",
);

console.log(JSON.stringify({ ...validation, counts_by_workstream: countsByWorkstream, counts_by_status: countsByStatus }, null, 2));
