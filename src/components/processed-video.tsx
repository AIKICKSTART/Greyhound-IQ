"use client";

import { CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ProcessedVideo({
  playbackUrl,
  hlsUrl,
  posterUrl,
  captionUrl,
  label,
}: {
  playbackUrl: string;
  hlsUrl: string | null;
  posterUrl: string | null;
  captionUrl: string | null;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const usingHlsRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preferMp4, setPreferMp4] = useState(false);

  useEffect(() => {
    const video = ref.current;
    usingHlsRef.current = false;
    if (!video || !hlsUrl || preferMp4) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      usingHlsRef.current = true;
      video.src = hlsUrl;
      video.load();
      return;
    }

    let disposed = false;
    let destroy: (() => void) | null = null;
    void import("hls.js")
      .then(({ default: Hls }) => {
        if (disposed || !Hls.isSupported()) return;
        const hls = new Hls({ enableWorker: true });
        destroy = () => hls.destroy();
        usingHlsRef.current = true;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return;
          hls.destroy();
          usingHlsRef.current = false;
          setPreferMp4(true);
          video.src = playbackUrl;
          video.load();
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
      })
      .catch(() => {
        // The MP4 source below remains the compatibility fallback.
      });

    return () => {
      disposed = true;
      usingHlsRef.current = false;
      destroy?.();
    };
  }, [attempt, hlsUrl, playbackUrl, preferMp4]);

  function retry() {
    const video = ref.current;
    setError(false);
    setLoading(true);
    setAttempt((current) => current + 1);
    if (video) {
      video.src = playbackUrl;
      video.load();
    }
  }

  return (
    <div className="relative grid min-h-[240px] w-full place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-black sm:min-h-[360px]">
      <video
        ref={ref}
        controls
        playsInline
        preload="metadata"
        poster={posterUrl ?? undefined}
        className="max-h-[70vh] min-h-[240px] w-full bg-black object-contain sm:min-h-[360px]"
        aria-label={label}
        onLoadStart={() => setLoading(true)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => {
          setLoading(false);
          setError(false);
        }}
        onPlaying={() => setLoading(false)}
        onError={() => {
          const video = ref.current;
          if (video && usingHlsRef.current) {
            usingHlsRef.current = false;
            setPreferMp4(true);
            setError(false);
            setLoading(true);
            video.src = playbackUrl;
            video.load();
            return;
          }
          setLoading(false);
          setError(true);
        }}
      >
        <source src={playbackUrl} type="video/mp4" />
        {captionUrl && (
          <track
            kind="captions"
            srcLang="en"
            label="English"
            src={captionUrl}
            default
          />
        )}
      </video>

      {loading && !error && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-black/28"
          role="status"
          aria-label="Loading video"
        >
          <Loader2 className="h-7 w-7 animate-spin text-white/80" aria-hidden="true" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/88 p-5 text-center">
          <div>
            <CircleAlert className="mx-auto h-6 w-6 text-amber-200" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-white">
              Video could not be played
            </p>
            <button
              type="button"
              onClick={retry}
              className="giq-button giq-button-glass mt-3 min-h-11 px-4 text-[12px] font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
