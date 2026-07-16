import type { Metadata } from "next";
import Link from "next/link";
import { resolveSponsoredMarketplaceVisibility } from "@/components/appearance-preview-state";
import { DOCK_SKIN_REGISTRY } from "@/components/dock-skin-catalogue";
import {
  APP_DOCK_REVIEW_FRAMES,
  getAppDockReviewFrame,
  resolveAppDockReviewSelection,
} from "@/components/design-lab-review-matrix";
import {
  PROTOTYPE_DEVICES,
  PROTOTYPE_REVIEW_COMPONENTS,
  PROTOTYPE_VARIANTS,
  getPrototypeReviewId,
} from "@/components/prototype-variants";
import { requireDesignLabReviewer } from "@/lib/design-lab-access";

type FeedDevicePreviewSearchParams = {
  device?: string | string[];
  dock?: string | string[];
  sponsored?: string | string[];
  variant?: string | string[];
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<FeedDevicePreviewSearchParams>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const { device, dock, variant } = resolveAppDockReviewSelection(resolved);
  const dockOption = DOCK_SKIN_REGISTRY.find((item) => item.key === dock)!;
  const frame = PROTOTYPE_DEVICES.find((item) => item.key === device)!;

  return {
    title: `${frame.label} ${variant} + ${dock} ${dockOption.label} - GreyhoundIQ Preview`,
    robots: { index: false, follow: false },
  };
}

export default async function FeedDevicePreviewPage({
  searchParams,
}: {
  searchParams: Promise<FeedDevicePreviewSearchParams>;
}) {
  await requireDesignLabReviewer();

  const resolved = await searchParams;
  const { device, dock, variant } = resolveAppDockReviewSelection(resolved);
  const sponsoredMarketplace = resolveSponsoredMarketplaceVisibility(
    resolved.sponsored
  );
  const frame = PROTOTYPE_DEVICES.find((item) => item.key === device)!;
  const option = PROTOTYPE_VARIANTS.find((item) => item.key === variant)!;
  const dockOption = DOCK_SKIN_REGISTRY.find((item) => item.key === dock)!;
  const reviewFrame = getAppDockReviewFrame(variant, dock, device);
  const targetHref = `/feed?variant=${variant}&demo=1&dock=${dock}&sponsored=${sponsoredMarketplace}`;
  const reviewComponents = PROTOTYPE_REVIEW_COMPONENTS.map((component) => ({
    ...component,
    id: getPrototypeReviewId(variant, device, component.key),
  }));
  const shellWidth =
    frame.width + (device === "mobile" ? 26 : device === "tablet" ? 30 : 22);

  return (
    <div
      data-device-preview
      className="min-h-screen overflow-auto bg-[#060508] px-3 py-5 text-white sm:px-6"
    >
      <style>{`
        body:has([data-device-preview]) .giq-site-header,
        body:has([data-device-preview]) .giq-member-header,
        body:has([data-device-preview]) .giq-mobile-dock,
        body:has([data-device-preview]) .giq-hub-conversation-dock,
        body:has([data-device-preview]) .giq-footer-shell,
        body:has([data-device-preview]) .giq-alert-wrap {
          display: none !important;
        }
      `}</style>
      <div className="mx-auto w-fit">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">
              Recording preview
            </p>
            <h1 className="mt-1 text-[15px] font-semibold text-white">
              {variant} · {option.label} / {option.detail}
              <span className="text-white/45"> · {dock} {dockOption.label}</span>
            </h1>
          </div>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] text-white/50">
            {frame.width} × {frame.height}
          </span>
          <nav className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3" aria-label="Device preview controls">
            <div className="flex flex-wrap gap-1.5" aria-label="Choose device type">
              {PROTOTYPE_DEVICES.map((deviceOption) => (
                <Link
                  key={deviceOption.key}
                  href={`/feed/device-preview?device=${deviceOption.key}&variant=${variant}&dock=${dock}&sponsored=${sponsoredMarketplace}`}
                  aria-current={deviceOption.key === device ? "page" : undefined}
                  className={`flex min-h-10 items-center rounded-lg px-3 text-[10px] font-semibold transition ${deviceOption.key === device ? "bg-[hsl(var(--secondary)/0.18)] text-[hsl(var(--secondary-light))]" : "bg-white/[0.04] text-white/45 hover:text-white"}`}
                >
                  {deviceOption.label}
                </Link>
              ))}
            </div>
            <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 xl:w-auto xl:grid-cols-6" aria-label="Choose design version">
              {PROTOTYPE_VARIANTS.map((variantOption) => (
                <Link
                  key={variantOption.key}
                  href={`/feed/device-preview?device=${device}&variant=${variantOption.key}&dock=${dock}&sponsored=${sponsoredMarketplace}`}
                  aria-current={variantOption.key === variant ? "page" : undefined}
                  title={`${variantOption.label} / ${variantOption.detail}`}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-[10px] font-semibold transition ${variantOption.key === variant ? "bg-[hsl(var(--primary))] text-white shadow-[0_0_20px_hsl(var(--primary)/0.35)]" : "bg-white/[0.04] text-white/45 hover:text-white"}`}
                >
                  <strong className="text-[11px]">{variantOption.key}</strong>
                  <span className="hidden leading-tight 2xl:block">
                    {variantOption.detail}
                  </span>
                </Link>
              ))}
            </div>
            <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6" aria-label="Choose dock skin">
              {DOCK_SKIN_REGISTRY.map((dockOption) => (
                <Link
                  key={dockOption.key}
                  href={`/feed/device-preview?device=${device}&variant=${variant}&dock=${dockOption.key}&sponsored=${sponsoredMarketplace}`}
                  aria-current={dockOption.key === dock ? "page" : undefined}
                  title={dockOption.detail}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-[10px] font-semibold transition ${dockOption.key === dock ? "bg-[hsl(var(--secondary)/0.18)] text-[hsl(var(--secondary-light))]" : "bg-white/[0.04] text-white/45 hover:text-white"}`}
                >
                  <strong className="text-[11px]">{dockOption.key}</strong>
                  <span className="truncate leading-tight">{dockOption.label}</span>
                </Link>
              ))}
            </div>
          </nav>
          <section
            data-review-summary
            aria-labelledby="prototype-review-summary-title"
            className="w-full border-t border-white/8 pt-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/38">
                  Selected review
                </p>
                <h2 id="prototype-review-summary-title" className="mt-1 text-[13px] font-semibold text-white">
                  {frame.label} · {variant} {option.label} + {dock} {dockOption.label}
                </h2>
              </div>
              <span className="text-[10px] text-white/42">
                Frame {reviewFrame.ordinal} of {APP_DOCK_REVIEW_FRAMES.length} · {reviewComponents.length} component IDs
              </span>
              <span className="text-[10px] text-white/42">
                Sponsored Marketplace {sponsoredMarketplace === "on" ? "visible" : "hidden"}
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-5">
              {reviewComponents.map((component) => (
                <li key={component.key} data-review-id={component.id} className="min-w-0 border-l border-white/10 pl-2.5">
                  <span className="block text-[9px] text-white/38">{component.label}</span>
                  <code className="mt-0.5 block truncate text-[9px] font-semibold text-[hsl(var(--primary-light))]" title={component.id}>
                    {component.id}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div
          data-review-frame-id={reviewFrame.id}
          data-review-variant={reviewFrame.variant}
          data-review-dock={reviewFrame.dock}
          data-review-device={reviewFrame.device}
          data-review-target={targetHref}
          data-sponsored-marketplace={sponsoredMarketplace}
          data-review-dimensions={`${reviewFrame.width}x${reviewFrame.height}`}
          data-review-id={getPrototypeReviewId(variant, device, "SHELL")}
          className={`relative mx-auto bg-[#09080b] shadow-[0_30px_100px_rgba(0,0,0,0.72)] ${
            device === "mobile"
              ? "rounded-[54px] border-[10px] border-[#242127] p-[3px]"
              : device === "tablet"
                ? "rounded-[34px] border-[12px] border-[#2b2930] p-[3px]"
                : "rounded-[18px] border-[8px] border-[#242127] p-[3px]"
          }`}
          style={{ width: `min(${shellWidth}px, calc(100vw - 1.5rem))` }}
        >
          {device === "mobile" ? (
            <>
              <span aria-hidden="true" className="absolute left-1/2 top-[13px] z-20 h-[27px] w-[92px] -translate-x-1/2 rounded-full border border-white/[0.04] bg-black shadow-[0_3px_12px_rgba(0,0,0,0.7)]" />
              <span aria-hidden="true" className="absolute -left-[13px] top-[118px] h-9 w-[4px] rounded-l bg-[#3a363f]" />
              <span aria-hidden="true" className="absolute -left-[13px] top-[170px] h-16 w-[4px] rounded-l bg-[#3a363f]" />
              <span aria-hidden="true" className="absolute -left-[13px] top-[244px] h-16 w-[4px] rounded-l bg-[#3a363f]" />
              <span aria-hidden="true" className="absolute -right-[13px] top-[188px] h-24 w-[4px] rounded-r bg-[#3a363f]" />
            </>
          ) : null}
          {device === "tablet" ? (
            <span aria-hidden="true" className="absolute left-1/2 top-[7px] z-20 size-[7px] -translate-x-1/2 rounded-full bg-[#080709] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />
          ) : null}
          <iframe
            title={`${frame.label} version ${variant} with ${dock} ${dockOption.label} dock`}
            src={targetHref}
            width={frame.width}
            height={frame.height}
            style={{ aspectRatio: `${frame.width} / ${frame.height}`, height: "auto" }}
            className={`block w-full bg-black ${
              device === "mobile"
                ? "rounded-[40px]"
                : device === "tablet"
                  ? "rounded-[20px]"
                  : "rounded-[9px]"
            }`}
          />
          {device !== "desktop" ? (
            <span aria-hidden="true" className="pointer-events-none absolute bottom-[10px] left-1/2 z-20 h-[5px] w-[112px] -translate-x-1/2 rounded-full bg-white/78 shadow-[0_1px_3px_rgba(0,0,0,0.45)]" />
          ) : null}
        </div>
        {device === "desktop" ? (
          <div aria-hidden="true" className="mx-auto flex w-56 flex-col items-center">
            <span className="h-16 w-8 bg-[linear-gradient(90deg,#1b191e,#39353e,#17151a)]" />
            <span className="h-3 w-48 rounded-full bg-[linear-gradient(180deg,#39353e,#151318)] shadow-[0_12px_28px_rgba(0,0,0,0.6)]" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
