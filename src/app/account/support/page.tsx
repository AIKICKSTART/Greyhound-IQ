import { ArrowLeft, CheckCircle2, Clock, LifeBuoy, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountSupportHelpCentre } from "@/components/account-support-help-centre";
import { PageTitle } from "@/components/page-title";
import { requireCurrentUserProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account support - GreyhoundIQ",
  description: "Review your GreyhoundIQ support tickets.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS = "giq-outline-action";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});

type SupportTicketSummary = {
  id: string;
  category: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
  };
};

type AccountSupportPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    ticket?: string | string[];
  }>;
};

export default async function AccountSupportPage({
  searchParams,
}: AccountSupportPageProps) {
  const current = await requireSupportProfile();
  const query = await searchParams;
  const ticketCreated = query.ticket === "created";
  const tickets = await getSupportTicketsForUser(current);

  return (
    <div>
      <SupportMemberHeader />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {ticketCreated ? (
          <div
            role="status"
            aria-live="polite"
            className="giq-panel mb-6 flex items-start gap-3 border border-[hsl(var(--primary)/0.28)] p-4 text-[13px] text-[hsl(var(--foreground))]"
          >
            <span className="giq-icon-plate flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <CheckCircle2
                className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
            </span>
            <div>
              <p className="font-semibold">Your support ticket has been created.</p>
              <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                The support team can now review it, and its latest status will appear below.
              </p>
            </div>
          </div>
        ) : null}

        <AccountSupportHelpCentre
          profileScope={current.profileId}
          query={query.q}
          role={current.role}
        />

        <section className={PANEL_CLASS}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LifeBuoy
                className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                Support tickets
              </h2>
            </div>
            <span className="giq-status-pill">
              {tickets === null
                ? "Unavailable"
                : `${tickets.length.toLocaleString("en-AU")} total`}
            </span>
          </div>

          {tickets === null ? (
            <UnavailableState />
          ) : tickets.length > 0 ? (
            <TicketList tickets={tickets} />
          ) : (
            <EmptyState />
          )}
        </section>
      </section>
    </div>
  );
}

function SupportMemberHeader() {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member settings</p>
          <PageTitle className="mt-2">
            Support
          </PageTitle>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Review your support history or create a new ticket.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/account" className={`${ACTION_CLASS} w-full sm:w-auto`}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to account
          </Link>
          <Link
            href="/contact"
            className="giq-liquid-purple-button w-full px-4 text-[13px] font-semibold sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create ticket
          </Link>
        </div>
      </div>
    </header>
  );
}

async function requireSupportProfile() {
  try {
    return await requireCurrentUserProfile();
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

function getSupportTicketsForUser(current: CurrentUserProfile) {
  return safeQuery<SupportTicketSummary[] | null>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.supportTicket.findMany({
          where: { userId: current.dbUserId },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 100,
          select: {
            id: true,
            category: true,
            status: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                messages: true,
              },
            },
          },
        })
      ),
    null
  );
}

function TicketList({ tickets }: { tickets: SupportTicketSummary[] }) {
  return (
    <div className="grid gap-3">
      {tickets.map((ticket) => (
        <article
          key={ticket.id}
          className="giq-subpanel p-4 sm:p-5 [content-visibility:auto] [contain-intrinsic-size:auto_180px]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Ticket
              </p>
              <h3 className="mt-1 text-[18px] font-semibold text-[hsl(var(--foreground))]">
                {formatLabel(ticket.category)} support ticket
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill value={ticket.status} />
              <span className="giq-status-pill giq-status-pill-purple">
                {formatLabel(ticket.priority)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TicketMetric label="Category" value={formatLabel(ticket.category)} />
            <TicketMetric
              label="Messages"
              value={formatMessageCount(ticket._count.messages)}
            />
            <TicketMetric label="Created" value={formatDateTime(ticket.createdAt)} />
            <TicketMetric label="Updated" value={formatDateTime(ticket.updatedAt)} />
          </div>
          <Link
            href={`/account/support/${ticket.id}`}
            className={`${ACTION_CLASS} mt-4 w-full sm:w-fit`}
          >
            View ticket
          </Link>
        </article>
      ))}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase();
  const tone =
    normalized === "open" || normalized === "pending"
      ? "giq-status-pill-gold"
      : "giq-status-pill-purple";

  return (
    <span className={`giq-status-pill ${tone}`}>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {formatLabel(value)}
    </span>
  );
}

function TicketMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="giq-dashed-panel px-5 py-10 text-center sm:px-8">
      <div className="giq-icon-plate mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        No support tickets yet
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
        Tickets you create from the contact page will appear here without
        exposing support message contents.
      </p>
      <Link
        href="/contact"
        className={`${ACTION_CLASS} mt-5 w-full sm:w-fit`}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Create ticket
      </Link>
    </div>
  );
}

function UnavailableState() {
  return (
    <div
      className="giq-dashed-panel px-5 py-10 text-center sm:px-8"
      role="status"
    >
      <div className="giq-icon-plate mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
        <LifeBuoy className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        Support history is temporarily unavailable
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
        Your tickets have not been removed. Refresh this page in a moment to
        try again.
      </p>
    </div>
  );
}

function formatDateTime(date: Date) {
  return DATE_TIME_FORMATTER.format(date);
}

function formatMessageCount(value: number) {
  return `${value.toLocaleString("en-AU")} ${value === 1 ? "message" : "messages"}`;
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const clipped = cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}
