// Single source of truth for the admin sidebar + dashboard grouping.
// Add a page here once; the shell nav and the dashboard both read it.

export type AdminNavItem = {
  href: string;
  label: string;
  /** One-line purpose, shown on the dashboard card. */
  blurb: string;
  minimumRole?: "moderator" | "admin";
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", blurb: "Operational snapshot across every admin domain.", minimumRole: "admin" },
    ],
  },
  {
    title: "People & access",
    items: [
      { href: "/admin/users", label: "Users", blurb: "Create users, set tiers/roles, ban, cancel deletion.", minimumRole: "admin" },
      { href: "/admin/organizations", label: "Organizations", blurb: "WorkOS organization records.", minimumRole: "admin" },
      { href: "/admin/invitations", label: "Invitations", blurb: "Outstanding organization invitations.", minimumRole: "admin" },
      { href: "/admin/account-deletion", label: "Account deletion", blurb: "Deletion requests and jobs.", minimumRole: "admin" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/admin/plans", label: "Plans", blurb: "Plans, prices, and entitlements.", minimumRole: "admin" },
      { href: "/admin/subscriptions", label: "Subscriptions", blurb: "Local subscription snapshots.", minimumRole: "admin" },
      { href: "/admin/entitlements", label: "Entitlements", blurb: "Effective entitlement snapshots.", minimumRole: "admin" },
      { href: "/admin/invoices", label: "Invoices", blurb: "Invoice records.", minimumRole: "admin" },
      { href: "/admin/payments", label: "Payments", blurb: "Payments, refunds, credit notes.", minimumRole: "admin" },
      { href: "/admin/billing", label: "Billing customers", blurb: "Billing customer records.", minimumRole: "admin" },
      { href: "/admin/billing-events", label: "Billing events", blurb: "Raw billing event log.", minimumRole: "admin" },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { href: "/admin/reports", label: "Reports", blurb: "User-submitted reports queue." },
      { href: "/admin/dog-ownership", label: "Dog ownership", blurb: "Pending ownership verification claims." },
      { href: "/admin/safety", label: "Trust & safety", blurb: "Safety flags and banned phrases." },
      { href: "/admin/listings", label: "Marketplace review", blurb: "Pending marketplace listings." },
      { href: "/admin/feed", label: "Feed moderation", blurb: "Community feed moderation." },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/admin/support", label: "Support tickets", blurb: "Support ticket queue." },
      { href: "/admin/feedback", label: "Feedback", blurb: "Product feedback submissions." },
      { href: "/admin/bug-reports", label: "Bug reports", blurb: "Reported bugs." },
    ],
  },
  {
    title: "Compliance",
    items: [
      { href: "/admin/compliance", label: "Compliance", blurb: "Consent, terms, marketing preferences.", minimumRole: "admin" },
      { href: "/admin/retention", label: "Retention", blurb: "Retention policies and deletion jobs.", minimumRole: "admin" },
      { href: "/admin/exports", label: "Exports", blurb: "Data export artifacts.", minimumRole: "admin" },
      { href: "/admin/audit", label: "Audit log", blurb: "Immutable audit trail.", minimumRole: "admin" },
      { href: "/admin/actions", label: "Admin actions", blurb: "Admin action history.", minimumRole: "admin" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/jobs", label: "Jobs", blurb: "Usage outbox, webhooks, agent runs.", minimumRole: "admin" },
      { href: "/admin/webhooks", label: "Webhook events", blurb: "Inbound webhook processing.", minimumRole: "admin" },
      { href: "/admin/usage", label: "Usage", blurb: "Usage events and aggregates.", minimumRole: "admin" },
      { href: "/admin/source-health", label: "Source health", blurb: "Data source status.", minimumRole: "admin" },
      { href: "/admin/page-rules", label: "Page rules", blurb: "Custom-page & marketplace fraud gates.", minimumRole: "admin" },
      { href: "/admin/site-content", label: "Site content", blurb: "Edit public pricing page copy & numbers.", minimumRole: "admin" },
      { href: "/admin/bespoke", label: "Bespoke design", blurb: "$500 concierge page-design requests." },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

export function adminHomeForRole(role: string | null | undefined) {
  return role === "admin" ? "/admin" : "/admin/reports";
}

export function adminNavForRole(role: string | null | undefined): AdminNavGroup[] {
  if (role !== "moderator" && role !== "admin") return [];
  const isAdmin = role === "admin";
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.minimumRole !== "admin" || isAdmin
    ),
  })).filter((group) => group.items.length > 0);
}
