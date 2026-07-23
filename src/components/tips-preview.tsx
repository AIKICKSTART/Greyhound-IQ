import { Bot, Clock3, Gauge, LockKeyhole, ShieldCheck } from "lucide-react";

import type { TIPS_PREVIEW_MODEL } from "@/lib/tips-preview";

type TipsPreviewModel = typeof TIPS_PREVIEW_MODEL;

const BOX_COLOURS = [
  "border-red-300/70 bg-red-600 text-white",
  "border-white/70 bg-white text-black",
  "border-blue-300/70 bg-blue-600 text-white",
] as const;

export function TipsPreview({ preview }: { preview: TipsPreviewModel }) {
  return (
    <section
      aria-label="Prediction Engine preview"
      className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[hsl(var(--surface-1))] shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
    >
      <div className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_78%_0%,hsl(var(--primary)/0.24),transparent_48%)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
              Prediction Engine
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[hsl(var(--foreground))]">
              The Syndicate preview
            </h2>
          </div>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-3 text-[11px] font-bold uppercase tracking-wide text-amber-200">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Preview only · not live
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
          This adapts the existing Prediction Engine interface for an early look.
          No runner selection, probability or result below is a betting tip.
        </p>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {preview.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-white/[0.07] bg-[linear-gradient(150deg,hsl(var(--primary)/0.1),transparent_62%)] p-4"
            >
              <strong className="block text-2xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
                {metric.value}
              </strong>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
                {metric.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/20 p-1.5">
          {["Next to run", "High confidence", "Completed"].map((label, index) => (
            <button
              key={label}
              type="button"
              disabled
              className={`min-h-10 shrink-0 cursor-not-allowed rounded-lg px-4 text-[12px] font-semibold ${
                index === 0
                  ? "bg-[hsl(var(--primary)/0.24)] text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--subtle-foreground))]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <article className="overflow-hidden rounded-2xl border border-[hsl(var(--primary-light)/0.28)] bg-black/20">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
            <div>
              <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
                Preview race card
              </p>
              <p className="mt-0.5 text-[11px] text-[hsl(var(--subtle-foreground))]">
                Runner data remains hidden until launch
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-[hsl(var(--primary-light))]">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Training mode
            </span>
          </header>

          <div className="divide-y divide-white/[0.06]">
            {BOX_COLOURS.map((boxClass, index) => (
              <div
                key={boxClass}
                className="grid grid-cols-[44px_minmax(0,1fr)_72px] items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span
                  className={`grid h-10 w-11 place-items-center rounded-md border-2 text-base font-extrabold shadow-lg ${boxClass}`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block h-2.5 w-36 max-w-full rounded-full bg-white/[0.09]" />
                  <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-bright))] opacity-40"
                      style={{ width: `${70 - index * 15}%` }}
                    />
                  </span>
                </span>
                <span className="text-right text-[12px] font-semibold text-[hsl(var(--subtle-foreground))]">
                  Hidden
                </span>
              </div>
            ))}
          </div>
        </article>

        <section aria-labelledby="agent-preview-heading">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-[hsl(var(--secondary-light))]" aria-hidden="true" />
            <h3
              id="agent-preview-heading"
              className="text-[12px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]"
            >
              Agent argument board
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {preview.agentRoles.map((agent) => (
              <article
                key={agent.name}
                data-tone={agent.tone}
                className="rounded-xl border border-white/[0.08] bg-[linear-gradient(145deg,hsl(var(--primary)/0.09),transparent_65%)] p-4"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--primary-light))]">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                  Evidence stage
                </div>
                <h4 className="mt-3 text-[15px] font-semibold text-[hsl(var(--foreground))]">
                  {agent.name}
                </h4>
                <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {agent.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            Preview values are deliberately withheld. Unfinished actions are
            disabled and nothing on this screen places or recommends a bet.
          </p>
          <button
            type="button"
            disabled
            className="giq-button giq-button-glass min-h-11 cursor-not-allowed justify-center px-4 text-[12px] opacity-55"
          >
            Tips are not live
          </button>
        </div>
      </div>
    </section>
  );
}
