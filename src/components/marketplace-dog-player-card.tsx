"use client";

import Link from "next/link";
import {
  Bookmark,
  Check,
  Eye,
  Info,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { resolveMarketplaceCardGesture } from "./marketplace-card-gesture";

export type MarketplaceDogCardArtwork = {
  kind: "image";
  src: string;
  position?: string;
};

export type MarketplaceDogCardData = {
  listingId: string;
  dogId: string;
  name: string;
  colourSex: string;
  starts: number | null;
  wins: number | null;
  seconds?: number | null;
  thirds?: number | null;
  strikeRate?: number | null;
  prizeMoney: string;
  pedigree: string;
  price: string;
  description: string;
  listingLabel: string;
  listingHref: string;
  profileHref: string;
  seller: {
    displayName: string;
    verified: boolean;
    region: string;
    memberSince?: string;
    responseTime?: string;
    history?: string;
  };
};

type PointerOrigin = { x: number; y: number };
type SaveMode = "local" | "account" | "none";

export function MarketplaceDogPlayerCard({
  dog,
  artwork,
  initiallySaved = false,
  saveMode = "local",
  onSavedChange,
  onDismiss,
  className = "",
}: {
  dog: MarketplaceDogCardData;
  artwork: MarketplaceDogCardArtwork;
  initiallySaved?: boolean;
  saveMode?: SaveMode;
  onSavedChange?: (saved: boolean) => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [frontInfoVisible, setFrontInfoVisible] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const pointerOrigin = useRef<PointerOrigin | null>(null);

  async function setListingSaved(nextSaved: boolean) {
    if (saveMode === "none" || saving) return;

    const previous = saved;
    setSaved(nextSaved);
    onSavedChange?.(nextSaved);
    setStatus(nextSaved ? `${dog.name} saved.` : `${dog.name} removed from saved.`);

    if (saveMode === "local") return;

    setSaving(true);
    try {
      const response = await fetch(`/api/listings/${dog.listingId}/save`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Could not update saved listing");
      }
      const persistedSaved = Boolean(data?.item?.saved);
      setSaved(persistedSaved);
      onSavedChange?.(persistedSaved);
      setStatus(
        persistedSaved
          ? `${dog.name} saved to your account.`
          : `${dog.name} removed from your saved listings.`
      );
    } catch (error) {
      setSaved(previous);
      onSavedChange?.(previous);
      setStatus(
        error instanceof Error ? error.message : "Could not update saved listing"
      );
    } finally {
      setSaving(false);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) return;
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic and assistive pointer events can omit an active pointer.
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerOrigin.current) return;
    const gesture = resolveMarketplaceCardGesture({
      deltaX: event.clientX - pointerOrigin.current.x,
      deltaY: event.clientY - pointerOrigin.current.y,
    });
    pointerOrigin.current = null;

    if (gesture === "tap") {
      setFlipped((current) => !current);
      return;
    }
    if (gesture === "save") {
      void setListingSaved(true);
      return;
    }
    if (gesture === "dismiss" && onDismiss) {
      setStatus(`${dog.name} dismissed.`);
      onDismiss();
    }
  }

  const controls = 2 + (saveMode === "none" ? 0 : 1) + (onDismiss ? 1 : 0);

  return (
    <div
      data-marketplace-dog-player-card
      data-card-face={flipped ? "back" : "front"}
      data-front-info={frontInfoVisible ? "visible" : "hidden"}
      className={`min-w-0 ${className}`}
    >
      <div
        className="giq-market-card-stage relative aspect-[5/7] touch-pan-y select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerOrigin.current = null;
        }}
      >
        <div
          className="giq-market-card-flipper absolute inset-0"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <CardFront
            dog={dog}
            artwork={artwork}
            showInfo={frontInfoVisible}
            hidden={flipped}
            onFlip={() => setFlipped(true)}
          />
          <CardBack
            dog={dog}
            artwork={artwork}
            hidden={!flipped}
            onFlip={() => setFlipped(false)}
          />
        </div>
      </div>

      <div
        className="mt-3 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${controls > 3 ? 2 : controls}, minmax(0, 1fr))`,
        }}
      >
        <button
          type="button"
          onClick={() => setFlipped((current) => !current)}
          aria-pressed={flipped}
          className="giq-market-card-control"
          style={{ minHeight: 44 }}
        >
          <RefreshCcw className="size-3.5" aria-hidden="true" />
          {flipped ? "Show front" : "Flip details"}
        </button>
        <button
          type="button"
          onClick={() => setFrontInfoVisible((current) => !current)}
          aria-pressed={frontInfoVisible}
          disabled={flipped}
          className="giq-market-card-control disabled:cursor-not-allowed disabled:opacity-45"
          style={{ minHeight: 44 }}
        >
          <Info className="size-3.5" aria-hidden="true" />
          {frontInfoVisible ? "Hide info" : "Show info"}
        </button>
        {saveMode !== "none" ? (
          <button
            type="button"
            onClick={() => void setListingSaved(!saved)}
            aria-pressed={saved}
            disabled={saving}
            className="giq-market-card-control disabled:cursor-wait disabled:opacity-60"
            style={{ minHeight: 44 }}
          >
            {saved ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <Bookmark className="size-3.5" aria-hidden="true" />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            onClick={() => {
              setStatus(`${dog.name} dismissed.`);
              onDismiss();
            }}
            className="giq-market-card-control"
            style={{ minHeight: 44 }}
          >
            <X className="size-3.5" aria-hidden="true" />
            Dismiss
          </button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

function CardFront({
  dog,
  artwork,
  showInfo,
  hidden,
  onFlip,
}: {
  dog: MarketplaceDogCardData;
  artwork: MarketplaceDogCardArtwork;
  showInfo: boolean;
  hidden: boolean;
  onFlip: () => void;
}) {
  return (
    <article
      aria-label={`${dog.name} marketplace player card front`}
      aria-hidden={hidden}
      className="giq-market-card-face giq-market-card-front absolute inset-0 overflow-hidden rounded-[clamp(18px,5%,28px)] border border-[hsl(var(--secondary)/0.62)] bg-[#050508] shadow-[0_28px_80px_rgba(0,0,0,0.62),0_0_32px_hsl(var(--primary)/0.16)]"
    >
      <div
        role="img"
        aria-label={`${dog.name} listing artwork`}
        className={
          showInfo && artwork.kind === "image"
            ? "absolute inset-x-[3.2%] top-[3.2%] h-[55%] rounded-[clamp(13px,4%,22px)] bg-[#090a0f] bg-no-repeat"
            : showInfo
              ? "absolute inset-0 bg-no-repeat"
              : "absolute inset-[1.6%] rounded-[clamp(14px,4%,24px)] bg-[#050508] bg-no-repeat"
        }
        style={artworkStyle(artwork, "front")}
      />
      {artwork.kind === "image" ? (
        <div
          className={
            showInfo
              ? "absolute inset-x-[3.2%] top-[3.2%] h-[55%] rounded-[clamp(13px,4%,22px)] border border-[hsl(var(--secondary)/0.62)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.05),inset_0_0_28px_rgba(0,0,0,0.32)]"
              : "absolute inset-[1.6%] rounded-[clamp(14px,4%,24px)] border border-[hsl(var(--secondary)/0.48)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
          }
        />
      ) : null}
      {showInfo ? (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,3,8,0.22)_0%,transparent_38%,rgba(3,3,8,0.18)_49%,rgba(3,3,8,0.96)_100%)]" />
          <div className="relative flex h-full flex-col p-[6%]">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full border border-[hsl(var(--secondary)/0.48)] bg-black/72 px-2.5 py-1 text-[clamp(9px,2.4vw,10px)] font-bold uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))] backdrop-blur">
            {dog.listingLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/28 bg-black/72 px-2 py-1 text-[clamp(9px,2.2vw,10px)] font-semibold text-emerald-200 backdrop-blur">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Public stats
          </span>
        </div>

        <div className="mt-auto rounded-[clamp(12px,4%,20px)] border border-white/12 bg-black/88 p-[4%] backdrop-blur-md">
          <div className="min-w-0">
            <h3 className="font-display line-clamp-2 text-[clamp(1.2rem,5.8vw,1.8rem)] uppercase leading-[0.92] text-white">
              {dog.name}
            </h3>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[clamp(10px,2.7vw,11px)] text-white/62">
                {dog.colourSex} · {dog.pedigree}
              </p>
              <strong className="shrink-0 text-[clamp(1rem,5.2vw,1.55rem)] leading-none text-[hsl(var(--secondary-light))]">
                {dog.price}
              </strong>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-1.5 text-center">
            <CardMetric value={formatStat(dog.starts)} label="Starts" />
            <CardMetric value={formatStat(dog.wins)} label="Wins" />
            <CardMetric value={dog.prizeMoney} label="Prize" />
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Link
              href={dog.profileHref}
              tabIndex={hidden ? -1 : 0}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2.5 text-[clamp(10px,2.5vw,11px)] font-semibold text-white/74 transition hover:bg-white/10 hover:text-white"
            >
              <Eye className="size-3" aria-hidden="true" />
              Public profile
            </Link>
            <button
              type="button"
              tabIndex={hidden ? -1 : 0}
              onClick={onFlip}
              className="min-h-11 rounded-full px-2.5 text-[clamp(10px,2.5vw,11px)] font-semibold text-[hsl(var(--primary-light))] hover:bg-white/[0.06] hover:text-white"
            >
              Tap for details
            </button>
          </div>
        </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function CardBack({
  dog,
  artwork,
  hidden,
  onFlip,
}: {
  dog: MarketplaceDogCardData;
  artwork: MarketplaceDogCardArtwork;
  hidden: boolean;
  onFlip: () => void;
}) {
  return (
    <article
      aria-label={`${dog.name} marketplace player card back`}
      aria-hidden={hidden}
      className="giq-market-card-face giq-market-card-back absolute inset-0 overflow-hidden rounded-[clamp(18px,5%,28px)] border border-[hsl(var(--secondary)/0.62)] bg-[#07060b] shadow-[0_28px_80px_rgba(0,0,0,0.62),0_0_32px_hsl(var(--primary)/0.16)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-no-repeat"
        style={artworkStyle(artwork, "back")}
      />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(5,4,10,0.84),rgba(14,8,26,0.72)_48%,rgba(4,4,8,0.94))]" />
      <div className="absolute inset-[3.2%] rounded-[clamp(13px,4%,22px)] border border-[hsl(var(--secondary)/0.38)] shadow-[inset_0_0_42px_rgba(0,0,0,0.52)]" />

      <div className="relative flex h-full flex-col gap-[2.2%] p-[7%] text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[clamp(9px,2.2vw,10px)] font-bold uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">
              Marketplace player card
            </p>
            <h3 className="font-display mt-1 truncate text-[clamp(1.25rem,6vw,1.8rem)] uppercase leading-none">
              {dog.name}
            </h3>
          </div>
          <button
            type="button"
            tabIndex={hidden ? -1 : 0}
            onClick={onFlip}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/12 bg-black/48 text-white/68 hover:bg-white/10 hover:text-white"
            aria-label={`Show the front of ${dog.name}'s card`}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
          </button>
        </div>

        <BackPanel label="Career record">
          <div className="grid grid-cols-5 divide-x divide-white/9 text-center">
            <CardMetric value={formatStat(dog.starts)} label="Starts" />
            <CardMetric value={formatStat(dog.wins)} label="Wins" />
            <CardMetric value={formatStat(dog.seconds)} label="2nd" />
            <CardMetric value={formatStat(dog.thirds)} label="3rd" />
            <CardMetric value={formatRate(dog)} label="Strike" />
          </div>
          <p className="mt-2 text-center text-[clamp(9px,2.5vw,10px)] font-semibold text-[hsl(var(--secondary-light))]">
            Public prize money {dog.prizeMoney}
          </p>
        </BackPanel>

        <BackPanel label="Pedigree and profile">
          <p className="truncate text-[clamp(9px,2.8vw,11px)] font-semibold text-white/82">
            {dog.pedigree}
          </p>
          <p className="mt-1 line-clamp-2 text-[clamp(9px,2.35vw,10px)] leading-relaxed text-white/52">
            {dog.description}
          </p>
        </BackPanel>

        <BackPanel label="Seller">
          <div className="flex items-start gap-2">
            <ShieldCheck
              className={`mt-0.5 size-4 shrink-0 ${dog.seller.verified ? "text-emerald-300" : "text-[hsl(var(--primary-light))]"}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[clamp(9px,2.8vw,11px)] font-semibold text-white/84">
                {dog.seller.displayName} · {dog.seller.verified ? "Verified" : "Community seller"}
              </p>
              <p className="mt-0.5 truncate text-[clamp(9px,2.2vw,10px)] text-white/46">
                {[dog.seller.region, dog.seller.memberSince, dog.seller.responseTime]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {dog.seller.history ? (
                <p className="mt-0.5 truncate text-[clamp(9px,2.2vw,10px)] text-white/46">
                  {dog.seller.history}
                </p>
              ) : null}
            </div>
          </div>
        </BackPanel>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Link
            href={dog.listingHref}
            tabIndex={hidden ? -1 : 0}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-[hsl(var(--primary-light)/0.34)] bg-[hsl(var(--primary)/0.16)] px-2 text-[clamp(10px,2.4vw,11px)] font-semibold text-[hsl(var(--primary-light))] hover:bg-[hsl(var(--primary)/0.28)] hover:text-white"
          >
            <MessageCircle className="size-3" aria-hidden="true" />
            Message seller
          </Link>
          <Link
            href={dog.listingHref}
            tabIndex={hidden ? -1 : 0}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] px-2 text-[clamp(10px,2.4vw,11px)] font-bold text-black hover:brightness-110"
          >
            View full listing
          </Link>
        </div>
        <p className="text-center text-[clamp(9px,1.9vw,10px)] leading-tight text-white/34">
          Public racing data only. Phone and email remain private until you choose to enquire.
        </p>
      </div>
    </article>
  );
}

function BackPanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[clamp(8px,3%,13px)] border border-white/10 bg-black/54 px-[4%] py-[3%] backdrop-blur-sm">
      <p className="mb-1 text-[clamp(9px,2vw,10px)] font-bold uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
        {label}
      </p>
      {children}
    </section>
  );
}

function CardMetric({ value, label }: { value: string; label: string }) {
  return (
    <span className="min-w-0 px-1">
      <strong className="block truncate text-[clamp(10px,2.8vw,11px)] text-white">
        {value}
      </strong>
      <small className="text-[clamp(9px,1.9vw,10px)] uppercase tracking-wide text-white/42">
        {label}
      </small>
    </span>
  );
}

function artworkStyle(
  artwork: MarketplaceDogCardArtwork,
  face: "front" | "back"
): CSSProperties {
  if (face === "front") {
    return {
      backgroundImage: `url(${JSON.stringify(artwork.src)})`,
      backgroundPosition: artwork.position ?? "center",
      backgroundSize: "contain",
    };
  }

  return {
    backgroundImage:
      "radial-gradient(circle at 50% 22%, hsl(var(--primary) / 0.34), transparent 36%), repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 10px)",
    backgroundSize: "auto",
  };
}

function formatStat(value: number | null | undefined) {
  return value == null ? "—" : String(value);
}

function formatRate(dog: MarketplaceDogCardData) {
  if (dog.strikeRate != null) return `${dog.strikeRate.toFixed(1)}%`;
  if (dog.starts && dog.wins != null) {
    return `${((dog.wins / dog.starts) * 100).toFixed(1)}%`;
  }
  return "—";
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("a, button"));
}
