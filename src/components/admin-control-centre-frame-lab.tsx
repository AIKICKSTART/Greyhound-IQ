"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

export const ADMIN_DEVICE_FRAMES = [
  { key: "desktop", label: "Desktop", width: 1440, height: 1000, scale: 0.7 },
  { key: "tablet", label: "Tablet", width: 834, height: 1112, scale: 0.62 },
  { key: "mobile", label: "Mobile", width: 390, height: 844, scale: 0.86 },
] as const;

export function AdminControlCentreFrameLab() {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedKey, setSelectedKey] = useState<
    (typeof ADMIN_DEVICE_FRAMES)[number]["key"]
  >(ADMIN_DEVICE_FRAMES[0].key);
  const [loadingKey, setLoadingKey] = useState<string | null>(
    ADMIN_DEVICE_FRAMES[0].key
  );
  const frame =
    ADMIN_DEVICE_FRAMES.find((candidate) => candidate.key === selectedKey) ??
    ADMIN_DEVICE_FRAMES[0];

  function selectFrame(key: (typeof ADMIN_DEVICE_FRAMES)[number]["key"]) {
    if (key === frame.key) return;
    setLoadingKey(key);
    setSelectedKey(key);
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div aria-label="Control Centre viewport" className="flex flex-wrap gap-2" role="tablist">
          {ADMIN_DEVICE_FRAMES.map((candidate, index) => (
            <button
              aria-controls="admin-control-centre-frame-panel"
              aria-selected={candidate.key === frame.key}
              className={
                candidate.key === frame.key
                  ? "giq-button min-h-11 px-4 text-sm font-semibold"
                  : "giq-outline-action min-h-11 px-4 text-sm font-semibold"
              }
              id={`admin-control-centre-${candidate.key}-tab`}
              key={candidate.key}
              onClick={() => selectFrame(candidate.key)}
              onKeyDown={(event) => {
                const lastIndex = ADMIN_DEVICE_FRAMES.length - 1;
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (index + 1) % ADMIN_DEVICE_FRAMES.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + ADMIN_DEVICE_FRAMES.length) %
                        ADMIN_DEVICE_FRAMES.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? lastIndex
                          : null;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextFrame = ADMIN_DEVICE_FRAMES[nextIndex];
                selectFrame(nextFrame.key);
                tabRefs.current[nextIndex]?.focus();
              }}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={candidate.key === frame.key ? 0 : -1}
              type="button"
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
          {frame.width} × {frame.height}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl bg-black/35 p-3">
        <div
          aria-labelledby={`admin-control-centre-${frame.key}-tab`}
          aria-busy={loadingKey === frame.key}
          className="relative overflow-hidden rounded-lg border border-white/15 bg-[hsl(var(--background))]"
          id="admin-control-centre-frame-panel"
          role="tabpanel"
          style={{
            height: frame.height * frame.scale,
            width: frame.width * frame.scale,
          }}
        >
          <iframe
            className="block origin-top-left border-0 bg-[hsl(var(--background))]"
            height={frame.height}
            key={frame.key}
            onLoad={() => setLoadingKey(null)}
            referrerPolicy="same-origin"
            src="/admin"
            style={{ transform: `scale(${frame.scale})` }}
            title={`${frame.label} interactive Control Centre`}
            width={frame.width}
          />
          {loadingKey === frame.key ? (
            <div
              className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.14),transparent_34%),hsl(var(--background)/0.96)]"
              role="status"
            >
              <span className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-[hsl(var(--muted-foreground))] shadow-xl shadow-black/20">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin text-[hsl(var(--primary-light))]"
                />
                Loading {frame.label} Control Centre
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
