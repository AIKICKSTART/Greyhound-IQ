import { ArrowLeft, CheckCircle2, Clock, LifeBuoy, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/page-hero";
import { requireCurrentUserProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account support - GreyhoundIQ",
  description: "Review your GreyhoundIQ support tickets.",
};

const PANEL_CLASS = "giq-panel p-6";
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
  searchParams: Promise<{ ticket?: string | string[] }>;
};

export default async function AccountSupportPage({
  searchParams,
}: AccountSupportPageProps) {
  const current = await requireSupportProfile();
  const ticketCreated = (await searchParams).ticket === "created";
  const tickets = await getSupportTicketsForUser(current.dbUserId);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Account
            <br />
            <span className="gradient-text">support.</span>
          </>
        }
        subtitle="Your current GreyhoundIQ support ticket history."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/account" className={`${ACTION_CLASS} w-fit`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to account
          </Link>
          <Link
            href="/contact"
            className="giq-liquid-purple-button min-h-10 px-4 text-[13px] font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Create ticket
          </Link>
        </div>

        {ticketCreated && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.08)] p-3 text-[13px] text-[hsl(var(--foreground))]">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
            Your support ticket has been created.
          </div>
        )}

        <section className={PANEL_CLASS}>
          <div className="mb-5 flex items-center gap-3">
            <LifeBuoy className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              Support tickets
            </h2>
          </div>

          {tickets.length > 0 ? (
            <TicketList tickets={tickets} />
          ) : (
            <EmptyState />
          )}
        </section>
      </section>
    </div>
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

function getSupportTicketsForUser(userId: string) {
  return safeQuery<SupportTicketSummary[]>(
    () =>
      prisma.supportTicket.findMany({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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
      }),
    []
  );
}

function TicketList({ tickets }: { tickets: SupportTicketSummary[] }) {
  return (
    <div className="grid gap-3">
      {tickets.map((ticket) => (
        <article key={ticket.id} className="giq-subpanel p-4">
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
      <Clock className="h-3.5 w-3.5" />
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
    <div className="giq-dashed-panel p-5">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        <MessageSquare className="h-4 w-4" />
      </div>
      <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        No support tickets yet
      </h3>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        Tickets you create from the contact page will appear here without
        exposing support message contents.
      </p>
      <Link
        href="/contact"
        className={`${ACTION_CLASS} mt-4 w-fit`}
      >
        <Plus className="h-3.5 w-3.5" />
        Create ticket
      </Link>
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
