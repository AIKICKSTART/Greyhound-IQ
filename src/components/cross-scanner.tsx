"use client";

/**
 * Pedigree scanner — premium loading state for the Test Mating cross record.
 *
 * Drop-in usage (replaces the plain "Loading the cross record…" panel on
 * /breeding/cross — wired by the page owner):
 *
 *   <CrossScanner sireName={sire.name} damName={dam.name} />
 *
 * Self-contained: every style is a Tailwind arbitrary value or a rule in the
 * scoped <style> block below — no globals.css. Motion is transform/opacity
 * only, loops until the real record resolves and unmounts this, and reads as a
 * deliberate "scan" within ~1s. Full prefers-reduced-motion fallback (static
 * panel + one pulsing dot + one line of text).
 */

import { useEffect, useState } from "react";

interface CrossScannerProps {
  sireName: string;
  damName: string;
}

const STAGE_INTERVAL_MS = 1400;

export function CrossScanner({ sireName, damName }: CrossScannerProps) {
  const stages = [
    `Scanning ${sireName}'s pedigree…`,
    `Scanning ${damName}'s pedigree…`,
    "Cross-matching shared ancestors…",
  ];
  const [stage, setStage] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(
      () => setStage((n) => (n + 1) % 3),
      STAGE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [reduced]);

  const shell =
    "relative overflow-hidden rounded-2xl border border-[hsl(var(--metal-silver)/0.14)] bg-[hsl(var(--surface-1)/0.58)] p-6 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_22px_48px_hsl(0_0%_0%/0.28)] sm:p-8";

  // Reduced-motion: a still panel, one gently pulsing dot, one honest line.
  if (reduced) {
    return (
      <div role="status" aria-live="polite" className={`${shell} cs-scope`}>
        <style>{SCANNER_CSS}</style>
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="cs-dot h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary-bright))]" />
          <p className="text-[13px] tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
            Preparing the cross record for {sireName} × {damName}…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={`${shell} cs-scope`}>
      <style>{SCANNER_CSS}</style>

      {/* Screen readers get one steady message, not the cycling stage lines. */}
      <span className="sr-only">
        Loading the cross record for {sireName} × {damName}.
      </span>

      {/* Scan stage: gold sire tree, purple dam tree, a beam sweeping across. */}
      <div
        aria-hidden="true"
        className="relative mx-auto flex max-w-[420px] items-center justify-center gap-1 py-1"
      >
        <div
          className="cs-glow cs-glow-sire pointer-events-none absolute left-[6%] top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--secondary)/0.45),transparent_70%)]"
        />
        <div
          className="cs-glow cs-glow-dam pointer-events-none absolute right-[6%] top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.45),transparent_70%)]"
        />

        <PedigreeSilhouette
          tint="hsl(var(--secondary))"
          accent="hsl(var(--secondary-light))"
          className="relative w-[104px] shrink-0 sm:w-28"
        />

        <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--metal-silver)/0.28)] bg-[hsl(var(--surface-3))] text-[14px] font-semibold text-[hsl(var(--foreground))] shadow-[0_0_24px_-10px_hsl(var(--primary-bright))]">
          <span className="cs-core inline-block">×</span>
        </span>

        <PedigreeSilhouette
          tint="hsl(var(--primary))"
          accent="hsl(var(--primary-bright))"
          mirror
          className="relative w-[104px] shrink-0 sm:w-28"
        />

        {/* The sweeping scan beam. transform-only, clipped by the panel. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 overflow-hidden">
          <div className="cs-beam absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,hsl(var(--secondary-light)/0.45),hsl(var(--primary-bright)/0.45),transparent)] mix-blend-screen" />
        </div>
      </div>

      {/* Cycling status line — fixed height so text swaps never shift layout. */}
      <div
        aria-hidden="true"
        className="mx-auto mt-5 flex min-h-[20px] max-w-[420px] items-center justify-center gap-2"
      >
        <span className="cs-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--secondary-light))]" />
        <p className="text-center text-[12.5px] font-medium tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
          {stages[stage]}
        </p>
      </div>

      {/* Indeterminate progress rail. */}
      <div className="mx-auto mt-3 h-[2px] max-w-[220px] overflow-hidden rounded-full bg-[hsl(var(--metal-silver)/0.12)]">
        <div className="cs-track h-full w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,hsl(var(--primary-bright)/0.9),transparent)]" />
      </div>
    </div>
  );
}

/**
 * A three-generation binary pedigree tree drawn as a compact SVG silhouette.
 * Root sits on the inner edge (toward the centre × node); ancestors fan out.
 * `mirror` flips it so the dam side faces back toward the centre.
 */
function PedigreeSilhouette({
  tint,
  accent,
  mirror = false,
  className = "",
}: {
  tint: string;
  accent: string;
  mirror?: boolean;
  className?: string;
}) {
  const nodes = [
    { cx: 120, cy: 60, r: 7, fill: accent },
    { cx: 78, cy: 34, r: 5, fill: tint },
    { cx: 78, cy: 86, r: 5, fill: tint },
    { cx: 34, cy: 18, r: 4, fill: tint },
    { cx: 34, cy: 50, r: 4, fill: tint },
    { cx: 34, cy: 70, r: 4, fill: tint },
    { cx: 34, cy: 102, r: 4, fill: tint },
  ];
  const links = [
    [120, 60, 78, 34],
    [120, 60, 78, 86],
    [78, 34, 34, 18],
    [78, 34, 34, 50],
    [78, 86, 34, 70],
    [78, 86, 34, 102],
  ];

  return (
    <svg
      viewBox="0 0 132 120"
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      role="presentation"
    >
      <g stroke={tint} strokeOpacity={0.4} strokeWidth={1.5} fill="none">
        {links.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.cx}
          cy={n.cy}
          r={n.r}
          fill={n.fill}
          fillOpacity={i === 0 ? 0.95 : 0.55}
        />
      ))}
    </svg>
  );
}

// Component-scoped stylesheet. Static string, transform/opacity keyframes only,
// each guarded so prefers-reduced-motion halts every animation.
const SCANNER_CSS = `
.cs-scope .cs-beam { animation: csBeam 1.7s cubic-bezier(0.65,0,0.35,1) infinite; will-change: transform; }
.cs-scope .cs-glow-sire { animation: csGlow 2.4s ease-in-out infinite; }
.cs-scope .cs-glow-dam { animation: csGlow 2.4s ease-in-out 1.2s infinite; }
.cs-scope .cs-core { animation: csCore 2s ease-in-out infinite; will-change: transform; }
.cs-scope .cs-track { animation: csTrack 1.5s ease-in-out infinite; will-change: transform; }
.cs-scope .cs-dot { animation: csDot 1.4s ease-in-out infinite; }
@keyframes csBeam { 0% { transform: translateX(-120%); } 100% { transform: translateX(420%); } }
@keyframes csGlow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.85; } }
@keyframes csCore { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.14); opacity: 1; } }
@keyframes csTrack { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }
@keyframes csDot { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .cs-scope .cs-beam,
  .cs-scope .cs-glow-sire,
  .cs-scope .cs-glow-dam,
  .cs-scope .cs-core,
  .cs-scope .cs-track { animation: none; }
  .cs-scope .cs-beam { opacity: 0; }
  .cs-scope .cs-dot { animation: csDot 2s ease-in-out infinite; }
}
`;
