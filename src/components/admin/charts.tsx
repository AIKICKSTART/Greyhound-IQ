// Pure-SVG/CSS chart primitives for admin reporting. Server components, no
// dependencies. Color flows from the parent via currentColor so callers pick
// the accent with a text-* class.

const SPARK_WIDTH = 200;

export function Sparkline({
  values,
  height = 44,
  className,
}: {
  values: number[];
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return null;
  }
  const max = Math.max(...values, 1);
  const step = SPARK_WIDTH / (values.length - 1);
  const points = values.map((value, i) => [
    i * step,
    height - 3 - (value / max) * (height - 6),
  ]);
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${SPARK_WIDTH} ${height} L0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} fill="currentColor" fillOpacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type BarListItem = {
  label: string;
  value: number;
};

export function BarList({
  items,
  formatValue,
  barClassName = "bg-[hsl(var(--primary))]",
}: {
  items: BarListItem[];
  formatValue?: (value: number) => string;
  barClassName?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
        No data yet.
      </p>
    );
  }
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-[hsl(var(--muted-foreground))]">
              {item.label}
            </span>
            <span className="font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {formatValue
                ? formatValue(item.value)
                : item.value.toLocaleString("en-AU")}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${barClassName}`}
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
