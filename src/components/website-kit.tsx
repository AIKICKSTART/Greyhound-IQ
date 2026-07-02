import type { CSSProperties, ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  accent?: string;
  subtitle?: string;
  children?: ReactNode;
};

export function WebsitePageHeader({
  eyebrow,
  title,
  accent,
  subtitle,
  children,
}: PageHeaderProps) {
  return (
    <section className="giq-website-header relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-12%,hsl(var(--primary)/0.14),transparent_42%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--surface-1)))]"
      />
      <div className="giq-website-header-inner relative mx-auto max-w-[70rem] px-6 pb-5 pt-8 sm:pb-7 sm:pt-11">
        {eyebrow ? (
          <div className="mb-3.5 inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--secondary-light)/0.28)] bg-[hsl(var(--secondary)/0.08)] px-3 py-1.5">
            <span
              aria-hidden="true"
              className="pulse-glow h-1.5 w-1.5 rounded-full bg-[hsl(var(--secondary-light))]"
            />
            <span className="giq-eyebrow text-[hsl(var(--secondary-light))]">
              {eyebrow}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="giq-website-header-title giq-h1-sm">
              {title} {accent ? <span className="gradient-text">{accent}</span> : null}
            </h1>
            {subtitle ? (
              <p className="giq-website-header-subtitle giq-body-lg mt-2.5 max-w-[620px] text-[hsl(var(--muted-foreground))]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {children ? <div className="flex flex-wrap items-center gap-2.5">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

type SectionProps = {
  title?: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WebsiteSection({ title, sub, right, children, className }: SectionProps) {
  return (
    <section className={`mx-auto max-w-[70rem] px-6 pb-10 pt-2 sm:pb-11 sm:pt-4 ${className ?? ""}`}>
      {title || right ? (
        <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
          <div>
            {title ? <h2 className="giq-h3">{title}</h2> : null}
            {sub ? <p className="giq-caption mt-1">{sub}</p> : null}
          </div>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function WebsiteMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="min-w-[120px] flex-1 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <div className="giq-micro">{label}</div>
      <div
        className="giq-mono-lg giq-tabular mt-1"
        style={{ color: tone ?? "hsl(var(--foreground))" }}
      >
        {value}
      </div>
    </div>
  );
}

export function WebsiteShot({
  label,
  ratio = "16/10",
  round = false,
  style,
}: {
  label: string;
  ratio?: CSSProperties["aspectRatio"];
  round?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden border border-[hsl(var(--metal-silver)/0.14)] bg-[repeating-linear-gradient(135deg,hsl(var(--surface-2))_0_11px,hsl(var(--surface-1))_11px_22px)]"
      style={{
        aspectRatio: ratio,
        borderRadius: round ? 999 : 12,
        ...style,
      }}
    >
      <span className="giq-mono-sm px-1.5 text-center tracking-[0.04em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </span>
    </div>
  );
}
