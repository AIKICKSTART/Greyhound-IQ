"use client";

import { Copy, FlaskConical, ShieldCheck, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  DESIGN_LAB_SCENARIO_DIMENSIONS,
  DESIGN_LAB_SCENARIO_GROUPS,
  type DesignLabScenarioGroupId,
  type DesignLabScenarioKey,
} from "./design-lab-scenario-contract";
import {
  buildDesignLabScenarioUrl,
  getDesignLabScenarioOption,
  resolveDesignLabScenarioState,
  type DesignLabScenarioState,
} from "./design-lab-scenario-state";
import {
  DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS,
  DESIGN_LAB_ONBOARDING_DEVICE_QUERY,
  DESIGN_LAB_ONBOARDING_TARGET_MODES,
  DESIGN_LAB_ONBOARDING_TARGET_QUERY,
  buildDesignLabOnboardingPreviewUrl,
  resolveDesignLabOnboardingDevice,
  resolveDesignLabOnboardingTargetMode,
} from "./design-lab-onboarding-preview";
import { resolveContextualOnboardingPreview } from "./onboarding-tour-registry";
import { DesignLabOnboardingDisclosureTargets } from "./design-lab-onboarding-disclosure-targets";

const BUSY_STATES = new Set([
  "initial-loading",
  "background-refresh",
  "skeleton",
  "delayed",
  "mutation-pending",
]);
const EMPTY_STATES = new Set(["empty", "no-results"]);
const MEDIA_STATES = new Set(["missing-media", "broken-media"]);

const SCENARIO_ACTION_CONTRACT_IDS = {
  fixture: "DL.ACTION.SCENARIO.FIXTURE.SELECT",
  tier: "DL.ACTION.SCENARIO.TIER.SELECT",
  auth: "DL.ACTION.SCENARIO.AUTH.SELECT",
  permissions: "DL.ACTION.SCENARIO.PERMISSIONS.SELECT",
  featureFlags: "DL.ACTION.SCENARIO.FEATUREFLAGS.SELECT",
  orientation: "DL.ACTION.SCENARIO.ORIENTATION.SELECT",
  navigation: "DL.ACTION.SCENARIO.NAVIGATION.SELECT",
  theme: "DL.ACTION.SCENARIO.THEME.SELECT",
  sponsoredDemo: "DL.ACTION.SCENARIO.SPONSOREDDEMO.SELECT",
  dataState: "DL.ACTION.SCENARIO.DATASTATE.SELECT",
  networkState: "DL.ACTION.SCENARIO.NETWORKSTATE.SELECT",
  errorState: "DL.ACTION.SCENARIO.ERRORSTATE.SELECT",
  longContent: "DL.ACTION.SCENARIO.LONGCONTENT.SELECT",
  missingImage: "DL.ACTION.SCENARIO.MISSINGIMAGE.SELECT",
  tour: "DL.ACTION.SCENARIO.TOUR.SELECT",
  tourStep: "DL.ACTION.SCENARIO.TOURSTEP.SELECT",
  reducedMotion: "DL.ACTION.SCENARIO.REDUCEDMOTION.SELECT",
  highContrast: "DL.ACTION.SCENARIO.HIGHCONTRAST.SELECT",
} satisfies Record<DesignLabScenarioKey, string>;

export function DesignLabScenarioControls() {
  const searchParams = useSearchParams();
  const scenario = resolveDesignLabScenarioState(searchParams);
  const selectedRoute = searchParams.get("route");
  const onboardingDevice = resolveDesignLabOnboardingDevice(
    searchParams.get(DESIGN_LAB_ONBOARDING_DEVICE_QUERY),
  );
  const onboardingTargetMode = resolveDesignLabOnboardingTargetMode(
    searchParams.get(DESIGN_LAB_ONBOARDING_TARGET_QUERY),
    scenario.errorState,
  );
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "unavailable" | "failed"
  >("idle");
  const [destructivePreview, setDestructivePreview] = useState(false);

  function updateScenario(key: DesignLabScenarioKey, value: string) {
    setCopyStatus("idle");
    setDestructivePreview(false);
    window.history.pushState(
      null,
      "",
      buildDesignLabScenarioUrl(window.location.href, { [key]: value }),
    );
  }

  function updateOnboardingPreview(
    patch: Parameters<typeof buildDesignLabOnboardingPreviewUrl>[1],
  ) {
    setCopyStatus("idle");
    window.history.pushState(
      null,
      "",
      buildDesignLabOnboardingPreviewUrl(window.location.href, patch),
    );
  }

  async function copyReviewUrl() {
    if (!navigator.clipboard) {
      setCopyStatus("unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <section
      className="giq-panel mt-5 overflow-hidden p-4 sm:p-6"
      aria-labelledby="design-lab-scenario-heading"
      data-design-lab-scenario-controls
      data-scenario-fixture={scenario.fixture}
      data-scenario-tier={scenario.tier}
      data-scenario-auth={scenario.auth}
      data-scenario-permissions={scenario.permissions}
      data-scenario-state={scenario.dataState}
      data-scenario-network={scenario.networkState}
      data-scenario-error={scenario.errorState}
      data-scenario-tour={scenario.tour}
      data-scenario-tour-step={scenario.tourStep}
      data-onboarding-preview-device={onboardingDevice.id}
      data-onboarding-preview-target={onboardingTargetMode}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
            <FlaskConical className="size-4" aria-hidden="true" />
            Synthetic scenario simulator
          </p>
          <h2
            id="design-lab-scenario-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
          >
            Reproduce access, content and failure states
          </h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Every control changes an allowlisted, synthetic review state and
            persists it in this URL. It never changes production identity,
            permissions, billing, records or feature flags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="giq-outline-action min-h-11 px-4 text-sm font-semibold"
            onClick={copyReviewUrl}
            data-scenario-copy-url
          >
            <Copy className="size-4" aria-hidden="true" />
            Copy review URL
          </button>
          <span
            className="min-w-24 text-[10px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]"
            aria-live="polite"
          >
            {copyStatus === "copied" ? "URL copied" : null}
            {copyStatus === "unavailable" ? "Clipboard unavailable" : null}
            {copyStatus === "failed" ? "Copy failed" : null}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div className="grid gap-4 lg:grid-cols-2">
          {DESIGN_LAB_SCENARIO_GROUPS.map((group) => (
            <ScenarioControlGroup
              key={group.id}
              group={group}
              scenario={scenario}
              onChange={updateScenario}
            />
          ))}
          <OnboardingPreviewControlGroup
            device={onboardingDevice}
            targetMode={onboardingTargetMode}
            onChange={updateOnboardingPreview}
          />
          <DesignLabOnboardingDisclosureTargets />
        </div>

        <ScenarioPreview
          scenario={scenario}
          selectedRoute={selectedRoute}
          onboardingDevice={onboardingDevice}
          onboardingTargetMode={onboardingTargetMode}
          destructivePreview={destructivePreview}
          onSimulateDestructive={() => setDestructivePreview(true)}
        />
      </div>
    </section>
  );
}

function OnboardingPreviewControlGroup({
  device,
  targetMode,
  onChange,
}: {
  device: (typeof DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS)[number];
  targetMode: (typeof DESIGN_LAB_ONBOARDING_TARGET_MODES)[number]["id"];
  onChange: (
    patch: Parameters<typeof buildDesignLabOnboardingPreviewUrl>[1],
  ) => void;
}) {
  return (
    <fieldset
      className="min-w-0 rounded-xl border border-[hsl(var(--primary-light)/0.22)] bg-[hsl(var(--primary)/0.055)] p-3.5 lg:col-span-2"
      data-design-lab-onboarding-preview-controls
    >
      <legend className="px-1 text-[11px] font-black uppercase tracking-[0.11em] text-white">
        Onboarding preview matrix
      </legend>
      <p className="px-1 text-[10px] leading-5 text-[hsl(var(--subtle-foreground))]">
        Combine the route selector with Permissions, Onboarding tour and Tour
        step above, then choose each canonical device and primary-target state.
        These controls remain synthetic and never write tour completion.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.09em] text-[hsl(var(--muted-foreground))]">
            Device size
          </span>
          <select
            className="giq-form-control min-h-11 w-full px-3 text-xs"
            value={device.id}
            onChange={(event) => onChange({ device: event.target.value })}
            data-design-lab-onboarding-control="device"
          >
            {DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.width} × {option.height}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.09em] text-[hsl(var(--muted-foreground))]">
            Step target
          </span>
          <select
            className="giq-form-control min-h-11 w-full px-3 text-xs"
            value={targetMode}
            onChange={(event) =>
              onChange({ targetMode: event.target.value })
            }
            data-design-lab-onboarding-control="targetMode"
          >
            {DESIGN_LAB_ONBOARDING_TARGET_MODES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

function ScenarioControlGroup({
  group,
  scenario,
  onChange,
}: {
  group: (typeof DESIGN_LAB_SCENARIO_GROUPS)[number];
  scenario: DesignLabScenarioState;
  onChange: (key: DesignLabScenarioKey, value: string) => void;
}) {
  const dimensions = DESIGN_LAB_SCENARIO_DIMENSIONS.filter(
    (dimension) => dimension.group === group.id,
  );

  return (
    <fieldset
      className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5"
      data-scenario-group={group.id}
    >
      <legend className="px-1 text-[11px] font-black uppercase tracking-[0.11em] text-white">
        {group.label}
      </legend>
      <p className="px-1 text-[10px] leading-5 text-[hsl(var(--subtle-foreground))]">
        {group.description}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {dimensions.map((dimension) => (
          <label key={dimension.key} className="min-w-0">
            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.09em] text-[hsl(var(--muted-foreground))]">
              {dimension.label}
            </span>
            <select
              className="giq-form-control min-h-11 w-full px-3 text-xs"
              name={dimension.queryParam}
              value={scenario[dimension.key]}
              onChange={(event) =>
                onChange(dimension.key, event.target.value)
              }
              data-design-lab-scenario-control={dimension.key}
              data-scenario-query-param={dimension.queryParam}
              data-action-contract={
                SCENARIO_ACTION_CONTRACT_IDS[dimension.key]
              }
            >
              {dimension.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ScenarioPreview({
  scenario,
  selectedRoute,
  onboardingDevice,
  onboardingTargetMode,
  destructivePreview,
  onSimulateDestructive,
}: {
  scenario: DesignLabScenarioState;
  selectedRoute: string | null;
  onboardingDevice: (typeof DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS)[number];
  onboardingTargetMode: (typeof DESIGN_LAB_ONBOARDING_TARGET_MODES)[number]["id"];
  destructivePreview: boolean;
  onSimulateDestructive: () => void;
}) {
  const dataState = getDesignLabScenarioOption(
    "dataState",
    scenario.dataState,
  )!;
  const errorState = getDesignLabScenarioOption(
    "errorState",
    scenario.errorState,
  )!;
  const fixture = getDesignLabScenarioOption("fixture", scenario.fixture)!;
  const isBusy = BUSY_STATES.has(scenario.dataState);
  const isEmpty = EMPTY_STATES.has(scenario.dataState);
  const isMediaMissing =
    scenario.missingImage === "on" || MEDIA_STATES.has(scenario.dataState);
  const longContent =
    scenario.longContent === "on" || scenario.dataState === "long-text";
  const contextualOnboardingPreview = scenario.tour.startsWith("tour:")
    ? resolveContextualOnboardingPreview({
        anonymous: scenario.auth === "signed-out",
        authenticated: scenario.auth === "signed-in" && scenario.permissions !== "none",
        route: selectedRoute,
        role: scenario.permissions,
        tourId: scenario.tour,
        step: scenario.tourStep,
        targetAvailable: onboardingTargetMode === "available",
      })
    : null;

  return (
    <aside
      className={`relative w-full min-w-0 justify-self-center overflow-hidden rounded-xl border p-4 transition-[max-width] ${
        scenario.highContrast === "on"
          ? "border-white bg-black text-white"
          : "border-white/[0.1] bg-[hsl(var(--surface-strong)/0.72)]"
      } ${scenario.orientation === "landscape" ? "2xl:self-start" : "2xl:min-h-[620px]"}`}
      aria-labelledby="scenario-preview-heading"
      aria-busy={isBusy}
      data-design-lab-scenario-preview
      data-fixture-state={scenario.dataState}
      data-network-state={scenario.networkState}
      data-error-state={scenario.errorState}
      data-reduced-motion={scenario.reducedMotion}
      data-high-contrast={scenario.highContrast}
      data-navigation-style={scenario.navigation}
      data-onboarding-device={onboardingDevice.id}
      data-onboarding-device-width={onboardingDevice.width}
      data-onboarding-device-height={onboardingDevice.height}
      data-onboarding-target-mode={onboardingTargetMode}
      data-destructive-simulation={destructivePreview ? "complete" : "idle"}
      style={{ maxWidth: Math.min(onboardingDevice.width, 720) }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[hsl(var(--secondary-light))]">
            Live synthetic preview
          </p>
          <h3 id="scenario-preview-heading" className="mt-1 text-lg font-semibold">
            {fixture.label}
          </h3>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em]">
          {onboardingDevice.label} · {onboardingDevice.width}px
        </span>
      </div>

      {scenario.networkState !== "online" ? (
        <p
          className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs text-amber-100"
          role="status"
        >
          {scenario.networkState === "offline"
            ? "Offline fixture: cached guidance remains visible; no request is sent. Reconnect, then refresh live information."
            : "Slow-network fixture: delayed feedback is simulated locally."}
        </p>
      ) : null}

      {scenario.errorState !== "none" ? (
        <div
          className="mt-4 rounded-lg border border-rose-300/25 bg-rose-300/[0.07] p-3"
          role="alert"
        >
          <strong className="text-sm text-rose-100">{errorState.label}</strong>
          <p className="mt-1 text-xs leading-5 text-rose-100/80">
            {errorState.description} This is presentation-only and grants no
            access.
          </p>
          {errorState.recovery ? (
            <p className="mt-2 text-xs font-medium leading-5 text-rose-100">
              Next step: {errorState.recovery}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
          {dataState.label}
        </p>
        {isBusy ? <ScenarioSkeleton /> : null}
        {isEmpty ? (
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
            {scenario.dataState === "no-results"
              ? "No synthetic records match this review query."
              : "This synthetic collection is empty."}
          </p>
        ) : null}
        {!isBusy && !isEmpty ? (
          <div className="mt-3 grid gap-3">
            {isMediaMissing ? (
              <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-white/15 text-xs text-[hsl(var(--muted-foreground))]">
                Synthetic media fallback
              </div>
            ) : (
              <div className="h-28 rounded-lg bg-[linear-gradient(135deg,hsl(var(--primary)/0.4),hsl(var(--secondary)/0.18))]" />
            )}
            <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              {fixture.description} {dataState.description}
              {longContent
                ? " Extended synthetic copy verifies wrapping, vertical growth, truncation boundaries and readable action placement without using private content."
                : ""}
            </p>
            {scenario.dataState === "large-volume" ? (
              <p className="rounded-md bg-white/[0.04] p-2 text-[10px] font-bold uppercase tracking-[0.08em]">
                250 synthetic rows represented
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {contextualOnboardingPreview?.status === "available" ? (
        <div className="mt-4 rounded-lg border border-[hsl(var(--primary-light)/0.35)] bg-[hsl(var(--primary)/0.1)] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[hsl(var(--primary-light))]">
            {contextualOnboardingPreview.tour.pageLabel} · step {contextualOnboardingPreview.stepNumber}
          </p>
          <strong className="mt-2 block text-sm text-[hsl(var(--foreground))]">
            {contextualOnboardingPreview.step.title}
          </strong>
          <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
            {contextualOnboardingPreview.step.body}
          </p>
          <p className="mt-2 text-[10px] leading-5 text-[hsl(var(--subtle-foreground))]">
            Target: {contextualOnboardingPreview.resolvedTargetId}
            {contextualOnboardingPreview.usedFallback
              ? ` (safe fallback for ${contextualOnboardingPreview.requestedTargetId})`
              : ""}
            . Synthetic preview only; no completion is written to an account.
          </p>
        </div>
      ) : contextualOnboardingPreview?.status === "unavailable" ? (
        <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] p-3">
          <p className="text-xs leading-5 text-amber-100">
            {contextualOnboardingPreview.message} No protected route details are
            disclosed.
          </p>
        </div>
      ) : scenario.tour !== "off" ? (
        <div className="mt-4 rounded-lg border border-[hsl(var(--primary-light)/0.35)] bg-[hsl(var(--primary)/0.1)] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[hsl(var(--primary-light))]">
            {scenario.tour} tour · step {scenario.tourStep}
          </p>
          <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
            Synthetic onboarding guidance. No completion is written to an
            account.
          </p>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
        <ScenarioDatum label="Auth" value={scenario.auth} />
        <ScenarioDatum label="Permissions" value={scenario.permissions} />
        <ScenarioDatum label="Feature profile" value={scenario.featureFlags} />
        <ScenarioDatum label="Sponsored" value={scenario.sponsoredDemo} />
        <ScenarioDatum
          label="Target mode"
          value={onboardingTargetMode}
        />
      </dl>

      <button
        type="button"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.06] px-3 text-xs font-bold text-rose-100"
        onClick={onSimulateDestructive}
        data-scenario-simulate-destructive
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Simulate destructive action
      </button>
      <p className="mt-2 flex items-start gap-2 text-[10px] leading-5 text-[hsl(var(--subtle-foreground))]">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {destructivePreview
          ? "Simulation complete. No record, account or external system changed."
          : "Simulation only. This control has no server action or mutation path."}
      </p>
    </aside>
  );
}

function ScenarioSkeleton() {
  return (
    <div className="mt-3 grid gap-2" aria-label="Synthetic loading skeleton">
      <span className="h-20 rounded-lg bg-white/[0.07]" />
      <span className="h-3 w-4/5 rounded-full bg-white/[0.07]" />
      <span className="h-3 w-3/5 rounded-full bg-white/[0.07]" />
    </div>
  );
}

function ScenarioDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2">
      <dt className="font-black uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[hsl(var(--foreground))]">{value}</dd>
    </div>
  );
}

export function DesignLabScenarioControlsFallback() {
  return (
    <section
      className="giq-panel mt-5 min-h-48 animate-pulse p-4 sm:p-6"
      aria-label="Loading synthetic scenario simulator"
    />
  );
}

export const DESIGN_LAB_SCENARIO_CONTROL_GROUP_IDS =
  DESIGN_LAB_SCENARIO_GROUPS.map((group) => group.id) as readonly DesignLabScenarioGroupId[];
