"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Play } from "lucide-react";

interface RaceReplayPlayerProps {
  streamUrl: string;
  streamContentType?: string | null;
  pageUrl?: string | null;
  title?: string | null;
  trackName: string;
  raceLabel: string;
  raceTimeLabel: string;
}

export function RaceReplayPlayer({
  streamUrl,
  streamContentType,
  pageUrl,
  title,
  trackName,
  raceLabel,
  raceTimeLabel,
}: RaceReplayPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poster = useMemo(
    () =>
      createReplayPoster({
        title: title ?? "GreyhoundIQ Replay",
        trackName,
        raceLabel,
        raceTimeLabel,
      }),
    [raceLabel, raceTimeLabel, title, trackName]
  );

  useEffect(() => {
    if (!activated) return;
    const video = videoRef.current;
    if (!video) return;
    const media = video;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;

    async function attachStream() {
      setLoading(true);
      setError(null);

      try {
        const canPlayNativeHls = Boolean(
          media.canPlayType("application/vnd.apple.mpegurl")
        );
        const isHlsStream =
          streamContentType?.includes("mpegurl") ||
          streamUrl.toLowerCase().includes(".m3u8");

        if (!isHlsStream || canPlayNativeHls) {
          media.src = streamUrl;
          await media.play();
          return;
        }

        const { default: Hls } = await import("hls.js");
        if (cancelled) return;

        if (!Hls.isSupported()) {
          setError("This browser cannot play this replay stream.");
          return;
        }

        const nextHls = new Hls({
          capLevelToPlayerSize: true,
          enableWorker: true,
        });
        hls = nextHls;
        nextHls.loadSource(streamUrl);
        nextHls.attachMedia(media);
        nextHls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) void media.play();
        });
        nextHls.on(Hls.Events.ERROR, (_event, data) => {
          if (isFatalHlsError(data)) {
            setError("Replay stream could not be loaded. Try the source page.");
          }
        });
      } catch {
        if (!cancelled) {
          setError("Replay stream could not be started. Try the source page.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void attachStream();

    return () => {
      cancelled = true;
      hls?.destroy();
      media.pause();
      media.removeAttribute("src");
      media.load();
    };
  }, [activated, streamContentType, streamUrl]);

  return (
    <section className="race-panel overflow-hidden">
      <div className="relative aspect-video bg-[hsl(var(--surface-1))]">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          controls={activated}
          playsInline
          poster={poster}
          preload="metadata"
        />

        {!activated && (
          <button
            type="button"
            className="absolute inset-0 isolate flex items-center justify-center overflow-hidden text-left"
            onClick={() => setActivated(true)}
            aria-label={`Play ${raceLabel} replay at ${trackName}`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${poster}")` }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.05),hsl(var(--background)/0.62))]"
            />
            <span className="relative flex flex-col items-center gap-4 px-6 text-center">
              <span className="grid h-20 w-20 place-items-center rounded-full border border-white/30 bg-[hsl(var(--secondary)/0.92)] text-white shadow-[0_22px_60px_hsl(var(--secondary)/0.28),inset_0_1px_0_hsl(0_0%_100%/0.34)] transition-transform hover:scale-105">
                <Play className="ml-1 h-9 w-9 fill-current" />
              </span>
              <span className="rounded-md border border-white/15 bg-black/45 px-4 py-2 text-[12px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md">
                Click play to watch replay
              </span>
            </span>
          </button>
        )}

        {loading && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/60 px-4 py-3 text-[12px] font-semibold text-white backdrop-blur-md">
            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary-light))]" />
            Loading replay stream
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="program-label">Race replay</p>
          <h2 className="mt-1 text-[16px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.02em]">
            {raceLabel} at {trackName}
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            {raceTimeLabel}
          </p>
        </div>
        {pageUrl && (
          <a
            href={pageUrl}
            target="_blank"
            rel="noreferrer"
            className="giq-button giq-button-glass min-h-10 px-4 text-[12px] font-semibold"
          >
            Source page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 border-t border-[hsl(var(--secondary)/0.18)] bg-[hsl(var(--secondary)/0.08)] px-4 py-3 text-[12px] text-[hsl(var(--secondary-light))]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

function createReplayPoster({
  title,
  trackName,
  raceLabel,
  raceTimeLabel,
}: {
  title: string;
  trackName: string;
  raceLabel: string;
  raceTimeLabel: string;
}) {
  const safeTitle = svgText(title).slice(0, 48);
  const safeTrack = svgText(trackName).slice(0, 34);
  const safeRace = svgText(raceLabel).slice(0, 24);
  const safeTime = svgText(raceTimeLabel).slice(0, 34);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#08050B"/>
      <stop offset="0.52" stop-color="#17111E"/>
      <stop offset="1" stop-color="#050407"/>
    </linearGradient>
    <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8F2CC8" stop-opacity="0.08"/>
      <stop offset="0.52" stop-color="#B95CFF" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#D5A63B" stop-opacity="0.34"/>
    </linearGradient>
    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <path d="M-40 600 C240 495 430 502 700 582 C930 650 1086 620 1320 504" fill="none" stroke="url(#rail)" stroke-width="70" opacity="0.72"/>
  <path d="M-70 627 C232 522 426 530 698 608 C936 676 1092 646 1340 528" fill="none" stroke="#E8E4DB" stroke-width="5" opacity="0.24"/>
  <path d="M-90 656 C225 550 424 558 696 634 C942 704 1098 674 1360 552" fill="none" stroke="#B95CFF" stroke-width="7" opacity="0.34"/>
  <g opacity="0.18">
    <path d="M135 0 L650 720" stroke="#FFFFFF" stroke-width="2"/>
    <path d="M235 0 L750 720" stroke="#FFFFFF" stroke-width="2"/>
    <path d="M335 0 L850 720" stroke="#FFFFFF" stroke-width="2"/>
    <path d="M435 0 L950 720" stroke="#FFFFFF" stroke-width="2"/>
    <path d="M535 0 L1050 720" stroke="#FFFFFF" stroke-width="2"/>
  </g>
  <rect x="54" y="52" width="1172" height="616" rx="34" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="2"/>
  <rect x="54" y="52" width="1172" height="7" rx="3.5" fill="#D5A63B" opacity="0.78"/>
  <rect x="348" y="234" width="584" height="250" rx="32" fill="#000000" opacity="0.44" filter="url(#softShadow)"/>
  <circle cx="640" cy="360" r="104" fill="#D5A63B" opacity="0.94" filter="url(#softShadow)"/>
  <circle cx="640" cy="360" r="104" fill="none" stroke="#FFFFFF" stroke-opacity="0.34" stroke-width="3"/>
  <path d="M612 306 L612 414 L704 360 Z" fill="#FFFFFF"/>
  <text x="86" y="122" fill="#B95CFF" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" letter-spacing="7">GREYHOUNDIQ REPLAY</text>
  <text x="86" y="184" fill="#F6F0E5" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="900" letter-spacing="-1">${safeRace}</text>
  <text x="86" y="238" fill="#B8B1AA" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${safeTrack}</text>
  <text x="86" y="286" fill="#D5A63B" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800">${safeTime}</text>
  <text x="640" y="535" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" letter-spacing="5">CLICK PLAY</text>
  <text x="640" y="572" text-anchor="middle" fill="#B8B1AA" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">${safeTitle}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function svgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isFatalHlsError(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "fatal" in value &&
    Boolean(value.fatal)
  );
}
