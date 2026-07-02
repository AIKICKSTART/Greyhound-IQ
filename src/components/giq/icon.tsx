import * as React from "react";
import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

import { cn } from "./utils";

type LucideIcon = React.ComponentType<LucideProps>;

const icons = Lucide as unknown as Record<string, LucideIcon | undefined>;

export const GIQ_ICONS = {
  search: icons.Search,
  menu: icons.Menu,
  close: icons.X,
  "chevron-down": icons.ChevronDown,
  "chevron-right": icons.ChevronRight,
  "arrow-right": icons.ArrowRight,
  plus: icons.Plus,
  check: icons.Check,
  filter: icons.Filter,
  settings: icons.Settings,
  bell: icons.Bell,
  user: icons.User,
  users: icons.Users,
  login: icons.LogIn,
  logout: icons.LogOut,
  "external-link": icons.ExternalLink,
  info: icons.Info,
  heart: icons.Heart,
  star: icons.Star,
  crown: icons.Crown,
  sparkles: icons.Sparkles,
  lock: icons.Lock,
  "chart-bar": icons.ChartBar ?? icons.BarChart3,
  "chart-line": icons.ChartLine ?? icons.LineChart,
  "trending-up": icons.TrendingUp,
  target: icons.Target,
  gauge: icons.Gauge,
  activity: icons.Activity,
  pie: icons.PieChart,
  dna: icons.Dna,
  ai: icons.Bot,
  clipboard: icons.ClipboardList,
  shield: icons.ShieldCheck,
  trophy: icons.Trophy,
  dog: icons.Dog,
  flag: icons.Flag,
  clock: icons.Clock,
  ruler: icons.Ruler,
  track: icons.Route,
  temp: icons.Thermometer,
  play: icons.Play,
  bolt: icons.Bolt,
  "map-pin": icons.MapPin,
  calendar: icons.Calendar,
  medal: icons.Medal,
} as const;

export type GiqIconName = keyof typeof GIQ_ICONS;
export type GiqIconFinish = "gold" | "purple" | "carbon";

const finishClasses: Record<GiqIconFinish, string> = {
  gold: "text-[hsl(var(--secondary-light))] drop-shadow-[0_0_10px_hsl(var(--secondary)/0.35)]",
  purple: "text-[hsl(var(--primary-light))] drop-shadow-[0_0_10px_hsl(var(--primary)/0.35)]",
  carbon: "text-[hsl(var(--metal-silver))] drop-shadow-[0_1px_2px_hsl(0_0%_0%/0.6)]",
};

export function Icon({
  name,
  finish,
  className,
  "aria-label": ariaLabel,
  ...props
}: Omit<LucideProps, "name"> & {
  name: GiqIconName;
  finish?: GiqIconFinish;
}) {
  const Component = GIQ_ICONS[name] ?? icons.CircleHelp;
  if (!Component) return null;

  return (
    <Component
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={cn("inline-block shrink-0 align-middle", finish && finishClasses[finish], className)}
      strokeWidth={props.strokeWidth ?? 2}
      {...props}
    />
  );
}
