"use client";

import { useCallback, useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PROTOTYPE_VARIANTS,
  type PrototypeVariant,
} from "@/components/prototype-variants";

export type { PrototypeVariant } from "@/components/prototype-variants";

export function PrototypeSwitcher({ current }: { current: PrototypeVariant }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cycle = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = PROTOTYPE_VARIANTS.findIndex(
        (variant) => variant.key === current
      );
      const nextIndex =
        (currentIndex + direction + PROTOTYPE_VARIANTS.length) %
        PROTOTYPE_VARIANTS.length;
      const params = new URLSearchParams(window.location.search);
      params.set("variant", PROTOTYPE_VARIANTS[nextIndex].key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [current, pathname, router]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        cycle(-1);
      }
      if (event.key === "ArrowRight") {
        cycle(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycle]);

  if (process.env.NODE_ENV === "production" || searchParams.get("demo") === "1") {
    return null;
  }

  const active = PROTOTYPE_VARIANTS.find((variant) => variant.key === current)!;

  return (
    <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/90 p-1.5 text-white shadow-2xl backdrop-blur-xl">
      <button
        type="button"
        onClick={() => cycle(-1)}
        aria-label="Previous header prototype"
        className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-[164px] px-2 text-center text-[12px] font-semibold tracking-wide">
        {active.key} · {active.label} / {active.detail}
      </span>
      <button
        type="button"
        onClick={() => cycle(1)}
        aria-label="Next header prototype"
        className="grid size-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
