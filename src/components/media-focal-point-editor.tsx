"use client";

import Image from "next/image";
import { Move, RotateCcw } from "lucide-react";
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
}: MediaFocalPointEditorProps) {
  const [x, setX] = useState(() => clampFocalPoint(defaultX));
  const [y, setY] = useState(() => clampFocalPoint(defaultY));
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
        className={
          shape === "circle" ? "mx-auto w-full max-w-[300px]" : "w-full"
        }
      >
        <div
          ref={frameRef}
          aria-describedby={instructionId}
          className={`relative cursor-grab touch-none select-none overflow-hidden border border-white/[0.12] bg-black shadow-[0_20px_50px_rgba(0,0,0,0.32)] active:cursor-grabbing focus-within:ring-2 focus-within:ring-[hsl(var(--primary-bright))] ${
            shape === "circle"
              ? "aspect-square rounded-full"
              : "aspect-[16/7] rounded-2xl sm:aspect-[16/5]"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onLostPointerCapture={() => {
            dragRef.current = null;
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
            style={{ objectPosition: position }}
          />
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

      <button
        type="button"
        onClick={() => {
          setX(0.5);
          setY(0.5);
        }}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-[12px] font-semibold text-[hsl(var(--foreground))] transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Center image
      </button>
    </div>
  );
}
