"use client";

import Image from "next/image";
import { Monitor, Move, RotateCcw, RotateCw, Smartphone } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type MediaFocalPointEditorProps = {
  src: string;
  alt: string;
  shape: "circle" | "banner";
  xName: string;
  yName: string;
  defaultX?: number;
  defaultY?: number;
  zoomName?: string;
  rotationName?: string;
  defaultZoom?: number;
  defaultRotation?: number;
};

export function clampFocalPoint(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function focalPointAfterDrag(
  start: number,
  deltaPixels: number,
  overflowPixels: number,
) {
  if (!Number.isFinite(overflowPixels) || overflowPixels <= 0) {
    return clampFocalPoint(start);
  }
  return clampFocalPoint(start - deltaPixels / overflowPixels);
}

export function MediaFocalPointEditor({
  src,
  alt,
  shape,
  xName,
  yName,
  defaultX = 0.5,
  defaultY = 0.5,
  zoomName,
  rotationName,
  defaultZoom = 1,
  defaultRotation = 0,
}: MediaFocalPointEditorProps) {
  const [x, setX] = useState(() => clampFocalPoint(defaultX));
  const [y, setY] = useState(() => clampFocalPoint(defaultY));
  const [zoom, setZoom] = useState(() => Math.min(3, Math.max(1, defaultZoom)));
  const [rotation, setRotation] = useState(() => normalizeRotation(defaultRotation));
  const [preview, setPreview] = useState<"desktop" | "mobile">("desktop");
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    clientX: number;
    clientY: number;
    overflowX: number;
    overflowY: number;
    x: number;
    y: number;
  } | null>(null);
  const id = useId();
  const label = shape === "circle" ? "Profile picture" : "Banner";

  function imageOverflow() {
    const frame = frameRef.current;
    const image = frame?.querySelector("img");
    if (!frame || !image?.naturalWidth || !image.naturalHeight) {
      return { x: 0, y: 0 };
    }
    const rect = frame.getBoundingClientRect();
    const scale = Math.max(
      rect.width / image.naturalWidth,
      rect.height / image.naturalHeight,
    );
    return {
      x: Math.max(0, image.naturalWidth * scale - rect.width),
      y: Math.max(0, image.naturalHeight * scale - rect.height),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const overflow = imageOverflow();
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      overflowX: overflow.x,
      overflowY: overflow.y,
      x,
      y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setX(
      focalPointAfterDrag(
        drag.x,
        event.clientX - drag.clientX,
        drag.overflowX,
      ),
    );
    setY(
      focalPointAfterDrag(
        drag.y,
        event.clientY - drag.clientY,
        drag.overflowY,
      ),
    );
  }

  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function rotate(delta: number) {
    setRotation((current) => normalizeRotation(current + delta));
  }

  const position = `${x * 100}% ${y * 100}%`;
  const instructionId = `${id}-instruction`;
  const horizontalId = `${id}-horizontal`;
  const verticalId = `${id}-vertical`;

  return (
    <div
      className="space-y-4"
      role="group"
      aria-label={`${label} alignment`}
    >
      <div
        className={shape === "circle"
          ? "mx-auto w-full max-w-[300px]"
          : preview === "mobile"
            ? "mx-auto w-full max-w-[430px]"
            : "w-full"}
      >
        <div
          ref={frameRef}
          tabIndex={0}
          role="application"
          aria-label={`${label} drag area. Use arrow keys to reposition.`}
          aria-describedby={instructionId}
          className={`relative cursor-grab touch-none select-none overflow-hidden border border-white/[0.12] bg-black shadow-[0_20px_50px_rgba(0,0,0,0.32)] active:cursor-grabbing focus-within:ring-2 focus-within:ring-[hsl(var(--primary-bright))] ${
            shape === "circle"
              ? "aspect-square rounded-full"
              : preview === "mobile"
                ? "aspect-[4/3] rounded-2xl"
                : "aspect-[16/7] rounded-2xl sm:aspect-[16/5]"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onLostPointerCapture={() => {
            dragRef.current = null;
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.05 : 0.01;
            if (event.key === "ArrowLeft") setX((value) => clampFocalPoint(value - step));
            else if (event.key === "ArrowRight") setX((value) => clampFocalPoint(value + step));
            else if (event.key === "ArrowUp") setY((value) => clampFocalPoint(value - step));
            else if (event.key === "ArrowDown") setY((value) => clampFocalPoint(value + step));
            else return;
            event.preventDefault();
          }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            draggable={false}
            unoptimized={
              src.startsWith("/api/media/") || src.startsWith("blob:")
            }
            sizes={
              shape === "circle"
                ? "300px"
                : "(max-width: 768px) 100vw, 1024px"
            }
            className="pointer-events-none object-cover"
            style={{
              objectPosition: position,
              transform: `rotate(${rotation}deg) scale(${zoom})`,
            }}
          />
          {shape === "banner" ? (
            <div className="pointer-events-none absolute inset-3 border border-dashed border-white/45 sm:inset-x-[10%]">
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-white/80">
                {preview === "mobile" ? "Mobile safe zone" : "Desktop safe zone"}
              </span>
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
          <p
            id={instructionId}
            className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 text-center text-[12px] font-semibold text-white drop-shadow-md"
          >
            <Move className="h-4 w-4" aria-hidden="true" />
            Drag to reposition
          </p>
        </div>
      </div>

      {shape === "banner" ? (
        <div className="flex justify-center gap-2" aria-label="Preview size">
          <button
            type="button"
            aria-pressed={preview === "desktop"}
            onClick={() => setPreview("desktop")}
            className={`giq-outline-action min-h-11 px-3 text-[12px] ${preview === "desktop" ? "border-[hsl(var(--primary-light)/0.6)] bg-[hsl(var(--primary)/0.18)]" : ""}`}
          >
            <Monitor className="h-4 w-4" aria-hidden="true" /> Desktop
          </button>
          <button
            type="button"
            aria-pressed={preview === "mobile"}
            onClick={() => setPreview("mobile")}
            className={`giq-outline-action min-h-11 px-3 text-[12px] ${preview === "mobile" ? "border-[hsl(var(--primary-light)/0.6)] bg-[hsl(var(--primary)/0.18)]" : ""}`}
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" /> Mobile
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label
          htmlFor={horizontalId}
          className="text-[12px] font-semibold text-[hsl(var(--muted-foreground))]"
        >
          <span className="flex items-center justify-between gap-3">
            Horizontal position
            <output className="tabular-nums text-[hsl(var(--foreground))]">
              {Math.round(x * 100)}%
            </output>
          </span>
          <input
            id={horizontalId}
            type="range"
            name={xName}
            min="0"
            max="1"
            step="0.01"
            value={x}
            onChange={(event) =>
              setX(clampFocalPoint(event.currentTarget.valueAsNumber))
            }
            className="mt-1 min-h-11 w-full cursor-pointer accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
          />
        </label>

        <label
          htmlFor={verticalId}
          className="text-[12px] font-semibold text-[hsl(var(--muted-foreground))]"
        >
          <span className="flex items-center justify-between gap-3">
            Vertical position
            <output className="tabular-nums text-[hsl(var(--foreground))]">
              {Math.round(y * 100)}%
            </output>
          </span>
          <input
            id={verticalId}
            type="range"
            name={yName}
            min="0"
            max="1"
            step="0.01"
            value={y}
            onChange={(event) =>
              setY(clampFocalPoint(event.currentTarget.valueAsNumber))
            }
            className="mt-1 min-h-11 w-full cursor-pointer accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
          />
        </label>
      </div>

      {zoomName ? (
        <label className="block text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center justify-between gap-3">
            Zoom
            <output className="tabular-nums text-[hsl(var(--foreground))]">
              {Math.round(zoom * 100)}%
            </output>
          </span>
          <input
            type="range"
            name={zoomName}
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => setZoom(event.currentTarget.valueAsNumber)}
            className="mt-1 min-h-11 w-full cursor-pointer accent-[hsl(var(--secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
          />
        </label>
      ) : null}

      {rotationName ? (
        <div className="flex flex-wrap items-center gap-2">
          <input type="hidden" name={rotationName} value={rotation} />
          <button type="button" onClick={() => rotate(-90)} className="giq-outline-action min-h-11 px-3 text-[12px]">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Rotate left
          </button>
          <button type="button" onClick={() => rotate(90)} className="giq-outline-action min-h-11 px-3 text-[12px]">
            <RotateCw className="h-4 w-4" aria-hidden="true" /> Rotate right
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setX(0.5);
          setY(0.5);
          setZoom(1);
          setRotation(0);
        }}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-[12px] font-semibold text-[hsl(var(--foreground))] transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reset image
      </button>
    </div>
  );
}

export function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}
