import Image from "next/image";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/page-title";
import { siteAssetUrl } from "@/lib/storage-paths";

interface PageHeroProps {
  image: string;
  badge?: string;
  badgeIcon?: ReactNode;
  badgeColor?: "primary" | "gold";
  title: ReactNode;
  subtitle: string;
  size?: "default" | "tall";
  children?: ReactNode;
}

const BADGE_COLORS = {
  primary: "giq-badge-purple",
  gold: "giq-badge-gold",
} as const;

export function PageHero({
  image,
  badge,
  badgeIcon,
  badgeColor = "primary",
  title,
  subtitle,
  size = "default",
  children,
}: PageHeroProps) {
  const imageSrc = siteAssetUrl(image);
  const minH = size === "tall" ? "min-h-[620px]" : "min-h-[420px]";
  const py = size === "tall" ? "py-16 md:py-24" : "py-14 md:py-20";
  const mediaClass = "aspect-[16/9]";

  return (
    <section className={`giq-page-hero relative overflow-hidden ${minH} flex items-center`}>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,hsl(var(--primary-bright)/0.10),transparent_34%),radial-gradient(circle_at_18%_88%,hsl(var(--secondary)/0.05),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(270_24%_3%)_100%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 track-rail-overlay" />
      <div aria-hidden="true" className="race-box-strip absolute inset-x-6 bottom-8 mx-auto max-w-7xl opacity-70" />

      <div className={`giq-page-hero-inner giq-hero-split relative mx-auto w-full max-w-7xl px-6 ${py}`}>
        <div className="giq-page-hero-copy max-w-[21rem] sm:max-w-2xl">
          {badge && (
            <div className={`giq-badge mb-5 ${BADGE_COLORS[badgeColor]}`}>
              {badgeIcon}
              <span>{badge}</span>
            </div>
          )}
          <PageTitle
            size={size === "tall" ? "display" : "page"}
            className="giq-page-hero-title"
          >
            {title}
          </PageTitle>
          <p
            className="giq-page-hero-subtitle mt-4 max-w-[21rem] text-base leading-[1.55] text-[hsl(var(--muted-foreground))] sm:max-w-xl md:text-lg"
          >
            {subtitle}
          </p>
          {children}
        </div>

        <div className={`giq-page-hero-media giq-glass-panel relative overflow-hidden rounded-2xl sm:min-h-[260px] ${mediaClass}`}>
          <Image
            src={imageSrc}
            alt=""
            fill
            preload
            fetchPriority="high"
            className="object-contain"
            sizes="(min-width: 1024px) 58vw, 100vw"
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.10]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(180deg,hsl(0_0%_100%/0.12),transparent)]" />
        </div>
      </div>
    </section>
  );
}
