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
  const minH = size === "tall" ? "min-h-[600px]" : "min-h-[380px]";
  const titleClass =
    size === "tall"
      ? "text-5xl md:text-7xl"
      : "text-4xl md:text-5xl";
  const py = size === "tall" ? "py-28" : "py-16";
  return (
    <section className={`relative overflow-hidden ${minH} flex items-center`}>
      <div className="absolute inset-0">
        <Image
          src={image}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(150_30%_3%)] via-[hsl(150_30%_3%/0.7)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(150_30%_3%)] via-transparent to-[hsl(150_30%_3%/0.4)]" />
        <div className="track-rail-overlay absolute inset-x-0 bottom-0 h-32" />
        <div className="race-box-strip absolute inset-x-6 bottom-8 mx-auto max-w-7xl opacity-70" />
      </div>

      <div className={`relative mx-auto max-w-7xl px-6 ${py} w-full`}>
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
      </div>
    </section>
  );
}
