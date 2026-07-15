"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

const REPLAY_POSTER_IMAGE = "/images/greyhoundiq-replay-ready-cover.webp";

interface RaceReplayPlayerProps {
  streamUrl: string;
  streamContentType?: string | null;
  trackName: string;
  raceLabel: string;
  raceTimeLabel: string;
}

export function RaceReplayPlayer({
  streamUrl,
  streamContentType,
  trackName,
  raceLabel,
  raceTimeLabel,
}: RaceReplayPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activated) return;
    const video = videoRef.current;
    if (!video) return;
    const media = video;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    const finishLoading = () => {
      if (!cancelled) setLoading(false);
    };
    media.addEventListener("canplay", finishLoading);
    media.addEventListener("playing", finishLoading);

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
          finishLoading();
          return;
        }

        const { default: Hls } = await import("hls.js");
        if (cancelled) return;

        if (!Hls.isSupported()) {
          setError("This browser cannot play this replay stream.");
          finishLoading();
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
          if (!cancelled) {
            void media.play();
            finishLoading();
          }
        });
        nextHls.on(Hls.Events.ERROR, (_event, data) => {
          if (isFatalHlsError(data)) {
            setError("Replay stream could not be loaded. Try again later.");
            finishLoading();
          }
        });
      } catch {
        if (!cancelled) {
          setError("Replay stream could not be started. Try again later.");
          finishLoading();
        }
      }
    }

    void attachStream();

    return () => {
      cancelled = true;
      hls?.destroy();
      media.removeEventListener("canplay", finishLoading);
      media.removeEventListener("playing", finishLoading);
      media.pause();
      media.removeAttribute("src");
      media.load();
    };
  }, [activated, streamContentType, streamUrl]);

  return (
    <section className="race-panel w-full max-w-full overflow-hidden">
      <div className="relative aspect-video w-full max-w-full bg-[hsl(var(--surface-1))]">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          controls={activated}
          playsInline
          poster={REPLAY_POSTER_IMAGE}
          preload="metadata"
        />

        {!activated && (
          <button
            type="button"
            className="absolute inset-0 isolate flex items-end justify-center overflow-hidden text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[hsl(var(--secondary-light))]"
            onClick={() => setActivated(true)}
            aria-label={`Play ${raceLabel} replay at ${trackName}`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${REPLAY_POSTER_IMAGE}")` }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0),hsl(var(--background)/0.14)_54%,hsl(var(--background)/0.72))]"
            />
            <span className="relative mx-4 mb-4 inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-black/45 px-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_32px_hsl(0_0%_0%/0.34)] backdrop-blur-md transition-transform hover:scale-[1.02] active:scale-[0.99] sm:mb-5 sm:text-[12px] sm:tracking-[0.16em]">
              Tap to start replay
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

      <div className="border-t border-white/[0.07] bg-white/[0.025] p-4">
        <div className="min-w-0">
          <p className="program-label">Race replay</p>
          <h2 className="mt-1 text-[16px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.02em]">
            {raceLabel} at {trackName}
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            {raceTimeLabel}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-[hsl(var(--secondary)/0.18)] bg-[hsl(var(--secondary)/0.08)] px-4 py-3 text-[12px] text-[hsl(var(--secondary-light))]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

function isFatalHlsError(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "fatal" in value &&
    Boolean(value.fatal)
  );
}
