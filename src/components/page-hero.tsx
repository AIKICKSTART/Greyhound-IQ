import Image from "next/image";
import type { ReactNode } from "react";

interface PageHeroProps {
  image: string;
  badge?: string;
  badgeIcon?: ReactNode;
  badgeColor?: "green" | "orange";
  title: ReactNode;
  subtitle: string;
  size?: "default" | "tall";
  children?: ReactNode;
}

const BADGE_COLORS = {
  green: "text-[hsl(142_60%_48%)]",
  orange: "text-[hsl(25_95%_53%)]",
} as const;

export function PageHero({
  image,
  badge,
  badgeIcon,
  badgeColor = "green",
  title,
  subtitle,
  size = "default",
  children,
}: PageHeroProps) {
  const minH = size === "tall" ? "min-h-[620px]" : "min-h-[420px]";
  const titleClass =
    size === "tall"
      ? "text-4xl md:text-6xl xl:text-7xl"
      : "text-4xl md:text-5xl";
  const py = size === "tall" ? "py-16 md:py-24" : "py-14 md:py-20";
  const mediaClass = "aspect-[16/9]";

  return (
    <section className={`relative overflow-hidden ${minH} flex items-center`}>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,hsl(142_60%_48%/0.18),transparent_34%),radial-gradient(circle_at_18%_88%,hsl(25_95%_53%/0.10),transparent_30%),linear-gradient(180deg,hsl(150_30%_3%)_0%,hsl(155_28%_5%)_100%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 track-rail-overlay" />
      <div aria-hidden="true" className="race-box-strip absolute inset-x-6 bottom-8 mx-auto max-w-7xl opacity-70" />

      <div className={`relative mx-auto grid w-full max-w-7xl items-center gap-10 px-6 ${py} lg:grid-cols-[0.86fr_1.14fr]`}>
        <div className="max-w-2xl">
          {badge && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 backdrop-blur-sm">
              {badgeIcon}
              <span
                className={`text-[11px] font-semibold uppercase ${BADGE_COLORS[badgeColor]}`}
              >
                {badge}
              </span>
            </div>
          )}
          <h1
            className={`${titleClass} font-semibold leading-[1.05] text-[hsl(210_13%_97%)]`}
          >
            {title}
          </h1>
          <p
            className="mt-4 max-w-xl text-base leading-[1.55] text-[hsl(215_14%_72%)] md:text-lg"
          >
            {subtitle}
          </p>
          {children}
        </div>

        <div className={`relative min-h-[260px] overflow-hidden rounded-2xl border border-white/[0.14] bg-[linear-gradient(180deg,hsl(0_0%_100%/0.08),hsl(0_0%_100%/0.02))] shadow-[0_28px_70px_hsl(0_0%_0%/0.36)] ${mediaClass}`}>
          <Image
            src={image}
            alt=""
            fill
            priority={size === "tall"}
            className="object-contain"
            sizes="(min-width: 1024px) 58vw, 100vw"
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.10]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(180deg,hsl(0_0%_100%/0.12),transparent)]" />
          <div className="pointer-events-none race-box-strip absolute inset-x-6 bottom-5 opacity-70" />
        </div>
      </div>
    </section>
  );
}
