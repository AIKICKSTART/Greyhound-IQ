// Single source of truth for the admin sidebar + dashboard grouping.
// Add a page here once; the shell nav and the dashboard both read it.

export type AdminNavItem = {
  href: string;
  label: string;
  /** One-line purpose, shown on the dashboard card. */
  blurb: string;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", blurb: "Operational snapshot across every admin domain." },
    ],
  },
  {
    title: "People & access",
    items: [
      { href: "/admin/users", label: "Users", blurb: "Create users, set tiers/roles, ban, cancel deletion." },
      { href: "/admin/organizations", label: "Organizations", blurb: "WorkOS organization records." },
      { href: "/admin/invitations", label: "Invitations", blurb: "Outstanding organization invitations." },
      { href: "/admin/account-deletion", label: "Account deletion", blurb: "Deletion requests and jobs." },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/admin/plans", label: "Plans", blurb: "Plans, prices, and entitlements." },
      { href: "/admin/subscriptions", label: "Subscriptions", blurb: "Local subscription snapshots." },
      { href: "/admin/entitlements", label: "Entitlements", blurb: "Effective entitlement snapshots." },
      { href: "/admin/invoices", label: "Invoices", blurb: "Invoice records." },
      { href: "/admin/payments", label: "Payments", blurb: "Payments, refunds, credit notes." },
      { href: "/admin/billing", label: "Billing customers", blurb: "Billing customer records." },
      { href: "/admin/billing-events", label: "Billing events", blurb: "Raw billing event log." },
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
      { href: "/admin/compliance", label: "Compliance", blurb: "Consent, terms, marketing preferences." },
      { href: "/admin/retention", label: "Retention", blurb: "Retention policies and deletion jobs." },
      { href: "/admin/exports", label: "Exports", blurb: "Data export artifacts." },
      { href: "/admin/audit", label: "Audit log", blurb: "Immutable audit trail." },
      { href: "/admin/actions", label: "Admin actions", blurb: "Admin action history." },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/jobs", label: "Jobs", blurb: "Usage outbox, webhooks, agent runs." },
      { href: "/admin/webhooks", label: "Webhook events", blurb: "Inbound webhook processing." },
      { href: "/admin/usage", label: "Usage", blurb: "Usage events and aggregates." },
      { href: "/admin/source-health", label: "Source health", blurb: "Data source status." },
      { href: "/admin/page-rules", label: "Page rules", blurb: "Custom-page & marketplace fraud gates." },
      { href: "/admin/site-content", label: "Site content", blurb: "Edit public pricing page copy & numbers." },
      { href: "/admin/bespoke", label: "Bespoke design", blurb: "$500 concierge page-design requests." },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);
