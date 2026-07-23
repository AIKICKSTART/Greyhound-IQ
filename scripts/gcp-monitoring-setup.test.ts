import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const script = "scripts/gcp-monitoring-setup.sh";
const baseAssignments = [
  "PROJECT=greyhoundiq-test",
  "PROD_HOST=greyhoundiq.test",
  "PROD_SERVICE=greyhoundiq-web-test",
];

function quoteShell(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function assignmentSource(assignments: string[]) {
  return assignments
    .map((assignment) => {
      const separator = assignment.indexOf("=");
      return `${assignment.slice(0, separator)}=${quoteShell(assignment.slice(separator + 1))}`;
    })
    .join(" ");
}

function bashPath(path: string) {
  const windows = path.match(/^([A-Za-z]):\\(.*)$/);
  return windows
    ? `/mnt/${windows[1].toLowerCase()}/${windows[2].replaceAll("\\", "/")}`
    : path;
}

function validate(channel?: string, service = "greyhoundiq-web-test") {
  const assignments = [
    ...baseAssignments.filter((item) => !item.startsWith("PROD_SERVICE=")),
    `PROD_SERVICE=${service}`,
    "PATH=/usr/bin:/bin",
    "GCP_MONITORING_VALIDATE_ONLY=1",
    ...(channel === undefined ? [] : [`NOTIFICATION_CHANNEL=${channel}`]),
  ];
  return spawnSync("bash", ["-lc", `env ${assignmentSource(assignments)} bash ${script}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

const valid = validate(
  "projects/greyhoundiq-test/notificationChannels/channel-123",
);
assert.equal(valid.status, 0, valid.stderr);
assert.match(valid.stdout, /no Google Cloud command was run/);

const service49 = `a${"b".repeat(48)}`;
const service50 = `a${"b".repeat(49)}`;
const maxLength = validate(
  "projects/greyhoundiq-test/notificationChannels/channel-123",
  service49,
);
assert.equal(maxLength.status, 0, maxLength.stderr);
assert.match(maxLength.stdout, /no Google Cloud command was run/);
assert.notEqual(
  validate(
    "projects/greyhoundiq-test/notificationChannels/channel-123",
    service50,
  ).status,
  0,
);

for (const invalid of [
  undefined,
  "projects/greyhoundiq-test/notificationChannels/",
  "projects/greyhoundiq-test/notificationChannels/channel-123/extra",
  "projects/another-project/notificationChannels/channel-123",
  "projects/greyhoundiq-test/notificationChannels/invalid id",
  'projects/greyhoundiq-test/notificationChannels/invalid"id',
  "projects/greyhoundiq-test/notificationChannels/invalid\tid",
  "projects/greyhoundiq-test/notificationChannels/invalid\nid",
  "projects/greyhoundiq-test/notificationChannels/invalid%id",
  "projects/greyhoundiq-test/notificationChannels/invalid\\id",
  "projects/greyhoundiq-test/notificationChannels/invalid'id",
]) {
  const result = validate(invalid);
  assert.notEqual(result.status, 0, `accepted invalid channel: ${invalid}`);
}

const fixture = mkdtempSync(
  join(process.cwd(), "scripts", ".gcp-monitoring-test-"),
);
const fixtureBash = bashPath(fixture);
const fakeGcloud = join(fixture, "gcloud");
const fakeLog = join(fixture, "calls.log");
writeFileSync(
  fakeGcloud,
  `#!/usr/bin/env bash
set -u
printf '%s\\n' "$*" >> "$FAKE_GCLOUD_LOG"
case "$*" in
  "monitoring uptime list-configs"*)
    [[ "$FAKE_GCLOUD_FAIL" == "uptime" ]] && exit 9
    exit 0
    ;;
  "logging metrics list"*)
    [[ "$FAKE_GCLOUD_FAIL" == "metrics" ]] && exit 9
    exit 0
    ;;
  "beta monitoring policies list"*)
    [[ "$FAKE_GCLOUD_FAIL" == "policies" ]] && exit 9
    exit 0
    ;;
esac
if [[ " $* " == *" create "* || " $* " == *" update "* ]]; then
  printf 'MUTATION %s\\n' "$*" >> "$FAKE_GCLOUD_LOG"
fi
if [[ "$*" == "monitoring uptime create"* ]]; then
  printf 'projects/greyhoundiq-test/uptimeCheckConfigs/check-123\\n'
fi
`,
  "utf8",
);
chmodSync(fakeGcloud, 0o755);

try {
  for (const failure of ["uptime", "metrics", "policies"]) {
    writeFileSync(fakeLog, "", "utf8");
    const result = spawnSync(
      "bash",
      [
        "-lc",
        `env PATH=${quoteShell(`${fixtureBash}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`)} FAKE_GCLOUD_LOG=${quoteShell(`${fixtureBash}/calls.log`)} ${assignmentSource([
          ...baseAssignments,
          "NOTIFICATION_CHANNEL=projects/greyhoundiq-test/notificationChannels/channel-123",
          `FAKE_GCLOUD_FAIL=${failure}`,
        ])} bash ${script}`,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, `${failure} discovery failure was ignored`);
    assert.doesNotMatch(
      readFileSync(fakeLog, "utf8"),
      /^MUTATION /m,
      `${failure} discovery failure allowed a mutation`,
    );
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const source = readFileSync(script, "utf8");
assert.match(source, /\^\[A-Za-z0-9_-\]\+\$/);
assert.match(source, /if ! uptime_inventory=/);
assert.match(source, /if ! metric_names=/);
assert.match(source, /if ! policy_inventory=/);
assert.match(source, /gcloud logging metrics "\$action"/);
assert.match(source, /gcloud beta monitoring policies update "\$policy_names"/);
assert.match(source, /Duplicate alert policies require operator review/);
assert.doesNotMatch(source, /Policy already exists, skipping/);
assert.match(source, /greyhoundiq_prod_aggregate_refresh_completed/);
assert.match(source, /conditionAbsent/);
assert.match(source, /greyhoundiq_prod_aggregate_scheduler_failures/);
assert.match(source, /cloud\.scheduler\.logging\.AttemptFinished/);
assert.match(source, /greyhoundiq_prod_scheduled_task_attention/);
assert.match(source, /scheduled_task\.failed/);
assert.match(source, /scheduled_task\.overlap/);
assert.match(source, /greyhoundiq_prod_scheduler_failures/);
assert.match(source, /greyhoundiq_prod_usage_delivery_attention/);
assert.match(source, /usage_delivery\.attention/);
assert.match(source, /usage-delivery-attention\.json/);
assert.match(source, /usage-delivery-backlog-or-dead-letter/);
assert.match(source, /resource\.labels\.job_id=~\\"\^greyhoundiq-prod-/);
assert.match(source, /scheduled_task_absence=\(/);
for (const taskId of [
  "account-deletion",
  "agent-cleanup",
  "aggregate-refresh",
  "call-maintenance",
  "community-readiness",
  "dog-profile-sync",
  "listing-expiry",
  "live-sync",
  "media-maintenance",
  "memory-decay",
  "notification-delivery",
  "usage-delivery",
]) {
  assert.match(source, new RegExp(`"${taskId}:\\d+"`));
}
assert.match(source, /scheduled_task\.completed/);
assert.match(source, /scheduled-task-failure-or-missed-run/);

console.log("GCP monitoring source tests passed");
