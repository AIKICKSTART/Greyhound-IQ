import {
  Activity,
  Bell,
  Bot,
  CreditCard,
  Dna,
  Home,
  Map,
  MessageSquare,
  Search,
  ShoppingBag,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const NAV_SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Race control",
    links: [
      { href: "/", label: "Home", description: "Today, shortcuts, and platform overview", icon: Home },
      { href: "/races", label: "Races", description: "Live cards, search, filters, and replays", icon: Activity },
      { href: "/results", label: "Results", description: "Recent winners, times, and margins", icon: Trophy },
      { href: "/tracks", label: "Tracks", description: "Australian tracks and meeting history", icon: Map },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { href: "/dogs", label: "Dogs", description: "Profiles, form, trainers, and records", icon: Search },
      { href: "/breeding", label: "Breeding", description: "Pedigree and breeding analysis", icon: Dna },
      { href: "/agents", label: "Agents", description: "AI workflows and racing analysis", icon: Bot },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/marketplace", label: "Marketplace", description: "Verified greyhound marketplace and saved dogs", icon: ShoppingBag },
      { href: "/groups", label: "Groups", description: "Community groups, topics, and threads", icon: Users },
      { href: "/feed", label: "Feed", description: "Personalised racing community updates", icon: MessageSquare },
      { href: "/pulse", label: "Pulse", description: "Private conversations, enquiries, and calls", icon: Bell },
      { href: "/pricing", label: "Pricing", description: "Plans, limits, and Pro access", icon: CreditCard },
    ],
  },
];

export const NAV_LINKS = NAV_SECTIONS.flatMap((section) =>
  section.links.map(({ href, label }) => ({ href, label }))
);

export const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "var(--muted-foreground)" },
  pro: { label: "Pro", color: "var(--primary-bright)" },
  pro_plus: { label: "Pro+", color: "var(--secondary)" },
};

export type HeaderState =
  | { signedIn: false }
  | {
      signedIn: true;
      firstName: string | null;
      name: string;
      email: string;
      tier: string;
      canAccessAdmin: boolean;
      unreadMessages: number;
      unreadNotifications: number;
      profileChannel: string | null;
    };
