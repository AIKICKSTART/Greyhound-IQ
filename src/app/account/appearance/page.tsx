import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Eye,
  LayoutDashboard,
  Megaphone,
  PanelsTopLeft,
  SaveOff,
  Sparkles,
} from "lucide-react";
import {
  getAppearancePreviewQuery,
  resolveAppearancePreviewState,
  type AppearancePreviewSearchParams,
} from "@/components/appearance-preview-state";
import { DOCK_SKIN_REGISTRY } from "@/components/dock-skin-catalogue";
import { MARKETPLACE_TEMPLATE_OPTIONS } from "@/components/marketplace-template-variants";
import {
  PROTOTYPE_TEMPLATE_COMPOSITIONS,
  PROTOTYPE_VARIANTS,
} from "@/components/prototype-variants";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Appearance Studio - GreyhoundIQ Design Lab",
  description:
    "Non-persistent review surface for GreyhoundIQ app, dock and marketplace templates.",
  robots: { index: false, follow: false },
};

const selectedClass =
  "border-[hsl(var(--primary-light)/0.7)] bg-[linear-gradient(145deg,hsl(var(--primary)/0.2),rgba(255,255,255,0.045))] shadow-[0_18px_50px_hsl(var(--primary)/0.12)]";
const idleClass =
  "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]";
const focusClass =
  "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white";

export default async function AccountAppearancePage({
  searchParams,
}: {
  searchParams: Promise<AppearancePreviewSearchParams>;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEVICE_PREVIEWS !== "true"
  ) {
    notFound();
  }

  if (!(await getCurrentUser())) {
    redirect("/sign-in?returnTo=/account/appearance");
  }

  const state = resolveAppearancePreviewState(await searchParams);
  const currentQuery = getAppearancePreviewQuery(state);
  const appOption = PROTOTYPE_VARIANTS.find((item) => item.key === state.app)!;
  const dockOption = DOCK_SKIN_REGISTRY.find((item) => item.key === state.dock)!;
  const marketOption = MARKETPLACE_TEMPLATE_OPTIONS.find(
    (item) => item.key === state.market
  )!;

  return (
    <div
      data-appearance-studio
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_85%_12%,hsl(var(--secondary)/0.12),transparent_24%),#070609] px-4 pb-32 pt-8 text-white sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[28px] border border-white/10 bg-black/35 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--secondary-light))]">
                Account · Design Lab
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
                Appearance Studio
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                Assemble an app template, dock skin and Marketplace layout for
                review. Sponsored-card visibility is included so the complete
                Feed experience can be evaluated before any preference is saved.
              </p>
            </div>
            <div className="grid min-w-[250px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {[
                ["App", state.app],
                ["Dock", state.dock],
                ["Market", state.market],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#0b0a0e] px-4 py-3 text-center">
                  <span className="block text-[9px] uppercase tracking-[0.16em] text-white/36">
                    {label}
                  </span>
                  <strong className="mt-1 block text-lg text-white">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </header>

        <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-4 text-sm text-amber-50/80">
          <SaveOff className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <strong className="block text-amber-200">Preview only — saving is disabled</strong>
            <p className="mt-1 leading-6">
              Selections live only in this page URL. No account, database,
              sponsored-delivery or billing setting is changed until a design is
              approved and the staging persistence contract passes review.
            </p>
          </div>
        </aside>

        <form method="get" className="mt-8 space-y-8">
          <fieldset>
            <legend className="flex items-center gap-3 text-xl font-bold">
              <LayoutDashboard className="size-5 text-[hsl(var(--primary-light))]" aria-hidden="true" />
              App template
            </legend>
            <p className="mt-1 text-sm text-white/44">Choose the main composition and information rhythm.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PROTOTYPE_VARIANTS.map((option) => {
                const selected = option.key === state.app;
                const composition = PROTOTYPE_TEMPLATE_COMPOSITIONS[option.key];
                return (
                  <label
                    key={option.key}
                    className={`relative cursor-pointer rounded-2xl border p-5 transition ${focusClass} ${selected ? selectedClass : idleClass}`}
                  >
                    <input
                      type="radio"
                      name="app"
                      value={option.key}
                      defaultChecked={selected}
                      className="sr-only"
                    />
                    <span className="text-xs font-black tracking-[0.16em] text-[hsl(var(--secondary-light))]">
                      {option.key}
                    </span>
                    <strong className="mt-2 block text-lg">{option.label}</strong>
                    <span className="mt-1 block text-sm text-white/48">{option.detail}</span>
                    <span className="mt-4 block text-[10px] uppercase tracking-[0.14em] text-white/30">
                      Recommended dock {composition.recommendedDock}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="flex items-center gap-3 text-xl font-bold">
              <PanelsTopLeft className="size-5 text-[hsl(var(--secondary-light))]" aria-hidden="true" />
              Dock skin
            </legend>
            <p className="mt-1 text-sm text-white/44">All skins retain the same Home, Feed, Post, Chat and Menu actions.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {DOCK_SKIN_REGISTRY.map((option) => {
                const selected = option.key === state.dock;
                return (
                  <label
                    key={option.key}
                    className={`cursor-pointer rounded-2xl border p-5 transition ${focusClass} ${selected ? selectedClass : idleClass}`}
                  >
                    <input
                      type="radio"
                      name="dock"
                      value={option.key}
                      defaultChecked={selected}
                      className="sr-only"
                    />
                    <span className="text-xs font-black tracking-[0.16em] text-[hsl(var(--secondary-light))]">
                      {option.key}
                    </span>
                    <strong className="mt-2 block text-lg">{option.label}</strong>
                    <span className="mt-1 block text-sm leading-6 text-white/48">{option.detail}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="flex items-center gap-3 text-xl font-bold">
              <Sparkles className="size-5 text-[hsl(var(--primary-light))]" aria-hidden="true" />
              Marketplace template
            </legend>
            <p className="mt-1 text-sm text-white/44">Compare six page-level Marketplace structures; dog-card art remains unchanged.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {MARKETPLACE_TEMPLATE_OPTIONS.map((option) => {
                const selected = option.key === state.market;
                return (
                  <label
                    key={option.key}
                    className={`cursor-pointer rounded-2xl border p-5 transition ${focusClass} ${selected ? selectedClass : idleClass}`}
                  >
                    <input
                      type="radio"
                      name="market"
                      value={option.key}
                      defaultChecked={selected}
                      className="sr-only"
                    />
                    <span className="text-xs font-black tracking-[0.16em] text-[hsl(var(--secondary-light))]">
                      {option.key}
                    </span>
                    <strong className="mt-2 block text-lg">{option.label}</strong>
                    <span className="mt-1 block text-sm leading-6 text-white/48">{option.detail}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <legend className="flex items-center gap-3 px-2 text-xl font-bold">
              <Megaphone className="size-5 text-amber-300" aria-hidden="true" />
              Sponsored Marketplace in Feed
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { key: "on", label: "Show", detail: "Include disclosed Marketplace showcases in the Feed preview." },
                { key: "off", label: "Hide", detail: "Review the Feed without sponsored Marketplace showcases." },
              ].map((option) => {
                const selected = option.key === state.sponsored;
                return (
                  <label
                    key={option.key}
                    className={`cursor-pointer rounded-xl border p-4 transition ${focusClass} ${selected ? selectedClass : idleClass}`}
                  >
                    <input
                      type="radio"
                      name="sponsored"
                      value={option.key}
                      defaultChecked={selected}
                      className="sr-only"
                    />
                    <strong>{option.label}</strong>
                    <span className="mt-1 block text-sm text-white/45">{option.detail}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/14 bg-[#0b090f]/95 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <p className="min-w-0 text-xs text-white/44">
              Current URL state: <code className="break-all text-white/70">{currentQuery}</code>
            </p>
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[hsl(var(--primary))] px-6 text-sm font-bold text-white shadow-[0_0_28px_hsl(var(--primary)/0.3)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Preview selection
            </button>
          </div>
        </form>

        <section className="mt-8 rounded-[28px] border border-white/10 bg-black/30 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/36">Selected review stack</p>
              <h2 className="mt-2 text-2xl font-bold">{appOption.label} · {dockOption.label} · {marketOption.label}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/48">
              Sponsored cards {state.sponsored === "on" ? "visible" : "hidden"}
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <ReviewLink
              href={`/feed/device-preview?device=mobile&variant=${state.app}&sponsored=${state.sponsored}`}
              title={`${state.app} app preview`}
              detail={`${appOption.label} / ${appOption.detail}`}
            />
            <ReviewLink
              href={`/design-lab/dock-skins?dock=${state.dock}`}
              title={`${state.dock} dock preview`}
              detail={dockOption.label}
            />
            <ReviewLink
              href={`/marketplace/design-lab?template=${state.market}`}
              title={`${state.market} Marketplace preview`}
              detail={marketOption.label}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ReviewLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[hsl(var(--primary-light)/0.55)] hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs text-white/42">{detail}</span>
      </span>
      <Eye className="size-5 shrink-0 text-white/35 transition group-hover:text-[hsl(var(--primary-light))]" aria-hidden="true" />
    </Link>
  );
}
