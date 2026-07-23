import { CheckCircle2, CircleDashed, Flag, LockKeyhole } from "lucide-react";
import Link from "next/link";

import {
  GREYHOUNDIQ_ARCHITECTURE_TASKS,
  type ArchitectureTaskStatus,
} from "./design-lab-architecture-plan";
import { DESIGN_LAB_SYNC_SNAPSHOT } from "./design-lab-sync";
import { designLabAreaHref } from "./design-lab-workspace";

const FINISH_LINE_TASK_IDS = [
  "ARCH-105",
  "ARCH-201",
  "ARCH-308",
  "ARCH-402",
  "ARCH-408",
  "ARCH-705",
  "ARCH-708",
] as const;

const FINISH_LINE_TASKS = FINISH_LINE_TASK_IDS.map((id) =>
  GREYHOUNDIQ_ARCHITECTURE_TASKS.find((task) => task.id === id),
).filter((task) => task !== undefined);

export function DesignLabDeploymentRace({ basePath }: { basePath: string }) {
  const completed = DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks;
  const total = DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks;
  const remaining = DESIGN_LAB_SYNC_SNAPSHOT.release.openChecks;
  const progress = total === 0 ? 0 : (completed / total) * 100;
  const displayProgress = progress.toFixed(1);
  const runnerPosition = Math.min(94, Math.max(6, progress));
  const releaseReady =
    DESIGN_LAB_SYNC_SNAPSHOT.release.status === "ready-for-approval";
  const productOpen =
    DESIGN_LAB_SYNC_SNAPSHOT.release.masterBlockers.find(
      (blocker) => blocker.prompt === "product",
    )?.remaining ?? 0;
  const securityOpen =
    DESIGN_LAB_SYNC_SNAPSHOT.release.masterBlockers.find(
      (blocker) => blocker.prompt === "security",
    )?.remaining ?? 0;
  const screenOpen = DESIGN_LAB_SYNC_SNAPSHOT.release.blockers.reduce(
    (sum, blocker) => sum + blocker.remaining,
    0,
  );
  const stagingOpen = DESIGN_LAB_SYNC_SNAPSHOT.release.preproductionBlockers.reduce(
    (sum, blocker) => sum + blocker.remaining,
    0,
  );
  const databaseOpen =
    DESIGN_LAB_SYNC_SNAPSHOT.release.databaseBlocker?.remaining ?? 0;

  return (
    <section
      className="giq-panel relative overflow-hidden p-4 sm:p-6"
      aria-labelledby="design-lab-deployment-race-heading"
      data-design-lab-deployment-race
      data-release-progress={displayProgress}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2 rounded-full bg-emerald-300 shadow-[0_0_12px_hsl(150_75%_55%/0.8)]"
                aria-hidden="true"
              />
              Canonical registry sync
            </span>
            <span className="text-[hsl(var(--subtle-foreground))]">
              Web MVP · native apps post-MVP
            </span>
          </div>
          <h2
            id="design-lab-deployment-race-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
          >
            Road to the production finish line
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Every metre comes from the same fail-closed screen, product,
            security, managed-service and database registries used by the
            release command. Documentation alone never moves the greyhound.
          </p>
        </div>

        <div className="min-w-52 rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
            Team deployment target
          </p>
          <p className="mt-1 text-sm font-semibold text-amber-100">
            {releaseReady
              ? `${DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.window} · approval window open`
              : `${DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.window} · ${remaining.toLocaleString("en-AU")} checks remain`}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
            {releaseReady
              ? "The exact immutable candidate can enter protected human approval."
              : `${DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.teamSeats}-agent finish-line push active. Promotion stays locked until staging, security, provider and recovery evidence passes.`}
          </p>
        </div>
      </div>

      <div
        className="relative mt-6 h-40 overflow-hidden rounded-2xl border border-white/[0.09] bg-[radial-gradient(circle_at_76%_42%,hsl(var(--secondary)/0.12),transparent_26%),linear-gradient(180deg,hsl(var(--primary)/0.14),transparent_55%),hsl(var(--card)/0.7)] sm:h-44"
        role="progressbar"
        aria-label="GreyhoundIQ verified production gate progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={`${completed} of ${total} verified, ${remaining} remaining`}
      >
        <div
          className="absolute inset-x-5 bottom-11 border-t border-dashed border-white/[0.07] sm:inset-x-8"
          aria-hidden="true"
        />
        <div className="absolute inset-x-5 bottom-7 h-2 overflow-hidden rounded-full bg-white/[0.08] sm:inset-x-8">
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--secondary)),hsl(var(--primary-light)),hsl(var(--success)))] shadow-[0_0_18px_hsl(var(--primary-light)/0.35)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          className="absolute bottom-10 w-56 -translate-x-1/2 transition-[left] duration-700 sm:w-80"
          style={{ left: `${runnerPosition}%` }}
          data-greyhound-progress-runner
        >
          <span
            className="absolute left-[-48%] top-[48%] -z-10 h-px w-[76%] bg-gradient-to-r from-transparent via-fuchsia-400/55 to-amber-200/80 shadow-[0_0_14px_hsl(var(--secondary)/0.6)]"
            aria-hidden="true"
          />
          <span
            className="absolute left-[-34%] top-[62%] -z-10 h-px w-[58%] bg-gradient-to-r from-transparent via-violet-400/35 to-transparent"
            aria-hidden="true"
          />
          <svg
            viewBox="0 0 2172 724"
            className="h-auto w-full overflow-visible drop-shadow-[0_10px_10px_rgba(0,0,0,0.48)]"
            role="img"
            aria-labelledby="greyhoundiq-progress-runner-title"
          >
            <title id="greyhoundiq-progress-runner-title">
              GreyhoundIQ runner racing toward the production finish line
            </title>
            <defs>
              <filter
                id="greyhoundiq-progress-runner-mask-key"
                x="0"
                y="0"
                width="2172"
                height="724"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -0.333 -0.333 -0.333 0 1"
                />
                <feComponentTransfer>
                  <feFuncA
                    type="linear"
                    slope="14"
                    intercept="-0.98"
                  />
                </feComponentTransfer>
              </filter>
              <mask
                id="greyhoundiq-progress-runner-mask"
                x="0"
                y="0"
                width="2172"
                height="724"
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                style={{ maskType: "alpha" }}
              >
                <image
                  href="/images/brand/greyhoundiq-progress-runner.png"
                  width="2172"
                  height="724"
                  preserveAspectRatio="xMidYMid meet"
                  filter="url(#greyhoundiq-progress-runner-mask-key)"
                />
              </mask>
            </defs>
            <g mask="url(#greyhoundiq-progress-runner-mask)">
              <image
                href="/images/brand/greyhoundiq-progress-runner.png"
                width="2172"
                height="724"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          </svg>
          <span className="mx-auto mt-0.5 block w-fit rounded-full border border-amber-200/20 bg-black/45 px-2 py-0.5 text-center text-[9px] font-black tabular-nums text-amber-100 shadow-[0_5px_16px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            {displayProgress}%
          </span>
        </div>

        <div className="absolute inset-y-0 right-4 flex w-8 flex-col items-center justify-end pb-4 sm:right-7">
          <Flag className="mb-1 size-5 text-amber-200" aria-hidden="true" />
          <span
            className="h-20 w-3 rounded-sm border border-white/20"
            style={{
              backgroundImage:
                "conic-gradient(#fff 25%, #17131f 0 50%, #fff 0 75%, #17131f 0)",
              backgroundSize: "8px 8px",
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RaceMetric label="Verified" value={completed.toLocaleString("en-AU")} />
        <RaceMetric label="MVP open" value={remaining.toLocaleString("en-AU")} />
        <RaceMetric label="MVP total" value={total.toLocaleString("en-AU")} />
        <RaceMetric
          label="Native post-MVP"
          value={String(DESIGN_LAB_SYNC_SNAPSHOT.preproduction.postMvpTotal)}
        />
      </dl>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Open MVP lanes</h3>
            <Link
              href={designLabAreaHref(basePath, "requirements")}
              prefetch={false}
              className="text-[10px] font-bold text-[hsl(var(--primary-light))] underline-offset-4 hover:underline"
            >
              Open all {remaining.toLocaleString("en-AU")} checks
            </Link>
          </div>
          <div className="mt-3 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            <RaceLane label="Screen journeys" value={screenOpen} />
            <RaceLane label="Development and product" value={productOpen} />
            <RaceLane label="Security engineering" value={securityOpen} />
            <RaceLane label="Managed staging and providers" value={stagingOpen} />
            <RaceLane label="Database operation contracts" value={databaseOpen} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Critical path to deployment</h3>
            <Link
              href={designLabAreaHref(basePath, "architecture")}
              prefetch={false}
              className="text-[10px] font-bold text-[hsl(var(--primary-light))] underline-offset-4 hover:underline"
            >
              Architecture control room
            </Link>
          </div>
          <ol className="mt-3 grid gap-2">
            {FINISH_LINE_TASKS.map((task) => (
              <li
                key={task.id}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                data-finish-line-task={task.id}
              >
                {task.status === "verified" ? (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-emerald-200"
                    aria-hidden="true"
                  />
                ) : task.status === "blocked" ? (
                  <LockKeyhole
                    className="mt-0.5 size-4 shrink-0 text-rose-200"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleDashed
                    className="mt-0.5 size-4 shrink-0 text-amber-100"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[9px] text-[hsl(var(--primary-light))]">
                      {task.id}
                    </span>
                    <TaskStatus status={task.status} />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold leading-5">
                    {task.title}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function RaceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
      <dt className="text-[9px] font-black uppercase tracking-[0.11em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function RaceLane({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-2 text-[11px]">
      <dt className="text-[hsl(var(--muted-foreground))]">{label}</dt>
      <dd className="font-semibold tabular-nums text-amber-100">
        {value.toLocaleString("en-AU")} open
      </dd>
    </div>
  );
}

function TaskStatus({ status }: { status: ArchitectureTaskStatus }) {
  return (
    <span className="rounded-full border border-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
      {status}
    </span>
  );
}
