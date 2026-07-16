"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  History,
  LayoutGrid,
  LifeBuoy,
  MessageSquare,
  Navigation,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import {
  DEFAULT_INTERACTIVE_HELP_STATE,
  DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
  INTERACTIVE_HELP_EVENT,
  INTERACTIVE_HELP_INTENT_EVENT,
  INTERACTIVE_HELP_PROGRESS_EVENT,
  INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX,
  INTERACTIVE_HELP_STORAGE_KEY,
  buildLegacyInteractiveHelpProgressStorageKey,
  buildInteractiveHelpProgressStorageKey,
  buildInteractiveHelpIntentStorageKey,
  listRecentlyCompletedInteractiveHelpTours,
  parseInteractiveHelpProgressStorageKey,
  parseInteractiveHelpProgressState,
  parseInteractiveHelpIntent,
  parseInteractiveHelpState,
  reduceInteractiveHelpProgressState,
  reduceInteractiveHelpState,
  resolveInteractiveHelpProductArea,
  serializeInteractiveHelpProgressState,
  serializeInteractiveHelpState,
  type InteractiveHelpAction,
  type InteractiveHelpProgressAction,
  type InteractiveHelpIntent,
  type RecentlyCompletedInteractiveHelpTour,
} from "@/components/interactive-help-state";
import {
  resolveInteractiveHelpPopupLayout,
  resolveInteractiveHelpTargetSide,
  type InteractiveHelpTargetBounds,
  type InteractiveHelpTargetSide,
  type InteractiveHelpViewport,
} from "@/components/interactive-help-layout";
import { queueOnboardingAnalyticsEvent } from "@/components/onboarding-analytics-client";
import {
  isAllowedOnboardingRevealController,
  resolveOnboardingRevealKind,
  type OnboardingRevealKind,
} from "@/components/onboarding-target-disclosure";
import {
  ONBOARDING_ANALYTICS_LEGACY_STEP_IDS,
  ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  ONBOARDING_ANALYTICS_SCHEMA_VERSION,
} from "@/components/onboarding-analytics";
import { ONBOARDING_HELP_TOUR_CATALOGUE } from "@/components/onboarding-help-catalogue";
import {
  onboardingScrollBehavior,
  resolveContextualOnboardingTour,
  type AdminOnboardingIcon,
  type OnboardingTargetId,
} from "@/components/onboarding-tour-registry";
import styles from "./interactive-help.module.css";

type HelpStep = {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  icon: LucideIcon;
  id?: string;
  title: string;
  targetId?: OnboardingTargetId;
  fallbackTargetId?: OnboardingTargetId;
};

type RecentlyCompletedHelpTour = RecentlyCompletedInteractiveHelpTour & {
  href: string | null;
  pageLabel: string;
};

const ADMIN_ONBOARDING_ICONS: Record<AdminOnboardingIcon, LucideIcon> = {
  sparkles: Sparkles,
  navigation: Navigation,
  user: UserRound,
  layout: LayoutGrid,
  shield: ShieldCheck,
};

const HELP_STEPS: readonly HelpStep[] = [
  {
    id: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0],
    icon: Sparkles,
    title: "Welcome to your race-day workspace",
    body: "GreyhoundIQ brings Australian race cards, form, dogs, community, marketplace and account tools into one signed-in experience.",
  },
  {
    id: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[1],
    icon: Navigation,
    title: "Move through racing intelligence",
    body: "Use Racing for cards and results, then Tracks, Dogs, Breeding and Statistics for deeper context. On mobile, these live in Menu; tablet and desktop keep the full navigation visible.",
    actionHref: "/races",
    actionLabel: "Open races",
  },
  {
    id: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[2],
    icon: MessageSquare,
    title: "Create and join the conversation",
    body: "Feed is the working stream for kennel updates, analysis and marketplace context. The Post action jumps directly to the composer, while Chat keeps private conversations close.",
    actionHref: "/feed#feed-composer",
    actionLabel: "Open the composer",
  },
  {
    id: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[3],
    icon: LayoutGrid,
    title: "Use the dock and complete menu",
    body: "The persistent dock covers Home, Feed, Post and Chat. Menu opens the complete screen map, including account and administration destinations available to your role.",
  },
  {
    id: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[4],
    icon: UserRound,
    title: "Your help stays under your control",
    body: "Open Account > Support to turn guided help on or off, restart this tour, or reset completed walkthroughs. While help is enabled, the Guide button keeps it close at hand.",
    actionHref: "/account",
    actionLabel: "Open account",
  },
] as const;

const ONBOARDING_INTENT_OPTIONS = [
  {
    id: "racing",
    label: "Racing and form",
    href: "/races",
    summary: "Race cards, results, tracks, dogs and form context.",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    href: "/marketplace",
    summary: "Listings, saved items, seller context and enquiries.",
  },
  {
    id: "community",
    label: "Community and messaging",
    href: "/feed",
    summary: "Feed, groups, forums and private conversation controls.",
  },
  {
    id: "account",
    label: "Account and billing",
    href: "/account",
    summary: "Security, privacy, billing, usage and support.",
  },
  {
    id: "agents",
    label: "AI agents",
    href: "/agents",
    summary: "Available workflows, run lifecycle and responsible use.",
  },
] as const satisfies readonly {
  href: string;
  id: InteractiveHelpIntent;
  label: string;
  summary: string;
}[];

let memorySnapshot = "";
const progressMemorySnapshots = new Map<string, string>();
const intentMemorySnapshots = new Map<string, string>();
let interactiveHelpOwner: string | null = null;
const interactiveHelpOwnerListeners = new Set<() => void>();
const SERVER_INTERACTIVE_HELP_SNAPSHOT = serializeInteractiveHelpState({
  completed: true,
  enabled: false,
});

export function InteractiveHelp({
  allowAutomaticOpen = true,
  allowContextualAutomaticOpen = allowAutomaticOpen,
  firstName,
  profileScope,
  role,
  showFloatingLauncher = true,
  tier,
}: {
  allowAutomaticOpen?: boolean;
  allowContextualAutomaticOpen?: boolean;
  firstName: string;
  profileScope?: string | null;
  role?: string | null;
  showFloatingLauncher?: boolean;
  tier?: string | null;
}) {
  const pathname = usePathname();
  const coachmarkDescriptionId = useId();
  const coachmarkTitleId = useId();
  const authenticated =
    role === "visitor" ? false : Boolean(profileScope?.trim() || role?.trim());
  const routeTour = resolveContextualOnboardingTour(pathname, {
    authenticated,
    role,
  });
  const progressStorageKey = routeTour
    ? buildInteractiveHelpProgressStorageKey({
        productArea: resolveInteractiveHelpProductArea(routeTour.tourId),
        profileScope,
        role: role ?? "visitor",
        route: routeTour.route,
        tier: tier ?? "free",
        tourId: routeTour.tourId,
        version: routeTour.version,
      })
    : null;
  const legacyProgressStorageKey = routeTour
    ? buildLegacyInteractiveHelpProgressStorageKey({
        profileScope,
        route: routeTour.route,
        tourId: routeTour.tourId,
        version: routeTour.version,
      })
    : null;
  const routeProgress = useInteractiveHelpProgress(
    progressStorageKey,
    legacyProgressStorageKey,
  );
  const routeSteps: readonly HelpStep[] = routeTour
    ? routeTour.steps.map((item) => ({
        ...item,
        icon: ADMIN_ONBOARDING_ICONS[item.icon],
      }))
    : [];
  const activeSteps = routeTour ? routeSteps : HELP_STEPS;
  const [legacyStepIndex, setLegacyStepIndex] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<
    | "resolving"
    | "primary"
    | "revealing"
    | "controller"
    | "fallback"
    | "missing"
  >("resolving");
  const [targetSide, setTargetSide] = useState<InteractiveHelpTargetSide>(null);
  const [targetBounds, setTargetBounds] =
    useState<InteractiveHelpTargetBounds | null>(null);
  const [resolvedTargetKey, setResolvedTargetKey] = useState<string | null>(
    null,
  );
  const coachmarkRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const revealAttemptRef = useRef(new Set<string>());
  const wasOpenRef = useRef(false);
  const viewport = useInteractiveHelpViewport();
  const popupLayout = resolveInteractiveHelpPopupLayout(
    viewport,
    targetSide,
    targetBounds,
  );
  const mobileViewport = popupLayout.mobile;
  const reducedMotion = useReducedMotion();
  const state = useInteractiveHelpState();
  const legacyAutoOpen =
    allowAutomaticOpen && state.enabled && !state.completed;
  const routeAutoOpen = Boolean(
    routeTour &&
    allowContextualAutomaticOpen &&
    state.enabled &&
    routeProgress.enabled &&
    !routeProgress.completed &&
    !routeProgress.dismissed,
  );
  const autoOpen = routeTour ? routeAutoOpen : legacyAutoOpen;
  const open = state.enabled && (autoOpen || manualOpen);
  const requestedStepIndex = routeTour ? routeProgress.step : legacyStepIndex;
  const stepIndex = Math.min(
    activeSteps.length - 1,
    Math.max(0, requestedStepIndex),
  );
  const step = activeSteps[stepIndex];
  const targetResolutionKey = `${pathname}:${step.id ?? step.title}:${step.targetId ?? "viewport"}`;
  const coachmarkReady =
    !routeTour || !step.targetId || resolvedTargetKey === targetResolutionKey;
  const StepIcon = step.icon;
  const lastStep = stepIndex === activeSteps.length - 1;
  const analyticsTourId =
    routeTour?.tourId ?? ONBOARDING_ANALYTICS_LEGACY_TOUR_ID;
  const analyticsStepId =
    step.id ?? ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[stepIndex];
  const analyticsOpenTourRef = useRef<string | null>(null);
  const analyticsViewedStepRef = useRef<string | null>(null);

  useEffect(() => {
    revealAttemptRef.current.clear();
  }, [pathname, step.id]);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const action = (event as CustomEvent<InteractiveHelpAction>).detail;
      if (action !== "restart" && action !== "enable") return;
      if (action === "restart") {
        queueOnboardingAnalyticsEvent({
          schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
          event: "tour-restarted",
          tourId: analyticsTourId,
        });
      }
      if (progressStorageKey) {
        updateInteractiveHelpProgress(progressStorageKey, action);
      } else {
        setLegacyStepIndex(0);
      }
      setManualOpen(true);
    };
    window.addEventListener(INTERACTIVE_HELP_EVENT, handleAction);
    return () =>
      window.removeEventListener(INTERACTIVE_HELP_EVENT, handleAction);
  }, [analyticsTourId, progressStorageKey]);

  useEffect(() => {
    if (open && !coachmarkReady) return;
    if (open && coachmarkReady && !wasOpenRef.current) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      window.requestAnimationFrame(() => coachmarkRef.current?.focus());
    }
    if (!open && wasOpenRef.current) {
      const previousFocus = restoreFocusRef.current;
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
      });
    }
    wasOpenRef.current = open;
  }, [coachmarkReady, open]);

  useEffect(() => {
    if (!open || !step.targetId) {
      return;
    }

    let highlightedTarget: HTMLElement | null = null;
    let previousScrollMarginBlockEnd = "";
    let previousScrollMarginBlockStart = "";
    let scheduledFrame: number | null = null;
    const observer = new MutationObserver(scheduleResolution);

    function resolveTarget() {
      scheduledFrame = null;
      const primary = findVisibleOnboardingTarget(step.targetId!);
      const fallback = step.fallbackTargetId
        ? findVisibleOnboardingTarget(step.fallbackTargetId)
        : null;
      const revealController = primary
        ? null
        : findVisibleOnboardingRevealController(step.targetId!);
      const revealAttemptKey = `${analyticsTourId}:${step.id}:${step.targetId}`;
      if (revealController && !revealAttemptRef.current.has(revealAttemptKey)) {
        revealAttemptRef.current.add(revealAttemptKey);
        setTargetStatus("revealing");
        revealController.element.click();
        scheduleResolution();
        return;
      }
      const nextTarget = primary ?? revealController?.element ?? fallback;
      const nextTargetBounds = nextTarget?.getBoundingClientRect();
      const nextTargetSide = nextTargetBounds
        ? resolveInteractiveHelpTargetSide(
            viewport,
            nextTargetBounds.top + nextTargetBounds.height / 2,
          )
        : null;
      const nextTargetLayoutBounds = nextTargetBounds
        ? {
            bottom: nextTargetBounds.bottom,
            height: nextTargetBounds.height,
            left: nextTargetBounds.left,
            right: nextTargetBounds.right,
            top: nextTargetBounds.top,
            width: nextTargetBounds.width,
          }
        : null;
      setTargetStatus(
        primary
          ? "primary"
          : revealController
            ? "controller"
            : fallback
              ? "fallback"
              : "missing",
      );
      setResolvedTargetKey(targetResolutionKey);
      setTargetSide((current) =>
        current === nextTargetSide ? current : nextTargetSide,
      );
      setTargetBounds((current) =>
        sameTargetBounds(current, nextTargetLayoutBounds)
          ? current
          : nextTargetLayoutBounds,
      );

      if (nextTarget !== highlightedTarget) {
        releaseHighlightedTarget();
        highlightedTarget = nextTarget;
        if (highlightedTarget) {
          previousScrollMarginBlockEnd =
            highlightedTarget.style.scrollMarginBlockEnd;
          previousScrollMarginBlockStart =
            highlightedTarget.style.scrollMarginBlockStart;
          highlightedTarget.setAttribute("data-onboarding-active", "true");
          if (nextTargetSide === "upper") {
            highlightedTarget.style.scrollMarginBlockStart = "16px";
          } else if (nextTargetSide === "lower") {
            highlightedTarget.style.scrollMarginBlockEnd =
              "calc(var(--giq-mobile-dock-clearance) + 16px)";
          }
          highlightedTarget.scrollIntoView({
            behavior: onboardingScrollBehavior(reducedMotion),
            block: resolveInteractiveHelpPopupLayout(viewport, nextTargetSide)
              .scrollBlock,
            inline: "nearest",
          });
        }
      }

      if (primary) observer.disconnect();
    }

    function scheduleResolution() {
      if (scheduledFrame !== null) return;
      scheduledFrame = window.requestAnimationFrame(resolveTarget);
    }

    function releaseHighlightedTarget() {
      if (!highlightedTarget) return;
      highlightedTarget.removeAttribute("data-onboarding-active");
      highlightedTarget.style.scrollMarginBlockEnd =
        previousScrollMarginBlockEnd;
      highlightedTarget.style.scrollMarginBlockStart =
        previousScrollMarginBlockStart;
    }

    observer.observe(document.body, {
      attributeFilter: [
        "aria-hidden",
        "aria-selected",
        "class",
        "data-onboarding-controls",
        "data-onboarding-reveal",
        "data-onboarding-target",
        "hidden",
        "style",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
    window.addEventListener("scroll", scheduleResolution, true);
    scheduleResolution();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleResolution, true);
      if (scheduledFrame !== null) {
        window.cancelAnimationFrame(scheduledFrame);
      }
      releaseHighlightedTarget();
    };
  }, [
    analyticsTourId,
    open,
    reducedMotion,
    step.fallbackTargetId,
    step.id,
    step.targetId,
    targetResolutionKey,
    viewport,
  ]);

  const ownsInteractiveHelp = useInteractiveHelpOwner();

  useEffect(() => {
    if (!ownsInteractiveHelp || !open) {
      analyticsOpenTourRef.current = null;
      analyticsViewedStepRef.current = null;
      return;
    }
    if (analyticsOpenTourRef.current !== analyticsTourId) {
      queueOnboardingAnalyticsEvent({
        schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
        event: "tour-started",
        tourId: analyticsTourId,
      });
      analyticsOpenTourRef.current = analyticsTourId;
    }
    const viewedStepKey = `${analyticsTourId}:${analyticsStepId}`;
    if (analyticsViewedStepRef.current !== viewedStepKey) {
      queueOnboardingAnalyticsEvent({
        schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
        event: "step-viewed",
        tourId: analyticsTourId,
        stepId: analyticsStepId,
      });
      analyticsViewedStepRef.current = viewedStepKey;
    }
  }, [analyticsStepId, analyticsTourId, open, ownsInteractiveHelp]);

  if (!ownsInteractiveHelp) return null;

  function closeAndComplete() {
    queueOnboardingAnalyticsEvent({
      schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
      event: "tour-completed",
      tourId: analyticsTourId,
    });
    if (progressStorageKey) {
      updateInteractiveHelpProgress(progressStorageKey, {
        type: "complete",
        completedAt: Date.now(),
      });
    } else {
      updateInteractiveHelp("complete");
    }
    setManualOpen(false);
  }

  function dismissHelp() {
    queueOnboardingAnalyticsEvent({
      schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
      event: "tour-dismissed",
      tourId: analyticsTourId,
    });
    if (progressStorageKey) {
      updateInteractiveHelpProgress(progressStorageKey, "disable");
    }
    updateInteractiveHelp("disable");
    setResolvedTargetKey(null);
    setManualOpen(false);
  }

  function openHelp() {
    queueOnboardingAnalyticsEvent({
      schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
      event: "help-opened",
      tourId: analyticsTourId,
    });
    if (!state.enabled) updateInteractiveHelp("enable");
    setResolvedTargetKey(null);
    if (progressStorageKey) {
      updateInteractiveHelpProgress(progressStorageKey, "resume");
    } else {
      setLegacyStepIndex(0);
      if (!state.enabled) updateInteractiveHelp("enable");
    }
    setManualOpen(true);
  }

  function changeStep(nextStep: number) {
    const boundedStep = Math.min(activeSteps.length - 1, Math.max(0, nextStep));
    if (progressStorageKey) {
      updateInteractiveHelpProgress(progressStorageKey, {
        type: "set-step",
        step: boundedStep,
      });
    } else {
      setLegacyStepIndex(boundedStep);
    }
  }

  function skipCurrentStep() {
    queueOnboardingAnalyticsEvent({
      schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
      event: "step-skipped",
      tourId: analyticsTourId,
      stepId: analyticsStepId,
    });
    if (lastStep) {
      closeAndComplete();
      return;
    }
    if (progressStorageKey) {
      updateInteractiveHelpProgress(progressStorageKey, "next");
    } else {
      setLegacyStepIndex(stepIndex + 1);
    }
  }

  const helpEnabled =
    state.enabled && (progressStorageKey ? routeProgress.enabled : true);
  const displayFloatingLauncher =
    !open &&
    helpEnabled &&
    showFloatingLauncher &&
    (Boolean(routeTour) || role !== "visitor");

  return (
    <>
      {displayFloatingLauncher ? (
        <button
          type="button"
          onClick={openHelp}
          aria-label="Open guided help"
          className="fixed bottom-[calc(var(--giq-mobile-dock-clearance)+12px)] left-3 z-[72] inline-flex min-h-11 items-center gap-2 rounded-full border border-[hsl(var(--primary-light)/0.36)] bg-[hsl(var(--surface-1)/0.98)] px-3 text-[11px] font-bold text-[hsl(var(--foreground))] shadow-[0_14px_34px_hsl(0_0%_0%/0.44)] transition hover:border-[hsl(var(--primary-light)/0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))] md:bottom-5 md:left-5"
        >
          <CircleHelp
            className="size-4 text-[hsl(var(--primary-light))]"
            aria-hidden="true"
          />
          <span>Guide</span>
        </button>
      ) : null}

      {open ? (
        <aside
          ref={coachmarkRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={coachmarkTitleId}
          aria-describedby={coachmarkDescriptionId}
          aria-busy={!coachmarkReady}
          tabIndex={-1}
          data-help-layout={
            mobileViewport ? "coachmark-mobile" : "coachmark-desktop"
          }
          data-help-device={popupLayout.deviceClass}
          data-help-keyboard={popupLayout.keyboardOpen ? "open" : "closed"}
          data-help-placement={popupLayout.placement}
          data-help-ready={coachmarkReady ? "true" : "false"}
          data-help-target-side={targetSide ?? "none"}
          data-onboarding-route={routeTour?.route}
          data-onboarding-step={routeTour ? step.id : undefined}
          data-onboarding-target-status={routeTour ? targetStatus : undefined}
          data-onboarding-tour={routeTour?.tourId}
          style={{
            "--help-arrow-offset": `${popupLayout.arrowOffset ?? 0}px`,
            left: popupLayout.left,
            maxHeight: popupLayout.maxHeight,
            top: popupLayout.top,
            transform: popupLayout.transform,
            width: popupLayout.width,
          } as CSSProperties}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            dismissHelp();
          }}
          className={`${styles.popup} giq-interactive-help-popup z-[80] rounded-2xl border border-white/[0.14] bg-[hsl(var(--surface-1))] shadow-[0_18px_46px_hsl(0_0%_0%/0.48)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]`}
        >
          <div className={styles.content}>
            <header className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[hsl(var(--secondary)/0.28)] bg-[hsl(var(--secondary)/0.09)] text-[hsl(var(--secondary-light))]">
              <StepIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[hsl(var(--primary-light))]">
                {stepIndex === 0 ? `Welcome, ${firstName}` : "Interactive help"}
              </p>
              <h2
                id={coachmarkTitleId}
                className="mt-1 text-base font-semibold leading-5 tracking-[-0.02em] text-[hsl(var(--foreground))]"
              >
                {step.title}
              </h2>
            </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-semibold tabular-nums text-[hsl(var(--muted-foreground))]">
                  {stepIndex + 1}/{activeSteps.length}
                </span>
                <button
                  type="button"
                  onClick={dismissHelp}
                  aria-label="Dismiss onboarding help"
                  className="grid size-9 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.07] hover:text-[hsl(var(--foreground))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </header>

          <div
            className="mt-3 grid grid-cols-5 gap-1.5"
            aria-label="Tour progress"
          >
            {activeSteps.map((item, index) => (
              <span
                key={item.id ?? item.title}
                aria-current={index === stepIndex ? "step" : undefined}
                className={`h-1 rounded-full ${
                  index <= stepIndex
                    ? "bg-[hsl(var(--primary-bright))]"
                    : "bg-white/[0.10]"
                }`}
              />
            ))}
          </div>

          <p
            id={coachmarkDescriptionId}
            className="mt-3 text-[13px] leading-5 text-[hsl(var(--muted-foreground))]"
          >
            {step.body}
          </p>

          {step.actionHref && step.actionLabel ? (
            <Link
              href={step.actionHref}
              onClick={() => {
                const actionHref = step.actionHref;
                if (!actionHref) return;
                if (actionHref === "/pricing") {
                  queueOnboardingAnalyticsEvent({
                    schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
                    event: "upgrade-viewed",
                    tourId: analyticsTourId,
                  });
                }
                if (
                  actionHref === "/contact" ||
                  actionHref.startsWith("/account/support")
                ) {
                  queueOnboardingAnalyticsEvent({
                    schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
                    event: "support-selected",
                    tourId: analyticsTourId,
                  });
                }
                closeAndComplete();
              }}
              className="giq-outline-action mt-3 w-fit"
            >
              {step.actionLabel}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}

          <p
            className={`mt-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))] ${
              !routeTour || targetStatus === "primary" ? "sr-only" : ""
            }`}
            aria-live="polite"
          >
            Step {stepIndex + 1}: {step.title}
            {routeTour && targetStatus === "fallback"
              ? " · The primary target is unavailable, so this step is anchored to its safe fallback."
              : null}
            {routeTour && targetStatus === "revealing"
              ? " · Opening the allowlisted, non-mutating tab or dialog that owns this target."
              : null}
            {routeTour && targetStatus === "controller"
              ? " · The target disclosure did not open automatically, so this step is anchored to its safe tab or dialog control."
              : null}
            {routeTour && targetStatus === "missing"
              ? " · The page target is not available yet; this step will attach if it loads, and the guidance remains usable here."
              : null}
          </p>

          <footer className="mt-3 border-t border-white/[0.08] pt-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => changeStep(stepIndex - 1)}
                className={`${styles.secondaryControl} giq-button giq-button-glass min-h-11 px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lastStep) closeAndComplete();
                  else changeStep(stepIndex + 1);
                }}
                className={`${styles.primaryControl} giq-button giq-button-primary min-h-11 px-3 text-[12px] font-semibold`}
              >
                {lastStep ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
              {!lastStep ? (
                <button
                  type="button"
                  onClick={skipCurrentStep}
                  className="min-h-11 px-1 text-[11px] font-semibold text-[hsl(var(--foreground))] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
                >
                  Skip step
                </button>
              ) : null}
            </div>
          </footer>
          </div>
        </aside>
      ) : null}
    </>
  );
}

export function InteractiveHelpMenuControls({
  profileScope,
}: {
  profileScope?: string | null;
}) {
  const state = useInteractiveHelpState();
  const intentFieldId = useId();
  const selectedIntent = useInteractiveHelpIntent(profileScope);
  const selectedIntentOption = ONBOARDING_INTENT_OPTIONS.find(
    ({ id }) => id === selectedIntent,
  );
  const recentlyCompleted =
    useRecentlyCompletedInteractiveHelpTours(profileScope);

  return (
    <div className="grid gap-2" aria-label="Onboarding help preferences">
      <button
        type="button"
        onClick={() =>
          updateInteractiveHelp(state.enabled ? "disable" : "enable")
        }
        className={`${styles.secondaryControl} giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold`}
      >
        {state.enabled ? (
          <ToggleRight
            className="h-3.5 w-3.5 text-emerald-300"
            aria-hidden="true"
          />
        ) : (
          <ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Guided help: {state.enabled ? "On" : "Off"}
      </button>
      <button
        type="button"
        onClick={() => {
          queueOnboardingAnalyticsEvent({
            schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
            event: "tour-restarted",
            tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
          });
          updateInteractiveHelp("restart");
        }}
        className={`${styles.secondaryControl} giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold`}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
        Restart guided tour
      </button>
      <button
        type="button"
        onClick={() => resetAllInteractiveHelp(profileScope)}
        className={`${styles.secondaryControl} giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Reset all tours on this device
      </button>
      <div className="grid gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
        <label
          htmlFor={intentFieldId}
          className="text-[12px] font-semibold text-[hsl(var(--foreground))]"
        >
          What do you want help with?
        </label>
        <select
          id={intentFieldId}
          value={selectedIntent ?? ""}
          onChange={(event) =>
            updateInteractiveHelpIntent(
              profileScope,
              parseInteractiveHelpIntent(event.target.value),
            )
          }
          className="giq-form-control min-h-11 px-3 text-[12px]"
        >
          <option value="">Choose a help focus</option>
          {ONBOARDING_INTENT_OPTIONS.map((intent) => (
            <option key={intent.id} value={intent.id}>
              {intent.label}
            </option>
          ))}
        </select>
        {selectedIntentOption ? (
          <div className="grid gap-2" aria-live="polite">
            <p className="text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
              {selectedIntentOption.summary}
            </p>
            <Link
              href={selectedIntentOption.href}
              onClick={() =>
                queueOnboardingAnalyticsEvent({
                  schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
                  event: "help-opened",
                  tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
                })
              }
              className="w-fit text-[11px] font-semibold text-[hsl(var(--primary-light))] underline-offset-4 hover:underline"
            >
              Open {selectedIntentOption.label} guidance
            </Link>
          </div>
        ) : null}
      </div>
      <details className="rounded-xl border border-white/[0.08] bg-white/[0.025]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[13px] font-semibold text-[hsl(var(--foreground))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]">
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          Recently completed
          <span className="ml-auto text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {recentlyCompleted.length}
          </span>
        </summary>
        <div
          className="border-t border-white/[0.07] px-3 py-3"
          aria-live="polite"
        >
          {recentlyCompleted.length > 0 ? (
            <ol className="grid gap-3">
              {recentlyCompleted.map((tour) => (
                <li key={tour.storageKey} className="grid gap-1 text-left">
                  <span className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                    {tour.pageLabel}
                  </span>
                  <time
                    dateTime={new Date(tour.completedAt).toISOString()}
                    className="text-[10px] text-[hsl(var(--muted-foreground))]"
                  >
                    {formatOnboardingCompletionTime(tour.completedAt)}
                  </time>
                  {tour.href ? (
                    <Link
                      href={tour.href}
                      onClick={() => {
                        const descriptor =
                          parseInteractiveHelpProgressStorageKey(
                            tour.storageKey,
                          );
                        if (descriptor) {
                          queueOnboardingAnalyticsEvent({
                            schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
                            event: "tour-restarted",
                            tourId: descriptor.tourId,
                          });
                        }
                        updateInteractiveHelpProgress(
                          tour.storageKey,
                          "restart",
                        );
                      }}
                      className="mt-1 w-fit text-[11px] font-semibold text-[hsl(var(--primary-light))] underline-offset-4 hover:underline"
                    >
                      Run again
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
              Finished tours will appear here with their completion time.
            </p>
          )}
        </div>
      </details>
      <Link
        href="/account/support#help-topics"
        onClick={() =>
          queueOnboardingAnalyticsEvent({
            schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
            event: "help-opened",
            tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
          })
        }
        className={`${styles.secondaryControl} giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold`}
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Search help topics
      </Link>
      <details
        className="rounded-xl border border-white/[0.08] bg-white/[0.025]"
        onToggle={(event) => {
          if (!event.currentTarget.open) return;
          queueOnboardingAnalyticsEvent({
            schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
            event: "upgrade-viewed",
            tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
          });
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[13px] font-semibold text-[hsl(var(--foreground))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Understand plan upgrades
        </summary>
        <div className="grid gap-2 border-t border-white/[0.07] px-3 py-3">
          <p className="text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
            Compare feature access and usage limits before changing a plan.
            Opening this explanation never changes billing or entitlement state.
          </p>
          <Link
            href="/pricing"
            className="w-fit text-[11px] font-semibold text-[hsl(var(--primary-light))] underline-offset-4 hover:underline"
          >
            Compare plans
          </Link>
        </div>
      </details>
      <Link
        href="/contact"
        onClick={() =>
          queueOnboardingAnalyticsEvent({
            schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
            event: "support-selected",
            tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
          })
        }
        className={`${styles.secondaryControl} giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold`}
      >
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
        Open support
      </Link>
    </div>
  );
}

function useInteractiveHelpState() {
  const snapshot = useSyncExternalStore(
    subscribeToInteractiveHelp,
    readInteractiveHelpSnapshot,
    () => SERVER_INTERACTIVE_HELP_SNAPSHOT,
  );
  return parseInteractiveHelpState(snapshot);
}

function useInteractiveHelpProgress(
  storageKey: string | null,
  legacyStorageKey: string | null,
) {
  const snapshot = useSyncExternalStore(
    (onChange) =>
      subscribeToInteractiveHelpProgress(
        storageKey,
        legacyStorageKey,
        onChange,
      ),
    () =>
      readInteractiveHelpProgressSnapshot(storageKey) ||
      readInteractiveHelpProgressSnapshot(legacyStorageKey),
    () => "",
  );
  useEffect(() => {
    migrateInteractiveHelpProgressStorageKey(storageKey, legacyStorageKey);
  }, [legacyStorageKey, storageKey]);
  return parseInteractiveHelpProgressState(snapshot);
}

function useRecentlyCompletedInteractiveHelpTours(
  profileScope: string | null | undefined,
) {
  const snapshot = useSyncExternalStore(
    subscribeToInteractiveHelpProgressInventory,
    () => readRecentlyCompletedInteractiveHelpSnapshot(profileScope),
    () => "[]",
  );
  return JSON.parse(snapshot) as RecentlyCompletedHelpTour[];
}

function useInteractiveHelpIntent(profileScope: string | null | undefined) {
  const storageKey = buildInteractiveHelpIntentStorageKey(profileScope);
  const snapshot = useSyncExternalStore(
    (onChange) => subscribeToInteractiveHelpIntent(storageKey, onChange),
    () => readInteractiveHelpIntentSnapshot(storageKey),
    () => "",
  );
  return parseInteractiveHelpIntent(snapshot);
}

const DEFAULT_INTERACTIVE_HELP_VIEWPORT_SNAPSHOT = "1024:768:0:0";

function useInteractiveHelpViewport(): InteractiveHelpViewport {
  const snapshot = useSyncExternalStore(
    subscribeToInteractiveHelpViewport,
    readInteractiveHelpViewportSnapshot,
    () => DEFAULT_INTERACTIVE_HELP_VIEWPORT_SNAPSHOT,
  );
  return useMemo(() => {
    const [width, height, offsetTop, keyboardInset] = snapshot
      .split(":")
      .map(Number);
    return {
      height: height ?? 768,
      keyboardInset: keyboardInset ?? 0,
      offsetTop: offsetTop ?? 0,
      width: width ?? 1024,
    };
  }, [snapshot]);
}

function subscribeToInteractiveHelpViewport(onChange: () => void) {
  const visualViewport = window.visualViewport;
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  visualViewport?.addEventListener("resize", onChange);
  visualViewport?.addEventListener("scroll", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    visualViewport?.removeEventListener("resize", onChange);
    visualViewport?.removeEventListener("scroll", onChange);
  };
}

function readInteractiveHelpViewportSnapshot() {
  const visualViewport = window.visualViewport;
  const width = visualViewport?.width ?? window.innerWidth;
  const height = visualViewport?.height ?? window.innerHeight;
  const offsetTop = visualViewport?.offsetTop ?? 0;
  const keyboardInset = Math.max(0, window.innerHeight - height - offsetTop);
  return [width, height, offsetTop, keyboardInset]
    .map((value) => Math.round(value))
    .join(":");
}

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useInteractiveHelpOwner() {
  const instanceId = useId();
  const owner = useSyncExternalStore(
    (onChange) => {
      interactiveHelpOwnerListeners.add(onChange);
      return () => interactiveHelpOwnerListeners.delete(onChange);
    },
    () => interactiveHelpOwner,
    () => null,
  );

  useEffect(() => {
    if (owner === null && interactiveHelpOwner === null) {
      interactiveHelpOwner = instanceId;
      notifyInteractiveHelpOwnerChange();
    }
  }, [instanceId, owner]);

  useEffect(() => {
    return () => {
      if (interactiveHelpOwner !== instanceId) return;
      interactiveHelpOwner = null;
      notifyInteractiveHelpOwnerChange();
    };
  }, [instanceId]);

  return owner === instanceId;
}

function notifyInteractiveHelpOwnerChange() {
  for (const listener of interactiveHelpOwnerListeners) listener();
}

function subscribeToInteractiveHelp(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === INTERACTIVE_HELP_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(INTERACTIVE_HELP_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(INTERACTIVE_HELP_EVENT, onChange);
  };
}

function readInteractiveHelpSnapshot() {
  try {
    return (
      window.localStorage.getItem(INTERACTIVE_HELP_STORAGE_KEY) ??
      memorySnapshot
    );
  } catch {
    return memorySnapshot;
  }
}

function subscribeToInteractiveHelpProgress(
  storageKey: string | null,
  legacyStorageKey: string | null,
  onChange: () => void,
) {
  if (!storageKey) return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === legacyStorageKey) onChange();
  };
  const handleProgress = (event: Event) => {
    const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
    if (
      detail?.storageKey === storageKey ||
      detail?.storageKey === legacyStorageKey
    ) {
      onChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(INTERACTIVE_HELP_PROGRESS_EVENT, handleProgress);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(INTERACTIVE_HELP_PROGRESS_EVENT, handleProgress);
  };
}

function subscribeToInteractiveHelpProgressInventory(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(`${INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX}:`)) {
      onChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(INTERACTIVE_HELP_PROGRESS_EVENT, onChange);
  window.addEventListener(INTERACTIVE_HELP_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(INTERACTIVE_HELP_PROGRESS_EVENT, onChange);
    window.removeEventListener(INTERACTIVE_HELP_EVENT, onChange);
  };
}

function subscribeToInteractiveHelpIntent(
  storageKey: string,
  onChange: () => void,
) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onChange();
  };
  const handleIntent = (event: Event) => {
    const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
    if (detail?.storageKey === storageKey) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(INTERACTIVE_HELP_INTENT_EVENT, handleIntent);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(INTERACTIVE_HELP_INTENT_EVENT, handleIntent);
  };
}

function readInteractiveHelpProgressSnapshot(storageKey: string | null) {
  if (!storageKey) return "";
  try {
    return (
      window.localStorage.getItem(storageKey) ??
      progressMemorySnapshots.get(storageKey) ??
      ""
    );
  } catch {
    return progressMemorySnapshots.get(storageKey) ?? "";
  }
}

function migrateInteractiveHelpProgressStorageKey(
  storageKey: string | null,
  legacyStorageKey: string | null,
) {
  if (!storageKey || !legacyStorageKey || storageKey === legacyStorageKey)
    return;
  if (readInteractiveHelpProgressSnapshot(storageKey)) return;

  const legacySnapshot = readInteractiveHelpProgressSnapshot(legacyStorageKey);
  if (!legacySnapshot) return;

  progressMemorySnapshots.set(storageKey, legacySnapshot);
  progressMemorySnapshots.delete(legacyStorageKey);
  try {
    window.localStorage.setItem(storageKey, legacySnapshot);
    window.localStorage.removeItem(legacyStorageKey);
  } catch {
    // The migrated state remains available in memory for this browser session.
  }
  window.dispatchEvent(
    new CustomEvent(INTERACTIVE_HELP_PROGRESS_EVENT, {
      detail: { storageKey },
    }),
  );
}

function readRecentlyCompletedInteractiveHelpSnapshot(
  profileScope: string | null | undefined,
) {
  const entries = new Map(progressMemorySnapshots);
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (
        !storageKey?.startsWith(`${INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX}:`)
      ) {
        continue;
      }
      const value = window.localStorage.getItem(storageKey);
      if (value !== null) entries.set(storageKey, value);
    }
  } catch {
    // The in-memory snapshot still provides session-local history.
  }

  const toursByRoute = new Map(
    ONBOARDING_HELP_TOUR_CATALOGUE.map((tour) => [
      `${tour.tourId}\u0000${tour.route}`,
      tour,
    ]),
  );
  const visibleTours = listRecentlyCompletedInteractiveHelpTours(
    entries,
    profileScope,
  ).flatMap((completed) => {
    const tour = toursByRoute.get(
      `${completed.tourId}\u0000${completed.route}`,
    );
    return tour
      ? [{ ...completed, href: tour.href, pageLabel: tour.pageLabel }]
      : [];
  });
  return JSON.stringify(visibleTours);
}

function readInteractiveHelpIntentSnapshot(storageKey: string) {
  try {
    return (
      window.localStorage.getItem(storageKey) ??
      intentMemorySnapshots.get(storageKey) ??
      ""
    );
  } catch {
    return intentMemorySnapshots.get(storageKey) ?? "";
  }
}

function updateInteractiveHelpProgress(
  storageKey: string,
  action: InteractiveHelpProgressAction,
) {
  const current = parseInteractiveHelpProgressState(
    readInteractiveHelpProgressSnapshot(storageKey),
  );
  const next = reduceInteractiveHelpProgressState(
    current ?? DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
    action,
  );
  const snapshot = serializeInteractiveHelpProgressState(next);
  progressMemorySnapshots.set(storageKey, snapshot);
  try {
    window.localStorage.setItem(storageKey, snapshot);
  } catch {
    // Non-sensitive progress falls back to memory for this browser session.
  }
  window.dispatchEvent(
    new CustomEvent(INTERACTIVE_HELP_PROGRESS_EVENT, {
      detail: { storageKey },
    }),
  );
}

function findVisibleOnboardingTarget(targetId: OnboardingTargetId) {
  const candidates = document.querySelectorAll<HTMLElement>(
    "[data-onboarding-target]",
  );
  return (
    Array.from(candidates).find(
      (candidate) =>
        candidate.dataset.onboardingTarget?.split(/\s+/).includes(targetId) &&
        candidate.getClientRects().length > 0,
    ) ?? null
  );
}

function sameTargetBounds(
  current: InteractiveHelpTargetBounds | null,
  next: InteractiveHelpTargetBounds | null,
) {
  if (!current || !next) return current === next;
  return (
    Math.abs(current.bottom - next.bottom) < 0.5 &&
    Math.abs(current.height - next.height) < 0.5 &&
    Math.abs(current.left - next.left) < 0.5 &&
    Math.abs(current.right - next.right) < 0.5 &&
    Math.abs(current.top - next.top) < 0.5 &&
    Math.abs(current.width - next.width) < 0.5
  );
}

function findVisibleOnboardingRevealController(targetId: OnboardingTargetId): {
  element: HTMLButtonElement;
  kind: OnboardingRevealKind;
} | null {
  const candidates = document.querySelectorAll<HTMLButtonElement>(
    "button[data-onboarding-controls][data-onboarding-reveal]",
  );
  for (const candidate of candidates) {
    const kind = resolveOnboardingRevealKind(
      candidate.dataset.onboardingReveal,
    );
    if (
      !kind ||
      candidate.getClientRects().length === 0 ||
      !isAllowedOnboardingRevealController({
        ariaDisabled: candidate.getAttribute("aria-disabled"),
        controls: candidate.dataset.onboardingControls,
        disabled: candidate.disabled,
        kind,
        role: candidate.getAttribute("role"),
        tagName: candidate.tagName,
        targetId,
        type: candidate.getAttribute("type"),
      })
    ) {
      continue;
    }
    return { element: candidate, kind };
  }
  return null;
}

function updateInteractiveHelp(action: InteractiveHelpAction) {
  const current = parseInteractiveHelpState(readInteractiveHelpSnapshot());
  const next = reduceInteractiveHelpState(
    current ?? DEFAULT_INTERACTIVE_HELP_STATE,
    action,
  );
  memorySnapshot = serializeInteractiveHelpState(next);
  try {
    window.localStorage.setItem(INTERACTIVE_HELP_STORAGE_KEY, memorySnapshot);
  } catch {
    // Non-sensitive preference falls back to memory for this browser session.
  }
  window.dispatchEvent(
    new CustomEvent<InteractiveHelpAction>(INTERACTIVE_HELP_EVENT, {
      detail: action,
    }),
  );
}

function updateInteractiveHelpIntent(
  profileScope: string | null | undefined,
  intent: InteractiveHelpIntent | null,
) {
  const storageKey = buildInteractiveHelpIntentStorageKey(profileScope);
  if (intent) intentMemorySnapshots.set(storageKey, intent);
  else intentMemorySnapshots.delete(storageKey);
  try {
    if (intent) window.localStorage.setItem(storageKey, intent);
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Non-sensitive intent remains available in memory for this session.
  }
  window.dispatchEvent(
    new CustomEvent(INTERACTIVE_HELP_INTENT_EVENT, {
      detail: { storageKey },
    }),
  );
}

function formatOnboardingCompletionTime(completedAt: number) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    timeZoneName: "short",
    year: "numeric",
  }).format(completedAt);
}

function resetAllInteractiveHelp(profileScope: string | null | undefined) {
  const requestedScope = profileScope?.trim() || "browser";
  for (const storageKey of progressMemorySnapshots.keys()) {
    if (
      parseInteractiveHelpProgressStorageKey(storageKey)?.profileScope ===
      requestedScope
    ) {
      progressMemorySnapshots.delete(storageKey);
    }
  }

  try {
    const matchingKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (
        storageKey &&
        parseInteractiveHelpProgressStorageKey(storageKey)?.profileScope ===
          requestedScope
      ) {
        matchingKeys.push(storageKey);
      }
    }
    for (const storageKey of matchingKeys) {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Browser-local help still resets through the in-memory fallback.
  }

  updateInteractiveHelpIntent(profileScope, null);
  updateInteractiveHelp("restart");
}
